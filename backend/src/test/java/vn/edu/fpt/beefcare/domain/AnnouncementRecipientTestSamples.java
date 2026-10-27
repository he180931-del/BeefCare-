package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;

public class AnnouncementRecipientTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static AnnouncementRecipient getAnnouncementRecipientSample1() {
        return new AnnouncementRecipient().id(1L);
    }

    public static AnnouncementRecipient getAnnouncementRecipientSample2() {
        return new AnnouncementRecipient().id(2L);
    }

    public static AnnouncementRecipient getAnnouncementRecipientRandomSampleGenerator() {
        return new AnnouncementRecipient().id(longCount.incrementAndGet());
    }
}
