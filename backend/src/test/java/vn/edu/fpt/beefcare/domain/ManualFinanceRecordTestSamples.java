package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class ManualFinanceRecordTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static ManualFinanceRecord getManualFinanceRecordSample1() {
        return new ManualFinanceRecord().id(1L).type("type1").category("category1").state("state1");
    }

    public static ManualFinanceRecord getManualFinanceRecordSample2() {
        return new ManualFinanceRecord().id(2L).type("type2").category("category2").state("state2");
    }

    public static ManualFinanceRecord getManualFinanceRecordRandomSampleGenerator() {
        return new ManualFinanceRecord()
            .id(longCount.incrementAndGet())
            .type(UUID.randomUUID().toString())
            .category(UUID.randomUUID().toString())
            .state(UUID.randomUUID().toString());
    }
}
