package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CalvingEventTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PregnancyEpisodeTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class CalvingEventTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(CalvingEvent.class);
        CalvingEvent calvingEvent1 = getCalvingEventSample1();
        CalvingEvent calvingEvent2 = new CalvingEvent();
        assertThat(calvingEvent1).isNotEqualTo(calvingEvent2);

        calvingEvent2.setId(calvingEvent1.getId());
        assertThat(calvingEvent1).isEqualTo(calvingEvent2);

        calvingEvent2 = getCalvingEventSample2();
        assertThat(calvingEvent1).isNotEqualTo(calvingEvent2);
    }

    @Test
    void damTest() {
        CalvingEvent calvingEvent = getCalvingEventRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        calvingEvent.setDam(cattleBack);
        assertThat(calvingEvent.getDam()).isEqualTo(cattleBack);

        calvingEvent.dam(null);
        assertThat(calvingEvent.getDam()).isNull();
    }

    @Test
    void episodeTest() {
        CalvingEvent calvingEvent = getCalvingEventRandomSampleGenerator();
        PregnancyEpisode pregnancyEpisodeBack = getPregnancyEpisodeRandomSampleGenerator();

        calvingEvent.setEpisode(pregnancyEpisodeBack);
        assertThat(calvingEvent.getEpisode()).isEqualTo(pregnancyEpisodeBack);

        calvingEvent.episode(null);
        assertThat(calvingEvent.getEpisode()).isNull();
    }
}
