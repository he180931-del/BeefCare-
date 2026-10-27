package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class HerdExitTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static HerdExit getHerdExitSample1() {
        return new HerdExit().id(1L).type("type1");
    }

    public static HerdExit getHerdExitSample2() {
        return new HerdExit().id(2L).type("type2");
    }

    public static HerdExit getHerdExitRandomSampleGenerator() {
        return new HerdExit().id(longCount.incrementAndGet()).type(UUID.randomUUID().toString());
    }
}
