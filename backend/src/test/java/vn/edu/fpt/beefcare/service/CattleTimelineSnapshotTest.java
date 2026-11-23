package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** R-16-02/04: every original uses the source snapshot's occurrence, with a safe fallback for old snapshots. */
class CattleTimelineSnapshotTest {
    private static final Instant FALLBACK = Instant.parse("2026-10-03T03:00:00Z");
    private static final String ORIGINAL = "2026-10-01T03:00:00Z";

    static Stream<Arguments> sourceTimes() {
        return Stream.of(
            Arguments.of("HEALTH_OBSERVATION", Map.of("observedAt", ORIGINAL), ORIGINAL),
            Arguments.of("TREATMENT", Map.of("administeredAt", ORIGINAL), ORIGINAL),
            Arguments.of("ESTRUS", Map.of("eventTime", ORIGINAL), ORIGINAL),
            Arguments.of("BREEDING", Map.of("eventTime", ORIGINAL), ORIGINAL),
            Arguments.of("PREGNANCY_CHECK", Map.of("eventTime", ORIGINAL), ORIGINAL),
            Arguments.of("PREGNANCY_UPDATE", Map.of("occurredTime", ORIGINAL), ORIGINAL),
            Arguments.of("CALVING_EVENT", Map.of("birthTime", ORIGINAL), ORIGINAL),
            Arguments.of("GROWTH_ASSESSMENT", Map.of("measuredAt", ORIGINAL), ORIGINAL),
            Arguments.of("HERD_ENTRY", Map.of("voucher", Map.of("entryDate", "2026-10-01")), "2026-09-30T17:00:00Z"),
            Arguments.of("HERD_ENTRY", Map.of("entryDate", "2026-10-01"), "2026-09-30T17:00:00Z"),
            Arguments.of("HERD_EXIT", Map.of("cattle", java.util.List.of(Map.of("exitDate", "2026-10-01"))), FALLBACK.toString()),
            Arguments.of("HEALTH_OBSERVATION", Map.of("observedAt", "invalid"), FALLBACK.toString()),
            Arguments.of("HERD_ENTRY", Map.of("voucher", "invalid"), FALLBACK.toString()),
            Arguments.of("UNKNOWN", Map.of("eventTime", ORIGINAL), FALLBACK.toString())
        );
    }

    @ParameterizedTest
    @MethodSource("sourceTimes")
    void usesActualSnapshotKeysOrFallsBack(String sourceType, Map<String, Object> snapshot, String expected) {
        assertThat(CattleTimelineService.originalOccurredAt(sourceType, snapshot, FALLBACK)).isEqualTo(Instant.parse(expected));
    }
}
