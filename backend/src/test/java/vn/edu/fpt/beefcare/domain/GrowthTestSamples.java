package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class GrowthTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static Growth getGrowthSample1() {
        return new Growth().id(1L).weightType("weightType1").bcs(1).status("status1");
    }

    public static Growth getGrowthSample2() {
        return new Growth().id(2L).weightType("weightType2").bcs(2).status("status2");
    }

    public static Growth getGrowthRandomSampleGenerator() {
        return new Growth()
            .id(longCount.incrementAndGet())
            .weightType(UUID.randomUUID().toString())
            .bcs(intCount.incrementAndGet())
            .status(UUID.randomUUID().toString());
    }
}
