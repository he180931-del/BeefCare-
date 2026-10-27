package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PenAssignmentTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PenTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PenAssignmentTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PenAssignment.class);
        PenAssignment penAssignment1 = getPenAssignmentSample1();
        PenAssignment penAssignment2 = new PenAssignment();
        assertThat(penAssignment1).isNotEqualTo(penAssignment2);

        penAssignment2.setId(penAssignment1.getId());
        assertThat(penAssignment1).isEqualTo(penAssignment2);

        penAssignment2 = getPenAssignmentSample2();
        assertThat(penAssignment1).isNotEqualTo(penAssignment2);
    }

    @Test
    void cattleTest() {
        PenAssignment penAssignment = getPenAssignmentRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        penAssignment.setCattle(cattleBack);
        assertThat(penAssignment.getCattle()).isEqualTo(cattleBack);

        penAssignment.cattle(null);
        assertThat(penAssignment.getCattle()).isNull();
    }

    @Test
    void penTest() {
        PenAssignment penAssignment = getPenAssignmentRandomSampleGenerator();
        Pen penBack = getPenRandomSampleGenerator();

        penAssignment.setPen(penBack);
        assertThat(penAssignment.getPen()).isEqualTo(penBack);

        penAssignment.pen(null);
        assertThat(penAssignment.getPen()).isNull();
    }
}
