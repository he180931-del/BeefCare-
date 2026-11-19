package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class PregnancyUpdateTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static PregnancyUpdate getPregnancyUpdateSample1() {
        return new PregnancyUpdate().id(1L).type("type1");
    }

    public static PregnancyUpdate getPregnancyUpdateSample2() {
        return new PregnancyUpdate().id(2L).type("type2");
    }

    public static PregnancyUpdate getPregnancyUpdateRandomSampleGenerator() {
        return new PregnancyUpdate().id(longCount.incrementAndGet()).type(UUID.randomUUID().toString());
    }
}
