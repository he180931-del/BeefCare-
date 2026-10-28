package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SupportHistoryTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SupportTicketTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class SupportHistoryTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(SupportHistory.class);
        SupportHistory supportHistory1 = getSupportHistorySample1();
        SupportHistory supportHistory2 = new SupportHistory();
        assertThat(supportHistory1).isNotEqualTo(supportHistory2);

        supportHistory2.setId(supportHistory1.getId());
        assertThat(supportHistory1).isEqualTo(supportHistory2);

        supportHistory2 = getSupportHistorySample2();
        assertThat(supportHistory1).isNotEqualTo(supportHistory2);
    }

    @Test
    void ticketTest() {
        SupportHistory supportHistory = getSupportHistoryRandomSampleGenerator();
        SupportTicket supportTicketBack = getSupportTicketRandomSampleGenerator();

        supportHistory.setTicket(supportTicketBack);
        assertThat(supportHistory.getTicket()).isEqualTo(supportTicketBack);

        supportHistory.ticket(null);
        assertThat(supportHistory.getTicket()).isNull();
    }

    @Test
    void actorTest() {
        SupportHistory supportHistory = getSupportHistoryRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        supportHistory.setActor(appUserBack);
        assertThat(supportHistory.getActor()).isEqualTo(appUserBack);

        supportHistory.actor(null);
        assertThat(supportHistory.getActor()).isNull();
    }
}
