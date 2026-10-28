package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class TicketMessageTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static TicketMessage getTicketMessageSample1() {
        return new TicketMessage().id(1L).type("type1").audience("audience1");
    }

    public static TicketMessage getTicketMessageSample2() {
        return new TicketMessage().id(2L).type("type2").audience("audience2");
    }

    public static TicketMessage getTicketMessageRandomSampleGenerator() {
        return new TicketMessage()
            .id(longCount.incrementAndGet())
            .type(UUID.randomUUID().toString())
            .audience(UUID.randomUUID().toString());
    }
}
