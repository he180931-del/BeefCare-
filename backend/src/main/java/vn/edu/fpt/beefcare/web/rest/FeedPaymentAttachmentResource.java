package vn.edu.fpt.beefcare.web.rest;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FeedPaymentAttachmentService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/** Optional PDF/JPG evidence for one payment recorded on a feed receipt. */
@RestController
@RequestMapping("/api/farms/{farmId}/feed/receipts/{receiptId}/payments/{paymentId}/attachments")
public class FeedPaymentAttachmentResource {

    private final FeedPaymentAttachmentService attachments;
    private final IdempotencyCommandService commands;

    public FeedPaymentAttachmentResource(FeedPaymentAttachmentService attachments, IdempotencyCommandService commands) {
        this.attachments = attachments;
        this.commands = commands;
    }

    @GetMapping
    public java.util.List<AttachmentDTO> list(
        @PathVariable Long farmId,
        @PathVariable Long receiptId,
        @PathVariable Long paymentId
    ) {
        return attachments.list(farmId, receiptId, paymentId);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> upload(
        @PathVariable Long farmId,
        @PathVariable Long receiptId,
        @PathVariable Long paymentId,
        @RequestHeader("Idempotency-Key") String key,
        @RequestParam("file") MultipartFile file
    ) {
        // IdempotencyCommandService rechecks the farm permission before a replay. Also validate the nested payment target here,
        // because a replay skips the command callback where upload() repeats the relation check under a receipt lock.
        attachments.verifyTarget(farmId, receiptId, paymentId);
        Map<String, Object> request = Map.of("receiptId", receiptId, "paymentId", paymentId, "fileHash", attachments.requestHash(file, paymentId));
        AttachmentDTO result = commands.execute(farmId, FarmAction.MANAGE_FEED, "FEED_PAYMENT_ATTACH:" + paymentId, key, request,
            AttachmentDTO.class, () -> attachments.upload(farmId, receiptId, paymentId, file));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{attachmentId}")
    public ResponseEntity<InputStreamResource> download(
        @PathVariable Long farmId,
        @PathVariable Long receiptId,
        @PathVariable Long paymentId,
        @PathVariable Long attachmentId
    ) {
        FeedPaymentAttachmentService.StoredDocument document = attachments.read(farmId, receiptId, paymentId, attachmentId);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(document.contentType()))
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(document.filename(), StandardCharsets.UTF_8).build().toString())
            .header("X-Content-Type-Options", "nosniff")
            .body(new InputStreamResource(document.content()));
    }
}
