package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.InternalRequestTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SupportTicketTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class InternalRequestTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(InternalRequest.class);
        InternalRequest internalRequest1 = getInternalRequestSample1();
        InternalRequest internalRequest2 = new InternalRequest();
        assertThat(internalRequest1).isNotEqualTo(internalRequest2);

        internalRequest2.setId(internalRequest1.getId());
        assertThat(internalRequest1).isEqualTo(internalRequest2);

        internalRequest2 = getInternalRequestSample2();
        assertThat(internalRequest1).isNotEqualTo(internalRequest2);
    }

    @Test
    void ticketTest() {
        InternalRequest internalRequest = getInternalRequestRandomSampleGenerator();
        SupportTicket supportTicketBack = getSupportTicketRandomSampleGenerator();

        internalRequest.setTicket(supportTicketBack);
        assertThat(internalRequest.getTicket()).isEqualTo(supportTicketBack);

        internalRequest.ticket(null);
        assertThat(internalRequest.getTicket()).isNull();
    }

    @Test
    void recipientTest() {
        InternalRequest internalRequest = getInternalRequestRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        internalRequest.setRecipient(appUserBack);
        assertThat(internalRequest.getRecipient()).isEqualTo(appUserBack);

        internalRequest.recipient(null);
        assertThat(internalRequest.getRecipient()).isNull();
    }
}
