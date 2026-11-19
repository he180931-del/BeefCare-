package vn.edu.fpt.beefcare.web.rest;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult;

/** Local-only payment simulator. It calls the exact settlement path used by verified SePay webhooks. */
@RestController
@RequestMapping("/api/dev/sepay")
@Profile({"dev", "local", "testh2"})
public class LocalSePaySimulatorResource {
    private final SePayWebhookService service;
    public LocalSePaySimulatorResource(SePayWebhookService service) { this.service = service; }

    @PostMapping("/events")
    public WebhookResult simulate(@RequestBody SePayPayload payload) {
        return service.receiveMock(payload);
    }
}
