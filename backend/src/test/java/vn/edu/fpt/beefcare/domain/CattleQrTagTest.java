package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleQrTagTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class CattleQrTagTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(CattleQrTag.class);
        CattleQrTag cattleQrTag1 = getCattleQrTagSample1();
        CattleQrTag cattleQrTag2 = new CattleQrTag();
        assertThat(cattleQrTag1).isNotEqualTo(cattleQrTag2);

        cattleQrTag2.setId(cattleQrTag1.getId());
        assertThat(cattleQrTag1).isEqualTo(cattleQrTag2);

        cattleQrTag2 = getCattleQrTagSample2();
        assertThat(cattleQrTag1).isNotEqualTo(cattleQrTag2);
    }

    @Test
    void cattleTest() {
        CattleQrTag cattleQrTag = getCattleQrTagRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        cattleQrTag.setCattle(cattleBack);
        assertThat(cattleQrTag.getCattle()).isEqualTo(cattleBack);

        cattleQrTag.cattle(null);
        assertThat(cattleQrTag.getCattle()).isNull();
    }
}
