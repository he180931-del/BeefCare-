package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class PaymentTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));
    private static final AtomicInteger intCount = new AtomicInteger(random.nextInt() + (2 * Short.MAX_VALUE));

    public static Payment getPaymentSample1() {
        return new Payment().id(1L).quoteRef("quoteRef1").durationYears(1).state("state1");
    }

    public static Payment getPaymentSample2() {
        return new Payment().id(2L).quoteRef("quoteRef2").durationYears(2).state("state2");
    }

    public static Payment getPaymentRandomSampleGenerator() {
        return new Payment()
            .id(longCount.incrementAndGet())
            .quoteRef(UUID.randomUUID().toString())
            .durationYears(intCount.incrementAndGet())
            .state(UUID.randomUUID().toString());
    }
}
