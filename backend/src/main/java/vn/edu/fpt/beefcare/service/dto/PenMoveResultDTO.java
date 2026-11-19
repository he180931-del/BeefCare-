package vn.edu.fpt.beefcare.service.dto;

import java.time.LocalDate;
import java.util.List;

public record PenMoveResultDTO(List<Moved> moved, List<Skipped> skipped, ApiMessage message, PenDTO destination) {
    public record Moved(
        Long cattleId,
        String cattleCode,
        Long assignmentId,
        Long fromPenId,
        String fromPenCode,
        Long toPenId,
        String toPenCode,
        LocalDate moveDate,
        String source
    ) {}

    public record Skipped(Long cattleId, String cattleCode, ApiMessage message) {}
}
