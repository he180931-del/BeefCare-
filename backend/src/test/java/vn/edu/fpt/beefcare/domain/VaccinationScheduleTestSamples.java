package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class VaccinationScheduleTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static VaccinationSchedule getVaccinationScheduleSample1() {
        return new VaccinationSchedule().id(1L).targetGroup("targetGroup1").doseCount(1).intervalDays(1).status("status1");
    }

    public static VaccinationSchedule getVaccinationScheduleSample2() {
        return new VaccinationSchedule().id(2L).targetGroup("targetGroup2").doseCount(2).intervalDays(2).status("status2");
    }

    public static VaccinationSchedule getVaccinationScheduleRandomSampleGenerator() {
        return new VaccinationSchedule()
            .id(longCount.incrementAndGet())
            .targetGroup(UUID.randomUUID().toString())
            .doseCount(intCount.incrementAndGet())
            .intervalDays(intCount.incrementAndGet())
            .status(UUID.randomUUID().toString());
    }
}
