package vn.edu.fpt.beefcare.service;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.MessageSource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import tech.jhipster.config.JHipsterProperties;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.service.email.EmailDelivery;
import vn.edu.fpt.beefcare.service.email.OutboundEmail;
import vn.edu.fpt.beefcare.domain.EmailDeliveryJob;
import vn.edu.fpt.beefcare.repository.EmailDeliveryJobRepository;
import vn.edu.fpt.beefcare.repository.SupportTicketRepository;

/** Sends messages after commit so links are never sent for rolled-back accounts or invitations. */
@Service
public class MailService {

    private static final Logger LOG = LoggerFactory.getLogger(MailService.class);
    private static final String USER = "user";
    private static final String BASE_URL = "baseUrl";
    private final JHipsterProperties properties;
    private final EmailDelivery delivery;
    private final ApplicationEventPublisher events;
    private final MessageSource messageSource;
    private final SpringTemplateEngine templateEngine;
    private final EmailDeliveryJobRepository jobs;
    private final SupportTicketRepository supportTickets;

    public MailService(
        JHipsterProperties properties,
        EmailDelivery delivery,
        ApplicationEventPublisher events,
        MessageSource messageSource,
        SpringTemplateEngine templateEngine,
        EmailDeliveryJobRepository jobs,
        SupportTicketRepository supportTickets
    ) {
        this.properties = properties;
        this.delivery = delivery;
        this.events = events;
        this.messageSource = messageSource;
        this.templateEngine = templateEngine;
        this.jobs = jobs;
        this.supportTickets = supportTickets;
    }

    /** Creates durable metadata; the referenced action token is reconstructed at delivery and never stored in this job. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void queueActionLink(String recipient, String templateKey, String linkSource, Long linkSourceId, String displayName, String contextName, String contextRole) {
        EmailDeliveryJob job = new EmailDeliveryJob();
        job.setRecipient(recipient);
        job.setTemplateKey(templateKey);
        job.setLinkSource(linkSource);
        job.setLinkSourceId(linkSourceId);
        job.setDisplayName(displayName);
        job.setContextName(contextName);
        job.setContextRole(contextRole);
        job.setSubject(switch (templateKey) {
            case "VERIFY_EMAIL" -> "Xác minh email BeefCare";
            case "RESET_PASSWORD" -> "Đặt lại mật khẩu BeefCare";
            case "FARM_INVITATION" -> "Lời mời tham gia trang trại BeefCare";
            default -> throw new IllegalArgumentException("Unknown action email template");
        });
        job.setCreatedAt(java.time.Instant.now());
        job.setAvailableAt(job.getCreatedAt());
        job.setStatus("PENDING");
        jobs.save(job);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelActionLink(String linkSource, Long linkSourceId) {
        jobs.cancelForLink(linkSource, linkSourceId);
    }

    /** FE-20 hook: caller is responsible for deciding when a customer-facing ticket status update is sent. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void queueSupportTicketUpdate(Long ticketId) {
        var ticket = supportTickets.findById(ticketId).orElseThrow(() -> new IllegalArgumentException("Support ticket does not exist"));
        EmailDeliveryJob job = new EmailDeliveryJob();
        job.setRecipient(ticket.getRequester().getEmail());
        job.setDisplayName(ticket.getRequester().getFullName());
        job.setTemplateKey("SUPPORT_TICKET_UPDATE");
        job.setLinkSource("SUPPORT_TICKET");
        job.setLinkSourceId(ticket.getId());
        job.setSubject("Cập nhật yêu cầu hỗ trợ BeefCare");
        job.setCreatedAt(java.time.Instant.now());
        job.setAvailableAt(job.getCreatedAt());
        job.setStatus("PENDING");
        jobs.save(job);
    }

    public void sendEmail(String to, String subject, String content, boolean isMultipart, boolean isHtml) {
        enqueue(to, subject, content, isHtml);
    }

    public void sendEmailFromTemplate(User user, String templateName, String titleKey) {
        renderAndQueue(user, templateName, titleKey);
    }

    public void sendActivationEmail(User user) {
        LOG.debug("Queueing activation email for recipient {}", user.getEmail());
        renderAndQueue(user, "mail/activationEmail", "email.activation.title");
    }

    public void sendCreationEmail(User user) {
        LOG.debug("Queueing creation email for recipient {}", user.getEmail());
        renderAndQueue(user, "mail/creationEmail", "email.activation.title");
    }

    public void sendPasswordResetMail(User user) {
        LOG.debug("Queueing password reset email for recipient {}", user.getEmail());
        renderAndQueue(user, "mail/passwordResetEmail", "email.reset.title");
    }

    private void renderAndQueue(User user, String templateName, String titleKey) {
        if (user.getEmail() == null) {
            LOG.debug("Email does not exist for user {}", user.getLogin());
            return;
        }
        Locale locale = Locale.forLanguageTag(user.getLangKey());
        Context context = new Context(locale);
        context.setVariable(USER, user);
        context.setVariable(BASE_URL, properties.getMail().getBaseUrl());
        String content = templateEngine.process(templateName, context);
        String subject = messageSource.getMessage(titleKey, null, locale);
        enqueue(user.getEmail(), subject, content, true);
    }

    private void enqueue(String to, String subject, String content, boolean html) {
        OutboundEmail message = new OutboundEmail(to, subject, content, html, java.time.Instant.now());
        if (TransactionSynchronizationManager.isActualTransactionActive()) events.publishEvent(message);
        else deliver(message);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(OutboundEmail message) {
        deliver(message);
    }

    private void deliver(OutboundEmail message) {
        try {
            delivery.deliver(message);
            LOG.debug("Sent email to recipient {} with subject {}", message.to(), message.subject());
        } catch (RuntimeException failure) {
            LOG.warn("Email delivery failed for recipient {} with subject {} ({})", message.to(), message.subject(), failure.getClass().getSimpleName());
        }
    }
}
