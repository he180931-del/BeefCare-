package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class TreatmentTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Treatment getTreatmentSample1() {
        return new Treatment()
            .id(1L)
            .treatmentDetail("treatmentDetail1")
            .dose("dose1")
            .route("route1")
            .withdrawalPeriod("withdrawalPeriod1")
            .result("result1");
    }

    public static Treatment getTreatmentSample2() {
        return new Treatment()
            .id(2L)
            .treatmentDetail("treatmentDetail2")
            .dose("dose2")
            .route("route2")
            .withdrawalPeriod("withdrawalPeriod2")
            .result("result2");
    }

    public static Treatment getTreatmentRandomSampleGenerator() {
        return new Treatment()
            .id(longCount.incrementAndGet())
            .treatmentDetail(UUID.randomUUID().toString())
            .dose(UUID.randomUUID().toString())
            .route(UUID.randomUUID().toString())
            .withdrawalPeriod(UUID.randomUUID().toString())
            .result(UUID.randomUUID().toString());
    }
}
