package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PregnancyEpisodeTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ReproductionEventTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PregnancyEpisodeTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PregnancyEpisode.class);
        PregnancyEpisode pregnancyEpisode1 = getPregnancyEpisodeSample1();
        PregnancyEpisode pregnancyEpisode2 = new PregnancyEpisode();
        assertThat(pregnancyEpisode1).isNotEqualTo(pregnancyEpisode2);

        pregnancyEpisode2.setId(pregnancyEpisode1.getId());
        assertThat(pregnancyEpisode1).isEqualTo(pregnancyEpisode2);

        pregnancyEpisode2 = getPregnancyEpisodeSample2();
        assertThat(pregnancyEpisode1).isNotEqualTo(pregnancyEpisode2);
    }

    @Test
    void confirmingCheckTest() {
        PregnancyEpisode pregnancyEpisode = getPregnancyEpisodeRandomSampleGenerator();
        ReproductionEvent reproductionEventBack = getReproductionEventRandomSampleGenerator();

        pregnancyEpisode.setConfirmingCheck(reproductionEventBack);
        assertThat(pregnancyEpisode.getConfirmingCheck()).isEqualTo(reproductionEventBack);

        pregnancyEpisode.confirmingCheck(null);
        assertThat(pregnancyEpisode.getConfirmingCheck()).isNull();
    }

    @Test
    void cattleTest() {
        PregnancyEpisode pregnancyEpisode = getPregnancyEpisodeRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        pregnancyEpisode.setCattle(cattleBack);
        assertThat(pregnancyEpisode.getCattle()).isEqualTo(cattleBack);

        pregnancyEpisode.cattle(null);
        assertThat(pregnancyEpisode.getCattle()).isNull();
    }
}
