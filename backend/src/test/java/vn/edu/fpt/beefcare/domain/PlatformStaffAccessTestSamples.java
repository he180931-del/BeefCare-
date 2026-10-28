package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class PlatformStaffAccessTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static PlatformStaffAccess getPlatformStaffAccessSample1() {
        return new PlatformStaffAccess().id(1L).role("role1").status("status1");
    }

    public static PlatformStaffAccess getPlatformStaffAccessSample2() {
        return new PlatformStaffAccess().id(2L).role("role2").status("status2");
    }

    public static PlatformStaffAccess getPlatformStaffAccessRandomSampleGenerator() {
        return new PlatformStaffAccess()
            .id(longCount.incrementAndGet())
            .role(UUID.randomUUID().toString())
            .status(UUID.randomUUID().toString());
    }
}
