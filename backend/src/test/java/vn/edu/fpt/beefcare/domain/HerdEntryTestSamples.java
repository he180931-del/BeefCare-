package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class HerdEntryTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static HerdEntry getHerdEntrySample1() {
        return new HerdEntry().id(1L).source("source1").historyDeclarations("historyDeclarations1");
    }

    public static HerdEntry getHerdEntrySample2() {
        return new HerdEntry().id(2L).source("source2").historyDeclarations("historyDeclarations2");
    }

    public static HerdEntry getHerdEntryRandomSampleGenerator() {
        return new HerdEntry()
            .id(longCount.incrementAndGet())
            .source(UUID.randomUUID().toString())
            .historyDeclarations(UUID.randomUUID().toString());
    }
}
