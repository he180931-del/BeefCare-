package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmAnnouncementTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmMembershipTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class FarmAnnouncementTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(FarmAnnouncement.class);
        FarmAnnouncement farmAnnouncement1 = getFarmAnnouncementSample1();
        FarmAnnouncement farmAnnouncement2 = new FarmAnnouncement();
        assertThat(farmAnnouncement1).isNotEqualTo(farmAnnouncement2);

        farmAnnouncement2.setId(farmAnnouncement1.getId());
        assertThat(farmAnnouncement1).isEqualTo(farmAnnouncement2);

        farmAnnouncement2 = getFarmAnnouncementSample2();
        assertThat(farmAnnouncement1).isNotEqualTo(farmAnnouncement2);
    }

    @Test
    void farmTest() {
        FarmAnnouncement farmAnnouncement = getFarmAnnouncementRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        farmAnnouncement.setFarm(farmBack);
        assertThat(farmAnnouncement.getFarm()).isEqualTo(farmBack);

        farmAnnouncement.farm(null);
        assertThat(farmAnnouncement.getFarm()).isNull();
    }

    @Test
    void authorTest() {
        FarmAnnouncement farmAnnouncement = getFarmAnnouncementRandomSampleGenerator();
        FarmMembership farmMembershipBack = getFarmMembershipRandomSampleGenerator();

        farmAnnouncement.setAuthor(farmMembershipBack);
        assertThat(farmAnnouncement.getAuthor()).isEqualTo(farmMembershipBack);

        farmAnnouncement.author(null);
        assertThat(farmAnnouncement.getAuthor()).isNull();
    }
}
