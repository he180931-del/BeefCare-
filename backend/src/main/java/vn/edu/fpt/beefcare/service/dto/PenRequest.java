package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;

/**
 * Create / update a pen (UC-FE04-02, UC-FE04-03).
 *
 * @param criteria        create: criteria of version 1; update: when present and different, saved as a new version from today
 * @param initialStatus   create only (default ACTIVE)
 * @param expectedVersion update only: optimistic-lock version of the pen the form was loaded with
 */
public record PenRequest(
    @NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9-]*") String code,
    @NotBlank @Size(max = 100) String name,
    @NotNull @Min(1) @Max(9999) Integer capacity,
    @Size(max = 500) String description,
    @Valid PenCriteriaDTO criteria,
    ActiveStatus initialStatus,
    Integer expectedVersion
) {}
