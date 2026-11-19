package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.HealthCaseTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class HealthCaseTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(HealthCase.class);
        HealthCase healthCase1 = getHealthCaseSample1();
        HealthCase healthCase2 = new HealthCase();
        assertThat(healthCase1).isNotEqualTo(healthCase2);

        healthCase2.setId(healthCase1.getId());
        assertThat(healthCase1).isEqualTo(healthCase2);

        healthCase2 = getHealthCaseSample2();
        assertThat(healthCase1).isNotEqualTo(healthCase2);
    }

    @Test
    void cattleTest() {
        HealthCase healthCase = getHealthCaseRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        healthCase.setCattle(cattleBack);
        assertThat(healthCase.getCattle()).isEqualTo(cattleBack);

        healthCase.cattle(null);
        assertThat(healthCase.getCattle()).isNull();
    }
}
