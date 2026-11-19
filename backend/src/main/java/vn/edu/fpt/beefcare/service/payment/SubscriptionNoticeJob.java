package vn.edu.fpt.beefcare.service.payment;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.repository.EmailDeliveryJobRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.MailService;
import vn.edu.fpt.beefcare.service.NotificationService;

/**
 * JOB-05 (SRS 24.5): daily at 07:00 Asia/Ho_Chi_Minh, tells the current Owner of each farm with a confirmed end date that
 * renewal opens (end − 90 days, GBR-71), that coverage ends in 30, 7 or 1 days, or that it ended today. One in-app notice
 * and one email per notice type, farm, period and Owner; a run only creates the notices of its own day, so a missed day is
 * not caught up and a repeated run creates nothing new.
 */
@Component
public class SubscriptionNoticeJob {

    private static final Logger LOG = LoggerFactory.getLogger(SubscriptionNoticeJob.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public enum Notice {
        RENEWAL_OPEN(90), EXPIRING_30(30), EXPIRING_7(7), EXPIRING_1(1), EXPIRED(0);

        final int daysBeforeEnd;

        Notice(int daysBeforeEnd) {
            this.daysBeforeEnd = daysBeforeEnd;
        }
    }

    private final SubscriptionRepository subscriptions;
    private final FarmMembershipRepository memberships;
    private final NotificationService notifications;
    private final MailService mail;
    private final EmailDeliveryJobRepository emailJobs;
    private final FarmClock clock;
    private final TransactionTemplate transactions;

    public SubscriptionNoticeJob(
        SubscriptionRepository subscriptions,
        FarmMembershipRepository memberships,
        NotificationService notifications,
        MailService mail,
        EmailDeliveryJobRepository emailJobs,
        FarmClock clock,
        PlatformTransactionManager transactionManager
    ) {
        this.subscriptions = subscriptions;
        this.memberships = memberships;
        this.notifications = notifications;
        this.mail = mail;
        this.emailJobs = emailJobs;
        this.clock = clock;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "${beefcare.jobs.subscription-notice-cron:0 0 7 * * *}", zone = "Asia/Ho_Chi_Minh")
    public void generateNotices() {
        int created = run();
        if (created > 0) LOG.info("JOB-05 created {} subscription notices", created);
    }

    /** Creates today's notices; returns how many new notices were created. */
    public int run() {
        LocalDate today = clock.today();
        AtomicInteger created = new AtomicInteger();
        subscriptions.findAll().stream().map(Subscription::getId).forEach(id -> {
            try {
                Integer n = transactions.execute(status -> noticeFor(id, today));
                if (n != null) created.addAndGet(n);
            } catch (RuntimeException failure) {
                LOG.error("JOB-05 failed for subscription {}; other farms continue", id, failure);
            }
        });
        return created.get();
    }

    private int noticeFor(Long subscriptionId, LocalDate today) {
        Subscription subscription = subscriptions.findById(subscriptionId).orElse(null);
        if (subscription == null || subscription.getLatestEnd() == null) return 0;
        LocalDate end = subscription.getLatestEnd().atZone(clock.zone()).toLocalDate();
        Notice notice = null;
        for (Notice candidate : Notice.values()) {
            if (end.minusDays(candidate.daysBeforeEnd).equals(today)) notice = candidate;
        }
        if (notice == null) return 0;
        Farm farm = subscription.getFarm();
        // A SUSPENDED farm cannot request a payment (GBR-71); it only hears that coverage ended.
        if ("SUSPENDED".equalsIgnoreCase(farm.getServiceStatus()) && notice != Notice.EXPIRED) return 0;
        var owner = memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farm.getId(), "OWNER", "ACTIVE").orElse(null);
        if (owner == null) return 0;
        AppUser recipient = owner.getUser();
        // JOB-04 writes the in-app "expired" notice with this key at the moment coverage ends; reuse it so there is one.
        String eventKey = notice == Notice.EXPIRED
            ? "SUBSCRIPTION_EXPIRED:" + farm.getId() + ":" + subscription.getLatestEnd()
            : "SUBSCRIPTION_NOTICE:" + notice + ":" + farm.getId() + ":" + subscription.getLatestEnd();
        notifications.notify(recipient, "subscription", "SUBSCRIPTION", farm.getId(), title(notice), summary(notice, farm, end), eventKey);
        String period = subscription.getLatestEnd().toString();
        if (emailJobs.existsByRecipientIgnoreCaseAndTemplateKeyAndLinkSourceIdAndContextRoleAndContextName(
            recipient.getEmail(), "SUBSCRIPTION_NOTICE", farm.getId(), notice.name(), period)) {
            return 0;
        }
        mail.queueActionLink(recipient.getEmail(), "SUBSCRIPTION_NOTICE", "FARM_SUBSCRIPTION", farm.getId(), recipient.getFullName(), period, notice.name());
        return 1;
    }

    static String title(Notice notice) {
        return switch (notice) {
            case RENEWAL_OPEN -> "Đã mở gia hạn gói dịch vụ";
            case EXPIRING_30, EXPIRING_7, EXPIRING_1 -> "Gói dịch vụ sắp hết hạn";
            case EXPIRED -> "Thời hạn dịch vụ đã hết";
        };
    }

    /** Shared with the email so both say the same thing. */
    public static String summary(Notice notice, Farm farm, LocalDate end) {
        String name = farm.getName();
        return switch (notice) {
            case RENEWAL_OPEN -> "Trang trại " + name + " đã có thể gia hạn. Thời hạn hiện tại kết thúc ngày " + DATE.format(end) + ".";
            case EXPIRING_30, EXPIRING_7, EXPIRING_1 -> "Gói dịch vụ của trang trại " + name + " sẽ hết hạn sau " + notice.daysBeforeEnd +
                " ngày, vào ngày " + DATE.format(end) + ".";
            case EXPIRED -> "Gói dịch vụ của trang trại " + name + " đã hết hạn ngày " + DATE.format(end) +
                ". Hãy gia hạn để tiếp tục sử dụng đầy đủ chức năng.";
        };
    }
}
