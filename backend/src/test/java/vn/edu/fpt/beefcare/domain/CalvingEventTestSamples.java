package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class CalvingEventTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static CalvingEvent getCalvingEventSample1() {
        return new CalvingEvent().id(1L).course("course1").damCondition("damCondition1");
    }

    public static CalvingEvent getCalvingEventSample2() {
        return new CalvingEvent().id(2L).course("course2").damCondition("damCondition2");
    }

    public static CalvingEvent getCalvingEventRandomSampleGenerator() {
        return new CalvingEvent()
            .id(longCount.incrementAndGet())
            .course(UUID.randomUUID().toString())
            .damCondition(UUID.randomUUID().toString());
    }
}
