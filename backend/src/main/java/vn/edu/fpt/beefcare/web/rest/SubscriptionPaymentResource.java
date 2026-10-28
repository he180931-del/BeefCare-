package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.PaymentDTO;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.SubscriptionOverview;

/** Owner subscription and payment-request API. Platform payment operations live under /api/platform/payments. */
@RestController
@RequestMapping("/api/farms/{farmId}/subscription")
public class SubscriptionPaymentResource {
    private final SubscriptionPaymentService service;
    public SubscriptionPaymentResource(SubscriptionPaymentService service) { this.service = service; }

    @GetMapping
    public SubscriptionOverview overview(@PathVariable Long farmId) { return service.overview(farmId); }

    @GetMapping("/payments")
    public List<PaymentDTO> history(@PathVariable Long farmId) { return service.history(farmId); }

    @GetMapping("/payments/{paymentId}")
    public PaymentDTO detail(@PathVariable Long farmId, @PathVariable Long paymentId) { return service.paymentDetails(farmId, paymentId); }

    @PostMapping("/payments")
    public PaymentDTO request(@PathVariable Long farmId, @Valid @RequestBody Request request) {
        return service.requestPayment(farmId, new SubscriptionPaymentService.PaymentRequest(request.durationYears()));
    }

    public record Request(@NotNull @Min(1) @Max(3) Integer durationYears) {}
}
