package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class CattleProfileChangeTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static CattleProfileChange getCattleProfileChangeSample1() {
        return new CattleProfileChange().id(1L).fieldName("fieldName1").oldValue("oldValue1").newValue("newValue1");
    }

    public static CattleProfileChange getCattleProfileChangeSample2() {
        return new CattleProfileChange().id(2L).fieldName("fieldName2").oldValue("oldValue2").newValue("newValue2");
    }

    public static CattleProfileChange getCattleProfileChangeRandomSampleGenerator() {
        return new CattleProfileChange()
            .id(longCount.incrementAndGet())
            .fieldName(UUID.randomUUID().toString())
            .oldValue(UUID.randomUUID().toString())
            .newValue(UUID.randomUUID().toString());
    }
}
