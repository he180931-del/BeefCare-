package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.payment.OwnerTransferSimulator;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult;

/** Local-only payment simulator. It calls the exact settlement path used by verified SePay webhooks. */
@RestController
@RequestMapping("/api/dev/sepay")
@Profile({"dev", "local", "testh2"})
public class LocalSePaySimulatorResource {
    private final SePayWebhookService service;
    private final OwnerTransferSimulator ownerTransfers;
    public LocalSePaySimulatorResource(SePayWebhookService service, OwnerTransferSimulator ownerTransfers) {
        this.service = service;
        this.ownerTransfers = ownerTransfers;
    }

    @PostMapping("/events")
    public WebhookResult simulate(@RequestBody SePayPayload payload) {
        return service.receiveMock(payload);
    }

    /** SCR-59 "Giả lập chuyển khoản": the farm's Owner simulates the bank transfer of one of its own requests. */
    @PostMapping("/farms/{farmId}/payments/{paymentId}/transfer")
    public WebhookResult ownerTransfer(@PathVariable Long farmId, @PathVariable Long paymentId,
        @Valid @RequestBody(required = false) OwnerTransfer body) {
        return ownerTransfers.transfer(farmId, paymentId, body == null ? null : body.amountVnd());
    }

    /** {@code amountVnd} omitted = exactly the requested amount; another value tests a mismatching transfer. */
    public record OwnerTransfer(@Positive BigDecimal amountVnd) {}
}
