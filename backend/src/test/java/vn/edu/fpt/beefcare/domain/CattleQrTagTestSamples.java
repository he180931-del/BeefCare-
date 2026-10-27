package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

public class CattleQrTagTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static CattleQrTag getCattleQrTagSample1() {
        return new CattleQrTag().id(1L).tagCode("tagCode1").status("status1");
    }

    public static CattleQrTag getCattleQrTagSample2() {
        return new CattleQrTag().id(2L).tagCode("tagCode2").status("status2");
    }

    public static CattleQrTag getCattleQrTagRandomSampleGenerator() {
        return new CattleQrTag().id(longCount.incrementAndGet()).tagCode(UUID.randomUUID().toString()).status(UUID.randomUUID().toString());
    }
}
