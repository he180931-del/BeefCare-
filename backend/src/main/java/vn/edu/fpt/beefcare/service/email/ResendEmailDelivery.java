package vn.edu.fpt.beefcare.service.email;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tech.jhipster.config.JHipsterProperties;

/** Delivers transactional email through Resend's HTTPS API. */
@Component
@Profile("!test & !testh2")
@ConditionalOnProperty(name = "beefcare.email.provider", havingValue = "resend")
public class ResendEmailDelivery implements EmailDelivery {

    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final RestClient client;
    private final String from;
    private final String apiKey;

    public ResendEmailDelivery(@Value("${beefcare.email.resend.api-key:}") String apiKey, JHipsterProperties properties) {
        this(createClient(), properties.getMail().getFrom(), apiKey);
    }

    ResendEmailDelivery(RestClient client, String from, String apiKey) {
        Assert.hasText(apiKey, "BEEFCARE_RESEND_API_KEY must be set when beefcare.email.provider=resend");
        this.client = client;
        this.apiKey = apiKey;
        this.from = from;
    }

    private static RestClient createClient() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        return RestClient.builder().requestFactory(requestFactory).build();
    }

    @Override
    public void deliver(OutboundEmail outbound) {
        try {
            client
                .post()
                .uri(RESEND_EMAILS_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(requestFor(outbound))
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException failure) {
            throw new IllegalStateException("Resend API delivery failed", failure);
        }
    }

    private ResendEmailRequest requestFor(OutboundEmail outbound) {
        String text = outbound.html()
            ? (StringUtils.hasText(outbound.plainText()) ? outbound.plainText() : outbound.content().replaceAll("<[^>]*>", " "))
            : outbound.content();
        return new ResendEmailRequest(from, List.of(outbound.to()), outbound.subject(), outbound.html() ? outbound.content() : null, text);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private record ResendEmailRequest(String from, List<String> to, String subject, String html, String text) {}
}
