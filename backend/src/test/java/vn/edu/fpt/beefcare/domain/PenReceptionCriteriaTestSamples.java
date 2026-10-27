package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class PenReceptionCriteriaTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static PenReceptionCriteria getPenReceptionCriteriaSample1() {
        return new PenReceptionCriteria()
            .id(1L)
            .versionNo(1)
            .acceptedPurposes("acceptedPurposes1")
            .acceptedStages("acceptedStages1")
            .thresholds("thresholds1");
    }

    public static PenReceptionCriteria getPenReceptionCriteriaSample2() {
        return new PenReceptionCriteria()
            .id(2L)
            .versionNo(2)
            .acceptedPurposes("acceptedPurposes2")
            .acceptedStages("acceptedStages2")
            .thresholds("thresholds2");
    }

    public static PenReceptionCriteria getPenReceptionCriteriaRandomSampleGenerator() {
        return new PenReceptionCriteria()
            .id(longCount.incrementAndGet())
            .versionNo(intCount.incrementAndGet())
            .acceptedPurposes(UUID.randomUUID().toString())
            .acceptedStages(UUID.randomUUID().toString())
            .thresholds(UUID.randomUUID().toString());
    }
}
