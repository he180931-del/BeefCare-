package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.service.HerdExitVoucherService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherRequests;

/**
 * Herd exit vouchers (FE-13): sale, cull, other and death / missing. The Owner creates, edits, confirms, dismisses and
 * voids; a Manager may read. Errors are {"code": "MSG-...", "params": {...}}. Collections use the shared payment
 * endpoints (POST /vouchers/exit/{id}/payments).
 */
@RestController
@RequestMapping("/api/farms/{farmId}/exit-vouchers")
public class HerdExitVoucherResource {

    private final HerdExitVoucherService service;
    private final IdempotencyCommandService commands;

    public HerdExitVoucherResource(HerdExitVoucherService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
    }

    @GetMapping("")
    public ExitVoucherDTO.ListResult list(
        @PathVariable Long farmId,
        @RequestParam(required = false) List<ExitVoucherStatus> status,
        @RequestParam(required = false) ExitType type,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return service.list(farmId, status, type, from, to);
    }

    @GetMapping("/selectable-cattle")
    public List<ExitVoucherDTO.SelectableCattle> selectableCattle(
        @PathVariable Long farmId,
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Long penId,
        @RequestParam(required = false) String herdGroup,
        @RequestParam(required = false) BigDecimal minWeightKg
    ) {
        return service.selectableCattle(farmId, q, penId, herdGroup, minWeightKg);
    }

    @GetMapping("/{id}")
    public ExitVoucherDTO.Detail get(@PathVariable Long farmId, @PathVariable Long id) {
        return service.get(farmId, id);
    }

    @PostMapping("")
    public ResponseEntity<ExitVoucherDTO.Detail> create(@PathVariable Long farmId, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody ExitVoucherRequests.Save request) {
        ExitVoucherDTO.Detail created = commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_CREATE", key, request, ExitVoucherDTO.Detail.class, () -> service.create(farmId, request));
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/exit-vouchers/" + created.id())).body(created);
    }

    @PutMapping("/{id}")
    public ExitVoucherDTO.Detail update(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody ExitVoucherRequests.Save request) {
        return commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_UPDATE:" + id, key, request, ExitVoucherDTO.Detail.class, () -> service.update(farmId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @RequestParam(required = false) Integer expectedVersion) {
        commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_DELETE:" + id, key, expectedVersion, Void.class, () -> { service.delete(farmId, id, expectedVersion); return null; });
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/lines")
    public ExitVoucherDTO.Detail addCattle(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody ExitVoucherRequests.AddCattle request) {
        return commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_ADD_CATTLE:" + id, key, request, ExitVoucherDTO.Detail.class, () -> service.addCattle(farmId, id, request));
    }

    @GetMapping("/{id}/checks")
    public ExitVoucherDTO.ChecksResult checks(@PathVariable Long farmId, @PathVariable Long id) {
        return service.checks(farmId, id);
    }

    @PostMapping("/{id}/confirm")
    public ExitVoucherDTO.ConfirmResult confirm(
        @PathVariable Long farmId,
        @PathVariable Long id,
        @RequestHeader("Idempotency-Key") String idempotencyKey,
        @Valid @RequestBody ExitVoucherRequests.Confirm request
    ) {
        return commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_CONFIRM:" + id, idempotencyKey, request, ExitVoucherDTO.ConfirmResult.class, () -> service.confirm(farmId, id, request, idempotencyKey));
    }

    @PostMapping("/{id}/dismiss")
    public ExitVoucherDTO.DismissResult dismiss(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody ExitVoucherRequests.Dismiss request) {
        return commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_DISMISS:" + id, key, request, ExitVoucherDTO.DismissResult.class, () -> service.dismiss(farmId, id, request));
    }

    @GetMapping("/{id}/void-check")
    public ExitVoucherDTO.VoidCheck voidCheck(@PathVariable Long farmId, @PathVariable Long id) {
        return service.voidCheck(farmId, id);
    }

    @PostMapping("/{id}/void")
    public ExitVoucherDTO.VoidResult voidVoucher(@PathVariable Long farmId, @PathVariable Long id, @RequestHeader("Idempotency-Key") String key, @Valid @RequestBody ExitVoucherRequests.Void request) {
        return commands.execute(farmId, FarmAction.MANAGE_EXIT_VOUCHERS, "EXIT_VOUCHER_VOID:" + id, key, request, ExitVoucherDTO.VoidResult.class, () -> service.voidVoucher(farmId, id, request));
    }
}
