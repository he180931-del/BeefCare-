package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;

/**
 * Record a payment to a seller (entry voucher) or a collection from a buyer (exit voucher).
 *
 * @param amount         whole VND, positive, at most the outstanding amount
 * @param voucherVersion optional optimistic-lock version of the voucher the form was loaded with
 */
public record RecordPaymentRequest(
    @NotNull LocalDate paymentDate,
    @NotNull @Positive Long amount,
    @NotNull PaymentMethod method,
    @Size(max = 100) String reference,
    @Size(max = 500) String note,
    Integer voucherVersion
) {}
