package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class HealthCaseTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static HealthCase getHealthCaseSample1() {
        return new HealthCase().id(1L).status("status1").outcome("outcome1");
    }

    public static HealthCase getHealthCaseSample2() {
        return new HealthCase().id(2L).status("status2").outcome("outcome2");
    }

    public static HealthCase getHealthCaseRandomSampleGenerator() {
        return new HealthCase().id(longCount.incrementAndGet()).status(UUID.randomUUID().toString()).outcome(UUID.randomUUID().toString());
    }
}
