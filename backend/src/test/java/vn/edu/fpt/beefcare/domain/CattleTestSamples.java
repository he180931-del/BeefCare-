package vn.edu.fpt.beefcare.domain;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class CattleTestSamples {

    private static final AtomicLong longCount = new AtomicLong(new java.util.Random().nextLong() + (2L * Integer.MAX_VALUE));

    public static Cattle getCattleSample1() {
        Cattle cattle = new Cattle();
        cattle.setId(1L);
        cattle.setDisplayCode("displayCode1");
        cattle.setEarTagNumber("earTag1");
        return cattle;
    }

    public static Cattle getCattleSample2() {
        Cattle cattle = new Cattle();
        cattle.setId(2L);
        cattle.setDisplayCode("displayCode2");
        cattle.setEarTagNumber("earTag2");
        return cattle;
    }

    public static Cattle getCattleRandomSampleGenerator() {
        Cattle cattle = new Cattle();
        cattle.setId(longCount.incrementAndGet());
        cattle.setDisplayCode(UUID.randomUUID().toString());
        cattle.setEarTagNumber(UUID.randomUUID().toString());
        return cattle;
    }
}
