package vn.edu.fpt.beefcare.service.dto;

import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;

/** Totals of a voucher: payment status is derived (Unpaid / Partly paid / Paid). overpaid is the MSG-FE06-23 difference. */
public record PaymentSummaryDTO(
    String voucherType,
    Long voucherId,
    String voucherCode,
    long total,
    long paid,
    long outstanding,
    long overpaid,
    PaymentState state,
    Integer voucherVersion
) {}
