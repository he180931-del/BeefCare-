package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class HealthObservationTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static HealthObservation getHealthObservationSample1() {
        return new HealthObservation().id(1L).source("source1");
    }

    public static HealthObservation getHealthObservationSample2() {
        return new HealthObservation().id(2L).source("source2");
    }

    public static HealthObservation getHealthObservationRandomSampleGenerator() {
        return new HealthObservation().id(longCount.incrementAndGet()).source(UUID.randomUUID().toString());
    }
}
