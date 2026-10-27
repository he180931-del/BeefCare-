package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleProfileChangeTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class CattleProfileChangeTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(CattleProfileChange.class);
        CattleProfileChange cattleProfileChange1 = getCattleProfileChangeSample1();
        CattleProfileChange cattleProfileChange2 = new CattleProfileChange();
        assertThat(cattleProfileChange1).isNotEqualTo(cattleProfileChange2);

        cattleProfileChange2.setId(cattleProfileChange1.getId());
        assertThat(cattleProfileChange1).isEqualTo(cattleProfileChange2);

        cattleProfileChange2 = getCattleProfileChangeSample2();
        assertThat(cattleProfileChange1).isNotEqualTo(cattleProfileChange2);
    }

    @Test
    void cattleTest() {
        CattleProfileChange cattleProfileChange = getCattleProfileChangeRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        cattleProfileChange.setCattle(cattleBack);
        assertThat(cattleProfileChange.getCattle()).isEqualTo(cattleBack);

        cattleProfileChange.cattle(null);
        assertThat(cattleProfileChange.getCattle()).isNull();
    }
}
