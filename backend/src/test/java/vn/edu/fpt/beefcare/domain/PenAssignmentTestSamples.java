package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class PenAssignmentTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static PenAssignment getPenAssignmentSample1() {
        return new PenAssignment().id(1L).source("source1");
    }

    public static PenAssignment getPenAssignmentSample2() {
        return new PenAssignment().id(2L).source("source2");
    }

    public static PenAssignment getPenAssignmentRandomSampleGenerator() {
        return new PenAssignment().id(longCount.incrementAndGet()).source(UUID.randomUUID().toString());
    }
}
