package vn.edu.fpt.beefcare.service.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import tech.jhipster.config.JHipsterProperties;

/** Configured SMTP adapter. Credentials come only from Spring mail environment configuration. */
@Component
@Profile("!test & !testh2")
@ConditionalOnProperty(name = "beefcare.email.provider", havingValue = "smtp")
public class SmtpEmailDelivery implements EmailDelivery {

    private static final Logger LOG = LoggerFactory.getLogger(SmtpEmailDelivery.class);
    private final JavaMailSender sender;
    private final JHipsterProperties properties;

    public SmtpEmailDelivery(JavaMailSender sender, JHipsterProperties properties) {
        this.sender = sender;
        this.properties = properties;
    }

    @Override
    public void deliver(OutboundEmail outbound) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                MimeMessage message = sender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, outbound.html(), StandardCharsets.UTF_8.name());
                helper.setTo(outbound.to());
                helper.setFrom(properties.getMail().getFrom());
                helper.setSubject(outbound.subject());
                if (outbound.html()) helper.setText(outbound.plainText() == null ? outbound.content().replaceAll("<[^>]*>", " ") : outbound.plainText(), outbound.content());
                else helper.setText(outbound.content(), false);
                sender.send(message);
                return;
            } catch (MailException | MessagingException failure) {
                last = new IllegalStateException("SMTP delivery failed", failure);
                if (attempt < 3) {
                    try { Thread.sleep(attempt * 250L); } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
        LOG.warn("Email delivery failed after retries for recipient {} and subject {}", outbound.to(), outbound.subject());
        if (last != null) throw last;
    }
}
