package vn.edu.fpt.beefcare.service.payment;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.JsonSupport;
import vn.edu.fpt.beefcare.service.NotificationService;

/** Implements JOB-03 and JOB-04 with per-farm serialized state changes and retry-safe notices. */
@Component
public class SubscriptionLifecycleJob {
    private static final Logger LOG = LoggerFactory.getLogger(SubscriptionLifecycleJob.class);
    private final PaymentRepository payments;
    private final SubscriptionRepository subscriptions;
    private final FarmRepository farms;
    private final FarmMembershipRepository memberships;
    private final AuditLogRepository auditLogs;
    private final NotificationService notifications;
    private final FarmClock clock;
    private final TransactionTemplate transactions;

    public SubscriptionLifecycleJob(
        PaymentRepository payments,
        SubscriptionRepository subscriptions,
        FarmRepository farms,
        FarmMembershipRepository memberships,
        AuditLogRepository auditLogs,
        NotificationService notifications,
        FarmClock clock,
        PlatformTransactionManager transactionManager
    ) {
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.farms = farms;
        this.memberships = memberships;
        this.auditLogs = auditLogs;
        this.notifications = notifications;
        this.clock = clock;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Scheduled(cron = "${beefcare.jobs.payment-expiry-cron:0 */5 * * * *}")
    public void expireUnpaidRequests() {
        Instant now = clock.now();
        AtomicInteger expiredCount = new AtomicInteger();
        payments.findAllByStateIgnoreCaseAndExpiresAtBefore("PENDING", now).stream()
            .map(Payment::getId)
            .forEach(paymentId -> runOne("payment " + paymentId, () -> {
                Payment observed = payments.findById(paymentId).orElse(null);
                if (observed == null) return;
                Long farmId = observed.getSubscription().getFarm().getId();
                farms.lockById(farmId).orElse(null);
                subscriptions.lockByFarmId(farmId).orElse(null);
                Payment payment = payments.lockById(paymentId).orElse(null);
                if (payment == null || !"PENDING".equalsIgnoreCase(payment.getState()) || !payment.getExpiresAt().isBefore(now)) return;
                payment.setState("EXPIRED");
                payments.saveAndFlush(payment);
                AuditLog audit = audit(null, "PAYMENT_EXPIRED", "Payment", payment.getId(), null, Map.of("quoteRef", payment.getQuoteRef()));
                memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farmId, "OWNER", "ACTIVE").ifPresent(owner ->
                    notifications.notify(owner.getUser(), "subscription", "Payment", payment.getId(), "Yêu cầu thanh toán đã hết hạn",
                        "Mã yêu cầu " + payment.getQuoteRef() + " đã hết hạn. Bạn có thể tạo yêu cầu mới.",
                        "PAYMENT_EXPIRED:" + payment.getId())
                );
                expiredCount.incrementAndGet();
            }));
        if (expiredCount.get() > 0) LOG.info("Expired {} unpaid subscription payment requests", expiredCount.get());
    }

    @Scheduled(cron = "${beefcare.jobs.subscription-coverage-cron:0 */15 * * * *}")
    public void evaluateCoverage() {
        Instant now = clock.now();
        AtomicInteger changedCount = new AtomicInteger();
        subscriptions.findAll().stream().map(Subscription::getId).forEach(subscriptionId -> runOne("subscription " + subscriptionId, () -> {
            Subscription observed = subscriptions.findById(subscriptionId).orElse(null);
            if (observed == null) return;
            Long farmId = observed.getFarm().getId();
            Farm farm = farms.lockById(farmId).orElse(null);
            if (farm == null) return;
            Subscription subscription = subscriptions.lockByFarmId(farmId).orElse(null);
            if (subscription == null) return;
            String entitlement = subscription.getLatestEnd() != null && subscription.getLatestEnd().isAfter(now) ? "ACTIVE" :
                (subscription.getLatestEnd() == null ? "PENDING_PAYMENT" : "EXPIRED");
            if (!entitlement.equalsIgnoreCase(subscription.getEntitlementStatus())) subscription.setEntitlementStatus(entitlement);

            String before = farm.getServiceStatus();
            if (!"SUSPENDED".equalsIgnoreCase(before) && !entitlement.equalsIgnoreCase(before)) farm.setServiceStatus(entitlement);
            boolean entitlementChanged = !entitlement.equalsIgnoreCase(observed.getEntitlementStatus());
            boolean serviceChanged = !before.equalsIgnoreCase(farm.getServiceStatus());
            if (!entitlementChanged && !serviceChanged) return;
            subscriptions.save(subscription);
            farms.saveAndFlush(farm);
            audit(null, "SERVICE_STATUS_JOB", "Farm", farmId, farm, Map.of(
                "statusBefore", before,
                "statusAfter", farm.getServiceStatus(),
                "entitlementStatus", entitlement,
                "latestEnd", subscription.getLatestEnd() == null ? "" : subscription.getLatestEnd().toString()
            ));
            if ("EXPIRED".equals(entitlement) && !"EXPIRED".equalsIgnoreCase(before)) {
                String eventKey = "SUBSCRIPTION_EXPIRED:" + farmId + ":" + subscription.getLatestEnd();
                memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farmId, "OWNER", "ACTIVE").ifPresent(owner ->
                    notifications.notify(owner.getUser(), "subscription", "Farm", farmId, "Thời hạn dịch vụ đã hết",
                        "Gói dịch vụ của trang trại đã hết hạn. Hãy gia hạn để tiếp tục sử dụng đầy đủ chức năng.", eventKey)
                );
            }
            changedCount.incrementAndGet();
        }));
        if (changedCount.get() > 0) LOG.info("Reconciled subscription coverage for {} farms", changedCount.get());
    }

    private void runOne(String label, Runnable work) {
        try {
            transactions.executeWithoutResult(status -> work.run());
        } catch (RuntimeException failure) {
            LOG.error("Subscription lifecycle job failed for {}; it will be retried on the next run", label, failure);
        }
    }

    private AuditLog audit(vn.edu.fpt.beefcare.domain.AppUser actor, String action, String targetType, Long targetId, Farm farm, Object details) {
        AuditLog entry = new AuditLog();
        entry.setActor(actor);
        entry.setFarm(farm);
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setLoggedAt(clock.now());
        entry.setDetails(JsonSupport.toJson(details));
        return auditLogs.save(entry);
    }
}
