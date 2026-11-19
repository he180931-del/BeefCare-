package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class ScheduledDoseTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static ScheduledDose getScheduledDoseSample1() {
        return new ScheduledDose().id(1L).doseNo(1).status("status1");
    }

    public static ScheduledDose getScheduledDoseSample2() {
        return new ScheduledDose().id(2L).doseNo(2).status("status2");
    }

    public static ScheduledDose getScheduledDoseRandomSampleGenerator() {
        return new ScheduledDose().id(longCount.incrementAndGet()).doseNo(intCount.incrementAndGet()).status(UUID.randomUUID().toString());
    }
}
