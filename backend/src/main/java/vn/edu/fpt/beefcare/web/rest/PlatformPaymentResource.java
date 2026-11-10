package vn.edu.fpt.beefcare.web.rest;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService;
import vn.edu.fpt.beefcare.service.payment.PlatformPaymentQueryService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.EvidenceDTO;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReturnCommand;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReturnResultCommand;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReviewCommand;

/** Platform Manager subscription/payment read and evidence reconciliation commands. */
@RestController
@RequestMapping("/api/platform/payments")
public class PlatformPaymentResource {
    static final String KEY = "Idempotency-Key";
    private final SePayWebhookService service;
    private final PlatformPaymentQueryService reads;
    private final IdempotencyCommandService commands;
    public PlatformPaymentResource(SePayWebhookService service, PlatformPaymentQueryService reads, IdempotencyCommandService commands) {
        this.service = service;
        this.reads = reads;
        this.commands = commands;
    }

    /** SCR-62 payment requests; optional state filter and code / farm search. */
    @GetMapping
    public PlatformSubscriptionQueryService.Page<PlatformPaymentQueryService.PaymentView> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String state, @RequestParam(required = false) String q) {
        return reads.payments(state, q, page, size);
    }

    /** SCR-62 summary tiles: PENDING requests, evidence to review, HOLD, locked for return. */
    @GetMapping("/summary")
    public PlatformSubscriptionQueryService.PaymentTiles summary() { return reads.tiles(); }

    @GetMapping("/{paymentId}")
    public PlatformPaymentQueryService.PaymentView get(@PathVariable Long paymentId) { return reads.payment(paymentId); }

    /** API-03 by transaction ID: stores the transaction as evidence once (idempotent by the BR-D24 identity). */
    @PostMapping("/lookup/{transactionId}")
    public vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult lookup(@PathVariable Long transactionId) {
        return service.lookupAndImport(transactionId);
    }

    /** API-03 by period (D19): from/to are VN dates, at most 31 days; read-only list with any stored evidenceId. */
    @GetMapping("/lookup")
    public SePayWebhookService.LookupPage lookupPeriod(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                       @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.lookupPeriod(from, to);
    }

    /** D18: ALL by default, inclusive VN bank dates and stable server pagination; GET never changes stored state. */
    @GetMapping("/evidence")
    public PlatformSubscriptionQueryService.Page<PlatformPaymentQueryService.EvidenceRow> evidence(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bankFrom,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bankTo,
                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return reads.evidence(status, bankFrom, bankTo, page, size);
    }

    @GetMapping("/evidence/{evidenceId}")
    public PlatformPaymentQueryService.EvidenceDetail evidenceDetail(@PathVariable Long evidenceId) { return reads.evidence(evidenceId); }

    @GetMapping("/evidence/{evidenceId}/candidates")
    public List<PlatformPaymentQueryService.Candidate> candidates(@PathVariable Long evidenceId) { return reads.candidates(evidenceId); }

    @PostMapping("/evidence/{evidenceId}/review")
    public EvidenceDTO review(@PathVariable Long evidenceId, @RequestBody Review request, @Parameter(name = KEY, in = ParameterIn.HEADER, required = true) @RequestHeader(value = KEY, required = false) String key) {
        return commands.executePlatform(PlatformRole.PM, "EVIDENCE_REVIEW", key, new Keyed(evidenceId, "review", request), EvidenceDTO.class,
            () -> service.review(evidenceId, new ReviewCommand(request.decision(), request.paymentId(), request.reason(), request.version())));
    }

    @PostMapping("/evidence/{evidenceId}/lock-return")
    public EvidenceDTO lockForReturn(@PathVariable Long evidenceId, @RequestBody ReturnChange request, @Parameter(name = KEY, in = ParameterIn.HEADER, required = true) @RequestHeader(value = KEY, required = false) String key) {
        return commands.executePlatform(PlatformRole.PM, "EVIDENCE_LOCK_RETURN", key, new Keyed(evidenceId, "lock", request), EvidenceDTO.class,
            () -> service.lockForReturn(evidenceId, new ReturnCommand(request.reason(), request.version())));
    }

    @PostMapping("/evidence/{evidenceId}/record-return")
    public EvidenceDTO recordReturn(@PathVariable Long evidenceId, @RequestBody ReturnResult request, @Parameter(name = KEY, in = ParameterIn.HEADER, required = true) @RequestHeader(value = KEY, required = false) String key) {
        return commands.executePlatform(PlatformRole.PM, "EVIDENCE_RETURN_RECORD", key, new Keyed(evidenceId, "record", request), EvidenceDTO.class,
            () -> service.recordReturn(evidenceId, new ReturnResultCommand(request.reference(), request.returnDate(), request.result(), request.version())));
    }

    @PostMapping("/evidence/{evidenceId}/unlock-return")
    public EvidenceDTO unlockReturn(@PathVariable Long evidenceId, @RequestBody ReturnChange request, @Parameter(name = KEY, in = ParameterIn.HEADER, required = true) @RequestHeader(value = KEY, required = false) String key) {
        return commands.executePlatform(PlatformRole.PM, "EVIDENCE_RETURN_UNLOCK", key, new Keyed(evidenceId, "unlock", request), EvidenceDTO.class,
            () -> service.unlockReturn(evidenceId, new ReturnCommand(request.reason(), request.version())));
    }

    /** Domain rules return MSG-COM-06/COM-10 per field, so the body carries documentation limits rather than bean constraints. */
    public record Review(@Schema(allowableValues = {"ACCEPT", "HOLD", "REJECT"}) String decision,
                         @Schema(description = "ACCEPT: selected request, or resolved by exact code if omitted. HOLD/REJECT: optional related request saved in review history only") Long paymentId,
                         @Schema(maxLength = 1000, description = "Reason and evidence references (one field)") String reason, Long version) {}
    public record ReturnChange(@Schema(maxLength = 1000) String reason, Long version) {}
    public record ReturnResult(@Schema(maxLength = 255, description = "Outgoing bank reference") String reference,
                               @Schema(description = "Date returned (Asia/Ho_Chi_Minh), not in the future nor before the bank-paid date") LocalDate returnDate,
                               @Schema(maxLength = 500) String result, Long version) {}

    /** The request fingerprint names the evidence and command, so one key never replays another evidence's change. */
    public record Keyed(Long evidenceId, String command, Object request) {}
}
