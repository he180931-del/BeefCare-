package vn.edu.fpt.beefcare.service.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDate;
import java.util.List;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;

/** A pen with its derived occupancy; the detail view also fills criteriaVersions and cattle, writes fill message. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PenDTO(
    Long id,
    String code,
    String name,
    int capacity,
    String description,
    ActiveStatus status,
    LocalDate statusEffectiveDate,
    String statusReason,
    int headcount,
    int freePlaces,
    boolean full,
    String acceptsSummary,
    PenCriteriaVersionDTO currentCriteria,
    Integer version,
    List<PenCriteriaVersionDTO> criteriaVersions,
    List<PenCattleDTO> cattle,
    ApiMessage message
) {
    public PenDTO withMessage(ApiMessage m) {
        return new PenDTO(
            id,
            code,
            name,
            capacity,
            description,
            status,
            statusEffectiveDate,
            statusReason,
            headcount,
            freePlaces,
            full,
            acceptsSummary,
            currentCriteria,
            version,
            criteriaVersions,
            cattle,
            m
        );
    }
}
