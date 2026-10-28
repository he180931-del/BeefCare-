package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;

/** Response bodies of the herd entry voucher feature. */
public final class EntryDtos {

    private EntryDtos() {}

    /** A message for the client: code (+ params) and the default text in the request language. */
    public record Notice(String code, Map<String, Object> params, String message) {}

    /** One line of a voucher; data echoes the normalised draft input, the other fields are the stored / derived facts. */
    public record Line(
        Long id,
        Integer lineNo,
        EntryLineStatus status,
        Long cattleId,
        String cattleCode,
        String earTagNumber,
        EntryLineRequest data,
        LocalDate entryDate,
        BigDecimal entryWeightKg,
        WeightBasis weightBasis,
        boolean estimatedWeight,
        Long unitPrice,
        long lineAmount,
        Long penId,
        String penCode,
        LocalDate quarantineUntil,
        Integer ageMonthsAtEntry,
        LifeStage proposedLifeStage,
        boolean corrected,
        Long calfOutcomeId,
        String damCode,
        String currentHerdStatus,
        Long currentPenId,
        String currentPenCode,
        Integer version
    ) {}

    public record HistoryItem(Instant at, String kind, String actor, Object details) {}

    public record Voucher(
        Long id,
        String code,
        EntryType entryType,
        EntryVoucherStatus status,
        LocalDate entryDate,
        Long sellerId,
        String sellerName,
        String sellerPhone,
        String quarantineCertNo,
        String vehiclePlate,
        String note,
        PricingBasis pricingBasis,
        long cattleAmount,
        long transportFee,
        long totalPayable,
        long amountPaid,
        long outstanding,
        long overpaid,
        PaymentState paymentState,
        PaymentMethod paymentMethod,
        LocalDate paymentDueDate,
        String createdBy,
        String postedBy,
        Instant postedAt,
        String voidReason,
        String voidedBy,
        Instant voidedAt,
        Instant createdAt,
        Integer version,
        int cattleCount,
        BigDecimal totalWeightKg,
        int estimatedWeightCount,
        List<Line> lines,
        List<VoucherPaymentDTO> payments,
        List<HistoryItem> history
    ) {}

    /** A row of the SCR-23 list. */
    public record Row(
        Long id,
        String code,
        LocalDate entryDate,
        EntryType entryType,
        EntryVoucherStatus status,
        String sellerName,
        String quarantineCertNo,
        List<String> damCodes,
        int cattleCount,
        int estimatedWeightCount,
        BigDecimal totalWeightKg,
        Long totalAmount,
        Long outstanding,
        PaymentState paymentState,
        String voidReason,
        Integer version
    ) {}

    public record OwedVoucher(Long id, String code, long outstanding) {}

    /** Summary tiles of SCR-23. */
    public record Tiles(
        int postedVouchers,
        int draftVouchers,
        int cattleEntered,
        int cattlePurchased,
        int cattleFarmBorn,
        long purchaseAmount,
        long owedToSellers,
        List<OwedVoucher> owedVouchers
    ) {}

    public record VoucherList(Tiles tiles, Map<String, Integer> statusCounts, List<Row> items) {}

    public record Issue(Integer lineNo, String severity, String code, String field, Map<String, Object> params, String message) {}

    public record OccupancyChange(Long penId, String penCode, int capacity, int before, int after, boolean willBeFull) {}

    public record LineCheck(Integer lineNo, String earTag, boolean ok, List<Map<String, Object>> receptionCheck) {}

    /** Pre-save / pre-post checks panel (SCR-24 summary panel). */
    public record Checks(
        Long voucherId,
        String voucherCode,
        boolean canPost,
        int cattleCount,
        BigDecimal totalWeightKg,
        int estimatedWeightCount,
        List<OccupancyChange> occupancy,
        List<LineCheck> lines,
        List<Issue> errors,
        List<Issue> warnings
    ) {}

    public record MatchingSchedule(Long scheduleId, String vaccineName, String targetGroup, List<String> cattleCodes) {}

    /** Result of posting (also returned unchanged on a repeated post). */
    public record PostResult(
        Voucher voucher,
        List<String> cattleCodes,
        String firstCode,
        String lastCode,
        boolean alreadyPosted,
        boolean printQr,
        Notice posted,
        List<Issue> warnings,
        List<MatchingSchedule> matchingSchedules,
        Notice schedulesNotice
    ) {}

    public record VoidCheckRow(Long entryId, Integer lineNo, Long cattleId, String cattleCode, List<String> eventsAfterEntry, boolean canVoid, String reason) {}

    public record VoidCheck(
        Long voucherId,
        String voucherCode,
        String entryType,
        LocalDate entryDate,
        int cattleCount,
        String sellerName,
        long paid,
        boolean canVoid,
        List<VoidCheckRow> rows,
        Notice confirm,
        Notice blocked
    ) {}

    public record VoidResult(Voucher voucher, Notice notice) {}

    public record EntryVoidResult(Voucher voucher, Line line, Notice notice, Notice overpaidNotice, long overpaid) {}

    public record CorrectionResult(Voucher voucher, Line line, Notice notice, Notice overpaidNotice, long overpaid, Long revisionId) {}

    public record ImportRow(
        int row,
        String earTag,
        String breed,
        String sex,
        String weight,
        String pen,
        String result,
        boolean added,
        List<Issue> issues
    ) {}

    public record ImportResult(
        int total,
        int valid,
        int warnings,
        int errors,
        int added,
        boolean committed,
        Notice summary,
        Notice addedNotice,
        List<ImportRow> rows,
        Voucher voucher
    ) {}

    public record PendingCalf(
        Long calfOutcomeId,
        Long calvingId,
        Long damId,
        String damCode,
        boolean damActive,
        String sireCode,
        String sex,
        LocalDate birthDate,
        BigDecimal birthWeightKg,
        String tagCode,
        Long proposedPenId,
        String proposedPenCode,
        Long defaultPurposeId,
        String registrationState,
        Long draftVoucherId
    ) {}

    public record RegisteredCalf(Long voucherId, String voucherCode, Long cattleId, String cattleCode, String damCode, Notice notice) {}

    public record Partner(
        Long id,
        String name,
        boolean seller,
        boolean buyer,
        boolean supplier,
        String phone,
        String area,
        String note,
        String status,
        Integer version
    ) {}
}
