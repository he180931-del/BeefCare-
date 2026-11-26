package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;

class HerdExitVoucherMoneyValidationUnitTest {
    private final HerdExitVoucherService service = mock(HerdExitVoucherService.class, CALLS_REAL_METHODS);

    @Test
    void tc1316CombinedInvalidInputsReturnDeductionsErrorBeforeDepositError() {
        HerdExitVoucher voucher = saleVoucher(1_000_000L, 1_000_001L, 1L);

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "validateMoney", voucher))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10));
    }

    @Test
    void depositAboveReceivableWithValidDeductionsReturnsPaymentAmountError() {
        HerdExitVoucher voucher = saleVoucher(1_000_000L, 100_000L, 900_001L);

        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(service, "validateMoney", voucher))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE06_13);
                assertThat(error.getParams()).containsEntry("amount", 900_000L);
            });
    }

    private static HerdExitVoucher saleVoucher(long cattleAmount, long deductions, long deposit) {
        HerdExitVoucher voucher = new HerdExitVoucher();
        voucher.setExitType(ExitType.SALE);
        voucher.setCattleAmount(cattleAmount);
        voucher.setDeductions(deductions);
        voucher.setAmountCollected(deposit);
        return voucher;
    }
}
