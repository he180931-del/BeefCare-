package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.VoucherKind;
import vn.edu.fpt.beefcare.service.VoucherPaymentService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.FarmAction;
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
    private final IdempotencyCommandService commands;

    public VoucherPaymentResource(VoucherPaymentService service, IdempotencyCommandService commands) {
        this.service = service;
        this.commands = commands;
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
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody RecordPaymentRequest request
    ) {
        FarmAction permission = VoucherKind.parse(type) == VoucherKind.ENTRY ? FarmAction.RECORD_ENTRY_PAYMENT : FarmAction.RECORD_EXIT_COLLECTION;
        PaymentResultDTO result = commands.execute(farmId, permission, "VOUCHER_PAYMENT_CREATE:" + type + ":" + voucherId, key, request, PaymentResultDTO.class, () -> service.record(farmId, VoucherKind.parse(type), voucherId, request));
        return ResponseEntity.created(URI.create("/api/farms/" + farmId + "/payments/" + result.payment().id())).body(result);
    }

    @GetMapping("/feed/receipts/{receiptId}/payments")
    public ResponseEntity<PaymentResultDTO> listFeedReceiptPayments(@PathVariable Long farmId,@PathVariable Long receiptId) {
        return ResponseEntity.ok(service.listFeedReceiptPayments(farmId,receiptId));
    }

    @PostMapping("/feed/receipts/{receiptId}/payments")
    public ResponseEntity<PaymentResultDTO> payFeedReceipt(@PathVariable Long farmId,@PathVariable Long receiptId,@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody RecordPaymentRequest request) {
        record Command(Long receiptId,RecordPaymentRequest body) {}
        PaymentResultDTO result=commands.execute(farmId,FarmAction.MANAGE_FEED,"FEED_RECEIPT_PAYMENT:"+receiptId,key,new Command(receiptId,request),PaymentResultDTO.class,()->service.recordFeedReceiptPayment(farmId,receiptId,request));
        return ResponseEntity.created(URI.create("/api/farms/"+farmId+"/payments/"+result.payment().id())).body(result);
    }

    @PostMapping("/payments/{paymentId}/void")
    public ResponseEntity<PaymentResultDTO> voidPayment(
        @PathVariable Long farmId,
        @PathVariable Long paymentId,
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody VoidPaymentRequest request
    ) {
        FarmAction permission = service.permissionForPayment(farmId, paymentId);
        return ResponseEntity.ok(commands.execute(farmId, permission, "VOUCHER_PAYMENT_VOID:" + paymentId, key, request, PaymentResultDTO.class, () -> service.voidPayment(farmId, paymentId, request)));
    }
}
