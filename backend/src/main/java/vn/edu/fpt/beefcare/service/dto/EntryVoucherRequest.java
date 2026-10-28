package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;

/**
 * Create (POST) or replace (PUT) a DRAFT entry voucher with its lines. entryType is required on create and fixed after
 * the first save. For a PURCHASE a seller is chosen (sellerId) or created inline (newSeller). amountPaid is the
 * intended initial payment: it becomes a payment only when the voucher is posted.
 */
public record EntryVoucherRequest(
    EntryType entryType,
    LocalDate entryDate,
    Long sellerId,
    @Valid NewPartner newSeller,
    @Size(max = 50) String quarantineCertNo,
    @Size(max = 20) String vehiclePlate,
    @Size(max = 1000) String note,
    PricingBasis pricingBasis,
    @PositiveOrZero Long transportFee,
    @PositiveOrZero Long amountPaid,
    PaymentMethod paymentMethod,
    LocalDate paymentDueDate,
    @Valid List<EntryLineRequest> lines,
    Integer expectedVersion
) {
    /** "+ Add new source" on the voucher (GBR-97). */
    public record NewPartner(@NotBlank @Size(max = 150) String name, @Size(max = 50) String phone, @Size(max = 255) String area) {}
}
