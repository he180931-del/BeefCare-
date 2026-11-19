package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PlatformStaffAccessTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class AppUserTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(AppUser.class);
        AppUser appUser1 = getAppUserSample1();
        AppUser appUser2 = new AppUser();
        assertThat(appUser1).isNotEqualTo(appUser2);

        appUser2.setId(appUser1.getId());
        assertThat(appUser1).isEqualTo(appUser2);

        appUser2 = getAppUserSample2();
        assertThat(appUser1).isNotEqualTo(appUser2);
    }

    @Test
    void platformStaffAccessTest() {
        AppUser appUser = getAppUserRandomSampleGenerator();
        PlatformStaffAccess platformStaffAccessBack = getPlatformStaffAccessRandomSampleGenerator();

        appUser.setPlatformStaffAccess(platformStaffAccessBack);
        assertThat(appUser.getPlatformStaffAccess()).isEqualTo(platformStaffAccessBack);
        assertThat(platformStaffAccessBack.getUser()).isEqualTo(appUser);

        appUser.platformStaffAccess(null);
        assertThat(appUser.getPlatformStaffAccess()).isNull();
        assertThat(platformStaffAccessBack.getUser()).isNull();
    }
}
