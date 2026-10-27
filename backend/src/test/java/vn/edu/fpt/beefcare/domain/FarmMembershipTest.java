package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmMembershipTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class FarmMembershipTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(FarmMembership.class);
        FarmMembership farmMembership1 = getFarmMembershipSample1();
        FarmMembership farmMembership2 = new FarmMembership();
        assertThat(farmMembership1).isNotEqualTo(farmMembership2);

        farmMembership2.setId(farmMembership1.getId());
        assertThat(farmMembership1).isEqualTo(farmMembership2);

        farmMembership2 = getFarmMembershipSample2();
        assertThat(farmMembership1).isNotEqualTo(farmMembership2);
    }

    @Test
    void farmTest() {
        FarmMembership farmMembership = getFarmMembershipRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        farmMembership.setFarm(farmBack);
        assertThat(farmMembership.getFarm()).isEqualTo(farmBack);

        farmMembership.farm(null);
        assertThat(farmMembership.getFarm()).isNull();
    }

    @Test
    void userTest() {
        FarmMembership farmMembership = getFarmMembershipRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        farmMembership.setUser(appUserBack);
        assertThat(farmMembership.getUser()).isEqualTo(appUserBack);

        farmMembership.user(null);
        assertThat(farmMembership.getUser()).isNull();
    }
}
