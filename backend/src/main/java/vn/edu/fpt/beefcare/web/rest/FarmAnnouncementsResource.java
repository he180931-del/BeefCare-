package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FarmAnnouncementService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.*;

/** Authenticated, tenant-scoped FE-07 workflow. */
@RestController
@RequestMapping("/api/farms/{farmId}/announcements")
public class FarmAnnouncementsResource {
    private final FarmAnnouncementService service;private final IdempotencyCommandService commands;
    public FarmAnnouncementsResource(FarmAnnouncementService service,IdempotencyCommandService commands){this.service=service;this.commands=commands;}

    @GetMapping public List<AnnouncementView> list(@PathVariable Long farmId){return service.list(farmId);}
    @PostMapping("/drafts") public ResponseEntity<AnnouncementView> createDraft(@PathVariable Long farmId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody DraftRequest request){return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_ANNOUNCEMENTS,"ANNOUNCEMENT_DRAFT_CREATE",key,request,AnnouncementView.class,()->service.createDraft(farmId,request)));}
    @PutMapping("/{id}/draft") public ResponseEntity<AnnouncementView> updateDraft(@PathVariable Long farmId,@PathVariable Long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody DraftRequest request){record Command(Long id,DraftRequest body){}return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_ANNOUNCEMENTS,"ANNOUNCEMENT_DRAFT_UPDATE:"+id,key,new Command(id,request),AnnouncementView.class,()->service.updateDraft(farmId,id,request)));}
    @PostMapping("/{id}/publish") public ResponseEntity<AnnouncementView> publish(@PathVariable Long farmId,@PathVariable Long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody PublishRequest request){record Command(Long id,PublishRequest body){}return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_ANNOUNCEMENTS,"ANNOUNCEMENT_PUBLISH:"+id,key,new Command(id,request),AnnouncementView.class,()->service.publish(farmId,id,request)));}
    @PostMapping("/{id}/corrections") public ResponseEntity<AnnouncementView> correct(@PathVariable Long farmId,@PathVariable Long id,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody CorrectionRequest request){record Command(Long id,CorrectionRequest body){}return ResponseEntity.ok(commands.execute(farmId,FarmAction.MANAGE_ANNOUNCEMENTS,"ANNOUNCEMENT_CORRECT:"+id,key,new Command(id,request),AnnouncementView.class,()->service.correctPublished(farmId,id,request)));}
    @PostMapping("/recipients/{recipientId}/read") public ResponseEntity<ReadResult> markRead(@PathVariable Long farmId,@PathVariable Long recipientId,@RequestHeader("Idempotency-Key") String key){return ResponseEntity.ok(commands.execute(farmId,FarmAction.VIEW_ANNOUNCEMENTS,"ANNOUNCEMENT_READ:"+recipientId,key,java.util.Map.of("recipientId",recipientId),ReadResult.class,()->service.markRead(farmId,recipientId)));}
}
