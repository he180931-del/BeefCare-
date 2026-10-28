package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class ProductionPurposeTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static ProductionPurpose getProductionPurposeSample1() {
        return new ProductionPurpose().id(1L).code("code1").name("name1");
    }

    public static ProductionPurpose getProductionPurposeSample2() {
        return new ProductionPurpose().id(2L).code("code2").name("name2");
    }

    public static ProductionPurpose getProductionPurposeRandomSampleGenerator() {
        return new ProductionPurpose()
            .id(longCount.incrementAndGet())
            .code(UUID.randomUUID().toString())
            .name(UUID.randomUUID().toString());
    }
}
