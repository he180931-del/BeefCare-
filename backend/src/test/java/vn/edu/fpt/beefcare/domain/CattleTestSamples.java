package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class CattleTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static Cattle getCattleSample1() {
        return new Cattle()
            .id(1L)
            .displayCode("displayCode1")
            .earTag("earTag1")
            .sex("sex1")
            .lifeStage("lifeStage1")
            .herdStatus("herdStatus1");
    }

    public static Cattle getCattleSample2() {
        return new Cattle()
            .id(2L)
            .displayCode("displayCode2")
            .earTag("earTag2")
            .sex("sex2")
            .lifeStage("lifeStage2")
            .herdStatus("herdStatus2");
    }

    public static Cattle getCattleRandomSampleGenerator() {
        return new Cattle()
            .id(longCount.incrementAndGet())
            .displayCode(UUID.randomUUID().toString())
            .earTag(UUID.randomUUID().toString())
            .sex(UUID.randomUUID().toString())
            .lifeStage(UUID.randomUUID().toString())
            .herdStatus(UUID.randomUUID().toString());
    }
}
