package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmMembershipTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ManagerPermissionTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ManagerPermissionTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(ManagerPermission.class);
        ManagerPermission managerPermission1 = getManagerPermissionSample1();
        ManagerPermission managerPermission2 = new ManagerPermission();
        assertThat(managerPermission1).isNotEqualTo(managerPermission2);

        managerPermission2.setId(managerPermission1.getId());
        assertThat(managerPermission1).isEqualTo(managerPermission2);

        managerPermission2 = getManagerPermissionSample2();
        assertThat(managerPermission1).isNotEqualTo(managerPermission2);
    }

    @Test
    void membershipTest() {
        ManagerPermission managerPermission = getManagerPermissionRandomSampleGenerator();
        FarmMembership farmMembershipBack = getFarmMembershipRandomSampleGenerator();

        managerPermission.setMembership(farmMembershipBack);
        assertThat(managerPermission.getMembership()).isEqualTo(farmMembershipBack);

        managerPermission.membership(null);
        assertThat(managerPermission.getMembership()).isNull();
    }
}
