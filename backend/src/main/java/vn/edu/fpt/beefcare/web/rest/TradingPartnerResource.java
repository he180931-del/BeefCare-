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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.service.TradingPartnerService;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.TradingPartnerRequest;

/** Trading partners (sellers, buyers, suppliers) of a farm. There is no DELETE: partners are made INACTIVE (GBR-97). */
@RestController
@RequestMapping("/api/farms/{farmId}/trading-partners")
public class TradingPartnerResource {

    private final TradingPartnerService service;

    public TradingPartnerResource(TradingPartnerService service) {
        this.service = service;
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
    public ResponseEntity<EntryDtos.Partner> create(@PathVariable Long farmId, @Valid @RequestBody TradingPartnerRequest request) {
        EntryDtos.Partner created = service.create(farmId, request);
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/trading-partners/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public EntryDtos.Partner update(@PathVariable Long farmId, @PathVariable Long id, @Valid @RequestBody TradingPartnerRequest request) {
        return service.update(farmId, id, request);
    }

    @PatchMapping("/{id}/status")
    public EntryDtos.Partner changeStatus(@PathVariable Long farmId, @PathVariable Long id, @RequestBody TradingPartnerRequest.StatusRequest request) {
        return service.changeStatus(farmId, id, request);
    }
}
