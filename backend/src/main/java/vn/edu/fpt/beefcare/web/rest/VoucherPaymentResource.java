package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.VoucherKind;
import vn.edu.fpt.beefcare.service.VoucherPaymentService;
import vn.edu.fpt.beefcare.service.dto.PaymentResultDTO;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;

/**
 * Payments to sellers (entry vouchers) and collections from buyers (exit vouchers), FE-06 / FE-13.
 * {type} is entry | exit.
 */
@RestController
@RequestMapping("/api/farms/{farmId}")
public class VoucherPaymentResource {

    private final VoucherPaymentService service;

    public VoucherPaymentResource(VoucherPaymentService service) {
        this.service = service;
    }

    @GetMapping("/vouchers/{type}/{voucherId}/payments")
    public ResponseEntity<PaymentResultDTO> list(@PathVariable Long farmId, @PathVariable String type, @PathVariable Long voucherId) {
        return ResponseEntity.ok(service.list(farmId, VoucherKind.parse(type), voucherId));
    }

    @PostMapping("/vouchers/{type}/{voucherId}/payments")
    public ResponseEntity<PaymentResultDTO> record(
        @PathVariable Long farmId,
        @PathVariable String type,
        @PathVariable Long voucherId,
        @Valid @RequestBody RecordPaymentRequest request
    ) {
        PaymentResultDTO result = service.record(farmId, VoucherKind.parse(type), voucherId, request);
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/payments/" + result.payment().id())).body(result);
    }

    @PostMapping("/payments/{paymentId}/void")
    public ResponseEntity<PaymentResultDTO> voidPayment(
        @PathVariable Long farmId,
        @PathVariable Long paymentId,
        @Valid @RequestBody VoidPaymentRequest request
    ) {
        return ResponseEntity.ok(service.voidPayment(farmId, paymentId, request));
    }
}
