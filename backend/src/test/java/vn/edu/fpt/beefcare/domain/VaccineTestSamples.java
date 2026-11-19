package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class VaccineTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static Vaccine getVaccineSample1() {
        return new Vaccine()
            .id(1L)
            .code("code1")
            .name("name1")
            .diseasePrevented("diseasePrevented1")
            .manufacturer("manufacturer1")
            .dose("dose1")
            .route("route1")
            .boosterInterval(1)
            .withdrawalInfo("withdrawalInfo1");
    }

    public static Vaccine getVaccineSample2() {
        return new Vaccine()
            .id(2L)
            .code("code2")
            .name("name2")
            .diseasePrevented("diseasePrevented2")
            .manufacturer("manufacturer2")
            .dose("dose2")
            .route("route2")
            .boosterInterval(2)
            .withdrawalInfo("withdrawalInfo2");
    }

    public static Vaccine getVaccineRandomSampleGenerator() {
        return new Vaccine()
            .id(longCount.incrementAndGet())
            .code(UUID.randomUUID().toString())
            .name(UUID.randomUUID().toString())
            .diseasePrevented(UUID.randomUUID().toString())
            .manufacturer(UUID.randomUUID().toString())
            .dose(UUID.randomUUID().toString())
            .route(UUID.randomUUID().toString())
            .boosterInterval(intCount.incrementAndGet())
            .withdrawalInfo(UUID.randomUUID().toString());
    }
}
