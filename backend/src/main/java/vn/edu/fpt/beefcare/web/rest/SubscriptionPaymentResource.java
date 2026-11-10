package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.format.annotation.DateTimeFormat;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.PaymentDTO;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.PaymentHistoryPage;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.SubscriptionOverview;

/** Owner subscription and payment-request API. Platform payment operations live under /api/platform/payments. */
@RestController
@RequestMapping("/api/farms/{farmId}/subscription")
public class SubscriptionPaymentResource {
    private final SubscriptionPaymentService service;
    private final IdempotencyCommandService commands;
    public SubscriptionPaymentResource(SubscriptionPaymentService service, IdempotencyCommandService commands) {
        this.service = service; this.commands = commands;
    }

    @GetMapping
    public SubscriptionOverview overview(@PathVariable Long farmId) { return service.overview(farmId); }

    @GetMapping("/payments")
    public PaymentHistoryPage history(@PathVariable Long farmId,
        @Parameter(description = "Partial payment code, case-insensitive; trimmed, maximum 100 characters.") @RequestParam(required = false) String q,
        @Parameter(schema = @Schema(allowableValues = {"PENDING", "PAID", "EXPIRED"})) @RequestParam(required = false) String status,
        @Parameter(description = "Inclusive created date in Asia/Ho_Chi_Minh.") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @Parameter(description = "Inclusive created date in Asia/Ho_Chi_Minh.") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @Parameter(schema = @Schema(allowableValues = {"requestedAt", "expiresAt"})) @RequestParam(defaultValue = "requestedAt") String sort,
        @Parameter(schema = @Schema(allowableValues = {"asc", "desc"})) @RequestParam(defaultValue = "desc") String dir,
        @Parameter(description = "Zero-based page; fixed 20 rows per page. Out of range returns 400 MSG-COM-10.",
            schema = @Schema(type = "integer", format = "int32", defaultValue = "0", minimum = "0", maximum = "107374182"))
        @RequestParam(defaultValue = "0") int page) {
        return service.history(farmId, q, status, from, to, sort, dir, page);
    }

    @GetMapping("/payments/{paymentId}")
    public PaymentDTO detail(@PathVariable Long farmId, @PathVariable Long paymentId) { return service.paymentDetails(farmId, paymentId); }

    @PostMapping("/payments")
    public PaymentDTO request(@PathVariable Long farmId, @Valid @RequestBody Request request,
        @RequestHeader("Idempotency-Key") String key) {
        try {
            return commands.execute(farmId, FarmAction.MANAGE_FARM_INFORMATION, "SUBSCRIPTION_PAYMENT_REQUEST", key, request, PaymentDTO.class,
                () -> service.requestPayment(farmId, new SubscriptionPaymentService.PaymentRequest(request.durationYears(), request.reviewedPriceVersion())));
        } catch (DomainException businessFailure) {
            throw businessFailure;
        } catch (RuntimeException saveFailure) {
            // The command transaction has already rolled back; preserve the UC-02 save-failure contract.
            DomainException failure = new DomainException(MessageCodes.COM_02, Map.of(), HttpStatus.INTERNAL_SERVER_ERROR);
            failure.initCause(saveFailure);
            throw failure;
        }
    }

    public record Request(@NotNull @Min(1) @Max(3) Integer durationYears, @NotNull @Positive Long reviewedPriceVersion) {}
}
