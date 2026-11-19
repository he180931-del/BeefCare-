package vn.edu.fpt.beefcare.service.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

/** A cattle currently in a pen, with short situation hints (present only where the data exists). */
public record PenCattleDTO(
    Long id,
    String code,
    String earTagNumber,
    String name,
    Sex sex,
    LifeStage lifeStage,
    LocalDate sinceDate,
    BigDecimal latestWeightKg,
    boolean exitPending,
    List<ApiMessage> hints
) {}
