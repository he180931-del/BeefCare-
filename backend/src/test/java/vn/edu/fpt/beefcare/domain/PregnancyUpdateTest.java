package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.HealthCaseTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PregnancyEpisodeTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PregnancyUpdateTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PregnancyUpdateTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PregnancyUpdate.class);
        PregnancyUpdate pregnancyUpdate1 = getPregnancyUpdateSample1();
        PregnancyUpdate pregnancyUpdate2 = new PregnancyUpdate();
        assertThat(pregnancyUpdate1).isNotEqualTo(pregnancyUpdate2);

        pregnancyUpdate2.setId(pregnancyUpdate1.getId());
        assertThat(pregnancyUpdate1).isEqualTo(pregnancyUpdate2);

        pregnancyUpdate2 = getPregnancyUpdateSample2();
        assertThat(pregnancyUpdate1).isNotEqualTo(pregnancyUpdate2);
    }

    @Test
    void episodeTest() {
        PregnancyUpdate pregnancyUpdate = getPregnancyUpdateRandomSampleGenerator();
        PregnancyEpisode pregnancyEpisodeBack = getPregnancyEpisodeRandomSampleGenerator();

        pregnancyUpdate.setEpisode(pregnancyEpisodeBack);
        assertThat(pregnancyUpdate.getEpisode()).isEqualTo(pregnancyEpisodeBack);

        pregnancyUpdate.episode(null);
        assertThat(pregnancyUpdate.getEpisode()).isNull();
    }

    @Test
    void healthCaseTest() {
        PregnancyUpdate pregnancyUpdate = getPregnancyUpdateRandomSampleGenerator();
        HealthCase healthCaseBack = getHealthCaseRandomSampleGenerator();

        pregnancyUpdate.setHealthCase(healthCaseBack);
        assertThat(pregnancyUpdate.getHealthCase()).isEqualTo(healthCaseBack);

        pregnancyUpdate.healthCase(null);
        assertThat(pregnancyUpdate.getHealthCase()).isNull();
    }
}
