package vn.edu.fpt.beefcare.service.dto;

import java.time.Instant;
import java.time.LocalDate;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;

public record VoucherPaymentDTO(
    Long id,
    String voucherType,
    Long voucherId,
    String voucherCode,
    PaymentDirection direction,
    LocalDate paymentDate,
    Long amount,
    PaymentMethod method,
    String reference,
    String note,
    PaymentRecordStatus status,
    Long recordedById,
    String recordedByName,
    Instant recordedAt,
    String voidReason,
    Instant voidedAt,
    Integer version
) {
    public static VoucherPaymentDTO from(VoucherPayment p) {
        boolean entry = p.getEntryVoucher() != null;
        return new VoucherPaymentDTO(
            p.getId(),
            entry ? "ENTRY" : "EXIT",
            entry ? p.getEntryVoucher().getId() : p.getExitVoucher().getId(),
            entry ? p.getEntryVoucher().getCode() : p.getExitVoucher().getCode(),
            p.getDirection(),
            p.getPaymentDate(),
            p.getAmount(),
            p.getMethod(),
            p.getReference(),
            p.getNote(),
            p.getStatus(),
            p.getRecordedBy().getId(),
            p.getRecordedBy().getFullName(),
            p.getRecordedAt(),
            p.getVoidReason(),
            p.getVoidedAt(),
            p.getVersion()
        );
    }
}
