package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.PenReceptionCriteriaTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PenTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PenReceptionCriteriaTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PenReceptionCriteria.class);
        PenReceptionCriteria penReceptionCriteria1 = getPenReceptionCriteriaSample1();
        PenReceptionCriteria penReceptionCriteria2 = new PenReceptionCriteria();
        assertThat(penReceptionCriteria1).isNotEqualTo(penReceptionCriteria2);

        penReceptionCriteria2.setId(penReceptionCriteria1.getId());
        assertThat(penReceptionCriteria1).isEqualTo(penReceptionCriteria2);

        penReceptionCriteria2 = getPenReceptionCriteriaSample2();
        assertThat(penReceptionCriteria1).isNotEqualTo(penReceptionCriteria2);
    }

    @Test
    void penTest() {
        PenReceptionCriteria penReceptionCriteria = getPenReceptionCriteriaRandomSampleGenerator();
        Pen penBack = getPenRandomSampleGenerator();

        penReceptionCriteria.setPen(penBack);
        assertThat(penReceptionCriteria.getPen()).isEqualTo(penBack);

        penReceptionCriteria.pen(null);
        assertThat(penReceptionCriteria.getPen()).isNull();
    }
}
