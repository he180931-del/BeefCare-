package vn.edu.fpt.beefcare.service.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Current pen and pen history of a cattle (newest first). */
public record PenHistoryDTO(Long cattleId, String cattleCode, String herdStatus, Current current, List<Row> history) {
    public record Current(
        Long penId,
        String penCode,
        String penName,
        LocalDate since,
        int headcount,
        int capacity,
        String acceptsSummary,
        Integer criteriaVersionNo
    ) {}

    public record Row(
        Long id,
        Long penId,
        String penCode,
        String penName,
        LocalDate fromDate,
        LocalDate toDate,
        String source,
        String reason,
        String warningReason,
        Integer criteriaVersionNo,
        Long recordedById,
        String recordedByName,
        Instant recordedAt
    ) {}
}
