package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class ManagerPermissionTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static ManagerPermission getManagerPermissionSample1() {
        return new ManagerPermission().id(1L).permissionCode("permissionCode1");
    }

    public static ManagerPermission getManagerPermissionSample2() {
        return new ManagerPermission().id(2L).permissionCode("permissionCode2");
    }

    public static ManagerPermission getManagerPermissionRandomSampleGenerator() {
        return new ManagerPermission().id(longCount.incrementAndGet()).permissionCode(UUID.randomUUID().toString());
    }
}
