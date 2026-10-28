package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;

/** Responses of the herd exit voucher endpoints (FE-13): list rows, detail, checks, confirm / void results. */
public final class ExitVoucherDTO {

    private ExitVoucherDTO() {}

    public record Ref(Long id, String label) {}

    public record Message(String code, Map<String, Object> params, String text) {}

    // ------------------------------------------------------------------ pre-confirmation checks (GBR-35, GBR-94)

    public record Withdrawal(LocalDate endDate, boolean breach) {}

    public record CaseRef(Long id, String status, LocalDate openedDate) {}

    public record Counted(int count, List<Long> ids) {}

    public record PregnancyRef(Long id, LocalDate expectedCalvingDate) {}

    /** Structured check result of one cattle. Warnings never block. */
    public record CattleCheck(
        Long cattleId,
        String cattleCode,
        Long penId,
        String penCode,
        Withdrawal withdrawal,
        List<CaseRef> openCases,
        Counted futureDoses,
        Counted futureReminders,
        PregnancyRef openPregnancy,
        List<Long> draftCalfIds,
        boolean hasWarnings,
        List<Message> messages
    ) {}

    public record Occupancy(Long penId, String penCode, int capacity, int before, int after) {}

    public record ChecksResult(Long voucherId, String code, Integer version, LocalDate exitDate, List<CattleCheck> cattle, List<Occupancy> occupancy) {}

    // ------------------------------------------------------------------ effects of a confirmed exit

    public record AssignmentRef(Long penId, String penCode, LocalDate fromDate, LocalDate toDate) {}

    /** What the exit closed or cancelled for one cattle; listed for review when the voucher is voided, never restored. */
    public record CattleEffects(
        Long cattleId,
        String cattleCode,
        AssignmentRef closedAssignment,
        List<Long> cancelledDoseIds,
        List<Long> cancelledReminderIds,
        List<Long> closedCaseIds,
        Long closedPregnancyId,
        List<Long> pendingCalfIds
    ) {}

    /** What is persisted in herd_exit.check_results. */
    public record StoredLine(CattleCheck check, CattleEffects effects) {}

    // ------------------------------------------------------------------ voucher

    public record Line(
        Long id,
        Integer lineNo,
        Long cattleId,
        String cattleCode,
        String earTagNumber,
        String breedName,
        Sex sex,
        LifeStage lifeStage,
        HerdStatus herdStatus,
        boolean exitPending,
        Long penId,
        String penCode,
        BigDecimal exitWeightKg,
        WeightBasis weightBasis,
        boolean estimated,
        Long unitPrice,
        Long lineAmount,
        ExitLineStatus status,
        CattleCheck check
    ) {}

    public record HistoryEvent(Instant time, String type, String actor, String text, Map<String, Object> data) {}

    public record Detail(
        Long id,
        String code,
        ExitType exitType,
        ExitVoucherStatus status,
        boolean loss,
        LocalDate exitDate,
        Ref buyer,
        String destination,
        String transportCertNo,
        String vehiclePlate,
        String note,
        LossKind lossKind,
        String deathCause,
        String carcassDisposal,
        Ref sourceHealthCase,
        PricingBasis pricingBasis,
        Long cattleAmount,
        Long deductions,
        Long totalReceivable,
        Long amountCollected,
        Long outstanding,
        PaymentMethod paymentMethod,
        LocalDate collectionDueDate,
        Ref reportedBy,
        Ref confirmedBy,
        Instant confirmedAt,
        String closeReason,
        Ref closedBy,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        Integer version,
        int cattleCount,
        BigDecimal totalWeightKg,
        int estimatedWeightCount,
        List<Line> lines,
        List<Occupancy> occupancy,
        PaymentSummaryDTO payment,
        List<VoucherPaymentDTO> payments,
        List<HistoryEvent> history
    ) {}

    public record ConfirmResult(Detail voucher, Message message, boolean repeated, List<CattleEffects> effects) {}

    public record VoidResult(Detail voucher, Message message, List<CattleEffects> reviewList) {}

    public record DismissResult(Detail voucher, Message message) {}

    // ------------------------------------------------------------------ void preflight (GBR-36)

    public record PenOption(Long penId, String penCode, boolean active, int freePlaces) {}

    public record VoidCattle(Long cattleId, String cattleCode, PenOption lastPen, boolean needsPenOverride) {}

    public record VoidCheck(
        Long voucherId,
        String code,
        Integer version,
        boolean voidable,
        List<VoidCattle> cattle,
        List<Occupancy> occupancyAfter,
        List<CattleEffects> reviewList,
        Message message
    ) {}

    // ------------------------------------------------------------------ list (SCR-41)

    public record Row(
        Long id,
        String code,
        LocalDate exitDate,
        ExitType exitType,
        ExitVoucherStatus status,
        boolean loss,
        Ref buyer,
        String destination,
        String transportCertNo,
        LossKind lossKind,
        String deathCause,
        Ref sourceHealthCase,
        List<String> pens,
        int cattleCount,
        BigDecimal totalWeightKg,
        boolean weightEstimated,
        Long totalReceivable,
        Long outstanding,
        String closeReason,
        Integer version
    ) {}

    public record Tiles(
        Map<ExitType, Integer> cattleExitedByType,
        int cattleExited,
        long salesRevenue,
        long toCollect,
        int vouchersToCollect,
        int awaitingOwner
    ) {}

    public record ListResult(LocalDate from, LocalDate to, Tiles tiles, Map<String, Integer> statusCounts, List<Row> vouchers) {}

    // ------------------------------------------------------------------ selectable cattle (popup)

    public record LatestWeight(BigDecimal weightKg, LocalDate date, WeightBasis basis) {}

    public record SelectableCattle(
        Long cattleId,
        String cattleCode,
        String earTagNumber,
        String name,
        String breedName,
        Sex sex,
        LifeStage lifeStage,
        String herdGroup,
        Long penId,
        String penCode,
        Integer ageMonths,
        LatestWeight latestWeight,
        LocalDate withdrawalEndDate,
        Long openCaseId
    ) {}
}
