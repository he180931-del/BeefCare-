package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class FarmTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Farm getFarmSample1() {
        return new Farm().id(1L).name("name1").location("location1").contact("contact1").serviceStatus("serviceStatus1");
    }

    public static Farm getFarmSample2() {
        return new Farm().id(2L).name("name2").location("location2").contact("contact2").serviceStatus("serviceStatus2");
    }

    public static Farm getFarmRandomSampleGenerator() {
        return new Farm()
            .id(longCount.incrementAndGet())
            .name(UUID.randomUUID().toString())
            .location(UUID.randomUUID().toString())
            .contact(UUID.randomUUID().toString())
            .serviceStatus(UUID.randomUUID().toString());
    }
}
