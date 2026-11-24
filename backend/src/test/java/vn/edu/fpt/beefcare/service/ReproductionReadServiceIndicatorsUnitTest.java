package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos.Indicators;

class ReproductionReadServiceIndicatorsUnitTest {

    private static final ZoneId FARM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ReproductionReadService service = new ReproductionReadService(
        null,
        new FarmClock(Clock.fixed(Instant.parse("2026-10-20T00:00:00Z"), FARM_ZONE)),
        null
    );

    @Test
    void tc1122CountsThreeNonVoidedPregnanciesAndFiveBreedingServices() throws Exception {
        List<PregnancyEpisode> episodes = List.of(episode("OPEN"), episode("CALVED"), episode("LOST"), episode("VOIDED"));
        List<ReproductionEvent> breedings = List.of(event("BREEDING"), event("BREEDING"), event("BREEDING"), event("BREEDING"), event("BREEDING"));

        Indicators result = indicators(new Cattle(), List.of(), breedings, episodes, null, LocalDate.of(2026, 10, 20));

        assertThat(result.conceptions()).isEqualTo(3);
        assertThat(result.services()).isEqualTo(5);
    }

    @Test
    void tc1123FlagsOneHundredElevenDaysAfterCalvingPastTheDefaultOneHundredEightDayLimit() throws Exception {
        LocalDate today = LocalDate.of(2026, 10, 20);
        CalvingEvent lastCalving = new CalvingEvent();
        lastCalving.setBirthTime(today.minusDays(111).atStartOfDay(FARM_ZONE).toInstant());

        Indicators result = indicators(new Cattle(), List.of(lastCalving), List.of(), List.of(), null, today);

        assertThat(result.daysSinceCalving()).isEqualTo(111L);
        assertThat(result.overdue()).isTrue();
    }

    private Indicators indicators(
        Cattle cattle,
        List<CalvingEvent> calvings,
        List<ReproductionEvent> events,
        List<PregnancyEpisode> episodes,
        PregnancyEpisode open,
        LocalDate today
    ) throws Exception {
        Method method = ReproductionReadService.class.getDeclaredMethod(
            "indicators",
            Cattle.class,
            List.class,
            List.class,
            List.class,
            PregnancyEpisode.class,
            Map.class,
            ZoneId.class,
            LocalDate.class
        );
        method.setAccessible(true);
        return (Indicators) method.invoke(service, cattle, calvings, events, episodes, open, Map.of(), FARM_ZONE, today);
    }

    private static PregnancyEpisode episode(String status) {
        PregnancyEpisode episode = new PregnancyEpisode();
        episode.setStatus(status);
        return episode;
    }

    private static ReproductionEvent event(String type) {
        ReproductionEvent event = new ReproductionEvent();
        event.setType(type);
        return event;
    }
}
