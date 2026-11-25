package vn.edu.fpt.beefcare.service.email;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.RestClient;
import org.springframework.test.web.client.MockRestServiceServer;

class ResendEmailDeliveryTest {

    @Test
    void postsHtmlMessageWithPlainTextAlternativeAndBearerToken() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ResendEmailDelivery delivery = new ResendEmailDelivery(builder.build(), "BeefCare <no-reply@beefcare.vn>", "re_test_token");

        server.expect(requestTo("https://api.resend.com/emails"))
            .andExpect(method(POST))
            .andExpect(header(AUTHORIZATION, "Bearer re_test_token"))
            .andExpect(content().json("""
                {"from":"BeefCare <no-reply@beefcare.vn>","to":["owner@example.test"],"subject":"Welcome","html":"<strong>Hello</strong>","text":"Hello"}
                """))
            .andRespond(withStatus(HttpStatus.OK));

        delivery.deliver(new OutboundEmail("owner@example.test", "Welcome", "<strong>Hello</strong>", true, Instant.now(), "Hello"));

        server.verify();
    }

    @Test
    void postsTextOnlyMessageWithoutAnHtmlField() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ResendEmailDelivery delivery = new ResendEmailDelivery(builder.build(), "BeefCare <no-reply@beefcare.vn>", "re_test_token");

        server.expect(requestTo("https://api.resend.com/emails"))
            .andExpect(content().json("""
                {"from":"BeefCare <no-reply@beefcare.vn>","to":["owner@example.test"],"subject":"Reset","text":"Use this link"}
                """))
            .andRespond(withStatus(HttpStatus.OK));

        delivery.deliver(new OutboundEmail("owner@example.test", "Reset", "Use this link", false, Instant.now()));

        server.verify();
    }

    @Test
    void turnsAnApiErrorIntoADeliveryFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ResendEmailDelivery delivery = new ResendEmailDelivery(builder.build(), "BeefCare <no-reply@beefcare.vn>", "re_test_token");
        server.expect(requestTo("https://api.resend.com/emails")).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY));

        assertThatThrownBy(() -> delivery.deliver(new OutboundEmail("owner@example.test", "Welcome", "Hello", false, Instant.now())))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Resend API delivery failed");

        server.verify();
    }
}
