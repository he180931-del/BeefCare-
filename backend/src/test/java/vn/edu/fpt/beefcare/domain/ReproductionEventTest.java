package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PregnancyEpisodeTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ReproductionEventTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ReproductionEventTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ReproductionEventTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(ReproductionEvent.class);
        ReproductionEvent reproductionEvent1 = getReproductionEventSample1();
        ReproductionEvent reproductionEvent2 = new ReproductionEvent();
        assertThat(reproductionEvent1).isNotEqualTo(reproductionEvent2);

        reproductionEvent2.setId(reproductionEvent1.getId());
        assertThat(reproductionEvent1).isEqualTo(reproductionEvent2);

        reproductionEvent2 = getReproductionEventSample2();
        assertThat(reproductionEvent1).isNotEqualTo(reproductionEvent2);
    }

    @Test
    void cattleTest() {
        ReproductionEvent reproductionEvent = getReproductionEventRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        reproductionEvent.setCattle(cattleBack);
        assertThat(reproductionEvent.getCattle()).isEqualTo(cattleBack);

        reproductionEvent.cattle(null);
        assertThat(reproductionEvent.getCattle()).isNull();
    }

    @Test
    void linkedEventTest() {
        ReproductionEvent reproductionEvent = getReproductionEventRandomSampleGenerator();
        ReproductionEvent reproductionEventBack = getReproductionEventRandomSampleGenerator();

        reproductionEvent.setLinkedEvent(reproductionEventBack);
        assertThat(reproductionEvent.getLinkedEvent()).isEqualTo(reproductionEventBack);

        reproductionEvent.linkedEvent(null);
        assertThat(reproductionEvent.getLinkedEvent()).isNull();
    }

    @Test
    void pregnancyEpisodeTest() {
        ReproductionEvent reproductionEvent = getReproductionEventRandomSampleGenerator();
        PregnancyEpisode pregnancyEpisodeBack = getPregnancyEpisodeRandomSampleGenerator();

        reproductionEvent.setPregnancyEpisode(pregnancyEpisodeBack);
        assertThat(reproductionEvent.getPregnancyEpisode()).isEqualTo(pregnancyEpisodeBack);
        assertThat(pregnancyEpisodeBack.getConfirmingCheck()).isEqualTo(reproductionEvent);

        reproductionEvent.pregnancyEpisode(null);
        assertThat(reproductionEvent.getPregnancyEpisode()).isNull();
        assertThat(pregnancyEpisodeBack.getConfirmingCheck()).isNull();
    }
}
