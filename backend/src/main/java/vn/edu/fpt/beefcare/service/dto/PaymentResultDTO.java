package vn.edu.fpt.beefcare.service.dto;

import java.util.List;

/** Result of recording / voiding a payment: the payment and the voucher's updated totals (list only on GET). */
public record PaymentResultDTO(VoucherPaymentDTO payment, PaymentSummaryDTO summary, List<VoucherPaymentDTO> payments) {
    public static PaymentResultDTO of(VoucherPaymentDTO payment, PaymentSummaryDTO summary) {
        return new PaymentResultDTO(payment, summary, null);
    }

    public static PaymentResultDTO list(List<VoucherPaymentDTO> payments, PaymentSummaryDTO summary) {
        return new PaymentResultDTO(null, summary, payments);
    }
}
