package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SupportTicketTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class SupportTicketTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(SupportTicket.class);
        SupportTicket supportTicket1 = getSupportTicketSample1();
        SupportTicket supportTicket2 = new SupportTicket();
        assertThat(supportTicket1).isNotEqualTo(supportTicket2);

        supportTicket2.setId(supportTicket1.getId());
        assertThat(supportTicket1).isEqualTo(supportTicket2);

        supportTicket2 = getSupportTicketSample2();
        assertThat(supportTicket1).isNotEqualTo(supportTicket2);
    }

    @Test
    void requesterTest() {
        SupportTicket supportTicket = getSupportTicketRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        supportTicket.setRequester(appUserBack);
        assertThat(supportTicket.getRequester()).isEqualTo(appUserBack);

        supportTicket.requester(null);
        assertThat(supportTicket.getRequester()).isNull();
    }

    @Test
    void farmTest() {
        SupportTicket supportTicket = getSupportTicketRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        supportTicket.setFarm(farmBack);
        assertThat(supportTicket.getFarm()).isEqualTo(farmBack);

        supportTicket.farm(null);
        assertThat(supportTicket.getFarm()).isNull();
    }

    @Test
    void assignedCsTest() {
        SupportTicket supportTicket = getSupportTicketRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        supportTicket.setAssignedCs(appUserBack);
        assertThat(supportTicket.getAssignedCs()).isEqualTo(appUserBack);

        supportTicket.assignedCs(null);
        assertThat(supportTicket.getAssignedCs()).isNull();
    }
}
