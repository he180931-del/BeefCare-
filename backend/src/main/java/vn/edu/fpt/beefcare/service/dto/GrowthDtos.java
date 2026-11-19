package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class GrowthDtos {
    private GrowthDtos() {}
    public record Measurement(@NotNull Instant measuredAt,Long measuredBy,String method,
        @DecimalMin("1") @DecimalMax("1500") @Digits(integer=4,fraction=1) BigDecimal weightKg,
        BigDecimal heartGirthCm,BigDecimal bodyLengthCm,BigDecimal bcs,@Size(max=500) String note,boolean acknowledgedLargeChange) {}
    public record Correction(@NotBlank String action,@jakarta.validation.Valid Measurement values,@NotBlank @Size(max=500) String reason,@NotNull Integer expectedVersion) {}
    public record Record(Long id,Long cattleId,Instant measuredAt,Instant recordedAt,Long measuredBy,String measuredByName,
        String method,BigDecimal weightKg,String basis,BigDecimal heartGirthCm,BigDecimal bodyLengthCm,BigDecimal bcs,
        String note,String status,boolean corrected,Integer version) {}
    public record Summary(Record currentWeight,BigDecimal latestBcs,BigDecimal adg,Integer windowDays,
        LocalDate nextWeighing,LocalDate projectedFinishingDate,String finishingStatus,int measurements,List<Record> records) {}
}
