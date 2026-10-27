package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class BreedTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Breed getBreedSample1() {
        return new Breed().id(1L).code("code1").name("name1");
    }

    public static Breed getBreedSample2() {
        return new Breed().id(2L).code("code2").name("name2");
    }

    public static Breed getBreedRandomSampleGenerator() {
        return new Breed().id(longCount.incrementAndGet()).code(UUID.randomUUID().toString()).name(UUID.randomUUID().toString());
    }
}
