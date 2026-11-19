package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmInvitationTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class FarmInvitationTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(FarmInvitation.class);
        FarmInvitation farmInvitation1 = getFarmInvitationSample1();
        FarmInvitation farmInvitation2 = new FarmInvitation();
        assertThat(farmInvitation1).isNotEqualTo(farmInvitation2);

        farmInvitation2.setId(farmInvitation1.getId());
        assertThat(farmInvitation1).isEqualTo(farmInvitation2);

        farmInvitation2 = getFarmInvitationSample2();
        assertThat(farmInvitation1).isNotEqualTo(farmInvitation2);
    }

    @Test
    void farmTest() {
        FarmInvitation farmInvitation = getFarmInvitationRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        farmInvitation.setFarm(farmBack);
        assertThat(farmInvitation.getFarm()).isEqualTo(farmBack);

        farmInvitation.farm(null);
        assertThat(farmInvitation.getFarm()).isNull();
    }
}
