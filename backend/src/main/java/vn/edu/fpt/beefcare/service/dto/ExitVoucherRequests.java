package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;

/**
 * Request bodies of the herd exit voucher endpoints (FE-13). Required fields are checked in the service so the
 * client receives the spec message code (for example MSG-COM-06) instead of a generic validation error.
 */
public final class ExitVoucherRequests {

    private ExitVoucherRequests() {}

    /** One cattle line. A missing weight defaults to the latest valid weight with basis ESTIMATED (GBR-92). */
    public record Line(
        Long cattleId,
        @Min(0) @Max(100000) BigDecimal exitWeightKg,
        WeightBasis weightBasis,
        @Min(0) @Max(1_000_000_000L) Long unitPrice
    ) {}

    /** Create (POST) or update (PUT) of a DRAFT voucher, or completion of a PENDING death voucher. */
    public record Save(
        ExitType exitType,
        LocalDate exitDate,
        Long buyerId,
        @Size(max = 150) String destination,
        @Size(max = 50) String transportCertNo,
        @Size(max = 20) String vehiclePlate,
        @Size(max = 1000) String note,
        LossKind lossKind,
        @Size(max = 1000) String deathCause,
        @Size(max = 255) String carcassDisposal,
        PricingBasis pricingBasis,
        @Min(0) Long deductions,
        @Min(0) Long depositCollected,
        PaymentMethod paymentMethod,
        LocalDate collectionDueDate,
        @Valid List<Line> lines,
        Integer expectedVersion
    ) {}

    /** Adds cattle to a DRAFT voucher by internal ids (popup) or by scanning a QR tag code. */
    public record AddCattle(List<Long> cattleIds, @Size(max = 100) String tagCode, Integer expectedVersion) {}

    public record Confirm(Boolean acknowledged, Integer expectedVersion) {}

    public record Dismiss(@Size(max = 500) String reason, Integer expectedVersion) {}

    /** penOverrides: cattleId to the pen it returns to; warningReasons: cattleId to the reception warning reason. */
    public record Void(@Size(max = 500) String reason, Map<Long, Long> penOverrides, Map<Long, String> warningReasons, Integer expectedVersion) {}
}
