package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class FeedManagementDtos {
    private FeedManagementDtos() {}

    public record ReceiptLineRequest(@NotNull Long feedItemId, @Size(max=30) String lotNumber, LocalDate expiryDate,
        @NotNull @DecimalMin(value="0.001") BigDecimal quantityPurchase, @Size(max=30) String purchaseUnit,
        @NotNull @PositiveOrZero Long unitPrice) {}
    public record CreateReceiptRequest(@NotNull LocalDate receiptDate, @NotNull Long supplierId,
        @Size(max=50) String invoiceNumber, @Size(max=100) String receivedBy, @Size(max=100) String storageLocation,
        @Size(max=1000) String note, @PositiveOrZero Long transportFee,
        @NotEmpty List<@Valid ReceiptLineRequest> lines, boolean postNow) {}
    public record UpdateDraftReceiptRequest(@NotNull Integer expectedVersion, @NotNull LocalDate receiptDate, @NotNull Long supplierId,
        @Size(max=50) String invoiceNumber, @Size(max=100) String receivedBy, @Size(max=100) String storageLocation,
        @Size(max=1000) String note, @PositiveOrZero Long transportFee, @NotEmpty List<@Valid ReceiptLineRequest> lines) {}
    public record ReceiptLineView(Long id, Long feedItemId, String feedCode, String feedName, String lotNumber,
        LocalDate expiryDate, BigDecimal quantityPurchase, String purchaseUnit, BigDecimal kgReceived, Long unitPrice, Long lineAmount) {}
    public record ReceiptView(Long id, String code, LocalDate receiptDate, Long supplierId, String supplierName,
        String status, long goodsAmount, long transportFee, long totalPayable, Integer version, List<ReceiptLineView> lines) {}
    public record VoidReceiptRequest(@NotBlank @Size(max=500) String reason, @NotNull Integer expectedVersion) {}
    public record StockAdjustmentLine(@NotNull Long feedItemId, @NotNull @DecimalMin("0.0") BigDecimal countedKg,
        @Size(max=500) String reason) {}
    public record StockAdjustmentRequest(@NotNull LocalDate countDate, @NotBlank @Size(max=30) String adjustmentType,
        @Size(max=200) String countedBy, @NotEmpty List<@Valid StockAdjustmentLine> lines) {}
    public record StockView(Long feedItemId, String code, String name, String group, BigDecimal onHandKg,
        BigDecimal minimumStockKg, BigDecimal averageDailyUseKg, BigDecimal daysOfCover, BigDecimal stockValue,
        String status, Integer version,String nearestLotNumber,LocalDate nearestLotExpiryDate) {}
    public record MovementView(Long id, Long feedItemId, String feedCode, String movementType, BigDecimal quantityKg,
        BigDecimal unitCost, BigDecimal balanceAfterKg, String sourceType, Long sourceId, java.time.Instant occurredAt) {}
    public record VersionRequest(@NotNull Integer expectedVersion) {}
    public record StockAdjustmentResult(List<StockView> items) {}
    public record RationComponentRequest(@NotNull Long feedItemId,@NotNull @DecimalMin("0.0") BigDecimal session1Kg,
        @NotNull @DecimalMin("0.0") BigDecimal session2Kg,@NotNull @DecimalMin("0.0") BigDecimal session3Kg) {}
    public record SaveRationRequest(@Size(max=30) String rationCode,@NotBlank @Size(max=100) String name,
        @Size(max=30) String herdGroup,@Size(max=500) String basis,@NotNull LocalDate effectiveFrom,
        @NotNull @Min(1) @Max(3) Integer sessionsPerDay,@NotEmpty List<@NotBlank String> sessionTimes,
        @NotEmpty List<@NotNull Long> penIds,@NotEmpty List<@Valid RationComponentRequest> components) {}
    public record RationComponentView(Long feedItemId,String feedCode,String feedName,BigDecimal session1Kg,
        BigDecimal session2Kg,BigDecimal session3Kg,BigDecimal dailyKg,BigDecimal estimatedDailyCost) {}
    public record RationView(Long id,String rationCode,Integer versionNo,String name,String herdGroup,String basis,
        LocalDate effectiveFrom,LocalDate effectiveTo,String status,Integer sessionsPerDay,List<Long> penIds,
        List<RationComponentView> components) {}
    public record FeedingLineRequest(@NotNull Long feedItemId,@NotNull @DecimalMin("0.0") BigDecimal actualKg) {}
    public record RecordFeedingRequest(@NotNull Long penId,@NotNull LocalDate feedingDate,@NotNull @Min(1) @Max(3) Integer sessionNo,
        @Size(max=100) String fedBy,@NotEmpty List<@Valid FeedingLineRequest> lines) {}
    public record FeedingLineView(Long feedItemId,String feedCode,BigDecimal plannedKg,BigDecimal actualKg,BigDecimal unitCost,Long totalCost) {}
    public record FeedingView(Long id,Long penId,LocalDate feedingDate,Integer sessionNo,Integer headCount,String status,
        Integer version,Long rationVersionId,List<FeedingLineView> lines) {}
    public record FeedingVoidRequest(@NotBlank @Size(max=500) String reason,@NotNull Integer expectedVersion) {}
    public record FeedingCorrectionRequest(@NotBlank @Size(max=500) String reason,@NotNull Integer expectedVersion,
        @Size(max=100) String fedBy,@NotEmpty List<@Valid FeedingLineRequest> lines) {}
    public record FeedReminderView(String ruleType,Long sourceId,Long feedItemId,Long penId,String code,String title,
        java.time.Instant dueTime,String status) {}
    public record ConsumptionRow(Long penId,String penCode,String herdGroup,Long feedItemId,String feedCode,
        BigDecimal plannedKg,BigDecimal actualKg,BigDecimal varianceRatio,Long totalCost) {}
    public record ConsumptionReport(LocalDate from,LocalDate to,List<ConsumptionRow> rows,BigDecimal adjustmentLossKg,
        Long adjustmentLossValue,java.time.Instant generatedAt) {}
    public record ConsumptionReportRequest(@NotNull LocalDate from,@NotNull LocalDate to) {}
    public record FeedItemRequest(@NotBlank @Size(max=50) @Pattern(regexp="TA-[0-9]{2,}") String code,@NotBlank @Size(max=150) String name,
        @NotBlank @Size(max=30) String feedGroup,@Size(max=30) String purchaseUnit,
        @DecimalMin(value="0.001") BigDecimal kgPerPurchaseUnit,@DecimalMin("0.0") BigDecimal minimumStockKg,
        @NotNull Boolean available,Integer expectedVersion) {}
    public record FeedItemView(Long id,String code,String name,String feedGroup,String purchaseUnit,
        BigDecimal kgPerPurchaseUnit,String stockUnit,BigDecimal onHandKg,BigDecimal averageUnitCost,
        BigDecimal minimumStockKg,Boolean available,Integer version) {}
}
