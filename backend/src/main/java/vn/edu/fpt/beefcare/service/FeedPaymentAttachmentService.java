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
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.repository.AttachmentRepository;
import vn.edu.fpt.beefcare.repository.FeedReceiptRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/** Optional evidence belonging to one payment on a feed receipt, separate from receipt-level documents. */
@Service
public class FeedPaymentAttachmentService {

    public static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final AttachmentOwnerType OWNER_TYPE = AttachmentOwnerType.FEED_RECEIPT_PAYMENT;

    private final AttachmentRepository attachments;
    private final AttachmentService store;
    private final AttachmentStorage storage;
    private final FeedReceiptRepository receipts;
    private final VoucherPaymentRepository payments;
    private final FarmAccessService access;
    private final AuditService audit;

    public FeedPaymentAttachmentService(
        AttachmentRepository attachments,
        AttachmentService store,
        AttachmentStorage storage,
        FeedReceiptRepository receipts,
        VoucherPaymentRepository payments,
        FarmAccessService access,
        AuditService audit
    ) {
        this.attachments = attachments;
        this.store = store;
        this.storage = storage;
        this.receipts = receipts;
        this.payments = payments;
        this.access = access;
        this.audit = audit;
    }

    /** Recheck farm access and the URL's receipt/payment relationship before the idempotency replay lookup. */
    @Transactional(readOnly = true)
    public void verifyTarget(Long farmId, Long receiptId, Long paymentId) {
        access.require(farmId, FarmAction.MANAGE_FEED);
        payment(farmId, receiptId, paymentId, false);
    }

    @Transactional(readOnly = true)
    public List<AttachmentDTO> list(Long farmId, Long receiptId, Long paymentId) {
        access.require(farmId, FarmAction.MANAGE_FEED);
        payment(farmId, receiptId, paymentId, false);
        return attachments.findByOwnerTypeAndOwnerIdAndFarm_IdAndRemovedAtIsNullOrderByIdAsc(OWNER_TYPE, paymentId, farmId)
            .stream().map(FeedPaymentAttachmentService::dto).toList();
    }

    /**
     * Payment fields are immutable after recording. Evidence may be appended while RECORDED; a voided payment remains readable for
     * history but cannot be changed. Locking the receipt serializes this check with feed-payment void and receipt void commands.
     */
    @Transactional
    public AttachmentDTO upload(Long farmId, Long receiptId, Long paymentId, MultipartFile file) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_FEED);
        VoucherPayment payment = payment(farmId, receiptId, paymentId, true);
        if (payment.getStatus() != PaymentRecordStatus.RECORDED) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "payment_is_not_recorded");
        }
        Upload upload = validate(file);
        String filename = FeedAttachmentService.displayName(file.getOriginalFilename(), upload.extension());
        Attachment saved = store.store(farmId, OWNER_TYPE, paymentId, upload.bytes(), upload.contentType(), upload.extension(), filename);
        audit.log(ctx, "FEED_PAYMENT_ATTACH", "VoucherPayment", paymentId,
            Map.of("attachmentId", saved.getId(), "contentType", saved.getContentType(), "fileSize", saved.getFileSize()));
        return dto(saved);
    }

    @Transactional(readOnly = true)
    public StoredDocument read(Long farmId, Long receiptId, Long paymentId, Long attachmentId) {
        access.require(farmId, FarmAction.MANAGE_FEED);
        payment(farmId, receiptId, paymentId, false);
        Attachment attachment = find(farmId, paymentId, attachmentId);
        try {
            return new StoredDocument(attachment.getContentType(), attachment.getOriginalFilename(), storage.open(attachment.getStorageKey()));
        } catch (IOException error) {
            throw new IllegalStateException("Unable to read payment attachment content", error);
        }
    }

    /** Hashes content and its declared type so retries replay while a different upload under the same key conflicts. */
    public String requestHash(MultipartFile file, Long paymentId) {
        if (file == null) return digest((paymentId + ":none").getBytes(StandardCharsets.UTF_8));
        try {
            String content = file.getSize() > MAX_BYTES ? "oversize" : digest(file.getBytes());
            return digest((paymentId + ":" + declaredType(file.getContentType()) + ":" + file.getSize() + ":" + content).getBytes(StandardCharsets.UTF_8));
        } catch (IOException error) {
            throw DomainException.invalid("file");
        }
    }

    /**
     * Resolves the payment through the receipt in the URL, both constrained to the requested farm. The receipt row lock shares the
     * lock order used by payment void and receipt void, preventing an upload from passing its RECORDED check after either command wins.
     */
    private VoucherPayment payment(Long farmId, Long receiptId, Long paymentId, boolean lockReceipt) {
        FeedReceipt receipt = (lockReceipt ? receipts.lockByIdAndFarm(receiptId, farmId) : receipts.findByIdAndFarm_Id(receiptId, farmId))
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        return payments.findByIdAndFarmId(paymentId, farmId)
            .filter(value -> value.getFeedReceipt() != null && receipt.getId().equals(value.getFeedReceipt().getId()))
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private Attachment find(Long farmId, Long paymentId, Long attachmentId) {
        return attachments.findByIdAndFarm_Id(attachmentId, farmId)
            .filter(value -> value.getOwnerType() == OWNER_TYPE && paymentId.equals(value.getOwnerId()) && value.getRemovedAt() == null)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "attachment_id", attachmentId));
    }

    /** PDF or JPEG only, at most 10 MiB; declared MIME must agree with the file signature. */
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
