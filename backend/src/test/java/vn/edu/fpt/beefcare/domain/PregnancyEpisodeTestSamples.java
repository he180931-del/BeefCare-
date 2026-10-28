package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class PregnancyEpisodeTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static PregnancyEpisode getPregnancyEpisodeSample1() {
        return new PregnancyEpisode().id(1L).parity(1).status("status1");
    }

    public static PregnancyEpisode getPregnancyEpisodeSample2() {
        return new PregnancyEpisode().id(2L).parity(2).status("status2");
    }

    public static PregnancyEpisode getPregnancyEpisodeRandomSampleGenerator() {
        return new PregnancyEpisode()
            .id(longCount.incrementAndGet())
            .parity(intCount.incrementAndGet())
            .status(UUID.randomUUID().toString());
    }
}
