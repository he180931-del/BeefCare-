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
import vn.edu.fpt.beefcare.domain.FeedReceipt;
import vn.edu.fpt.beefcare.domain.FeedStockAdjustment;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;
import vn.edu.fpt.beefcare.repository.AttachmentRepository;
import vn.edu.fpt.beefcare.repository.FeedReceiptRepository;
import vn.edu.fpt.beefcare.repository.FeedStockAdjustmentRepository;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/**
 * FE-23 documents: the invoice or delivery note of a feed receipt (SCR-79) and the count record or photos of a stock adjustment
 * (SCR-80), "PDF or JPG, max 10 MB each". Bytes and metadata use the shared private attachment store ({@link AttachmentService#store}).
 * Owner and Manager only ({@link FarmAction#MANAGE_FEED}). Files can be added or removed while the document is a DRAFT; a POSTED or VOIDED
 * receipt opens read-only (SCR-79) and a posted adjustment is immutable (GBR-100), so those can only be listed and downloaded.
 */
@Service
public class FeedAttachmentService {

    public static final long MAX_BYTES = 10L * 1024 * 1024;

    /** The two documents that carry files, with their attachment owner type and the "not a draft" reason code used by their services. */
    public enum Owner {
        RECEIPT(AttachmentOwnerType.FEED_RECEIPT, "receipt_is_not_draft"),
        ADJUSTMENT(AttachmentOwnerType.FEED_ADJUSTMENT, "adjustment_is_not_draft");

        private final AttachmentOwnerType type;
        private final String notDraftReason;

        Owner(AttachmentOwnerType type, String notDraftReason) {
            this.type = type;
            this.notDraftReason = notDraftReason;
        }
    }

    private final AttachmentRepository attachments;
    private final AttachmentService store;
    private final AttachmentStorage storage;
    private final FeedReceiptRepository receipts;
    private final FeedStockAdjustmentRepository adjustments;
    private final FarmAccessService access;
    private final AuditService audit;

    public FeedAttachmentService(
        AttachmentRepository attachments,
        AttachmentService store,
        AttachmentStorage storage,
        FeedReceiptRepository receipts,
        FeedStockAdjustmentRepository adjustments,
        FarmAccessService access,
        AuditService audit
    ) {
        this.attachments = attachments;
        this.store = store;
        this.storage = storage;
        this.receipts = receipts;
        this.adjustments = adjustments;
        this.access = access;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<AttachmentDTO> list(Long farmId, Owner owner, Long documentId) {
        access.require(farmId, FarmAction.MANAGE_FEED);
        status(farmId, owner, documentId, false);
        return attachments.findByOwnerTypeAndOwnerIdAndFarm_IdAndRemovedAtIsNullOrderByIdAsc(owner.type, documentId, farmId).stream().map(FeedAttachmentService::dto).toList();
    }

    @Transactional
    public AttachmentDTO upload(Long farmId, Owner owner, Long documentId, MultipartFile file) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_FEED);
        requireDraft(owner, status(farmId, owner, documentId, true));
        Upload upload = validate(file);
        Attachment saved = store.store(farmId, owner.type, documentId, upload.bytes, upload.contentType, upload.extension, displayName(file.getOriginalFilename(), upload.extension));
        audit.log(ctx, "FEED_DOC_ATTACH", target(owner), documentId, Map.of("attachmentId", saved.getId(), "contentType", saved.getContentType(), "fileSize", saved.getFileSize()));
        return dto(saved);
    }

    @Transactional(readOnly = true)
    public StoredDocument read(Long farmId, Owner owner, Long documentId, Long attachmentId) {
        access.require(farmId, FarmAction.MANAGE_FEED);
        status(farmId, owner, documentId, false);
        Attachment attachment = find(farmId, owner, documentId, attachmentId);
        try {
            return new StoredDocument(attachment.getContentType(), attachment.getOriginalFilename(), storage.open(attachment.getStorageKey()));
        } catch (IOException error) {
            throw new IllegalStateException("Unable to read attachment content", error);
        }
    }

    /** The file stays in the store and is kept with its metadata (removed_at) like every other attachment; it is no longer listed or served. */
    @Transactional
    public AttachmentDTO remove(Long farmId, Owner owner, Long documentId, Long attachmentId) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_FEED);
        requireDraft(owner, status(farmId, owner, documentId, true));
        Attachment attachment = find(farmId, owner, documentId, attachmentId);
        attachment.setRemovedAt(Instant.now());
        audit.log(ctx, "FEED_DOC_REMOVE", target(owner), documentId, Map.of("attachmentId", attachment.getId()));
        return dto(attachment);
    }

    /**
     * Hash of the request content for the idempotency record, so a retried upload of the same file replays and a different file conflicts.
     * It does not validate: permission is checked first by the command, and the file rules are applied inside it.
     */
    public String requestHash(MultipartFile file, Long documentId) {
        if (file == null) return digest((documentId + ":none").getBytes(StandardCharsets.UTF_8));
        try {
            String content = file.getSize() > MAX_BYTES ? "oversize" : digest(file.getBytes());
            return digest((documentId + ":" + declaredType(file.getContentType()) + ":" + file.getSize() + ":" + content).getBytes(StandardCharsets.UTF_8));
        } catch (IOException error) {
            throw DomainException.invalid("file");
        }
    }

    /** Status of the document in this farm; 404 (MSG-COM-08) when it does not exist in the farm. {@code lock} serializes with posting. */
    private String status(Long farmId, Owner owner, Long documentId, boolean lock) {
        return switch (owner) {
            case RECEIPT -> (lock ? receipts.lockByIdAndFarm(documentId, farmId) : receipts.findByIdAndFarm_Id(documentId, farmId))
                .map(FeedReceipt::getStatus).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
            case ADJUSTMENT -> (lock ? adjustments.lockByIdAndFarm(documentId, farmId) : adjustments.findByIdAndFarm_Id(documentId, farmId))
                .map(FeedStockAdjustment::getStatus).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        };
    }

    private static void requireDraft(Owner owner, String status) {
        if (!"DRAFT".equals(status)) throw DomainException.conflict(MessageCodes.COM_05, "reason", owner.notDraftReason);
    }

    private Attachment find(Long farmId, Owner owner, Long documentId, Long attachmentId) {
        return attachments.findByIdAndFarm_Id(attachmentId, farmId)
            .filter(value -> value.getOwnerType() == owner.type && documentId.equals(value.getOwnerId()) && value.getRemovedAt() == null)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId));
    }

    private static String target(Owner owner) {
        return owner == Owner.RECEIPT ? "FeedReceipt" : "FeedStockAdjustment";
    }

    /**
     * PDF or JPEG only, at most 10 MB. The type is taken from the content (magic bytes), and the type declared by the client must agree
     * with it, so a renamed or mislabelled file is refused. Problems are MSG-COM-10 on field {@code file} with a {@code reason}.
     */
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

    /**
     * The name shown in the list and offered on download: no path, control or bidirectional-override characters, no leading dots, at most
     * 255 characters, and always ending in the extension that matches the detected type.
     */
    public static String displayName(String original, String extension) {
        String leaf = original == null ? "" : original.replace('\\', '/');
        leaf = leaf.substring(leaf.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\\u202A-\\u202E\\u2066-\\u2069<>:\"|?*]", "").replaceAll("^\\.+", "").trim();
        if (leaf.isBlank()) leaf = "document";
        String lower = leaf.toLowerCase(Locale.ROOT);
        boolean matches = ".pdf".equals(extension) ? lower.endsWith(".pdf") : lower.endsWith(".jpg") || lower.endsWith(".jpeg");
        if (!matches) leaf = leaf + extension;
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
