package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class ReminderParameterTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static ReminderParameter getReminderParameterSample1() {
        return new ReminderParameter().id(1L).parameterType("parameterType1").paramValue("paramValue1").versionNo(1);
    }

    public static ReminderParameter getReminderParameterSample2() {
        return new ReminderParameter().id(2L).parameterType("parameterType2").paramValue("paramValue2").versionNo(2);
    }

    public static ReminderParameter getReminderParameterRandomSampleGenerator() {
        return new ReminderParameter()
            .id(longCount.incrementAndGet())
            .parameterType(UUID.randomUUID().toString())
            .paramValue(UUID.randomUUID().toString())
            .versionNo(intCount.incrementAndGet());
    }
}
