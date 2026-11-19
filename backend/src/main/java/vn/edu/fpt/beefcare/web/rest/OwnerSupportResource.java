package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.*;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;

@RestController
@RequestMapping("/api/support/tickets")
public class OwnerSupportResource {
    private final SupportTicketCommandService support;
    private final IdempotencyCommandService commands;
    public OwnerSupportResource(SupportTicketCommandService support, IdempotencyCommandService commands) { this.support = support; this.commands = commands; }
    @GetMapping
    public SupportDtos.Page mine(@RequestParam(required=false) String q, @RequestParam(required=false) String category,
        @RequestParam(required=false) String tab, @RequestParam(required=false) Instant from, @RequestParam(required=false) Instant to,
        @RequestParam(defaultValue="0") int page, @RequestParam(defaultValue="25") int size) {
        return support.mine(q, category, tab, from, to, page, size);
    }
    @GetMapping("/{id}") public SupportDtos.Ticket get(@PathVariable Long id) { return support.get(id, false); }
    @PostMapping public SupportDtos.Ticket create(@Valid @RequestBody SupportDtos.Create r, @RequestHeader("Idempotency-Key") String key) {
        return commands.execute(null, null, "SUPPORT_CREATE", key, r, SupportDtos.Ticket.class, () -> support.create(r));
    }
    @PostMapping("/{id}/replies") public SupportDtos.Ticket reply(@PathVariable Long id, @Valid @RequestBody SupportDtos.Reply r, @RequestHeader("Idempotency-Key") String key) {
        support.requireRequester(id);
        return commands.execute(null, null, "SUPPORT_REPLY:"+id, key, r, SupportDtos.Ticket.class, () -> support.reply(id, r, false, false));
    }
    @PostMapping("/{id}/acknowledgments") public SupportDtos.Ticket acknowledge(@PathVariable Long id, @Valid @RequestBody SupportDtos.Acknowledge r, @RequestHeader("Idempotency-Key") String key) {
        support.requireRequester(id);
        return commands.execute(null, null, "SUPPORT_ACK:"+id, key, r, SupportDtos.Ticket.class, () -> support.acknowledge(id, r));
    }
    @PostMapping("/{id}/reopen") public SupportDtos.Ticket reopen(@PathVariable Long id, @Valid @RequestBody SupportDtos.Reopen r, @RequestHeader("Idempotency-Key") String key) {
        support.requireRequester(id);
        return commands.execute(null, null, "SUPPORT_REOPEN:"+id, key, r, SupportDtos.Ticket.class, () -> support.reopen(id, r));
    }
}
