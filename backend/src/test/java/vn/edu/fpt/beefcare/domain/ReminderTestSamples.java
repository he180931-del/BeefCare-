package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class ReminderTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Reminder getReminderSample1() {
        return new Reminder().id(1L).ruleType("ruleType1").sourceRecord("sourceRecord1").status("status1");
    }

    public static Reminder getReminderSample2() {
        return new Reminder().id(2L).ruleType("ruleType2").sourceRecord("sourceRecord2").status("status2");
    }

    public static Reminder getReminderRandomSampleGenerator() {
        return new Reminder()
            .id(longCount.incrementAndGet())
            .ruleType(UUID.randomUUID().toString())
            .sourceRecord(UUID.randomUUID().toString())
            .status(UUID.randomUUID().toString());
    }
}
