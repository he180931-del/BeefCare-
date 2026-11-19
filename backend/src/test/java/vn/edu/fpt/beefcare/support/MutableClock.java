package vn.edu.fpt.beefcare.support;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

/** A Clock whose "now" tests can set, so business dates ("today") are deterministic. */
public class MutableClock extends Clock {

    private final AtomicReference<Instant> now;
    private final ZoneId zone;

    public MutableClock(Instant start) {
        this(new AtomicReference<>(start), ZoneOffset.UTC);
    }

    private MutableClock(AtomicReference<Instant> now, ZoneId zone) {
        this.now = now;
        this.zone = zone;
    }

    /** Sets the clock to 10:00 farm time (Asia/Ho_Chi_Minh) on the given date. */
    public void setFarmToday(LocalDate date) {
        now.set(date.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
    }

    public void set(Instant instant) {
        now.set(instant);
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableClock(now, zone);
    }

    @Override
    public Instant instant() {
        return now.get();
    }
}
