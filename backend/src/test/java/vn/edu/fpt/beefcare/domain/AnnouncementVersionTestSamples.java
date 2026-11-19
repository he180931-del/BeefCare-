package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class AnnouncementVersionTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static AnnouncementVersion getAnnouncementVersionSample1() {
        return new AnnouncementVersion().id(1L).versionNo(1).title("title1");
    }

    public static AnnouncementVersion getAnnouncementVersionSample2() {
        return new AnnouncementVersion().id(2L).versionNo(2).title("title2");
    }

    public static AnnouncementVersion getAnnouncementVersionRandomSampleGenerator() {
        return new AnnouncementVersion()
            .id(longCount.incrementAndGet())
            .versionNo(intCount.incrementAndGet())
            .title(UUID.randomUUID().toString());
    }
}
