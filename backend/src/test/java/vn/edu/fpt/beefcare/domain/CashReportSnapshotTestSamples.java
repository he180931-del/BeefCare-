package vn.edu.fpt.beefcare.domain;

import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;

public class CashReportSnapshotTestSamples {

    private static final Random random = new Random();
    private static final AtomicLong longCount = new AtomicLong(random.nextInt() + (2L * Integer.MAX_VALUE));

    public static CashReportSnapshot getCashReportSnapshotSample1() {
        return new CashReportSnapshot().id(1L);
    }

    public static CashReportSnapshot getCashReportSnapshotSample2() {
        return new CashReportSnapshot().id(2L);
    }

    public static CashReportSnapshot getCashReportSnapshotRandomSampleGenerator() {
        return new CashReportSnapshot().id(longCount.incrementAndGet());
    }
}
