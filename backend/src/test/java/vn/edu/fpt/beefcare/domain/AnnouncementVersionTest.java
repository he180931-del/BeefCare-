package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AnnouncementVersionTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmAnnouncementTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class AnnouncementVersionTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(AnnouncementVersion.class);
        AnnouncementVersion announcementVersion1 = getAnnouncementVersionSample1();
        AnnouncementVersion announcementVersion2 = new AnnouncementVersion();
        assertThat(announcementVersion1).isNotEqualTo(announcementVersion2);

        announcementVersion2.setId(announcementVersion1.getId());
        assertThat(announcementVersion1).isEqualTo(announcementVersion2);

        announcementVersion2 = getAnnouncementVersionSample2();
        assertThat(announcementVersion1).isNotEqualTo(announcementVersion2);
    }

    @Test
    void announcementTest() {
        AnnouncementVersion announcementVersion = getAnnouncementVersionRandomSampleGenerator();
        FarmAnnouncement farmAnnouncementBack = getFarmAnnouncementRandomSampleGenerator();

        announcementVersion.setAnnouncement(farmAnnouncementBack);
        assertThat(announcementVersion.getAnnouncement()).isEqualTo(farmAnnouncementBack);

        announcementVersion.announcement(null);
        assertThat(announcementVersion.getAnnouncement()).isNull();
    }
}
