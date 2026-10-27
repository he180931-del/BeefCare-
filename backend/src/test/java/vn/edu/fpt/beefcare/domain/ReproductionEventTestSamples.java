package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class ReproductionEventTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static ReproductionEvent getReproductionEventSample1() {
        return new ReproductionEvent().id(1L).type("type1").method("method1").result("result1").source("source1");
    }

    public static ReproductionEvent getReproductionEventSample2() {
        return new ReproductionEvent().id(2L).type("type2").method("method2").result("result2").source("source2");
    }

    public static ReproductionEvent getReproductionEventRandomSampleGenerator() {
        return new ReproductionEvent()
            .id(longCount.incrementAndGet())
            .type(UUID.randomUUID().toString())
            .method(UUID.randomUUID().toString())
            .result(UUID.randomUUID().toString())
            .source(UUID.randomUUID().toString());
    }
}
