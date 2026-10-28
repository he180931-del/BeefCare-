package vn.edu.fpt.beefcare.service.email;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import vn.edu.fpt.beefcare.domain.AccountLinkToken;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.EmailDeliveryJob;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.EmailDeliveryJobRepository;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.payment.SubscriptionNoticeJob;
import vn.edu.fpt.beefcare.repository.SupportTicketRepository;

/** Durable, retryable dispatch for verification, reset and invitation links and account notices. Only a row reference is stored. */
@Service
public class EmailDeliveryJobService {

    private static final String EMAIL_VERIFICATION = "EMAIL_VERIFICATION";
    private static final String PASSWORD_RESET = "PASSWORD_RESET";
    private static final int MAX_ATTEMPTS = 8;
    private static final DateTimeFormatter DISPLAY_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.forLanguageTag("vi"));
    private final EmailDeliveryJobRepository jobs;
    private final AccountLinkTokenRepository accountLinks;
    private final FarmInvitationRepository invitations;
    private final SupportTicketRepository supportTickets;
    private final AppUserRepository accounts;
    private final FarmRepository farms;
    private final ActionLinkSigner signer;
    private final EmailDelivery delivery;
    private final SpringTemplateEngine templates;
    private final String frontendBaseUrl;
    private final String backendBaseUrl;
    private final TransactionTemplate requiresNew;

    public EmailDeliveryJobService(
        EmailDeliveryJobRepository jobs,
        AccountLinkTokenRepository accountLinks,
        FarmInvitationRepository invitations,
        SupportTicketRepository supportTickets,
        AppUserRepository accounts,
        FarmRepository farms,
        ActionLinkSigner signer,
        EmailDelivery delivery,
        SpringTemplateEngine templates,
        PlatformTransactionManager transactionManager,
        @Value("${beefcare.email.frontend-base-url}") String frontendBaseUrl,
        @Value("${beefcare.email.backend-base-url}") String backendBaseUrl
    ) {
        this.jobs = jobs;
        this.accountLinks = accountLinks;
        this.invitations = invitations;
        this.supportTickets = supportTickets;
        this.accounts = accounts;
        this.farms = farms;
        this.signer = signer;
        this.delivery = delivery;
        this.templates = templates;
        this.frontendBaseUrl = trimTrailingSlash(frontendBaseUrl);
        this.backendBaseUrl = trimTrailingSlash(backendBaseUrl);
        this.requiresNew = new TransactionTemplate(transactionManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Scheduled(fixedDelayString = "${beefcare.email.poll-delay-ms:2000}")
    public void dispatchDueJobs() {
        Instant now = Instant.now();
        for (EmailDeliveryJob candidate : jobs.findByStatusAndAvailableAtLessThanEqualOrderByCreatedAtAsc("PENDING", now, PageRequest.of(0, 25))) {
            if (claim(candidate.getId(), now)) dispatch(candidate.getId());
        }
    }

    private boolean claim(Long id, Instant now) {
        Integer claimed = requiresNew.execute(status -> jobs.claim(id, now, now.plus(Duration.ofMinutes(2))));
        return claimed != null && claimed == 1;
    }

    private void dispatch(Long id) {
        OutboundEmail message;
        try {
            message = requiresNew.execute(status -> prepare(id));
            if (message == null) return;
            delivery.deliver(message);
            requiresNew.executeWithoutResult(status -> jobs.findById(id).ifPresent(job -> {
                if (!"PENDING".equals(job.getStatus())) return;
                job.setStatus("SENT");
                job.setSentAt(Instant.now());
                job.setLeaseUntil(null);
                job.setLastError(null);
            }));
        } catch (RuntimeException failure) {
            requiresNew.executeWithoutResult(status -> jobs.findById(id).ifPresent(job -> {
                if (!"PENDING".equals(job.getStatus())) return;
                job.setLeaseUntil(null);
                job.setLastError(failure.getClass().getSimpleName());
                if (job.getAttempts() >= MAX_ATTEMPTS) {
                    job.setStatus("FAILED");
                } else {
                    long delay = Math.min(3600, 1L << Math.min(12, job.getAttempts()));
                    job.setAvailableAt(Instant.now().plusSeconds(delay));
                }
            }));
        }
    }

    private OutboundEmail prepare(Long id) {
        EmailDeliveryJob job = jobs.findById(id).orElse(null);
        if (job == null || !"PENDING".equals(job.getStatus())) return null;
        String bearer;
        Instant expiry;
        String expectedRecipient;
        String actionUrl;
        Farm subscriptionFarm = null;
        if ("ACCOUNT_LINK".equals(job.getLinkSource())) {
            AccountLinkToken link = accountLinks.findById(job.getLinkSourceId()).orElse(null);
            if (link == null || link.getUsedAt() != null || link.getTokenNonce() == null || !link.getExpiresAt().isAfter(Instant.now())) return cancel(job);
            String templateKey = EMAIL_VERIFICATION.equals(link.getTokenType()) ? "VERIFY_EMAIL" : "PASSWORD_RESET".equals(link.getTokenType()) ? "RESET_PASSWORD" : null;
            if (templateKey == null || !templateKey.equals(job.getTemplateKey())) return cancel(job);
            bearer = signer.bearer("ACCOUNT_LINK:" + link.getTokenType(), link.getId(), link.getTokenNonce());
            if (!signer.matchesHash(bearer, link.getTokenHash())) return cancel(job);
            expectedRecipient = link.getUser().getEmail();
            expiry = link.getExpiresAt();
            String base = templateKey.equals("VERIFY_EMAIL") ? backendBaseUrl + "/api/activate?token=" : frontendBaseUrl + "/reset-password?token=";
            actionUrl = base + bearer;
        } else if ("INVITATION".equals(job.getLinkSource())) {
            FarmInvitation invitation = invitations.findById(job.getLinkSourceId()).orElse(null);
            if (invitation == null || !"PENDING".equalsIgnoreCase(invitation.getStatus()) || invitation.getTokenNonce() == null || !invitation.getExpiresAt().isAfter(Instant.now())) return cancel(job);
            bearer = signer.bearer("FARM_INVITATION", invitation.getId(), invitation.getTokenNonce());
            if (!signer.matchesHash(bearer, invitation.getTokenHash())) return cancel(job);
            expectedRecipient = invitation.getInvitedEmail();
            expiry = invitation.getExpiresAt();
            actionUrl = frontendBaseUrl + "/invitation/accept?token=" + bearer;
        } else if ("ACCOUNT".equals(job.getLinkSource()) && "GOOGLE_SIGN_IN_ADVICE".equals(job.getTemplateKey())) {
            // UC-FE01-05 AF1: no link or token, only advice; dropped if a password was added meanwhile.
            AppUser account = accounts.findById(job.getLinkSourceId()).orElse(null);
            if (account == null || account.isPasswordLoginEnabled()) return cancel(job);
            expectedRecipient = account.getEmail();
            expiry = Instant.now();
            actionUrl = frontendBaseUrl + "/sign-in";
            bearer = null;
        } else if ("FARM_SUBSCRIPTION".equals(job.getLinkSource()) && "SUBSCRIPTION_NOTICE".equals(job.getTemplateKey())) {
            // JOB-05: contextRole holds the notice type and contextName the period end it is about.
            Farm farm = farms.findById(job.getLinkSourceId()).orElse(null);
            if (farm == null) return cancel(job);
            expectedRecipient = job.getRecipient();
            expiry = Instant.parse(job.getContextName());
            actionUrl = frontendBaseUrl + "/farms/" + farm.getId() + "/subscription";
            bearer = null;
            subscriptionFarm = farm;
        } else if ("SUPPORT_TICKET".equals(job.getLinkSource()) && "SUPPORT_TICKET_UPDATE".equals(job.getTemplateKey())) {
            var ticket = supportTickets.findById(job.getLinkSourceId()).orElse(null);
            if (ticket == null || !job.getRecipient().equalsIgnoreCase(ticket.getRequester().getEmail())) return cancel(job);
            expectedRecipient = ticket.getRequester().getEmail();
            expiry = Instant.now();
            actionUrl = frontendBaseUrl + "/support/tickets/" + ticket.getId();
            bearer = null;
            job.setContextName(ticket.getCode());
            job.setContextRole(ticket.getStatus());
            job.setDisplayName(ticket.getRequester().getFullName());
        } else {
            return cancel(job);
        }
        if (!job.getRecipient().equalsIgnoreCase(expectedRecipient)) return cancel(job);

        String title;
        String intro;
        String button;
        String safeName = blankDefault(job.getDisplayName(), "bạn");
        String expiryText;
        switch (job.getTemplateKey()) {
            case "VERIFY_EMAIL" -> {
                title = "Xác minh email của bạn";
                intro = "Xác minh địa chỉ email để kích hoạt tài khoản BeefCare và tiếp tục đăng ký.";
                button = "Xác minh email";
                expiryText = "Liên kết có hiệu lực đến " + DISPLAY_TIME.withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(expiry) + " (giờ Việt Nam).";
            }
            case "RESET_PASSWORD" -> {
                title = "Đặt lại mật khẩu";
                intro = "Bạn đã yêu cầu đặt lại mật khẩu BeefCare. Nếu bạn không yêu cầu, hãy bỏ qua email này.";
                button = "Đặt lại mật khẩu";
                expiryText = "Liên kết chỉ sử dụng một lần và hết hạn lúc " + DISPLAY_TIME.withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(expiry) + " (giờ Việt Nam).";
            }
            case "FARM_INVITATION" -> {
                String farmName = blankDefault(job.getContextName(), "trang trại");
                String role = "MANAGER".equalsIgnoreCase(job.getContextRole()) ? "Quản lý" : "Kỹ thuật viên";
                intro = "Bạn được mời tham gia trang trại “" + farmName + "” với vai trò " + role + ". Hãy đăng nhập bằng email này để xem và chấp nhận lời mời.";
                title = "Lời mời tham gia trang trại";
                button = "Xem lời mời";
                expiryText = "Lời mời hết hạn lúc " + DISPLAY_TIME.withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(expiry) + " (giờ Việt Nam).";
            }
            case "GOOGLE_SIGN_IN_ADVICE" -> {
                title = "Đăng nhập bằng Google";
                intro = "Tài khoản BeefCare của bạn đăng nhập bằng Google và chưa có mật khẩu, nên không có mật khẩu nào để đặt lại. Hãy chọn “Tiếp tục với Google” ở màn hình đăng nhập. Sau khi đăng nhập, bạn có thể thêm mật khẩu trong hồ sơ của mình.";
                button = "Đăng nhập";
                expiryText = "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.";
            }
            case "SUBSCRIPTION_NOTICE" -> {
                SubscriptionNoticeJob.Notice notice;
                try { notice = SubscriptionNoticeJob.Notice.valueOf(job.getContextRole()); } catch (RuntimeException unknown) { return cancel(job); }
                title = notice == SubscriptionNoticeJob.Notice.RENEWAL_OPEN ? "Đã mở gia hạn gói dịch vụ"
                    : notice == SubscriptionNoticeJob.Notice.EXPIRED ? "Thời hạn dịch vụ đã hết" : "Gói dịch vụ sắp hết hạn";
                intro = SubscriptionNoticeJob.summary(notice, subscriptionFarm, expiry.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate());
                button = "Xem gói dịch vụ";
                expiryText = "BeefCare không tự động gia hạn; bạn tạo yêu cầu thanh toán khi muốn gia hạn.";
            }
            case "SUPPORT_TICKET_UPDATE" -> {
                title = "Cập nhật yêu cầu hỗ trợ";
                intro = "Yêu cầu hỗ trợ " + blankDefault(job.getContextName(), "") + " đã được cập nhật. Trạng thái hiện tại: " + blankDefault(job.getContextRole(), "Đang xử lý") + ".";
                button = "Mở yêu cầu hỗ trợ";
                expiryText = "Đăng nhập vào BeefCare để xem nội dung và trao đổi mới nhất.";
            }
            default -> { return cancel(job); }
        }
        Context context = new Context(Locale.forLanguageTag("vi"));
        context.setVariable("title", title);
        context.setVariable("greeting", "Xin chào " + safeName + ",");
        context.setVariable("intro", intro);
        context.setVariable("buttonLabel", button);
        context.setVariable("actionUrl", actionUrl);
        context.setVariable("expiryText", expiryText);
        String html = templates.process("mail/srs/action", context);
        String plain = "BeefCare\n\n" + "Xin chào " + safeName + ",\n\n" + intro + "\n\n" + button + ": " + actionUrl + "\n\n" + expiryText + "\n";
        return new OutboundEmail(job.getRecipient(), job.getSubject(), html, true, Instant.now(), plain);
    }

    private OutboundEmail cancel(EmailDeliveryJob job) {
        job.setStatus("CANCELLED");
        job.setLeaseUntil(null);
        return null;
    }

    private static String blankDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String trimTrailingSlash(String value) {
        if (value == null) return "";
        return value.replaceAll("/+$", "");
    }
}
