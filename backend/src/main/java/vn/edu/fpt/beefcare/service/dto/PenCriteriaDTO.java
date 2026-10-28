package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.math.BigDecimal;
import java.util.Set;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

/** Reception criteria of a pen; each criterion type appears at most once, null or empty means "not set". */
public record PenCriteriaDTO(
    Set<PurposeType> purposeTypes,
    Set<LifeStage> lifeStages,
    Sex sex,
    @Min(0) @Max(240) Integer minAgeMonths,
    @DecimalMin("1") @DecimalMax("1500") BigDecimal minWeightKg
) {}
