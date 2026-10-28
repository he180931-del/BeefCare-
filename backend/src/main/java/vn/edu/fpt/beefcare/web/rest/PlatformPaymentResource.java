package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.EvidenceDTO;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.PaymentCandidate;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.PlatformPayment;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReturnCommand;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReturnResultCommand;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReviewCommand;

/** Platform Manager subscription/payment read and evidence reconciliation commands. */
@RestController
@RequestMapping("/api/platform/payments")
public class PlatformPaymentResource {
    private final SePayWebhookService service;
    private final PlatformSubscriptionQueryService queries;
    public PlatformPaymentResource(SePayWebhookService service, PlatformSubscriptionQueryService queries) {
        this.service = service;
        this.queries = queries;
    }

    /** SCR-62 payment requests; optional state filter and code / farm search. */
    @GetMapping
    public Page<PlatformPayment> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size,
                                      @RequestParam(required = false) String state, @RequestParam(required = false) String q) {
        if (state == null && q == null) return service.platformPayments(page, size);
        var result = queries.paymentView(state, q, page, size);
        return new PageImpl<>(result.items(), PageRequest.of(result.page(), result.size()), result.total());
    }

    /** SCR-62 summary tiles: PENDING requests, evidence to review, HOLD, locked for return. */
    @GetMapping("/summary")
    public PlatformSubscriptionQueryService.PaymentTiles summary() { return queries.paymentTiles(); }

    @GetMapping("/{paymentId}")
    public PlatformPayment get(@PathVariable Long paymentId) { return service.platformPayment(paymentId); }

    @PostMapping("/lookup/{transactionId}")
    public vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult lookup(@PathVariable Long transactionId) {
        return service.lookupAndImport(transactionId);
    }

    /** Without filters: the open review queue. status: ALL, TO_REVIEW, HOLD, REJECTED, ACCEPTED or LOCKED; bank dates in Asia/Ho_Chi_Minh. */
    @GetMapping("/evidence")
    public List<EvidenceDTO> evidence(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bankFrom,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bankTo) {
        if (status == null && bankFrom == null && bankTo == null) return service.unresolvedEvidence();
        return queries.evidenceView(status, bankFrom, bankTo);
    }

    @GetMapping("/evidence/{evidenceId}/candidates")
    public List<PaymentCandidate> candidates(@PathVariable Long evidenceId) { return service.candidates(evidenceId); }

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
