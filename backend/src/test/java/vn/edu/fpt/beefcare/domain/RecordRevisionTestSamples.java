package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class RecordRevisionTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static RecordRevision getRecordRevisionSample1() {
        return new RecordRevision().id(1L).sourceType("sourceType1").sourceId(1L).action("action1");
    }

    public static RecordRevision getRecordRevisionSample2() {
        return new RecordRevision().id(2L).sourceType("sourceType2").sourceId(2L).action("action2");
    }

    public static RecordRevision getRecordRevisionRandomSampleGenerator() {
        return new RecordRevision()
            .id(longCount.incrementAndGet())
            .sourceType(UUID.randomUUID().toString())
            .sourceId(longCount.incrementAndGet())
            .action(UUID.randomUUID().toString());
    }
}
