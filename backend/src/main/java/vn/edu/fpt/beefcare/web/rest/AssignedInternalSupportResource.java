package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.*;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;

@RestController
@RequestMapping("/api/platform/internal-requests")
public class AssignedInternalSupportResource {
    private final InternalSupportRequestService service;
    private final PlatformAccessService platform;
    private final IdempotencyCommandService commands;
    public AssignedInternalSupportResource(InternalSupportRequestService service, PlatformAccessService platform, IdempotencyCommandService commands) {
        this.service = service; this.platform = platform; this.commands = commands;
    }
    @GetMapping public List<SupportDtos.InternalView> mine(@RequestParam(required=false) String state) { return service.mine(state); }
    @GetMapping("/{id}") public SupportDtos.InternalView get(@PathVariable Long id) { return service.get(id); }
    @GetMapping("/{id}/domain-results") public List<Map<String,Object>> results(@PathVariable Long id) { return service.domainResults(id); }
    @PostMapping("/{id}/completion") public SupportDtos.InternalView complete(@PathVariable Long id, @Valid @RequestBody SupportDtos.Complete r, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatformAuthorized(platform.requireAnyPlatformRole().role(), "SUPPORT_IR_COMPLETE:"+id, key, r, SupportDtos.InternalView.class,
            () -> service.requireRecipient(id), () -> service.complete(id, r));
    }
}
