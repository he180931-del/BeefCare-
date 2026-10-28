package vn.edu.fpt.beefcare.web.rest;

import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.Page;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.ReceiptDetail;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.ReceiptPage;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.SubscriptionDetail;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.SubscriptionRow;

/** PM read-only views: SCR-61 Platform Subscriptions (UC-FE19-04) and SCR-70 Subscription Receipts (UC-FE21-01). */
@RestController
@RequestMapping("/api/platform")
public class PlatformSubscriptionResource {

    private final PlatformSubscriptionQueryService queries;

    public PlatformSubscriptionResource(PlatformSubscriptionQueryService queries) {
        this.queries = queries;
    }

    /** coverage: ALL, CURRENT, FUTURE_ONLY or NONE; endFrom/endTo filter the confirmed end date (Asia/Ho_Chi_Minh). */
    @GetMapping("/subscriptions")
    public Page<SubscriptionRow> subscriptions(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String coverage,
        @RequestParam(required = false) String serviceStatus,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endFrom,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endTo,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return queries.subscriptions(q, coverage, serviceStatus, endFrom, endTo, page, size);
    }

    @GetMapping("/subscriptions/{farmId}")
    public SubscriptionDetail subscription(@PathVariable Long farmId) {
        return queries.subscription(farmId);
    }

    /** Receipts by bank-paid time (GBR-82); the tiles count and total the whole filtered period. */
    @GetMapping("/finance/receipts")
    public ReceiptPage receipts(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) Long farmId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bankFrom,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate bankTo,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return queries.receipts(q, farmId, bankFrom, bankTo, page, size);
    }

    @GetMapping("/finance/receipts/{paymentId}")
    public ReceiptDetail receipt(@PathVariable Long paymentId) {
        return queries.receipt(paymentId);
    }
}
