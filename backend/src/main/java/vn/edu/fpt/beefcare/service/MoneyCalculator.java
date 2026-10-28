package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;

/**
 * Money rules of section 5 / GBR-91. All amounts are whole VND (long).
 */
public final class MoneyCalculator {

    private MoneyCalculator() {}

    /** PER_KG: unit price x weight rounded to whole VND (half up); PER_HEAD: the unit price. A missing price is 0. */
    public static long lineAmount(PricingBasis basis, Long unitPrice, BigDecimal weightKg) {
        if (unitPrice == null || basis == null) {
            return 0L;
        }
        if (basis == PricingBasis.PER_HEAD) {
            return unitPrice;
        }
        if (weightKg == null) {
            return 0L;
        }
        return BigDecimal.valueOf(unitPrice).multiply(weightKg).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    public static long sum(Collection<Long> amounts) {
        return amounts.stream().mapToLong(a -> a == null ? 0L : a).sum();
    }

    /** Entry voucher: total payable = cattle amount + transport fee. */
    public static long totalPayable(long cattleAmount, long transportFee) {
        return cattleAmount + transportFee;
    }

    /** Exit voucher: total receivable = cattle amount - deductions. */
    public static long totalReceivable(long cattleAmount, long deductions) {
        return cattleAmount - deductions;
    }

    /** Total - sum of RECORDED payments; never negative (an over-payment left by a correction shows 0, MSG-FE06-23). */
    public static long outstanding(long total, long paid) {
        return Math.max(0L, total - paid);
    }

    /** How much the paid amount exceeds the total, 0 when it does not (MSG-FE06-23). */
    public static long overpaid(long total, long paid) {
        return Math.max(0L, paid - total);
    }

    /**
     * Unpaid when nothing is paid; Paid when the total is covered (also a zero total, as in v_herd_entry_voucher_payment);
     * otherwise Partly paid.
     */
    public static PaymentState paymentState(long total, long paid) {
        if (total <= 0 || paid >= total) {
            return PaymentState.PAID;
        }
        return paid <= 0 ? PaymentState.UNPAID : PaymentState.PARTLY_PAID;
    }
}
