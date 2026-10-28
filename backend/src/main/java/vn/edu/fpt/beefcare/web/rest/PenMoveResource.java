package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.PenMoveService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.dto.PenHistoryDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveResultDTO;

/** REST API of pen moves (UC-FE04-05) and of the pen history of a cattle. */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class PenMoveResource {

    private final PenMoveService service;
    private final IdempotencyCommandService commands;

    public PenMoveResource(PenMoveService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    @PostMapping("/pen-moves/check")
    public ResponseEntity<PenMoveCheckDTO> check(@PathVariable Long farmId, @Valid @RequestBody PenMoveCheckRequest request) {
        return ResponseEntity.ok(service.check(farmId, request));
    }

    @PostMapping("/pen-moves")
    public ResponseEntity<PenMoveResultDTO> move(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody PenMoveRequest request) {
        return ResponseEntity.ok(commands.execute(farmId, FarmAction.MOVE_CATTLE, "PEN_MOVE", key, request, PenMoveResultDTO.class, () -> service.move(farmId, request)));
    }

    @GetMapping("/cattle/{cattleId}/pen-history")
    public ResponseEntity<PenHistoryDTO> history(@PathVariable Long farmId, @PathVariable Long cattleId) {
        return ResponseEntity.ok(service.history(farmId, cattleId));
    }
}
