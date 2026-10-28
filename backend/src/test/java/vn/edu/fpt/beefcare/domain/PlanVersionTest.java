package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.PlanVersionTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PlanVersionTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PlanVersion.class);
        PlanVersion planVersion1 = getPlanVersionSample1();
        PlanVersion planVersion2 = new PlanVersion();
        assertThat(planVersion1).isNotEqualTo(planVersion2);

        planVersion2.setId(planVersion1.getId());
        assertThat(planVersion1).isEqualTo(planVersion2);

        planVersion2 = getPlanVersionSample2();
        assertThat(planVersion1).isNotEqualTo(planVersion2);
    }
}
