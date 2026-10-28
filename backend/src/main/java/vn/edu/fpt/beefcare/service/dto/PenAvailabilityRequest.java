package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;

/** Stop (INACTIVE) or resume (ACTIVE) new placements in a pen (UC-FE04-04); never moves cattle (GBR-20). */
public record PenAvailabilityRequest(
    @NotNull ActiveStatus status,
    @NotNull LocalDate effectiveDate,
    @NotBlank @Size(max = 500) String reason,
    Integer expectedVersion
) {}
