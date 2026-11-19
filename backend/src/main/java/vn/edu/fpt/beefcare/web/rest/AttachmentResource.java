package vn.edu.fpt.beefcare.web.rest;

import java.nio.charset.StandardCharsets;
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
import vn.edu.fpt.beefcare.service.AttachmentService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.AttachmentDTO;

/** Private, tenant-scoped photo upload and read routes. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class AttachmentResource {

    private final AttachmentService attachments;
    private final IdempotencyCommandService commands;

    public AttachmentResource(AttachmentService attachments, IdempotencyCommandService commands) {
        this.attachments = attachments;
        this.commands = commands;
    }

    @PostMapping(path = "/cattle/{cattleId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> uploadCattlePhoto(
        @PathVariable Long farmId,
        @PathVariable Long cattleId,
        @RequestParam Integer expectedVersion,
        @RequestHeader("Idempotency-Key") String key,
        @RequestParam("file") MultipartFile file
    ) {
        String hash = attachments.requestHash(file, cattleId, expectedVersion);
        AttachmentDTO result = commands.execute(
            farmId,
            FarmAction.MANAGE_CATTLE_PHOTOS,
            "CATTLE_PHOTO_UPLOAD:" + cattleId,
            key,
            Map.of("targetId", cattleId, "expectedVersion", expectedVersion, "photoHash", hash),
            AttachmentDTO.class,
            () -> attachments.uploadCattlePhoto(farmId, cattleId, expectedVersion, file)
        );
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/cattle/{cattleId}/photo")
    public ResponseEntity<AttachmentDTO> removeCattlePhoto(
        @PathVariable Long farmId,
        @PathVariable Long cattleId,
        @RequestParam Integer expectedVersion,
        @RequestHeader("Idempotency-Key") String key
    ) {
        AttachmentDTO result = commands.execute(
            farmId,
            FarmAction.MANAGE_CATTLE_PHOTOS,
            "CATTLE_PHOTO_REMOVE:" + cattleId,
            key,
            Map.of("targetId", cattleId, "expectedVersion", expectedVersion),
            AttachmentDTO.class,
            () -> attachments.removeCattlePhoto(farmId, cattleId, expectedVersion)
        );
        return ResponseEntity.ok(result);
    }

    @PostMapping(path = "/entry-lines/{entryId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDTO> uploadEntryPhoto(
        @PathVariable Long farmId,
        @PathVariable Long entryId,
        @RequestParam Integer expectedVersion,
        @RequestHeader("Idempotency-Key") String key,
        @RequestParam("file") MultipartFile file
    ) {
        String hash = attachments.requestHash(file, entryId, expectedVersion);
        AttachmentDTO result = commands.execute(
            farmId,
            FarmAction.MANAGE_ENTRY_VOUCHERS,
            "ENTRY_PHOTO_UPLOAD:" + entryId,
            key,
            Map.of("targetId", entryId, "expectedVersion", expectedVersion, "photoHash", hash),
            AttachmentDTO.class,
            () -> attachments.uploadEntryPhoto(farmId, entryId, expectedVersion, file)
        );
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/entry-lines/{entryId}/photo")
    public ResponseEntity<AttachmentDTO> removeEntryPhoto(
        @PathVariable Long farmId,
        @PathVariable Long entryId,
        @RequestParam Integer expectedVersion,
        @RequestHeader("Idempotency-Key") String key
    ) {
        AttachmentDTO result = commands.execute(
            farmId,
            FarmAction.MANAGE_ENTRY_VOUCHERS,
            "ENTRY_PHOTO_REMOVE:" + entryId,
            key,
            Map.of("targetId", entryId, "expectedVersion", expectedVersion),
            AttachmentDTO.class,
            () -> attachments.removeEntryPhoto(farmId, entryId, expectedVersion)
        );
        return ResponseEntity.ok(result);
    }

    @GetMapping("/attachments/{attachmentId}")
    public ResponseEntity<InputStreamResource> read(@PathVariable Long farmId, @PathVariable Long attachmentId) {
        AttachmentService.StoredPhoto photo = attachments.read(farmId, attachmentId);
        InputStreamResource body = new InputStreamResource(photo.content());
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename("photo", StandardCharsets.UTF_8).build().toString())
            .body(body);
    }
}
