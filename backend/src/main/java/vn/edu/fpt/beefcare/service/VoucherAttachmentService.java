package vn.edu.fpt.beefcare.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.fpt.beefcare.domain.Attachment;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.repository.AttachmentRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.HerdExitVoucherRepository;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/** PDF/JPEG attachments belonging to an entry or exit voucher. */
@Service
public class VoucherAttachmentService {

    public static final long MAX_BYTES = 10L * 1024 * 1024;

    public enum Owner {
        ENTRY(AttachmentOwnerType.HERD_ENTRY_VOUCHER, FarmAction.VIEW_ENTRY_VOUCHERS, FarmAction.MANAGE_ENTRY_VOUCHERS, "entry_voucher_is_not_draft"),
        EXIT(AttachmentOwnerType.HERD_EXIT_VOUCHER, FarmAction.VIEW_EXIT_VOUCHERS, FarmAction.MANAGE_EXIT_VOUCHERS, "exit_voucher_is_not_draft");

        private final AttachmentOwnerType type;
        private final FarmAction viewAction;
        private final FarmAction manageAction;
        private final String notDraftReason;

        Owner(AttachmentOwnerType type, FarmAction viewAction, FarmAction manageAction, String notDraftReason) {
            this.type = type;
            this.viewAction = viewAction;
            this.manageAction = manageAction;
            this.notDraftReason = notDraftReason;
        }
    }

    private final AttachmentRepository attachments;
    private final AttachmentService store;
    private final AttachmentStorage storage;
    private final HerdEntryVoucherRepository entries;
    private final HerdExitVoucherRepository exits;
    private final FarmAccessService access;
    private final AuditService audit;

    public VoucherAttachmentService(
        AttachmentRepository attachments,
        AttachmentService store,
        AttachmentStorage storage,
        HerdEntryVoucherRepository entries,
        HerdExitVoucherRepository exits,
        FarmAccessService access,
        AuditService audit
    ) {
        this.attachments = attachments;
        this.store = store;
        this.storage = storage;
        this.entries = entries;
        this.exits = exits;
        this.access = access;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<AttachmentDTO> list(Long farmId, Owner owner, Long voucherId) {
        access.require(farmId, owner.viewAction);
        status(farmId, owner, voucherId, false);
        return attachments.findByOwnerTypeAndOwnerIdAndFarm_IdAndRemovedAtIsNullOrderByIdAsc(owner.type, voucherId, farmId).stream()
            .map(VoucherAttachmentService::dto)
            .toList();
    }

    @Transactional
    public AttachmentDTO upload(Long farmId, Owner owner, Long voucherId, MultipartFile file) {
        FarmContext context = access.require(farmId, owner.manageAction);
        requireDraft(owner, status(farmId, owner, voucherId, true));
        Upload upload = validate(file);
        Attachment saved = store.store(
            farmId,
            owner.type,
            voucherId,
            upload.bytes,
            upload.contentType,
            upload.extension,
            displayName(file.getOriginalFilename(), upload.extension)
        );
        audit.log(context, "VOUCHER_ATTACH", target(owner), voucherId, Map.of("attachmentId", saved.getId(), "contentType", saved.getContentType(), "fileSize", saved.getFileSize()));
        return dto(saved);
    }

    @Transactional(readOnly = true)
    public StoredDocument read(Long farmId, Owner owner, Long voucherId, Long attachmentId) {
        access.require(farmId, owner.viewAction);
        status(farmId, owner, voucherId, false);
        Attachment attachment = find(farmId, owner, voucherId, attachmentId);
        try {
            return new StoredDocument(attachment.getContentType(), attachment.getOriginalFilename(), storage.open(attachment.getStorageKey()));
        } catch (IOException error) {
            throw new IllegalStateException("Unable to read attachment content", error);
        }
    }

    @Transactional
    public AttachmentDTO remove(Long farmId, Owner owner, Long voucherId, Long attachmentId) {
        FarmContext context = access.require(farmId, owner.manageAction);
        requireDraft(owner, status(farmId, owner, voucherId, true));
        Attachment attachment = find(farmId, owner, voucherId, attachmentId);
        attachment.setRemovedAt(Instant.now());
        audit.log(context, "VOUCHER_DETACH", target(owner), voucherId, Map.of("attachmentId", attachment.getId()));
        return dto(attachment);
    }

    public String requestHash(MultipartFile file, Long voucherId) {
        if (file == null) return digest((voucherId + ":none").getBytes(StandardCharsets.UTF_8));
        try {
            String content = file.getSize() > MAX_BYTES ? "oversize" : digest(file.getBytes());
            return digest((voucherId + ":" + declaredType(file.getContentType()) + ":" + file.getSize() + ":" + content).getBytes(StandardCharsets.UTF_8));
        } catch (IOException error) {
            throw DomainException.invalid("file");
        }
    }

    private String status(Long farmId, Owner owner, Long voucherId, boolean lock) {
        return switch (owner) {
            case ENTRY -> (lock ? entries.lockByIdAndFarmId(farmId, voucherId) : entries.findByIdAndFarmId(voucherId, farmId))
                .map(HerdEntryVoucher::getStatus)
                .map(Enum::name)
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
            case EXIT -> (lock ? exits.lockByIdAndFarmId(farmId, voucherId) : exits.findByIdAndFarmId(voucherId, farmId))
                .map(HerdExitVoucher::getStatus)
                .map(Enum::name)
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        };
    }

    private static void requireDraft(Owner owner, String status) {
        if (!"DRAFT".equals(status)) throw DomainException.conflict(MessageCodes.COM_05, "reason", owner.notDraftReason);
    }

    private Attachment find(Long farmId, Owner owner, Long voucherId, Long attachmentId) {
        return attachments.findByIdAndFarm_Id(attachmentId, farmId)
            .filter(value -> value.getOwnerType() == owner.type && voucherId.equals(value.getOwnerId()) && value.getRemovedAt() == null)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId));
    }

    private static String target(Owner owner) {
        return owner == Owner.ENTRY ? "HerdEntryVoucher" : "HerdExitVoucher";
    }

    private static Upload validate(MultipartFile file) {
        if (file == null || file.isEmpty()) throw DomainException.required("file");
        if (file.getSize() > MAX_BYTES) throw fileProblem(HttpStatus.PAYLOAD_TOO_LARGE, "too_large");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException error) {
            throw DomainException.invalid("file");
        }
        if (bytes.length == 0) throw DomainException.required("file");
        if (bytes.length > MAX_BYTES) throw fileProblem(HttpStatus.PAYLOAD_TOO_LARGE, "too_large");
        boolean jpeg = bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff;
        boolean pdf = bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-';
        if (!jpeg && !pdf) throw fileProblem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "unsupported_type");
        String detected = jpeg ? MediaType.IMAGE_JPEG_VALUE : MediaType.APPLICATION_PDF_VALUE;
        if (!detected.equals(declaredType(file.getContentType()))) throw fileProblem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "content_type_mismatch");
        return new Upload(bytes, detected, jpeg ? ".jpg" : ".pdf");
    }

    private static String declaredType(String contentType) {
        if (contentType == null) return "";
        int parameters = contentType.indexOf(';');
        return (parameters < 0 ? contentType : contentType.substring(0, parameters)).trim().toLowerCase(Locale.ROOT);
    }

    private static DomainException fileProblem(HttpStatus status, String reason) {
        return new DomainException(MessageCodes.COM_10, DomainException.params("field", "file", "reason", reason, "maxBytes", MAX_BYTES), status);
    }

    public static String displayName(String original, String extension) {
        String leaf = original == null ? "" : original.replace('\\', '/');
        leaf = leaf.substring(leaf.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\\u202A-\\u202E\\u2066-\\u2069<>:\"|?*]", "").replaceAll("^\\.+", "").trim();
        if (leaf.isBlank()) leaf = "document";
        String lower = leaf.toLowerCase(Locale.ROOT);
        boolean matches = ".pdf".equals(extension) ? lower.endsWith(".pdf") : lower.endsWith(".jpg") || lower.endsWith(".jpeg");
        if (!matches) leaf += extension;
        if (leaf.length() > 255) {
            String suffix = leaf.substring(leaf.lastIndexOf('.'));
            leaf = leaf.substring(0, 255 - suffix.length()) + suffix;
        }
        return leaf;
    }

    private static AttachmentDTO dto(Attachment attachment) {
        return new AttachmentDTO(attachment.getId(), attachment.getContentType(), attachment.getFileSize(), attachment.getOriginalFilename(), attachment.getCreatedAt());
    }

    private static String digest(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private record Upload(byte[] bytes, String contentType, String extension) {}

    public record StoredDocument(String contentType, String filename, InputStream content) implements AutoCloseable {
        @Override
        public void close() throws IOException {
            content.close();
        }
    }
}
