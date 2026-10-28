package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class PlanVersionTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static PlanVersion getPlanVersionSample1() {
        return new PlanVersion().id(1L).terms("terms1");
    }

    public static PlanVersion getPlanVersionSample2() {
        return new PlanVersion().id(2L).terms("terms2");
    }

    public static PlanVersion getPlanVersionRandomSampleGenerator() {
        return new PlanVersion().id(longCount.incrementAndGet()).terms(UUID.randomUUID().toString());
    }
}
