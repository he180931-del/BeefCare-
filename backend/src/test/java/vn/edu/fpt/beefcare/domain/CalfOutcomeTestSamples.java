package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class CalfOutcomeTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static CalfOutcome getCalfOutcomeSample1() {
        return new CalfOutcome().id(1L).outcome("outcome1").sex("sex1").registrationState("registrationState1");
    }

    public static CalfOutcome getCalfOutcomeSample2() {
        return new CalfOutcome().id(2L).outcome("outcome2").sex("sex2").registrationState("registrationState2");
    }

    public static CalfOutcome getCalfOutcomeRandomSampleGenerator() {
        return new CalfOutcome()
            .id(longCount.incrementAndGet())
            .outcome(UUID.randomUUID().toString())
            .sex(UUID.randomUUID().toString())
            .registrationState(UUID.randomUUID().toString());
    }
}
