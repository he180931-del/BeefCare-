package vn.edu.fpt.beefcare.service.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Move one or several cattle to another pen (UC-FE04-05).
 *
 * @param reason          required, at most 500 characters; "Correction" marks a reverse move
 * @param warningReasons  cattle id to reason, required for each cattle that fails a reception criterion
 * @param cattleVersions  optional cattle id to the version the form was loaded with
 * @param performedBy     optional app-user id of an ACTIVE farm member, default the signed-in user
 */
public record PenMoveRequest(
    @NotEmpty List<@NotNull Long> cattleIds,
    @NotNull Long toPenId,
    LocalDate moveDate,
    @Size(max = 500) String reason,
    Map<Long, String> warningReasons,
    Map<Long, Integer> cattleVersions,
    Long performedBy
) {}
