package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SupportTicketTestSamples.*;
import static vn.edu.fpt.beefcare.domain.TicketMessageTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class TicketMessageTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(TicketMessage.class);
        TicketMessage ticketMessage1 = getTicketMessageSample1();
        TicketMessage ticketMessage2 = new TicketMessage();
        assertThat(ticketMessage1).isNotEqualTo(ticketMessage2);

        ticketMessage2.setId(ticketMessage1.getId());
        assertThat(ticketMessage1).isEqualTo(ticketMessage2);

        ticketMessage2 = getTicketMessageSample2();
        assertThat(ticketMessage1).isNotEqualTo(ticketMessage2);
    }

    @Test
    void ticketTest() {
        TicketMessage ticketMessage = getTicketMessageRandomSampleGenerator();
        SupportTicket supportTicketBack = getSupportTicketRandomSampleGenerator();

        ticketMessage.setTicket(supportTicketBack);
        assertThat(ticketMessage.getTicket()).isEqualTo(supportTicketBack);

        ticketMessage.ticket(null);
        assertThat(ticketMessage.getTicket()).isNull();
    }

    @Test
    void authorTest() {
        TicketMessage ticketMessage = getTicketMessageRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        ticketMessage.setAuthor(appUserBack);
        assertThat(ticketMessage.getAuthor()).isEqualTo(appUserBack);

        ticketMessage.author(null);
        assertThat(ticketMessage.getAuthor()).isNull();
    }
}
