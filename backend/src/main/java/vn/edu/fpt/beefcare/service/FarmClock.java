package vn.edu.fpt.beefcare.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Dates and event times in the farm time zone (GBR-66, default Asia/Ho_Chi_Minh). Tests replace the Clock bean.
 */
@Component
public class FarmClock {

    private final Clock clock;
    private final ZoneId zone;

    public FarmClock(Clock clock, @Value("${application.farm-time-zone:Asia/Ho_Chi_Minh}") String zone) {
        this.clock = clock;
        this.zone = ZoneId.of(zone);
    }

    public ZoneId zone() {
        return zone;
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(zone));
    }

    public Instant now() {
        return clock.instant();
    }

    public LocalDate toFarmDate(Instant instant) {
        return instant.atZone(zone).toLocalDate();
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
