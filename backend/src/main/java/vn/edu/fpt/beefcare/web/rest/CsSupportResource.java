package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.*;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;

@RestController
@RequestMapping("/api/platform/support")
public class CsSupportResource {
    private final SupportTicketCommandService support;
    private final InternalSupportRequestService internal;
    private final IdempotencyCommandService commands;
    public CsSupportResource(SupportTicketCommandService support, InternalSupportRequestService internal, IdempotencyCommandService commands) {
        this.support = support; this.internal = internal; this.commands = commands;
    }
    @GetMapping("/tickets")
    public SupportDtos.Page queue(@RequestParam(required=false) String q, @RequestParam(required=false) String category,
        @RequestParam(required=false) String tab, @RequestParam(required=false) Instant from, @RequestParam(required=false) Instant to,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="25") int size, @RequestParam(required=false) Long farmId,
        @RequestParam(required=false) String priority, @RequestParam(required=false) String assignment) {
        return support.queue(q, category, tab, from, to, page, size, farmId, priority, assignment);
    }
    @GetMapping("/tickets/{id}") public SupportDtos.Ticket get(@PathVariable Long id) { return support.get(id, true); }
    @GetMapping("/recipients") public List<Map<String,Object>> recipients(@RequestParam PlatformRole role) { return internal.recipients(role); }
    @PostMapping("/tickets/{id}/processing") public SupportDtos.Ticket process(@PathVariable Long id, @Valid @RequestBody SupportDtos.Processing r, @RequestHeader("Idempotency-Key") String key) {
        if ("CLAIM".equals(r.action())) {
            commands.executePlatform(PlatformRole.CS, "SUPPORT_CLAIM:"+id, key, r, SupportDtos.Ticket.class, () -> support.process(id, r));
            // A claim replay returns the current role-filtered view; handover must never expose cached internal results.
            return support.get(id, true);
        }
        return assigned(id, "SUPPORT_PROCESS:", key, r, () -> support.process(id, r));
    }
    @PostMapping("/tickets/{id}/replies") public SupportDtos.Ticket reply(@PathVariable Long id, @Valid @RequestBody SupportDtos.Reply r, @RequestHeader("Idempotency-Key") String key) {
        return assigned(id, "SUPPORT_CS_REPLY:", key, r, () -> support.reply(id, r, true, false));
    }
    @PostMapping("/tickets/{id}/internal-notes") public SupportDtos.Ticket note(@PathVariable Long id, @Valid @RequestBody SupportDtos.Reply r, @RequestHeader("Idempotency-Key") String key) {
        return assigned(id, "SUPPORT_NOTE:", key, r, () -> support.reply(id, r, true, true));
    }
    @PostMapping("/tickets/{id}/resolutions") public SupportDtos.Ticket resolve(@PathVariable Long id, @Valid @RequestBody SupportDtos.Resolution r, @RequestHeader("Idempotency-Key") String key) {
        return assigned(id, "SUPPORT_RESOLVE:", key, r, () -> support.resolve(id, r));
    }
    @PostMapping("/tickets/{id}/close") public SupportDtos.Ticket close(@PathVariable Long id, @Valid @RequestBody SupportDtos.Close r, @RequestHeader("Idempotency-Key") String key) {
        return assigned(id, "SUPPORT_CLOSE:", key, r, () -> support.close(id, r));
    }
    @PostMapping("/tickets/{id}/internal-requests") public SupportDtos.InternalView createInternal(@PathVariable Long id, @Valid @RequestBody SupportDtos.InternalCreate r, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatformAuthorized(PlatformRole.CS, "SUPPORT_IR_CREATE:"+id, key, r, SupportDtos.InternalView.class,
            () -> support.requireAssigned(id), () -> internal.create(id, r));
    }
    @PostMapping("/tickets/{ticketId}/internal-requests/{id}/management") public SupportDtos.InternalView manageInternal(@PathVariable Long ticketId, @PathVariable Long id,
        @Valid @RequestBody SupportDtos.InternalManage r, @RequestHeader("Idempotency-Key") String key) {
        return commands.executePlatformAuthorized(PlatformRole.CS, "SUPPORT_IR_MANAGE:"+id, key, r, SupportDtos.InternalView.class,
            () -> internal.requireAssignedCs(ticketId, id), () -> internal.manage(id, r));
    }
    private SupportDtos.Ticket assigned(Long id, String action, String key, Object r, Supplier<SupportDtos.Ticket> command) {
        return commands.executePlatformAuthorized(PlatformRole.CS, action+id, key, r, SupportDtos.Ticket.class, () -> support.requireAssigned(id), command);
    }
}
