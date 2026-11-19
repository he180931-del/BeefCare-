package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.GrowthTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class GrowthTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Growth.class);
        Growth growth1 = getGrowthSample1();
        Growth growth2 = new Growth();
        assertThat(growth1).isNotEqualTo(growth2);

        growth2.setId(growth1.getId());
        assertThat(growth1).isEqualTo(growth2);

        growth2 = getGrowthSample2();
        assertThat(growth1).isNotEqualTo(growth2);
    }

    @Test
    void cattleTest() {
        Growth growth = getGrowthRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        growth.setCattle(cattleBack);
        assertThat(growth.getCattle()).isEqualTo(cattleBack);

        growth.cattle(null);
        assertThat(growth.getCattle()).isNull();
    }
}
