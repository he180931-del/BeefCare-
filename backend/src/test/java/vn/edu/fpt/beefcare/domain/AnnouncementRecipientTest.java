package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AnnouncementRecipientTestSamples.*;
import static vn.edu.fpt.beefcare.domain.AnnouncementVersionTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmMembershipTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class AnnouncementRecipientTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(AnnouncementRecipient.class);
        AnnouncementRecipient announcementRecipient1 = getAnnouncementRecipientSample1();
        AnnouncementRecipient announcementRecipient2 = new AnnouncementRecipient();
        assertThat(announcementRecipient1).isNotEqualTo(announcementRecipient2);

        announcementRecipient2.setId(announcementRecipient1.getId());
        assertThat(announcementRecipient1).isEqualTo(announcementRecipient2);

        announcementRecipient2 = getAnnouncementRecipientSample2();
        assertThat(announcementRecipient1).isNotEqualTo(announcementRecipient2);
    }

    @Test
    void versionTest() {
        AnnouncementRecipient announcementRecipient = getAnnouncementRecipientRandomSampleGenerator();
        AnnouncementVersion announcementVersionBack = getAnnouncementVersionRandomSampleGenerator();

        announcementRecipient.setVersion(announcementVersionBack);
        assertThat(announcementRecipient.getVersion()).isEqualTo(announcementVersionBack);

        announcementRecipient.version(null);
        assertThat(announcementRecipient.getVersion()).isNull();
    }

    @Test
    void membershipTest() {
        AnnouncementRecipient announcementRecipient = getAnnouncementRecipientRandomSampleGenerator();
        FarmMembership farmMembershipBack = getFarmMembershipRandomSampleGenerator();

        announcementRecipient.setMembership(farmMembershipBack);
        assertThat(announcementRecipient.getMembership()).isEqualTo(farmMembershipBack);

        announcementRecipient.membership(null);
        assertThat(announcementRecipient.getMembership()).isNull();
    }
}
