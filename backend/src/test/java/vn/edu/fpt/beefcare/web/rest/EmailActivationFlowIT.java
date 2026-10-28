package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.EmailDeliveryJobRepository;
import vn.edu.fpt.beefcare.service.IdentityService;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;
import vn.edu.fpt.beefcare.service.email.EmailDeliveryJobService;
import vn.edu.fpt.beefcare.service.email.MockEmailDelivery;

@ServiceIntegrationTest
class EmailActivationFlowIT {

    @Autowired IdentityService identityService;
    @Autowired EmailDeliveryJobService deliveryJobs;
    @Autowired EmailDeliveryJobRepository jobs;
    @Autowired AccountLinkTokenRepository links;
    @Autowired MockEmailDelivery inbox;
    @Autowired ActionLinkSigner signer;
    @Autowired MockMvc mockMvc;

    @Test
    void registeredEmailLinkDispatchesDurablyAndCreatesSessionAfterVerification() throws Exception {
        String email = "mail-flow@example.test";
        identityService.register("Mail Flow Owner", email, "SomeStrongPass9", "SomeStrongPass9", true);

        var queued = jobs.findAll().stream().filter(job -> email.equalsIgnoreCase(job.getRecipient())).findFirst().orElseThrow();
        assertThat(queued.getTemplateKey()).isEqualTo("VERIFY_EMAIL");
        assertThat(queued.getLinkSource()).isEqualTo("ACCOUNT_LINK");
        assertThat(queued.getLinkSourceId()).isNotNull();
        deliveryJobs.dispatchDueJobs();

        var message = inbox.findMessagesFor(email).stream().findFirst().orElseThrow();
        assertThat(message.subject()).containsIgnoringCase("xác minh"); // the subject is "Xác minh email BeefCare"
        assertThat(message.content()).contains("Xin chào Mail Flow Owner");
        String token = tokenFrom(message.plainText());
        var link = links.findById(queued.getLinkSourceId()).orElseThrow();
        assertThat(link.getTokenHash()).isEqualTo(signer.hash(token));

        MvcResult activated = mockMvc.perform(get("/api/activate").param("token", token))
            .andExpect(status().isSeeOther())
            .andReturn();
        MockHttpSession session = (MockHttpSession) activated.getRequest().getSession(false);
        assertThat(session).isNotNull();
        assertThat(session.getMaxInactiveInterval()).isEqualTo(28_800);
        assertThat(activated.getResponse().getHeader("Location")).endsWith("/owner-registration");
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isOk());
        assertThat(links.findById(link.getId()).orElseThrow().getUsedAt()).isNotNull();
        assertThat(jobs.findById(queued.getId()).orElseThrow().getStatus()).isEqualTo("SENT");
    }

    @Test
    void failedMailProviderDeliveryIsRetriedFromThePersistedJob() {
        String email = "mail-retry@example.test";
        identityService.register("Retry Owner", email, "SomeStrongPass9", "SomeStrongPass9", true);
        inbox.failNextDeliveries(1);
        deliveryJobs.dispatchDueJobs();
        var job = jobs.findAll().stream().filter(candidate -> email.equalsIgnoreCase(candidate.getRecipient())).findFirst().orElseThrow();
        assertThat(job.getStatus()).isEqualTo("PENDING");
        assertThat(job.getAttempts()).isEqualTo(1);
        assertThat(job.getLastError()).isEqualTo("IllegalStateException");
        assertThat(inbox.findMessagesFor(email)).isEmpty();

        job.setAvailableAt(java.time.Instant.now().minusSeconds(1));
        jobs.saveAndFlush(job);
        deliveryJobs.dispatchDueJobs();

        var delivered = jobs.findById(job.getId()).orElseThrow();
        assertThat(delivered.getStatus()).isEqualTo("SENT");
        assertThat(delivered.getAttempts()).isEqualTo(2);
        assertThat(inbox.findMessagesFor(email)).hasSize(1);
    }

    private static String tokenFrom(String text) {
        var matcher = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(text);
        if (!matcher.find()) throw new AssertionError("The rendered plain-text email did not include an action link");
        return matcher.group(1);
    }
}
