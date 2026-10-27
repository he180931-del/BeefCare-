package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class AuditLogTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static AuditLog getAuditLogSample1() {
        return new AuditLog().id(1L).action("action1").targetType("targetType1").targetId(1L);
    }

    public static AuditLog getAuditLogSample2() {
        return new AuditLog().id(2L).action("action2").targetType("targetType2").targetId(2L);
    }

    public static AuditLog getAuditLogRandomSampleGenerator() {
        return new AuditLog()
            .id(longCount.incrementAndGet())
            .action(UUID.randomUUID().toString())
            .targetType(UUID.randomUUID().toString())
            .targetId(longCount.incrementAndGet());
    }
}
