package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.service.TradingPartnerService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.TradingPartnerRequest;

/** Trading partners (sellers, buyers, suppliers) of a farm. There is no DELETE: partners are made INACTIVE (GBR-97). */
@RestController
@RequestMapping("/api/farms/{farmId}/trading-partners")
public class TradingPartnerResource {

    private final TradingPartnerService service;
    private final IdempotencyCommandService commands;

    public TradingPartnerResource(TradingPartnerService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    @GetMapping
    public List<EntryDtos.Partner> list(
        @PathVariable Long farmId,
        @RequestParam(required = false) String role,
        @RequestParam(required = false) ActiveStatus status,
        @RequestParam(required = false) String q
    ) {
        return service.list(farmId, role, status, q);
    }

    @GetMapping("/{id}")
    public EntryDtos.Partner get(@PathVariable Long farmId, @PathVariable Long id) {
        return service.get(farmId, id);
    }

    @PostMapping
    public ResponseEntity<EntryDtos.Partner> create(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody TradingPartnerRequest request) {
        FarmAction permission = Boolean.TRUE.equals(request.buyer()) ? FarmAction.MANAGE_BUYERS : FarmAction.MANAGE_SELLERS;
        EntryDtos.Partner created = commands.execute(farmId, permission, "TRADING_PARTNER_CREATE", key, request, EntryDtos.Partner.class, () -> service.create(farmId, request));
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/trading-partners/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public EntryDtos.Partner update(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody TradingPartnerRequest request) {
        EntryDtos.Partner current = service.get(farmId, id);
        FarmAction permission = current.buyer() || Boolean.TRUE.equals(request.buyer()) ? FarmAction.MANAGE_BUYERS : FarmAction.MANAGE_SELLERS;
        return commands.execute(farmId, permission, "TRADING_PARTNER_UPDATE:" + id, key, request, EntryDtos.Partner.class, () -> service.update(farmId, id, request));
    }

    @PatchMapping("/{id}/status")
    public EntryDtos.Partner changeStatus(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @RequestBody TradingPartnerRequest.StatusRequest request) {
        EntryDtos.Partner current = service.get(farmId, id);
        FarmAction permission = current.buyer() ? FarmAction.MANAGE_BUYERS : FarmAction.MANAGE_SELLERS;
        return commands.execute(farmId, permission, "TRADING_PARTNER_STATUS:" + id, key, request, EntryDtos.Partner.class, () -> service.changeStatus(farmId, id, request));
    }
}
