package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.service.PenService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.dto.PenAvailabilityRequest;
import vn.edu.fpt.beefcare.service.dto.PenDTO;
import vn.edu.fpt.beefcare.service.dto.PenListDTO;
import vn.edu.fpt.beefcare.service.dto.PenRequest;

/** REST API of the pens of a farm (FE-04). Pens are never deleted, so there is no DELETE. */
@RestController
@RequestMapping("/api/farms/{farmId}/pens")
public class PenResource {

    private final PenService service;
    private final IdempotencyCommandService commands;

    public PenResource(PenService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    @GetMapping
    public ResponseEntity<PenListDTO> list(
        @PathVariable Long farmId,
        @RequestParam(required = false) ActiveStatus status,
        @RequestParam(required = false) String q
    ) {
        return ResponseEntity.ok(service.list(farmId, status, q));
    }

    @GetMapping("/{penId}")
    public ResponseEntity<PenDTO> get(@PathVariable Long farmId, @PathVariable Long penId) {
        return ResponseEntity.ok(service.get(farmId, penId));
    }

    @PostMapping
    public ResponseEntity<PenDTO> create(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PenRequest request) {
        PenDTO pen = commands.execute(farmId, FarmAction.MANAGE_PENS, "PEN_CREATE", key, request, PenDTO.class, () -> service.create(farmId, request));
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/pens/" + pen.id())).body(pen);
    }

    @PutMapping("/{penId}")
    public ResponseEntity<PenDTO> update(@PathVariable Long farmId, @PathVariable Long penId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PenRequest request) {
        return ResponseEntity.ok(commands.execute(farmId, FarmAction.MANAGE_PENS, "PEN_UPDATE:" + penId, key, request, PenDTO.class, () -> service.update(farmId, penId, request)));
    }

    @PostMapping("/{penId}/availability")
    public ResponseEntity<PenDTO> changeAvailability(
        @PathVariable Long farmId,
        @PathVariable Long penId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody PenAvailabilityRequest request
    ) {
        return ResponseEntity.ok(commands.execute(farmId, FarmAction.MANAGE_PENS, "PEN_AVAILABILITY:" + penId, key, request, PenDTO.class, () -> service.changeAvailability(farmId, penId, request)));
    }
}
