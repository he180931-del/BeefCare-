package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class VaccinationTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Vaccination getVaccinationSample1() {
        return new Vaccination().id(1L).dose("dose1").batchNo("batchNo1").source("source1").vaccinator("vaccinator1");
    }

    public static Vaccination getVaccinationSample2() {
        return new Vaccination().id(2L).dose("dose2").batchNo("batchNo2").source("source2").vaccinator("vaccinator2");
    }

    public static Vaccination getVaccinationRandomSampleGenerator() {
        return new Vaccination()
            .id(longCount.incrementAndGet())
            .dose(UUID.randomUUID().toString())
            .batchNo(UUID.randomUUID().toString())
            .source(UUID.randomUUID().toString())
            .vaccinator(UUID.randomUUID().toString());
    }
}
