package vn.edu.fpt.beefcare.web.rest;

import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService.AuditEntry;

@RestController
@RequestMapping("/api/platform/audit")
public class PlatformAuditResource {
    private final PlatformAuditQueryService service;

    public PlatformAuditResource(PlatformAuditQueryService service) {
        this.service = service;
    }

    @GetMapping
    public Page<AuditEntry> search(
        @RequestParam(required = false) Instant from,
        @RequestParam(required = false) Instant to,
        @RequestParam(required = false) String action,
        @RequestParam(required = false) String targetType,
        @RequestParam(required = false) Long actorId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return service.search(from, to, action, targetType, actorId, page, size);
    }

    @GetMapping("/{id}")
    public AuditEntry get(@PathVariable Long id) {
        return service.get(id);
    }
}
