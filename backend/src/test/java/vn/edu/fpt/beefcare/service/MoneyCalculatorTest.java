package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;

class MoneyCalculatorTest {

    @Test
    void perKgLineAmountIsPriceTimesWeightRoundedToWholeVnd() {
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_KG, 85_000L, new BigDecimal("312.5"))).isEqualTo(26_562_500L);
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_KG, 85_001L, new BigDecimal("0.5"))).isEqualTo(42_501L);
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_KG, 1L, new BigDecimal("0.49"))).isZero();
    }

    @Test
    void perHeadLineAmountIsTheUnitPrice() {
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_HEAD, 18_000_000L, new BigDecimal("250"))).isEqualTo(18_000_000L);
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_HEAD, 18_000_000L, null)).isEqualTo(18_000_000L);
    }

    @Test
    void missingPriceOrWeightGivesZero() {
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_KG, null, new BigDecimal("300"))).isZero();
        assertThat(MoneyCalculator.lineAmount(PricingBasis.PER_KG, 80_000L, null)).isZero();
    }

    @Test
    void totalsAndOutstanding() {
        assertThat(MoneyCalculator.sum(List.of(10L, 20L, 30L))).isEqualTo(60L);
        assertThat(MoneyCalculator.totalPayable(60_000_000L, 2_000_000L)).isEqualTo(62_000_000L);
        assertThat(MoneyCalculator.totalReceivable(60_000_000L, 1_000_000L)).isEqualTo(59_000_000L);
        assertThat(MoneyCalculator.outstanding(62_000_000L, 20_000_000L)).isEqualTo(42_000_000L);
        assertThat(MoneyCalculator.outstanding(10L, 25L)).isZero();
        assertThat(MoneyCalculator.overpaid(10L, 25L)).isEqualTo(15L);
        assertThat(MoneyCalculator.overpaid(10L, 5L)).isZero();
    }

    @Test
    void paymentStateIsDerived() {
        assertThat(MoneyCalculator.paymentState(100, 0)).isEqualTo(PaymentState.UNPAID);
        assertThat(MoneyCalculator.paymentState(100, 40)).isEqualTo(PaymentState.PARTLY_PAID);
        assertThat(MoneyCalculator.paymentState(100, 100)).isEqualTo(PaymentState.PAID);
        assertThat(MoneyCalculator.paymentState(100, 120)).isEqualTo(PaymentState.PAID);
        assertThat(MoneyCalculator.paymentState(0, 0)).isEqualTo(PaymentState.PAID);
    }
}
