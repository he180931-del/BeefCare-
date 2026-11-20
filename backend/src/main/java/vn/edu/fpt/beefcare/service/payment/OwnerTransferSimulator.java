package vn.edu.fpt.beefcare.service.payment;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmAccessService;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult;

/**
 * Local-only "Giả lập chuyển khoản" on SCR-59: the Owner who created a request plays the bank and SePay for it.
 * The event is built from the request's own snapshot (code, amount, receiving account and bank) and goes through
 * the same simulator pipeline as the PM tool, so matching, confirmation and e-mail behave exactly as for a webhook.
 * Not a transaction on purpose: the pipeline commits evidence and job in its own transactions.
 */
@Service
@Profile({ "dev", "local", "testh2" })
public class OwnerTransferSimulator {

    /** Largest integer a browser keeps exactly, so the generated SePay ID displays unchanged on SCR-62. */
    private static final long MAX_SAFE_ID = 9_007_199_254_740_991L;

    private final SePayWebhookService sepay;
    private final FarmAccessService farmAccess;
    private final PaymentRepository payments;
    private final FarmClock clock;

    public OwnerTransferSimulator(SePayWebhookService sepay, FarmAccessService farmAccess, PaymentRepository payments, FarmClock clock) {
        this.sepay = sepay;
        this.farmAccess = farmAccess;
        this.payments = payments;
        this.clock = clock;
    }

    /** @param amountVnd amount the simulated bank received; null transfers exactly the requested amount. */
    public WebhookResult transfer(Long farmId, Long paymentId, BigDecimal amountVnd) {
        sepay.requireSimulator();
        // Same permission as creating the request: only the farm's Owner.
        farmAccess.require(farmId, FarmAction.MANAGE_FARM_INFORMATION);
        Payment payment = payments.findFirstByIdAndSubscription_Farm_Id(paymentId, farmId)
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if (amountVnd != null && amountVnd.signum() <= 0) throw DomainException.invalid("amountVnd");
        long transactionId = ThreadLocalRandom.current().nextLong(1_000_000_000L, MAX_SAFE_ID);
        String quote = payment.getQuoteRef();
        return sepay.receiveSimulated(new SePayPayload(
            transactionId,
            payment.getReceivingBankCode(),
            clock.now().truncatedTo(ChronoUnit.MICROS).toString(),
            payment.getReceivingAccount(),
            quote,
            quote + " gia lap chuyen khoan",
            "IN",
            amountVnd != null ? amountVnd : payment.getAmountVnd(),
            "MOCK-" + transactionId
        ));
    }
}
