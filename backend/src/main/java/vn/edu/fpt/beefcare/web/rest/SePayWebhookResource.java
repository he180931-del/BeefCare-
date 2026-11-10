package vn.edu.fpt.beefcare.web.rest;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;

@RestController
public class SePayWebhookResource {
    private static final int MAX_BODY_BYTES = 65_536;
    private final SePayWebhookService service;

    public SePayWebhookResource(SePayWebhookService service) {
        this.service = service;
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Store authenticated SePay evidence and its durable processing job",
        description = "HMAC-SHA256 of timestamp + '.' + exact raw request bytes; ±300 seconds. HTTP 200 acknowledges committed storage, not PAID. No session/CSRF or Idempotency-Key is used; the provider/environment/namespace/transaction ID is the key.",
        parameters = {
            @io.swagger.v3.oas.annotations.Parameter(name = "X-SePay-Timestamp", in = io.swagger.v3.oas.annotations.enums.ParameterIn.HEADER, required = true,
                schema = @io.swagger.v3.oas.annotations.media.Schema(type = "string", pattern = "[0-9]{1,12}")),
            @io.swagger.v3.oas.annotations.Parameter(name = "X-SePay-Signature", in = io.swagger.v3.oas.annotations.enums.ParameterIn.HEADER, required = true,
                schema = @io.swagger.v3.oas.annotations.media.Schema(type = "string", pattern = "sha256=[0-9a-fA-F]{64}"))},
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true, content = @io.swagger.v3.oas.annotations.media.Content(
            schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = SePayWebhookService.SePayPayload.class))),
        responses = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Evidence and job committed; replay reuses them"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Invalid signature or timestamp; no bank evidence", content = @io.swagger.v3.oas.annotations.media.Content),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid JSON or transaction fields", content = @io.swagger.v3.oas.annotations.media.Content),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Same bank transaction identity, conflicting business data", content = @io.swagger.v3.oas.annotations.media.Content),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "413", description = "Body exceeds 65536 bytes", content = @io.swagger.v3.oas.annotations.media.Content),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Evidence/job could not commit; provider must retry", content = @io.swagger.v3.oas.annotations.media.Content)})
    @PostMapping(path = {"/api/webhooks/sepay", "/api/v1/payments/sepay/webhook"}, consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public WebhookAcknowledgement receive(HttpServletRequest request) throws IOException {
        byte[] body = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE);
        service.receive(request.getHeader("X-SePay-Timestamp"), request.getHeader("X-SePay-Signature"), body);
        return new WebhookAcknowledgement(true);
    }

    public record WebhookAcknowledgement(boolean success) {}
}
