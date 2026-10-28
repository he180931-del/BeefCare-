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
        boolean exit = p.getExitVoucher() != null;
        String kind = entry ? "ENTRY" : exit ? "EXIT" : "FEED_RECEIPT";
        Long voucherId = entry ? p.getEntryVoucher().getId() : exit ? p.getExitVoucher().getId() : p.getFeedReceipt().getId();
        String voucherCode = entry ? p.getEntryVoucher().getCode() : exit ? p.getExitVoucher().getCode() : p.getFeedReceipt().getCode();
        return new VoucherPaymentDTO(
            p.getId(),
            kind,
            voucherId,
            voucherCode,
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
