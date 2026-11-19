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
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.VoucherAttachmentService;
import vn.edu.fpt.beefcare.service.VoucherAttachmentService.Owner;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/** Private voucher documents for entry and exit workflows. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class VoucherAttachmentResource {

    private final VoucherAttachmentService attachments;
    private final IdempotencyCommandService commands;

    public VoucherAttachmentResource(VoucherAttachmentService attachments, IdempotencyCommandService commands) {
        this.attachments = attachments;
        this.commands = commands;
    }

    @GetMapping("/entry-vouchers/{voucherId}/attachments")
    public List<AttachmentDTO> listEntry(@PathVariable Long farmId, @PathVariable Long voucherId) {
        return attachments.list(farmId, Owner.ENTRY, voucherId);
    }

    @PostMapping(path = "/entry-vouchers/{voucherId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> uploadEntry(
        @PathVariable Long farmId,
        @PathVariable Long voucherId,
        @RequestHeader("Idempotency-Key") String key,
        @RequestParam("file") MultipartFile file
    ) {
        return upload(farmId, Owner.ENTRY, voucherId, key, file);
    }

    @GetMapping("/entry-vouchers/{voucherId}/attachments/{attachmentId}")
    public ResponseEntity<InputStreamResource> readEntry(@PathVariable Long farmId, @PathVariable Long voucherId, @PathVariable Long attachmentId) {
        return download(attachments.read(farmId, Owner.ENTRY, voucherId, attachmentId));
    }

    @DeleteMapping("/entry-vouchers/{voucherId}/attachments/{attachmentId}")
    public ResponseEntity<AttachmentDTO> removeEntry(
        @PathVariable Long farmId,
        @PathVariable Long voucherId,
        @PathVariable Long attachmentId,
        @RequestHeader("Idempotency-Key") String key
    ) {
        return remove(farmId, Owner.ENTRY, voucherId, attachmentId, key);
    }

    @GetMapping("/exit-vouchers/{voucherId}/attachments")
    public List<AttachmentDTO> listExit(@PathVariable Long farmId, @PathVariable Long voucherId) {
        return attachments.list(farmId, Owner.EXIT, voucherId);
    }

    @PostMapping(path = "/exit-vouchers/{voucherId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> uploadExit(
        @PathVariable Long farmId,
        @PathVariable Long voucherId,
        @RequestHeader("Idempotency-Key") String key,
        @RequestParam("file") MultipartFile file
    ) {
        return upload(farmId, Owner.EXIT, voucherId, key, file);
    }

    @GetMapping("/exit-vouchers/{voucherId}/attachments/{attachmentId}")
    public ResponseEntity<InputStreamResource> readExit(@PathVariable Long farmId, @PathVariable Long voucherId, @PathVariable Long attachmentId) {
        return download(attachments.read(farmId, Owner.EXIT, voucherId, attachmentId));
    }

    @DeleteMapping("/exit-vouchers/{voucherId}/attachments/{attachmentId}")
    public ResponseEntity<AttachmentDTO> removeExit(
        @PathVariable Long farmId,
        @PathVariable Long voucherId,
        @PathVariable Long attachmentId,
        @RequestHeader("Idempotency-Key") String key
    ) {
        return remove(farmId, Owner.EXIT, voucherId, attachmentId, key);
    }

    private ResponseEntity<AttachmentDTO> upload(Long farmId, Owner owner, Long voucherId, String key, MultipartFile file) {
        Map<String, Object> request = Map.of("voucherId", voucherId, "fileHash", attachments.requestHash(file, voucherId));
        FarmAction action = owner == Owner.ENTRY ? FarmAction.MANAGE_ENTRY_VOUCHERS : FarmAction.MANAGE_EXIT_VOUCHERS;
        return ResponseEntity.ok(commands.execute(farmId, action, "VOUCHER_ATTACH:" + owner.name() + ":" + voucherId, key, request, AttachmentDTO.class,
            () -> attachments.upload(farmId, owner, voucherId, file)));
    }

    private ResponseEntity<AttachmentDTO> remove(Long farmId, Owner owner, Long voucherId, Long attachmentId, String key) {
        Map<String, Object> request = Map.of("voucherId", voucherId, "attachmentId", attachmentId);
        FarmAction action = owner == Owner.ENTRY ? FarmAction.MANAGE_ENTRY_VOUCHERS : FarmAction.MANAGE_EXIT_VOUCHERS;
        return ResponseEntity.ok(commands.execute(farmId, action, "VOUCHER_DETACH:" + owner.name() + ":" + voucherId, key, request, AttachmentDTO.class,
            () -> attachments.remove(farmId, owner, voucherId, attachmentId)));
    }

    private static ResponseEntity<InputStreamResource> download(VoucherAttachmentService.StoredDocument document) {
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(document.contentType()))
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(document.filename(), StandardCharsets.UTF_8).build().toString())
            .header("X-Content-Type-Options", "nosniff")
            .body(new InputStreamResource(document.content()));
    }
}
