package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.SePayPayload;
import vn.edu.fpt.beefcare.service.payment.SubscriptionLifecycleJob;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * GBR-72/GBR-73 "confirmations for one farm are processed one at a time": a PM acceptance, a SePay confirmation or the
 * coverage job that waits for the farm lock must continue from the subscription committed meanwhile, never from a copy
 * read before the lock. Threads need committed data, so this class owns its database (no rollback per test).
 */
@ServiceIntegrationTest
@TestPropertySource(properties = {"beefcare.sepay.environment=MOCK", "beefcare.sepay.account-namespace=UC6C", "beefcare.sepay.account-number=UC6C-ACCOUNT",
    "spring.datasource.url=jdbc:h2:mem:uc6concurrency;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000"})
class SubscriptionConfirmationConcurrencyTest extends DomainTestSupport {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final BigDecimal AMOUNT = new BigDecimal("1200000");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired PlatformTransactionManager tm;
    @Autowired DataSource dataSource;
    @Autowired FarmRepository farms;
    @Autowired SubscriptionRepository subscriptions;
    @Autowired SubscriptionLifecycleJob lifecycle;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @AfterEach
    void stopWorker() {
        worker.shutdownNow();
    }

    private record Fixture(Long farmId, Long subscriptionId, Long paymentId, String quoteRef, String pmEmail) {}

    private <T> T committed(Supplier<T> work) {
        return new TransactionTemplate(tm).execute(status -> work.get());
    }

    /** One farm with an Owner, a subscription in the given state and one PENDING 1-year request around "now". */
    private Fixture fixture(String farmStatus, String entitlement, Instant latestEnd) {
        return committed(() -> {
            AppUser pm = user();
            save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE"));
            PlanVersion plan = save(new PlanVersion().price1y(AMOUNT).price2y(new BigDecimal("2160000"))
                .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(1)));
            Farm farm = farm(farmStatus);
            memberWithRole(farm, FarmRole.OWNER);
            Subscription sub = new Subscription().farm(farm).planVersion(plan).entitlementStatus(entitlement);
            sub.setLatestEnd(latestEnd);
            save(sub);
            Payment p = new Payment();
            p.setSubscription(sub); p.setRequestedBy(user()); p.setPriceVersion(plan);
            p.setQuoteRef(String.format("BCCONC%08d", next())); p.setState("PENDING"); p.setDurationYears(1); p.setAmountVnd(AMOUNT);
            p.setRequestedAt(clock.instant().minusSeconds(3600)); p.setExpiresAt(clock.instant().plusSeconds(3600));
            p.setReceivingAccount("UC6C-ACCOUNT"); p.setReceivingEnvironment("MOCK"); p.setReceivingAccountNamespace("UC6C");
            save(p);
            return new Fixture(farm.getId(), sub.getId(), p.getId(), p.getQuoteRef(), pm.getEmail());
        });
    }

    /** Unmatched incoming evidence with a mistyped code, eligible for the fixture's request when the PM selects it. */
    private BankTransferEvidence mistypedEvidence() {
        return committed(() -> {
            BankTransferEvidence e = new BankTransferEvidence();
            e.setProvider("SEPAY"); e.setEnvironment("MOCK"); e.setAccountNamespace("UC6C");
            e.setProviderTxnId(886000000000L + next()); e.setAmount(AMOUNT); e.setBankPaidAt(clock.instant().minusSeconds(60));
            e.setReviewStatus("UNMATCHED"); e.setReviewReason("No matching payment request"); e.setTransferDirection("IN");
            e.setReceivingAccount("UC6C-ACCOUNT"); e.setQuoteRef("BCTYPO" + next()); e.setTransferContent("Chuyen khoan");
            e.setAuthOutcome("VERIFIED");
            return save(e);
        });
    }

    /**
     * Plays another confirmation of the same farm: holds the farm lock, starts the worker, waits until the worker is
     * blocked on that lock, then commits a new coverage end. The worker result is returned (failures propagate).
     */
    private <T> T whileAnotherConfirmationHoldsTheFarm(Fixture f, Instant newEnd, Callable<T> work) throws Exception {
        AtomicReference<Future<T>> running = new AtomicReference<>();
        new TransactionTemplate(tm).executeWithoutResult(status -> {
            Farm farm = farms.lockById(f.farmId()).orElseThrow();
            running.set(worker.submit(work));
            if (!awaitALockWaiter(running.get())) return; // the worker finished early: its own failure is reported below
            Subscription sub = subscriptions.lockByFarmId(f.farmId()).orElseThrow();
            sub.setLatestEnd(newEnd);
            sub.setEntitlementStatus("ACTIVE");
            subscriptions.saveAndFlush(sub);
            farm.setServiceStatus("ACTIVE");
            farms.saveAndFlush(farm);
        });
        return running.get().get(30, TimeUnit.SECONDS);
    }

    /** True once another session waits for a lock held by the caller; false if the worker ended without waiting. */
    private boolean awaitALockWaiter(Future<?> worker) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        try (var connection = dataSource.getConnection()) {
            String sql = connection.getMetaData().getDatabaseProductName().startsWith("PostgreSQL")
                ? "select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'"
                : "select count(*) from information_schema.sessions where blocker_id is not null";
            while (System.nanoTime() < deadline) {
                try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
                    if (rows.next() && rows.getLong(1) > 0) return true;
                }
                if (worker.isDone()) return false;
                Thread.sleep(20);
            }
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
        throw new AssertionError("The worker never waited for the farm lock");
    }

    private Payment payment(Long id) {
        return committed(() -> {
            Payment p = em.find(Payment.class, id);
            p.getSubscription().getLatestEnd();
            return p;
        });
    }

    private Subscription subscription(Long id) {
        return committed(() -> em.find(Subscription.class, id));
    }

    private String farmStatus(Long id) {
        return committed(() -> em.find(Farm.class, id).getServiceStatus());
    }

    private static Instant plusYear(Instant start) {
        return start.atZone(VN).plusYears(1).toInstant();
    }

    @Test
    void pmAcceptanceWaitingForTheFarmContinuesFromTheCoverageCommittedMeanwhile() throws Exception {
        Fixture f = fixture("ACTIVE", "PENDING", null);
        BankTransferEvidence e = mistypedEvidence();
        Instant renewedUntil = clock.instant().atZone(VN).plusYears(3).toInstant();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("decision", "ACCEPT"); body.put("paymentId", f.paymentId()); body.put("reason", "Mã gõ sai, khớp yêu cầu duy nhất");
        body.put("version", e.getVersion());

        whileAnotherConfirmationHoldsTheFarm(f, renewedUntil, () -> mvc.perform(post("/api/platform/payments/evidence/" + e.getId() + "/review")
                .with(csrf()).with(SecurityMockMvcRequestPostProcessors.user(f.pmEmail())).header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(body)))
            .andExpect(status().isOk()).andReturn());

        Payment paid = payment(f.paymentId());
        assertThat(paid.getState()).isEqualTo("PAID");
        assertThat(paid.getConfirmationSource()).isEqualTo("PM");
        assertThat(paid.getPurchasedStart()).as("GBR-73: start at max(confirmation, latest confirmed end)").isEqualTo(renewedUntil);
        assertThat(paid.getPurchasedEnd()).isEqualTo(plusYear(renewedUntil));
        assertThat(subscription(f.subscriptionId()).getLatestEnd()).isEqualTo(plusYear(renewedUntil));
    }

    @Test
    void sepayConfirmationWaitingForTheFarmContinuesFromTheCoverageCommittedMeanwhile() throws Exception {
        Fixture f = fixture("ACTIVE", "PENDING", null);
        Instant renewedUntil = clock.instant().atZone(VN).plusYears(3).toInstant();
        String bankTime = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN).format(clock.instant().minusSeconds(60));
        SePayPayload transfer = new SePayPayload(887000000000L + next(), "BIDV", bankTime, "UC6C-ACCOUNT", f.quoteRef(),
            "Thanh toan " + f.quoteRef(), "IN", AMOUNT, "REF-CONC");

        whileAnotherConfirmationHoldsTheFarm(f, renewedUntil, () -> mvc.perform(post("/api/dev/sepay/events")
                .with(csrf()).with(SecurityMockMvcRequestPostProcessors.user(f.pmEmail())).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsString(transfer)))
            .andExpect(status().isOk()).andReturn());

        Payment paid = payment(f.paymentId());
        assertThat(paid.getState()).isEqualTo("PAID");
        assertThat(paid.getConfirmationSource()).isEqualTo("SEPAY");
        assertThat(paid.getPurchasedStart()).isEqualTo(renewedUntil);
        assertThat(paid.getPurchasedEnd()).isEqualTo(plusYear(renewedUntil));
        assertThat(subscription(f.subscriptionId()).getLatestEnd()).isEqualTo(plusYear(renewedUntil));
    }

    @Test
    void coverageJobWaitingForTheFarmKeepsARenewalCommittedMeanwhile() throws Exception {
        Fixture f = fixture("ACTIVE", "ACTIVE", clock.instant().minusSeconds(60));
        Instant renewedUntil = plusYear(clock.instant());

        whileAnotherConfirmationHoldsTheFarm(f, renewedUntil, () -> {
            lifecycle.evaluateCoverage();
            return null;
        });

        Subscription after = subscription(f.subscriptionId());
        assertThat(after.getLatestEnd()).as("the job must not write back the coverage it read before the lock").isEqualTo(renewedUntil);
        assertThat(after.getEntitlementStatus()).isEqualTo("ACTIVE");
        assertThat(farmStatus(f.farmId())).isEqualTo("ACTIVE");
    }
}
