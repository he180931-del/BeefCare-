package vn.edu.fpt.beefcare.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.stereotype.Component;

/**
 * Dates in fixed UTC+7. The injected clock supplies absolute instants and can be replaced by tests.
 */
@Component
public class FarmClock {

    private final Clock clock;
    public FarmClock(Clock clock) {
        this.clock = clock;
    }

    public ZoneId zone() {
        return FarmTimeZones.OFFSET;
    }

    public LocalDate today() {
        return toFarmDate(now());
    }

    public Instant now() {
        return clock.instant();
    }

    public LocalDate toFarmDate(Instant instant) {
        return LocalDate.ofInstant(instant, FarmTimeZones.OFFSET);
    }

    /** MSG-COM-07: an event date must not be in the future. */
    public void assertNotFuture(LocalDate date) {
        if (date != null && date.isAfter(today())) {
            throw DomainException.unprocessable(MessageCodes.COM_07);
        }
    }

    public void assertNotFuture(Instant time) {
        if (time != null && time.isAfter(now())) {
            throw DomainException.unprocessable(MessageCodes.COM_07);
        }
    }
}
