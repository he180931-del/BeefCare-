package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class FarmAnnouncementTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static FarmAnnouncement getFarmAnnouncementSample1() {
        return new FarmAnnouncement().id(1L).state("state1");
    }

    public static FarmAnnouncement getFarmAnnouncementSample2() {
        return new FarmAnnouncement().id(2L).state("state2");
    }

    public static FarmAnnouncement getFarmAnnouncementRandomSampleGenerator() {
        return new FarmAnnouncement().id(longCount.incrementAndGet()).state(UUID.randomUUID().toString());
    }
}
