package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class MedicineTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Medicine getMedicineSample1() {
        return new Medicine().id(1L).code("code1").name("name1").dose("dose1").route("route1").withdrawalInfo("withdrawalInfo1");
    }

    public static Medicine getMedicineSample2() {
        return new Medicine().id(2L).code("code2").name("name2").dose("dose2").route("route2").withdrawalInfo("withdrawalInfo2");
    }

    public static Medicine getMedicineRandomSampleGenerator() {
        return new Medicine()
            .id(longCount.incrementAndGet())
            .code(UUID.randomUUID().toString())
            .name(UUID.randomUUID().toString())
            .dose(UUID.randomUUID().toString())
            .route(UUID.randomUUID().toString())
            .withdrawalInfo(UUID.randomUUID().toString());
    }
}
