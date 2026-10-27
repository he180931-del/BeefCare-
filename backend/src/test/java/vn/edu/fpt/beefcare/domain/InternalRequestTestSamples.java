package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class InternalRequestTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static InternalRequest getInternalRequestSample1() {
        return new InternalRequest().id(1L).targetRole("targetRole1").state("state1").outcome("outcome1");
    }

    public static InternalRequest getInternalRequestSample2() {
        return new InternalRequest().id(2L).targetRole("targetRole2").state("state2").outcome("outcome2");
    }

    public static InternalRequest getInternalRequestRandomSampleGenerator() {
        return new InternalRequest()
            .id(longCount.incrementAndGet())
            .targetRole(UUID.randomUUID().toString())
            .state(UUID.randomUUID().toString())
            .outcome(UUID.randomUUID().toString());
    }
}
