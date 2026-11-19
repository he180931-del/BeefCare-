package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class SupportHistoryTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static SupportHistory getSupportHistorySample1() {
        return new SupportHistory().id(1L).eventType("eventType1").priorState("priorState1").newState("newState1");
    }

    public static SupportHistory getSupportHistorySample2() {
        return new SupportHistory().id(2L).eventType("eventType2").priorState("priorState2").newState("newState2");
    }

    public static SupportHistory getSupportHistoryRandomSampleGenerator() {
        return new SupportHistory()
            .id(longCount.incrementAndGet())
            .eventType(UUID.randomUUID().toString())
            .priorState(UUID.randomUUID().toString())
            .newState(UUID.randomUUID().toString());
    }
}
