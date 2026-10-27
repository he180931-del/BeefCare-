package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class FarmMembershipTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static FarmMembership getFarmMembershipSample1() {
        return new FarmMembership().id(1L).role("role1").status("status1");
    }

    public static FarmMembership getFarmMembershipSample2() {
        return new FarmMembership().id(2L).role("role2").status("status2");
    }

    public static FarmMembership getFarmMembershipRandomSampleGenerator() {
        return new FarmMembership().id(longCount.incrementAndGet()).role(UUID.randomUUID().toString()).status(UUID.randomUUID().toString());
    }
}
