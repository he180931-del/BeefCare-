package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class GrowthDtos {
    private GrowthDtos() {}
    public record Measurement(@NotNull Instant measuredAt,Long measuredBy,String method,
        @DecimalMin("1") @DecimalMax("1500") @Digits(integer=4,fraction=1) BigDecimal weightKg,
        BigDecimal heartGirthCm,BigDecimal bodyLengthCm,BigDecimal bcs,@Size(max=500) String note,boolean acknowledgedLargeChange) {}
    public record Correction(@NotBlank String action,@jakarta.validation.Valid Measurement values,@NotBlank @Size(max=500) String reason,@NotNull Integer expectedVersion) {}
    /**
     * A2 history row. {@code revisions} (GAP-FE08-01, BR-D15): corrections / exclusions of the record, oldest first, with the
     * values before the change; only on the single-cattle view and the correction answer (omitted from revision snapshots).
     */
    public record Record(Long id,Long cattleId,Instant measuredAt,Instant recordedAt,Long measuredBy,String measuredByName,
        String method,BigDecimal weightKg,String basis,BigDecimal heartGirthCm,BigDecimal bodyLengthCm,BigDecimal bcs,
        String note,String status,boolean corrected,Integer version,
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) List<Revision> revisions) {
        public Record(Long id,Long cattleId,Instant measuredAt,Instant recordedAt,Long measuredBy,String measuredByName,
            String method,BigDecimal weightKg,String basis,BigDecimal heartGirthCm,BigDecimal bodyLengthCm,BigDecimal bcs,
            String note,String status,boolean corrected,Integer version) {
            this(id,cattleId,measuredAt,recordedAt,measuredBy,measuredByName,method,weightKg,basis,heartGirthCm,bodyLengthCm,bcs,note,status,corrected,version,null);
        }
        public Record withRevisions(List<Revision> list) {
            return new Record(id,cattleId,measuredAt,recordedAt,measuredBy,measuredByName,method,weightKg,basis,heartGirthCm,bodyLengthCm,bcs,note,status,corrected,version,list);
        }
    }
    /** One immutable correction / exclusion: who, when, why, values before and after (UC-FE08-03, TC-08-13). */
    public record Revision(Long id,Instant changedAt,String changedBy,String action,String reason,Map<String,Object> before,Map<String,Object> after) {}
    /**
     * A2. {@code targetKg} / {@code missingKg} / {@code adg60} / {@code finishingDays} (GAP-FE08-02, GBR-107): finishing target
     * of a FATTENING animal from the farm parameter TARGET_FINISHING_WEIGHT_KG, kg still missing from the latest VALID weight,
     * the 60-day ADG used and the days from that weight to the projected date; null when the projection does not apply.
     */
    public record Summary(Record currentWeight,BigDecimal latestBcs,BigDecimal adg,Integer windowDays,
        LocalDate nextWeighing,LocalDate projectedFinishingDate,String finishingStatus,int measurements,List<Record> records,
        BigDecimal targetKg,BigDecimal missingKg,BigDecimal adg60,Integer finishingDays) {}
}
