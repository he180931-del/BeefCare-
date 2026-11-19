package vn.edu.fpt.beefcare.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class SePayPaymentFlowTest extends DomainTestSupport {
    @Autowired SePayWebhookService service;
    @Autowired PaymentRepository payments;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired BankTransferEvidenceRepository evidences;
    @Autowired SubscriptionLifecycleJob lifecycle;
    @Autowired PlatformSubscriptionQueryService queries;
    @Autowired vn.edu.fpt.beefcare.repository.NotificationRepository notifications;
    @Autowired vn.edu.fpt.beefcare.service.NotificationService notificationService;

    @Test
    void authenticatedMockEventPaysOnceAndSameEventReplaysSuccessfully() {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Subscription subscription = createSubscription(farm, price);
        Payment payment = pendingPayment(owner, price, subscription);
        createPlatformManager();
        actAsPlatformManager();

        var first = service.receiveMock(event(81001L, payment.getQuoteRef(), "1200000"));
        var replay = service.receiveMock(event(81001L, payment.getQuoteRef(), "1200000"));

        assertThat(first.success()).isTrue();
        assertThat(first.duplicate()).isFalse();
        assertThat(first.reviewStatus()).isEqualTo("ACCEPTED");
        assertThat(replay.success()).isTrue();
        assertThat(replay.duplicate()).isTrue();
        assertThat(replay.evidenceId()).isEqualTo(first.evidenceId());
        assertThat(payments.findById(payment.getId()).orElseThrow().getState()).isEqualTo("PAID");
        assertThat(payments.findById(payment.getId()).orElseThrow().getReceiptCode()).startsWith("RC-");
        assertThat(subscriptions.findById(subscription.getId()).orElseThrow().getLatestEnd()).isAfter(clock.instant());
        assertThat(evidences.count()).isEqualTo(1);
    }

    @Test
    void sameProviderTransactionIdWithChangedPayloadIsRejectedWithoutSecondSettlement() {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Subscription subscription = createSubscription(farm, price);
        Payment payment = pendingPayment(owner, price, subscription);
        createPlatformManager();
        actAsPlatformManager();

        service.receiveMock(event(81002L, payment.getQuoteRef(), "1200000"));

        assertThatThrownBy(() -> service.receiveMock(event(81002L, payment.getQuoteRef(), "1200001")))
            .isInstanceOf(ResponseStatusException.class)
            .extracting(error -> ((ResponseStatusException) error).getStatusCode())
            .isEqualTo(HttpStatus.CONFLICT);
        assertThat(payments.findById(payment.getId()).orElseThrow().getState()).isEqualTo("PAID");
        assertThat(evidences.count()).isEqualTo(1);
    }

    @Test
    void expiredQuoteIsMarkedAndNotifiedButAnInWindowBankTransferCanStillSettleIt() {
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Subscription subscription = createSubscription(farm, price);
        Payment payment = pendingPayment(owner, price, subscription);
        payment.setRequestedAt(clock.instant().minusSeconds(7200));
        payment.setExpiresAt(clock.instant().minusSeconds(3600));
        payments.saveAndFlush(payment);
        createPlatformManager();
        actAsPlatformManager();

        lifecycle.expireUnpaidRequests();
        assertThat(payments.findById(payment.getId()).orElseThrow().getState()).isEqualTo("EXPIRED");

        var paid = service.receiveMock(event(payment.getQuoteRef(), 81003L, "1200000", clock.instant().minusSeconds(5400)));
        assertThat(paid.reviewStatus()).isEqualTo("ACCEPTED");
        assertThat(payments.findById(payment.getId()).orElseThrow().getState()).isEqualTo("PAID");
    }

    @Test
    void bankTransferAtTheExpiryBoundaryIsNeverAccepted() {
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Subscription subscription = createSubscription(farm, price);
        Payment payment = pendingPayment(owner, price, subscription);
        payment.setRequestedAt(clock.instant().minusSeconds(3600));
        payment.setExpiresAt(clock.instant());
        payments.saveAndFlush(payment);
        createPlatformManager();
        actAsPlatformManager();

        var evidence = service.receiveMock(event(payment.getQuoteRef(), 81004L, "1200000", payment.getExpiresAt()));
        assertThat(evidence.reviewStatus()).isEqualTo("UNMATCHED");
        assertThat(payments.findById(payment.getId()).orElseThrow().getState()).isEqualTo("PENDING");

        // UC-FE14-04 / JOB-06 step 4: every ACTIVE PM gets one reconciliation notice, bounded to id, amount and reason
        AppUser pm = em.createQuery("select u from AppUser u where u.email = 'pm@beefcare.test'", AppUser.class).getSingleResult();
        var notice = notifications.findByEventKeyAndRecipient_Id("EVIDENCE_REVIEW:" + evidence.evidenceId(), pm.getId()).orElseThrow();
        assertThat(notice.getTargetType()).isEqualTo("BANK_TRANSFER_EVIDENCE");
        assertThat(notice.getTargetId()).isEqualTo(evidence.evidenceId());
        assertThat(notice.getSummary()).contains("81004").doesNotContain(payment.getQuoteRef());
        assertThat(notificationService.mine()).extracting(n -> n.targetId()).contains(evidence.evidenceId());
        // a replayed delivery creates no second notice
        service.receiveMock(event(payment.getQuoteRef(), 81004L, "1200000", payment.getExpiresAt()));
        assertThat(notifications.findAll()).filteredOn(n -> ("EVIDENCE_REVIEW:" + evidence.evidenceId()).equals(n.getEventKey())).hasSize(1);
    }

    @Test
    void acceptedPaymentCreatesNoReconciliationNotice() {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Payment payment = pendingPayment(owner, price, createSubscription(farm, price));
        createPlatformManager();
        actAsPlatformManager();
        var paid = service.receiveMock(event(81005L, payment.getQuoteRef(), "1200000"));
        assertThat(paid.reviewStatus()).isEqualTo("ACCEPTED");
        assertThat(notifications.findAll()).noneMatch(n -> ("EVIDENCE_REVIEW:" + paid.evidenceId()).equals(n.getEventKey()));
    }

    @Test
    void paidPaymentIsAReceiptAndACurrentSubscriptionInThePmViews() {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Payment payment = pendingPayment(owner, price, createSubscription(farm, price));
        createPlatformManager();
        actAsPlatformManager();
        var paid = service.receiveMock(event(81006L, payment.getQuoteRef(), "1200000"));
        assertThat(paid.reviewStatus()).isEqualTo("ACCEPTED");

        // SCR-70 / UC-FE21-01
        var receipts = queries.receipts(null, farm.getId(), null, null, 0, 25);
        assertThat(receipts.receiptsInPeriod()).isEqualTo(1);
        assertThat(receipts.totalAmount()).isEqualByComparingTo("1200000");
        assertThat(receipts.items()).singleElement().satisfies(r -> {
            assertThat(r.paymentId()).isEqualTo(payment.getId());
            assertThat(r.receiptCode()).startsWith("RC-");
            assertThat(r.bankPaidAt()).isNotNull();
        });
        var receipt = queries.receipt(payment.getId());
        assertThat(receipt.confirmationSource()).isEqualTo("SEPAY_AUTOMATIC");
        assertThat(receipt.confirmedAt()).isNotNull();
        assertThat(receipt.maskedTransactionId()).isEqualTo("****1006");
        assertThat(receipt.purchasedEnd()).isAfter(receipt.purchasedStart());
        LocalDate bankDay = receipts.items().get(0).bankPaidAt().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        assertThat(queries.receipts(null, farm.getId(), bankDay.plusDays(1), null, 0, 25).receiptsInPeriod()).isZero();
        assertThat(queries.receipts(payment.getReceiptCode(), null, null, null, 0, 25).items()).extracting(r -> r.paymentId()).containsExactly(payment.getId());

        // SCR-61 / UC-FE19-04
        assertThat(queries.subscriptions(farm.getName(), "CURRENT", null, null, null, 0, 25).items()).extracting(r -> r.farmId()).containsExactly(farm.getId());
        assertThat(queries.subscriptions(farm.getName(), "NONE", null, null, null, 0, 25).items()).isEmpty();
        var detail = queries.subscription(farm.getId());
        assertThat(detail.periods()).singleElement().satisfies(p -> assertThat(p.paymentCode()).isEqualTo(payment.getQuoteRef()));
        assertThat(detail.renewalOpens()).isEqualTo(detail.summary().confirmedUntil().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(90).toInstant());
        assertThat(detail.summary().ownerEmail()).isEqualTo(owner.getEmail());

        // a farm that never paid
        Farm unpaid = farm("PENDING_PAYMENT");
        memberWithRole(unpaid, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        assertThat(queries.subscriptions(unpaid.getName(), "NONE", null, null, null, 0, 25).items()).extracting(r -> r.farmId()).containsExactly(unpaid.getId());
        assertThat(queries.subscription(unpaid.getId()).emptyMessage()).isEqualTo("No subscription yet: no period or end date.");

        // only a PM sees these views
        actAs(owner);
        assertThatThrownBy(() -> queries.receipts(null, null, null, null, 0, 25)).isInstanceOf(vn.edu.fpt.beefcare.service.DomainException.class);
        assertThatThrownBy(() -> queries.subscriptions(null, null, null, null, null, 0, 25)).isInstanceOf(vn.edu.fpt.beefcare.service.DomainException.class);
    }

    @Test
    void evidenceFiltersAndTilesFollowTheReviewStatus() {
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        PlanVersion price = createPrice();
        Payment payment = pendingPayment(owner, price, createSubscription(farm, price));
        createPlatformManager();
        actAsPlatformManager();
        var unmatched = service.receiveMock(event(payment.getQuoteRef(), 81007L, "999", clock.instant()));
        assertThat(unmatched.reviewStatus()).isEqualTo("UNMATCHED");

        assertThat(queries.evidenceView("TO_REVIEW", null, null)).extracting(e -> e.id()).contains(unmatched.evidenceId());
        assertThat(queries.evidenceView("ACCEPTED", null, null)).extracting(e -> e.id()).doesNotContain(unmatched.evidenceId());
        LocalDate today = clock.instant().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
        assertThat(queries.evidenceView("ALL", today.plusDays(1), null)).extracting(e -> e.id()).doesNotContain(unmatched.evidenceId());
        assertThat(queries.paymentTiles().evidenceToReview()).isGreaterThanOrEqualTo(1);
        assertThat(queries.paymentTiles().pendingRequests()).isGreaterThanOrEqualTo(1);
        assertThat(queries.paymentView("PENDING", payment.getQuoteRef(), 0, 25).items()).extracting(p -> p.id()).containsExactly(payment.getId());
        assertThatThrownBy(() -> queries.evidenceView("WHATEVER", null, null)).isInstanceOf(vn.edu.fpt.beefcare.service.DomainException.class);
    }

    private PlanVersion createPrice() {
        PlanVersion price = new PlanVersion();
        price.setPrice1y(new BigDecimal("1200000"));
        price.setPrice2y(new BigDecimal("2000000"));
        price.setPrice3y(new BigDecimal("2700000"));
        price.setEffectiveAt(clock.instant().minusSeconds(60));
        return save(price);
    }

    private Subscription createSubscription(Farm farm, PlanVersion price) {
        Subscription subscription = new Subscription();
        subscription.setFarm(farm);
        subscription.setPlanVersion(price);
        subscription.setEntitlementStatus("PENDING");
        return save(subscription);
    }

    private Payment pendingPayment(AppUser owner, PlanVersion price, Subscription subscription) {
        Payment payment = new Payment();
        payment.setQuoteRef("BC123456789012");
        payment.setDurationYears(1);
        payment.setAmountVnd(new BigDecimal("1200000"));
        payment.setState("PENDING");
        payment.setRequestedAt(clock.instant().minusSeconds(60));
        payment.setExpiresAt(clock.instant().plusSeconds(86340));
        payment.setSubscription(subscription);
        payment.setRequestedBy(owner);
        payment.setPriceVersion(price);
        payment.setReceivingAccountNamespace("LOCAL-MOCK");
        payment.setReceivingEnvironment("MOCK");
        payment.setReceivingAccount("MOCK-ACCOUNT");
        payment.setReceivingBankCode("MOCKBANK");
        payment.setVersion(0L);
        return save(payment);
    }

    private void createPlatformManager() {
        AppUser manager = new AppUser();
        manager.setEmail("pm@beefcare.test");
        manager.setFullName("Platform Manager");
        manager.setAccountStatus("ACTIVE");
        save(manager);
        User identity = new User();
        identity.setLogin(manager.getEmail());
        identity.setEmail(manager.getEmail());
        identity.setPassword("$2a$10$01234567890123456789012345678901234567890123456789012");
        identity.setActivated(true);
        save(identity);
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(manager);
        access.setRole("PM");
        access.setStatus("ACTIVE");
        save(access);
    }

    private void actAsPlatformManager() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("pm@beefcare.test", "n/a", java.util.List.of(new SimpleGrantedAuthority("ROLE_USER")))
        );
    }

    private SePayPayload event(long transactionId, String quoteRef, String amount) {
        return event(quoteRef, transactionId, amount, clock.instant());
    }

    private SePayPayload event(String quoteRef, long transactionId, String amount, Instant paidAt) {
        return new SePayPayload(
            transactionId,
            "Mock bank",
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(paidAt),
            "MOCK-ACCOUNT",
            quoteRef,
            "Payment " + quoteRef,
            "IN",
            new BigDecimal(amount),
            "mock-reference-" + transactionId
        );
    }
}
