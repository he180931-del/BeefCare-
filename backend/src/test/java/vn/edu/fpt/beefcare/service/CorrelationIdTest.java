package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

/** D34: the correlation ID kept in the MDC for one request or one job run. */
class CorrelationIdTest {

    @AfterEach
    void clear() {
        MDC.clear();
    }

    @Test
    void keepsAPlainClientIdAndReplacesAnythingElse() {
        assertThat(CorrelationId.acceptOrNew("req-2026-11-15_abc.1")).isEqualTo("req-2026-11-15_abc.1");
        for (String rejected : new String[] { null, "", "short", "has space inside", "x".repeat(65), "line\nbreak123", "<script>alert</script>" }) {
            String id = CorrelationId.acceptOrNew(rejected);
            assertThat(id).isNotEqualTo(rejected).hasSize(36);
        }
    }

    @Test
    void currentReadsTheMdcOrMakesANewIdWithoutStoringIt() {
        String first = CorrelationId.current();
        assertThat(first).hasSize(36);
        assertThat(MDC.get(CorrelationId.MDC_KEY)).isNull();
        CorrelationId.runWith("job-run-0001", () -> assertThat(CorrelationId.current()).isEqualTo("job-run-0001"));
        assertThat(MDC.get(CorrelationId.MDC_KEY)).isNull();
    }

    /** A scheduled run gets its own ID and restores the thread's previous value (pooled scheduler threads). */
    @Test
    void eachScheduledRunGetsItsOwnIdAndRestoresThePreviousOne() {
        List<String> seen = new ArrayList<>();
        Runnable job = CorrelationId.withNewId(() -> seen.add(MDC.get(CorrelationId.MDC_KEY)));
        MDC.put(CorrelationId.MDC_KEY, "outer-request-1");
        job.run();
        job.run();
        assertThat(seen).hasSize(2).doesNotContainNull().doesNotHaveDuplicates().doesNotContain("outer-request-1");
        assertThat(MDC.get(CorrelationId.MDC_KEY)).isEqualTo("outer-request-1");
    }
}
