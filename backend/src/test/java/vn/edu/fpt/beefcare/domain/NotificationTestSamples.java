package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class NotificationTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Notification getNotificationSample1() {
        return new Notification().id(1L).targetType("targetType1").targetId(1L);
    }

    public static Notification getNotificationSample2() {
        return new Notification().id(2L).targetType("targetType2").targetId(2L);
    }

    public static Notification getNotificationRandomSampleGenerator() {
        return new Notification()
            .id(longCount.incrementAndGet())
            .targetType(UUID.randomUUID().toString())
            .targetId(longCount.incrementAndGet());
    }
}
