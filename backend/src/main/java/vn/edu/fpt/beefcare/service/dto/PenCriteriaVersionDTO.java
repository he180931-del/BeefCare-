package vn.edu.fpt.beefcare.service.dto;

import java.time.LocalDate;
import java.util.List;

public record PenCriteriaVersionDTO(
    Long id,
    Integer versionNo,
    LocalDate effectiveFrom,
    Long changedById,
    String changedByName,
    PenCriteriaDTO criteria,
    List<String> rows
) {}
