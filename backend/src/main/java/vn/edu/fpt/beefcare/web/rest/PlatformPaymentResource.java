package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
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
    private final SePayWebhookService service;
    private final PlatformPaymentQueryService reads;
    public PlatformPaymentResource(SePayWebhookService service, PlatformPaymentQueryService reads) {
        this.service = service;
        this.reads = reads;
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

    @PostMapping("/lookup/{transactionId}")
    public vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult lookup(@PathVariable Long transactionId) {
        return service.lookupAndImport(transactionId);
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
    public EvidenceDTO review(@PathVariable Long evidenceId, @Valid @RequestBody Review request) {
        return service.review(evidenceId, new ReviewCommand(request.decision(), request.paymentId(), request.reason(), request.version()));
    }

    @PostMapping("/evidence/{evidenceId}/lock-return")
    public EvidenceDTO lockForReturn(@PathVariable Long evidenceId, @Valid @RequestBody ReturnChange request) {
        return service.lockForReturn(evidenceId, new ReturnCommand(request.reason(), request.version()));
    }

    @PostMapping("/evidence/{evidenceId}/record-return")
    public EvidenceDTO recordReturn(@PathVariable Long evidenceId, @Valid @RequestBody ReturnResult request) {
        return service.recordReturn(evidenceId, new ReturnResultCommand(request.reference(), request.result(), request.version()));
    }

    @PostMapping("/evidence/{evidenceId}/unlock-return")
    public EvidenceDTO unlockReturn(@PathVariable Long evidenceId, @Valid @RequestBody ReturnChange request) {
        return service.unlockReturn(evidenceId, new ReturnCommand(request.reason(), request.version()));
    }

    public record Review(@NotBlank @Size(max = 20) String decision, Long paymentId, @NotBlank @Size(max = 500) String reason, @NotNull Long version) {}
    public record ReturnChange(@NotBlank @Size(max = 500) String reason, @NotNull Long version) {}
    public record ReturnResult(@NotBlank @Size(max = 255) String reference, @NotBlank @Size(max = 500) String result, @NotNull Long version) {}
}
