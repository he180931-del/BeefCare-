package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PlatformStaffAccessTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PlatformStaffAccessTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(PlatformStaffAccess.class);
        PlatformStaffAccess platformStaffAccess1 = getPlatformStaffAccessSample1();
        PlatformStaffAccess platformStaffAccess2 = new PlatformStaffAccess();
        assertThat(platformStaffAccess1).isNotEqualTo(platformStaffAccess2);

        platformStaffAccess2.setId(platformStaffAccess1.getId());
        assertThat(platformStaffAccess1).isEqualTo(platformStaffAccess2);

        platformStaffAccess2 = getPlatformStaffAccessSample2();
        assertThat(platformStaffAccess1).isNotEqualTo(platformStaffAccess2);
    }

    @Test
    void userTest() {
        PlatformStaffAccess platformStaffAccess = getPlatformStaffAccessRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        platformStaffAccess.setUser(appUserBack);
        assertThat(platformStaffAccess.getUser()).isEqualTo(appUserBack);

        platformStaffAccess.user(null);
        assertThat(platformStaffAccess.getUser()).isNull();
    }
}
