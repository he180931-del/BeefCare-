package vn.edu.fpt.beefcare.web.rest;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult;

@RestController
public class SePayWebhookResource {
    private static final int MAX_BODY_BYTES = 65_536;
    private final SePayWebhookService service;

    public SePayWebhookResource(SePayWebhookService service) {
        this.service = service;
    }

    @PostMapping(path = "/api/webhooks/sepay", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public WebhookResult receive(HttpServletRequest request) throws IOException {
        byte[] body = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE);
        return service.receive(request.getHeader("X-SePay-Timestamp"), request.getHeader("X-SePay-Signature"), body);
    }
}
