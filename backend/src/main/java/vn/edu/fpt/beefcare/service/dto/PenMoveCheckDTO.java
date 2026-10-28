package vn.edu.fpt.beefcare.service.dto;

import java.time.LocalDate;
import java.util.List;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.CriterionResult;

/**
 * Reception-check table of the Move Pen popup. {@code blocked} means the move cannot be confirmed (destination
 * INACTIVE or too few free places, MSG-FE04-05 in {@code block}); a cattle {@code error} blocks the move for that
 * cattle (MSG-COM-13/17/18, MSG-FE04-09); {@code alreadyInDestination} cattle are skipped (MSG-FE04-07).
 */
public record PenMoveCheckDTO(
    Long toPenId,
    String toPenCode,
    boolean destinationActive,
    int capacity,
    int headcount,
    int freePlaces,
    int movingCount,
    boolean blocked,
    ApiMessage block,
    Integer criteriaVersionNo,
    List<CattleCheck> cattle
) {
    public record CattleCheck(
        Long cattleId,
        String cattleCode,
        Long currentPenId,
        String currentPenCode,
        LocalDate currentFromDate,
        boolean alreadyInDestination,
        ApiMessage error,
        boolean allMet,
        boolean warningReasonRequired,
        ApiMessage warning,
        List<CriterionResult> results
    ) {}
}
