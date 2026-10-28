package vn.edu.fpt.beefcare.web.rest;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FeedAttachmentService;
import vn.edu.fpt.beefcare.service.FeedAttachmentService.Owner;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/**
 * SCR-79 / SCR-80 attachments of a feed receipt and of a stock adjustment: PDF or JPEG, 10 MB each, Owner and Manager only. Files can be
 * added or removed while the document is a DRAFT; afterwards they can only be listed and downloaded.
 */
@RestController
@RequestMapping("/api/farms/{farmId}/feed")
public class FeedAttachmentResource {

    private final FeedAttachmentService attachments;
    private final IdempotencyCommandService commands;

    public FeedAttachmentResource(FeedAttachmentService attachments, IdempotencyCommandService commands) {
        this.attachments = attachments;
        this.commands = commands;
    }

    @GetMapping("/receipts/{receiptId}/attachments")
    public List<AttachmentDTO> listReceiptFiles(@PathVariable Long farmId, @PathVariable Long receiptId) {
        return attachments.list(farmId, Owner.RECEIPT, receiptId);
    }

    @PostMapping(path = "/receipts/{receiptId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> uploadReceiptFile(
        @PathVariable Long farmId, @PathVariable Long receiptId, @RequestHeader("Idempotency-Key") String key, @RequestParam("file") MultipartFile file
    ) {
        return upload(farmId, Owner.RECEIPT, "FEED_RECEIPT_ATTACH:", receiptId, key, file);
    }

    @GetMapping("/receipts/{receiptId}/attachments/{attachmentId}")
    public ResponseEntity<InputStreamResource> downloadReceiptFile(@PathVariable Long farmId, @PathVariable Long receiptId, @PathVariable Long attachmentId) {
        return download(attachments.read(farmId, Owner.RECEIPT, receiptId, attachmentId));
    }

    @DeleteMapping("/receipts/{receiptId}/attachments/{attachmentId}")
    public ResponseEntity<AttachmentDTO> removeReceiptFile(
        @PathVariable Long farmId, @PathVariable Long receiptId, @PathVariable Long attachmentId, @RequestHeader("Idempotency-Key") String key
    ) {
        return remove(farmId, Owner.RECEIPT, "FEED_RECEIPT_DETACH:", receiptId, attachmentId, key);
    }

    @GetMapping("/adjustments/{adjustmentId}/attachments")
    public List<AttachmentDTO> listAdjustmentFiles(@PathVariable Long farmId, @PathVariable Long adjustmentId) {
        return attachments.list(farmId, Owner.ADJUSTMENT, adjustmentId);
    }

    @PostMapping(path = "/adjustments/{adjustmentId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> uploadAdjustmentFile(
        @PathVariable Long farmId, @PathVariable Long adjustmentId, @RequestHeader("Idempotency-Key") String key, @RequestParam("file") MultipartFile file
    ) {
        return upload(farmId, Owner.ADJUSTMENT, "FEED_ADJUSTMENT_ATTACH:", adjustmentId, key, file);
    }

    @GetMapping("/adjustments/{adjustmentId}/attachments/{attachmentId}")
    public ResponseEntity<InputStreamResource> downloadAdjustmentFile(@PathVariable Long farmId, @PathVariable Long adjustmentId, @PathVariable Long attachmentId) {
        return download(attachments.read(farmId, Owner.ADJUSTMENT, adjustmentId, attachmentId));
    }

    @DeleteMapping("/adjustments/{adjustmentId}/attachments/{attachmentId}")
    public ResponseEntity<AttachmentDTO> removeAdjustmentFile(
        @PathVariable Long farmId, @PathVariable Long adjustmentId, @PathVariable Long attachmentId, @RequestHeader("Idempotency-Key") String key
    ) {
        return remove(farmId, Owner.ADJUSTMENT, "FEED_ADJUSTMENT_DETACH:", adjustmentId, attachmentId, key);
    }

    private ResponseEntity<AttachmentDTO> upload(Long farmId, Owner owner, String action, Long documentId, String key, MultipartFile file) {
        Map<String, Object> request = Map.of("documentId", documentId, "fileHash", attachments.requestHash(file, documentId));
        return ResponseEntity.ok(commands.execute(farmId, FarmAction.MANAGE_FEED, action + documentId, key, request, AttachmentDTO.class,
            () -> attachments.upload(farmId, owner, documentId, file)));
    }

    private ResponseEntity<AttachmentDTO> remove(Long farmId, Owner owner, String action, Long documentId, Long attachmentId, String key) {
        Map<String, Object> request = Map.of("documentId", documentId, "attachmentId", attachmentId);
        return ResponseEntity.ok(commands.execute(farmId, FarmAction.MANAGE_FEED, action + documentId, key, request, AttachmentDTO.class,
            () -> attachments.remove(farmId, owner, documentId, attachmentId)));
    }

    /** Private content: never cached, never sniffed, always offered as a download under the sanitized name. */
    private static ResponseEntity<InputStreamResource> download(FeedAttachmentService.StoredDocument document) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(document.contentType()))
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(document.filename(), StandardCharsets.UTF_8).build().toString())
            .header("X-Content-Type-Options", "nosniff")
            .body(new InputStreamResource(document.content()));
    }
}
