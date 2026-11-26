package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.BankEvidenceJob;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.BankEvidenceJobRepository;
import vn.edu.fpt.beefcare.repository.SePayWebhookRejectionRepository;
import vn.edu.fpt.beefcare.service.email.EmailDeliveryJobService;
import vn.edu.fpt.beefcare.service.email.MockEmailDelivery;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC8 HTTP and committed readback: no outer test transaction may hide a lost acknowledgement/job boundary. */
@ServiceIntegrationTest
@TestPropertySource(properties = {
    "beefcare.sepay.environment=MOCK", "beefcare.sepay.account-namespace=UC8", "beefcare.sepay.account-number=UC8-ACCOUNT",
    "beefcare.sepay.webhook-secret=uc8-test-only-signature-secret", "beefcare.sepay.processing-delay-ms=86400000",
    "spring.datasource.url=jdbc:h2:mem:uc8webhook;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "logging.level.org.hibernate.SQL=WARN"
})
class SePayWebhookResourceTest extends DomainTestSupport {
    static final String SECRET = "uc8-test-only-signature-secret";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired PlatformTransactionManager tm;
    @Autowired JdbcTemplate sql;
    @Autowired SePayWebhookService service;
    @Autowired EmailDeliveryJobService deliveryJobs;
    @Autowired MockEmailDelivery inbox;
    @MockitoSpyBean AuditLogRepository auditLogs;
    @MockitoSpyBean BankEvidenceJobRepository processingJobs;
    @MockitoSpyBean SePayWebhookRejectionRepository rejectedDeliveries;

    record Fixture(Long farmId, Long paymentId, String quote, Long ownerId, String email) {}

    <T> T committed(Supplier<T> work) { return new TransactionTemplate(tm).execute(status -> work.get()); }

    Fixture fixture(String state) {
        return committed(() -> {
            Farm farm = farm(state);
            AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            PlanVersion price = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
                .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(86400)));
            Subscription sub = save(new Subscription().farm(farm).planVersion(price).entitlementStatus("PENDING"));
            Payment p = new Payment(); p.setSubscription(sub); p.setRequestedBy(owner); p.setPriceVersion(price);
            p.setQuoteRef(String.format("BCUC8%09d", next())); p.setDurationYears(1); p.setAmountVnd(new BigDecimal("1200000"));
            p.setState("PENDING"); p.setRequestedAt(clock.instant().minusSeconds(3600)); p.setExpiresAt(clock.instant().plusSeconds(82800));
            p.setReceivingAccount("UC8-ACCOUNT"); p.setReceivingAccountNamespace("UC8"); p.setReceivingEnvironment("MOCK");
            save(p); return new Fixture(farm.getId(), p.getId(), p.getQuoteRef(), owner.getId(), owner.getEmail());
        });
    }

    Map<String, Object> payload(Fixture f, long transaction) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", transaction); p.put("gateway", "BIDV"); p.put("transactionDate", clock.instant().minusSeconds(60).toString());
        p.put("accountNumber", "UC8-ACCOUNT"); p.put("code", f.quote()); p.put("content", "Thanh toán " + f.quote());
        p.put("transferType", "in"); p.put("transferAmount", 1200000); p.put("referenceCode", "BANK-" + transaction);
        return p;
    }

    static String signature(String timestamp, byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
    }

    String send(String route, Map<String, Object> payload, long secondsAgo, int expected) throws Exception {
        byte[] body = om.writeValueAsBytes(payload); String timestamp = Long.toString(clock.instant().getEpochSecond() - secondsAgo);
        return mvc.perform(post(route).contentType("application/json").content(body)
                .header("X-SePay-Timestamp", timestamp).header("X-SePay-Signature", signature(timestamp, body)))
            .andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/webhooks/sepay", "/api/v1/payments/sepay/webhook"})
    void acknowledgesBothRoutesOnlyAfterEvidenceAndJobCommitWithoutConfirmingInTheRequest(String route) throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next();
        assertThat(om.readTree(send(route, payload(f, transaction), 0, 200))).isEqualTo(om.readTree("{\"success\":true}"));
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
        var evidence = sql.queryForMap("select id,review_status,delivery_attempts,first_received_at from bank_transfer_evidence where provider_txn_id=?", transaction);
        assertThat(evidence.get("review_status")).isEqualTo("RECEIVED"); assertThat(evidence.get("delivery_attempts")).isEqualTo(1);
        assertThat(evidence.get("first_received_at")).isNotNull();
        assertThat(sql.queryForObject("select count(*) from bank_evidence_job where evidence_id=? and status='PENDING'", Long.class, evidence.get("id"))).isEqualTo(1);
    }

    @Test
    void replayReusesThePendingJobAndPreservesTheFirstReceivedTime() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        send("/api/webhooks/sepay", p, 0, 200);
        Object received = sql.queryForObject("select first_received_at from bank_transfer_evidence where provider_txn_id=?", Object.class, transaction);
        clock.set(clock.instant().plusSeconds(20)); send("/api/webhooks/sepay", p, 0, 200);
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where provider_txn_id=?", Long.class, transaction)).isEqualTo(1);
        assertThat(sql.queryForObject("select delivery_attempts from bank_transfer_evidence where provider_txn_id=?", Integer.class, transaction)).isEqualTo(2);
        assertThat(sql.queryForObject("select first_received_at from bank_transfer_evidence where provider_txn_id=?", Object.class, transaction)).isEqualTo(received);
        assertThat(sql.queryForObject("select count(*) from bank_evidence_job j join bank_transfer_evidence e on e.id=j.evidence_id where e.provider_txn_id=?", Long.class, transaction)).isEqualTo(1);
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
    }

    @Test
    void invalidSignatureOrTimestampStoresOnlyRestrictedRejectionMetadata() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next();
        long before = sql.queryForObject("select count(*) from sepay_webhook_rejection", Long.class);
        send("/api/webhooks/sepay", payload(f, transaction), 301, 401);
        byte[] body = om.writeValueAsBytes(payload(f, transaction));
        mvc.perform(post("/api/v1/payments/sepay/webhook").contentType("application/json").content(body)
            .header("X-SePay-Timestamp", clock.instant().getEpochSecond()).header("X-SePay-Signature", "sha256=" + "0".repeat(64)))
            .andExpect(status().isUnauthorized());
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where provider_txn_id=?", Long.class, transaction)).isZero();
        assertThat(sql.queryForObject("select count(*) from sepay_webhook_rejection", Long.class)).isEqualTo(before + 2);
        var rejected = sql.queryForList("select reason,body_bytes from sepay_webhook_rejection order by id desc limit 2");
        assertThat(rejected).allSatisfy(r -> { assertThat(r.get("reason")).isEqualTo("INVALID_AUTHENTICATION"); assertThat(r.get("body_bytes")).isEqualTo(body.length); });
    }

    @Test
    void authenticatedPayloadRetainsDescriptionAndTransferContentBeyondTheOld255CharacterLimit() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        String content = "Nội dung ".repeat(50) + f.quote(); String description = "Mô tả ngân hàng khác nội dung";
        p.put("content", content); p.put("description", description);
        send("/api/webhooks/sepay", p, 0, 200);
        var stored = sql.queryForMap("select transfer_content,description,provider_code from bank_transfer_evidence where provider_txn_id=?", transaction);
        assertThat(stored.get("transfer_content")).isEqualTo(content); assertThat(stored.get("description")).isEqualTo(description);
        assertThat(stored.get("provider_code")).isEqualTo(f.quote());
    }

    @Test
    void conflictingCodesNeverChooseTheFirstRequestAutomatically() {
        Fixture first = fixture("PENDING_PAYMENT"); Fixture second = fixture("PENDING_PAYMENT");
        committed(() -> { AppUser pm = user(); save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE"));
            actAs(pm); return null; });
        var result = service.receiveMock(new SePayWebhookService.SePayPayload(880000000000L + next(), "BIDV", clock.instant().minusSeconds(60).toString(),
            "UC8-ACCOUNT", first.quote(), "Thanh toán " + second.quote(), "in", new BigDecimal("1200000"), "BANK-CONFLICT"));
        assertThat(result.paymentId()).isNull();
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, first.paymentId())).isEqualTo("PENDING");
        assertThat(sql.queryForObject("select review_reason from bank_transfer_evidence where id=?", String.class, result.evidenceId())).isEqualTo("Conflicting payment references");
    }

    @Test
    void synchronousSimulatorStillConfirmsAndQueuesOneDurableOwnerEmail() {
        Fixture f = fixture("SUSPENDED");
        committed(() -> { AppUser pm = user(); save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE")); actAs(pm); return null; });
        var p = new SePayWebhookService.SePayPayload(880000000000L + next(), "BIDV", clock.instant().minusSeconds(60).toString(),
            "UC8-ACCOUNT", f.quote(), f.quote(), "in", new BigDecimal("1200000"), "BANK-EMAIL");
        var first = service.receiveMock(p); var again = service.receiveMock(p);
        assertThat(first.paymentId()).isEqualTo(f.paymentId()); assertThat(again.duplicate()).isTrue();
        assertThat(sql.queryForObject("select count(*) from email_delivery_job where link_source='PAYMENT_RECEIPT' and link_source_id=?", Long.class, f.paymentId())).isEqualTo(1);
        assertThat(sql.queryForObject("select service_status from farm where id=?", String.class, f.farmId())).isEqualTo("SUSPENDED");
    }

    AppUser manager() {
        return committed(() -> { AppUser pm = user(); save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE")); return pm; });
    }

    long evidence(long transaction) { return sql.queryForObject("select id from bank_transfer_evidence where provider_txn_id=?", Long.class, transaction); }
    Map<String, Object> job(long evidence) { return sql.queryForMap("select * from bank_evidence_job where evidence_id=?", evidence); }
    Instant instant(Object value) { return ((java.sql.Timestamp) value).toInstant(); }
    void update(String statement, Object... values) { committed(() -> sql.update(statement, values)); }
    long version(long evidence) { return sql.queryForObject("select version from bank_transfer_evidence where id=?", Long.class, evidence); }

    ResultActions hold(AppUser pm, long evidence, long version) throws Exception {
        return mvc.perform(post("/api/platform/payments/evidence/" + evidence + "/review").with(csrf()).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(pm.getEmail()))
            .header("Idempotency-Key", UUID.randomUUID().toString()).contentType("application/json")
            .content(om.writeValueAsBytes(Map.of("decision", "HOLD", "reason", "Chờ kiểm tra giao dịch", "version", version))));
    }

    @Test
    void workerCommitsTheWholePaymentRoundTripOnceAndKeepsSuspension() throws Exception {
        Fixture f = fixture("SUSPENDED"); long transaction = 880000000000L + next();
        send("/api/webhooks/sepay", payload(f, transaction), 0, 200); long evidence = evidence(transaction);
        service.processDueEvidence(); service.processDueEvidence();
        var p = sql.queryForMap("select * from payment where id=?", f.paymentId());
        assertThat(p.get("state")).isEqualTo("PAID"); assertThat(p.get("confirmation_source")).isEqualTo("SEPAY");
        assertThat(p.get("confirmed_at")).isNotNull(); assertThat(p.get("purchased_start")).isEqualTo(p.get("confirmed_at"));
        assertThat(instant(p.get("purchased_end"))).isEqualTo(clock.instant().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).plusYears(1).toInstant());
        assertThat(sql.queryForObject("select latest_end from subscription where farm_id=?", Object.class, f.farmId())).isEqualTo(p.get("purchased_end"));
        assertThat(sql.queryForObject("select service_status from farm where id=?", String.class, f.farmId())).isEqualTo("SUSPENDED");
        assertThat(sql.queryForObject("select payment_id from bank_transfer_evidence where id=?", Long.class, evidence)).isEqualTo(f.paymentId());
        assertThat(job(evidence).get("status")).isEqualTo("DONE"); assertThat(job(evidence).get("attempts")).isEqualTo(1);
        assertThat(sql.queryForObject("select count(*) from audit_log where action='SEPAY_PAYMENT_PAID' and target_id=?", Long.class, f.paymentId())).isEqualTo(1);
        assertThat(sql.queryForObject("select count(*) from notification where event_key=? and recipient_id=?", Long.class, "PAYMENT_PAID:" + f.paymentId(), f.ownerId())).isEqualTo(1);
        assertThat(sql.queryForObject("select count(*) from email_delivery_job where event_key=?", Long.class, "PAYMENT_PAID:" + f.paymentId())).isEqualTo(1);
    }

    @Test
    void failedSettlementRollsBackButItsStoredEvidenceRetriesAtTheDocumentedDelaysThenStopsAt24Hours() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); AppUser pm = manager(); long transaction = 880000000000L + next();
        send("/api/webhooks/sepay", payload(f, transaction), 0, 200); long evidence = evidence(transaction); Instant failedAt = clock.instant();
        doThrow(new IllegalStateException("test-only rollback after paid fields were set")).when(auditLogs).save(argThat((AuditLog a) -> "SEPAY_PAYMENT_PAID".equals(a.getAction())));
        try {
            for (long delay : new long[] {60, 300, 900, 3600}) {
                service.processDueEvidence(); var row = job(evidence);
                assertThat(row.get("status")).isEqualTo("PENDING"); assertThat(instant(row.get("available_at"))).isEqualTo(clock.instant().plusSeconds(delay));
                assertThat(instant(row.get("first_failure_at"))).isEqualTo(failedAt);
                assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
                assertThat(sql.queryForObject("select payment_id from bank_transfer_evidence where id=?", Long.class, evidence)).isNull();
                assertThat(sql.queryForObject("select count(*) from email_delivery_job where event_key=?", Long.class, "PAYMENT_PAID:" + f.paymentId())).isZero();
                clock.set(instant(row.get("available_at")));
            }
            clock.set(failedAt.plus(Duration.ofHours(24))); service.processDueEvidence(); service.processDueEvidence();
            assertThat(job(evidence).get("status")).isEqualTo("FAILED");
            assertThat(sql.queryForObject("select review_status from bank_transfer_evidence where id=?", String.class, evidence)).isEqualTo("NEEDS_REVIEW");
            assertThat(sql.queryForObject("select count(*) from notification where event_key=? and recipient_id=?", Long.class, "EVIDENCE_REVIEW:" + evidence, pm.getId())).isEqualTo(1);
        } finally { reset(auditLogs); }
    }

    @Test
    void retrySurvivesAClearedPersistenceContextAndDoesNotPayTwiceAfterAnExpiredLease() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next();
        send("/api/webhooks/sepay", payload(f, transaction), 0, 200); long evidence = evidence(transaction);
        update("update bank_evidence_job set lease_until=?,attempts=1 where evidence_id=?", java.sql.Timestamp.from(clock.instant().plusSeconds(10)), evidence);
        service.processDueEvidence(); assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
        committed(() -> { em.clear(); return null; }); clock.set(clock.instant().plusSeconds(11));
        service.processDueEvidence(); service.processDueEvidence();
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PAID");
        assertThat(job(evidence).get("attempts")).isEqualTo(2);
    }

    @Test
    void pmHoldBeforeProcessingIsNeverOverwrittenByTheWorker() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); AppUser pm = manager(); long transaction = 880000000000L + next();
        send("/api/webhooks/sepay", payload(f, transaction), 0, 200); long evidence = evidence(transaction);
        hold(pm, evidence, version(evidence)).andExpect(status().isOk());
        service.processDueEvidence();
        assertThat(sql.queryForObject("select review_status from bank_transfer_evidence where id=?", String.class, evidence)).isEqualTo("HOLD");
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
        assertThat(job(evidence).get("status")).isEqualTo("DONE");
    }

    @Test
    void concurrentDeliveriesAndWorkersCreateOneEvidenceJobPeriodAndEmailIntent() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); var transfer = payload(f, transaction);
        try (var threads = Executors.newFixedThreadPool(2)) {
            var a = threads.submit(() -> send("/api/webhooks/sepay", transfer, 0, 200));
            var b = threads.submit(() -> send("/api/v1/payments/sepay/webhook", transfer, 0, 200));
            a.get(20, TimeUnit.SECONDS); b.get(20, TimeUnit.SECONDS);
            var first = threads.submit(service::processDueEvidence); var second = threads.submit(service::processDueEvidence);
            first.get(20, TimeUnit.SECONDS); second.get(20, TimeUnit.SECONDS);
        }
        long evidence = evidence(transaction);
        assertThat(sql.queryForObject("select delivery_attempts from bank_transfer_evidence where id=?", Integer.class, evidence)).isEqualTo(2);
        assertThat(job(evidence).get("attempts")).isEqualTo(1);
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where payment_id=?", Long.class, f.paymentId())).isEqualTo(1);
        assertThat(sql.queryForObject("select count(*) from email_delivery_job where event_key=?", Long.class, "PAYMENT_PAID:" + f.paymentId())).isEqualTo(1);
    }

    @Test
    void ownerEmailUsesTheCurrentOwnerAndStoredPaidFieldsWithoutClaimingSuspensionWasLifted() throws Exception {
        Fixture f = fixture("SUSPENDED"); long transaction = 880000000000L + next();
        send("/api/webhooks/sepay", payload(f, transaction), 0, 200); service.processDueEvidence();
        AppUser current = committed(() -> {
            em.createQuery("update FarmMembership m set m.status='INACTIVE' where m.farm.id=:farm").setParameter("farm", f.farmId()).executeUpdate();
            return memberWithRole(em.find(Farm.class, f.farmId()), FarmRole.OWNER);
        });
        deliveryJobs.dispatchDueJobs(); deliveryJobs.dispatchDueJobs();
        assertThat(inbox.findMessagesFor(f.email())).isEmpty();
        var message = inbox.findMessagesFor(current.getEmail()); assertThat(message).hasSize(1);
        assertThat(message.getFirst().subject()).contains("Xác nhận thanh toán");
        assertThat(message.getFirst().plainText()).contains(f.quote(), "1.200.000", "1 năm", "RC-", "đang bị tạm ngưng", "/goi-dich-vu/lich-su?farm=" + f.farmId());
        assertThat(sql.queryForObject("select status from email_delivery_job where event_key=?", String.class, "PAYMENT_PAID:" + f.paymentId())).isEqualTo("SENT");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void emailProviderFailureRetriesIndependentlyOfPaidAndStopsAt24Hours(boolean expired) throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next();
        send("/api/webhooks/sepay", payload(f, transaction), 0, 200); service.processDueEvidence();
        // Dispatch only this test's job: unrelated committed fixtures need not consume the simulated failure.
        update("update email_delivery_job set available_at=? where status='PENDING' and event_key<>?", java.sql.Timestamp.from(Instant.now().plusSeconds(86400)), "PAYMENT_PAID:" + f.paymentId());
        inbox.failNextDeliveries(1); deliveryJobs.dispatchDueJobs();
        assertThat(sql.queryForObject("select status from email_delivery_job where event_key=?", String.class, "PAYMENT_PAID:" + f.paymentId())).isEqualTo("PENDING");
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PAID");
        assertThat(inbox.findMessagesFor(f.email())).isEmpty();
        update("update email_delivery_job set available_at=?,created_at=? where event_key=?", java.sql.Timestamp.from(Instant.now().minusSeconds(1)),
            java.sql.Timestamp.from(Instant.now().minusSeconds(expired ? 86401 : 10)), "PAYMENT_PAID:" + f.paymentId());
        deliveryJobs.dispatchDueJobs();
        assertThat(sql.queryForObject("select status from email_delivery_job where event_key=?", String.class, "PAYMENT_PAID:" + f.paymentId())).isEqualTo(expired ? "FAILED" : "SENT");
        assertThat(inbox.findMessagesFor(f.email())).hasSize(expired ? 0 : 1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"id", "transactionDate", "transferType", "transferAmount"})
    void missingRequiredProviderFieldsCannotCreateEvidenceOrAJob(String field) throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); var p = payload(f, transaction); p.remove(field);
        send("/api/webhooks/sepay", p, 0, 400);
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where provider_txn_id=?", Long.class, transaction)).isZero();
    }

    @Test
    void anExpiredRequestPaidInsideItsOriginalWindowStillConfirmsThroughTheQueue() throws Exception {
        Fixture f = fixture("EXPIRED"); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        update("update payment set state='EXPIRED',requested_at=?,expires_at=? where id=?", java.sql.Timestamp.from(clock.instant().minusSeconds(86400)),
            java.sql.Timestamp.from(clock.instant().minusSeconds(1)), f.paymentId());
        send("/api/webhooks/sepay", p, 0, 200); service.processDueEvidence();
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PAID");
    }

    @Test
    void replayDoesNotInventUnknownHistoricalDeliveryCounts() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        send("/api/webhooks/sepay", p, 0, 200);
        update("update bank_transfer_evidence set delivery_attempts=null,first_received_at=null where provider_txn_id=?", transaction);
        send("/api/webhooks/sepay", p, 0, 200);
        var stored = sql.queryForMap("select delivery_attempts,first_received_at from bank_transfer_evidence where provider_txn_id=?", transaction);
        assertThat(stored.get("delivery_attempts")).isNull(); assertThat(stored.get("first_received_at")).isNull();
    }

    @Test
    void continuousRenewalsKeepTheOriginalFebruary29AnniversaryAcrossNonLeapYears() throws Exception {
        clock.set(Instant.parse("2028-02-29T03:00:00Z")); Fixture first = fixture("PENDING_PAYMENT"); Fixture current = first;
        for (int year = 2028; year <= 2031; year++) {
            if (year > 2028) {
                clock.set(Instant.parse(year + "-02-01T03:00:00Z"));
                current = committed(() -> {
                    Payment original = em.find(Payment.class, first.paymentId()); Payment p = new Payment();
                    p.setSubscription(original.getSubscription()); p.setRequestedBy(original.getRequestedBy()); p.setPriceVersion(original.getPriceVersion());
                    p.setQuoteRef(String.format("BCUC8%09d", next())); p.setDurationYears(1); p.setAmountVnd(new BigDecimal("1200000")); p.setState("PENDING");
                    p.setRequestedAt(clock.instant().minusSeconds(3600)); p.setExpiresAt(clock.instant().plusSeconds(82800));
                    p.setReceivingAccount("UC8-ACCOUNT"); p.setReceivingAccountNamespace("UC8"); p.setReceivingEnvironment("MOCK"); save(p);
                    return new Fixture(first.farmId(), p.getId(), p.getQuoteRef(), first.ownerId(), first.email());
                });
            }
            send("/api/webhooks/sepay", payload(current, 880000000000L + next()), 0, 200); service.processDueEvidence();
        }
        assertThat(sql.queryForObject("select latest_end from subscription where farm_id=?", java.sql.Timestamp.class, first.farmId()).toInstant())
            .isEqualTo(Instant.parse("2032-02-29T03:00:00Z"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"fraction", "string"})
    void providerTransactionIdentityCannotBeSilentlyCoercedToAnotherInteger(String kind) throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); var p = payload(f, 880000000000L + next());
        p.put("id", "fraction".equals(kind) ? new BigDecimal("123.5") : "123");
        send("/api/webhooks/sepay", p, 0, 400);
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where quote_ref=?", Long.class, f.quote())).isZero();
    }

    @Test
    void exhaustedOutgoingProcessingStillDoesNotCreateAReconciliationNotice() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); AppUser pm = manager(); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        p.put("transferType", "out"); send("/api/webhooks/sepay", p, 0, 200); long evidence = evidence(transaction);
        doThrow(new IllegalStateException("test-only evidence processing failure")).when(auditLogs).save(argThat((AuditLog a) -> "SEPAY_EVIDENCE".equals(a.getAction())));
        try { service.processDueEvidence(); } finally { reset(auditLogs); }
        clock.set(clock.instant().plus(Duration.ofHours(24))); service.processDueEvidence();
        assertThat(job(evidence).get("status")).isEqualTo("FAILED");
        assertThat(sql.queryForObject("select count(*) from notification where event_key=? and recipient_id=?", Long.class, "EVIDENCE_REVIEW:" + evidence, pm.getId())).isZero();
    }

    @Test
    void failureToStoreTheJobCannotAcknowledgeOrLeaveAnOrphanEvidence() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); byte[] body = om.writeValueAsBytes(payload(f, transaction));
        String timestamp = Long.toString(clock.instant().getEpochSecond());
        doThrow(new IllegalStateException("test-only job storage failure")).when(processingJobs).saveAndFlush(any(BankEvidenceJob.class));
        try {
            try {
                int response = mvc.perform(post("/api/webhooks/sepay").contentType("application/json").content(body)
                        .header("X-SePay-Timestamp", timestamp).header("X-SePay-Signature", signature(timestamp, body)))
                    .andReturn().getResponse().getStatus();
                assertThat(response).isGreaterThanOrEqualTo(500);
            } catch (jakarta.servlet.ServletException rejected) {
                assertThat(rejected.getRootCause()).isInstanceOf(IllegalStateException.class);
            }
        } finally { reset(processingJobs); }
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where provider_txn_id=?", Long.class, transaction)).isZero();
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
    }

    /** Review UC8 #1: JOB-06 polls on its own thread, so its first step can land between the storage commit and the immediate run. */
    @Test
    void aJob06PollBetweenStorageAndTheImmediateRunCannotTakeTheSimulatorOrLookupResult() {
        Fixture f = fixture("PENDING_PAYMENT");
        committed(() -> { AppUser pm = user(); save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE")); actAs(pm); return null; });
        AtomicInteger takenByJob06 = new AtomicInteger(-1);
        doAnswer(call -> {
            Long jobId = sql.queryForObject("select id from bank_evidence_job where evidence_id=?", Long.class, (Long) call.getArgument(0));
            takenByJob06.set(committed(() -> processingJobs.claim(jobId, clock.instant(), clock.instant().plusSeconds(120))));
            return java.util.Optional.of(committed(() -> em.find(BankEvidenceJob.class, jobId)));
        }).when(processingJobs).findByEvidence_Id(any());
        try {
            var result = service.receiveMock(new SePayWebhookService.SePayPayload(880000000000L + next(), "BIDV", clock.instant().minusSeconds(60).toString(),
                "UC8-ACCOUNT", f.quote(), f.quote(), "in", new BigDecimal("1200000"), "BANK-IMMEDIATE"));
            assertThat(takenByJob06.get()).isZero();
            assertThat(result.paymentId()).isEqualTo(f.paymentId()); assertThat(result.reviewStatus()).isEqualTo("ACCEPTED");
            assertThat(job(result.evidenceId()).get("status")).isEqualTo("DONE"); assertThat(job(result.evidenceId()).get("attempts")).isEqualTo(1);
        } finally { reset(processingJobs); }
    }

    /** Review UC8 #2: counting a redelivery is not a business change, so the version a PM has open on SCR-62 stays valid. */
    @Test
    void aRepeatedDeliveryIsCountedWithoutInvalidatingTheEvidenceVersionAPmHasOpen() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); AppUser pm = manager(); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        send("/api/webhooks/sepay", p, 0, 200); long evidence = evidence(transaction); long opened = version(evidence);
        send("/api/v1/payments/sepay/webhook", p, 0, 200);
        assertThat(sql.queryForObject("select delivery_attempts from bank_transfer_evidence where id=?", Integer.class, evidence)).isEqualTo(2);
        assertThat(version(evidence)).isEqualTo(opened);
        hold(pm, evidence, opened).andExpect(status().isOk());
        assertThat(sql.queryForObject("select review_status from bank_transfer_evidence where id=?", String.class, evidence)).isEqualTo("HOLD");
    }

    /** Review UC8 #3 (R-19-08, E3): the signed body bounds every field, so an authenticated transfer is never refused for length. */
    @Test
    void authenticatedTransfersWithLongProviderFieldsAreStoredInFullForReview() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next(); var p = payload(f, transaction);
        String gateway = "Ngân hàng ".repeat(30), reference = "REF-".repeat(60), account = "9".repeat(120), code = f.quote() + "-" + "X".repeat(400);
        p.put("gateway", gateway); p.put("referenceCode", reference); p.put("accountNumber", account); p.put("code", code);
        send("/api/webhooks/sepay", p, 0, 200); long evidence = evidence(transaction);
        var stored = sql.queryForMap("select gateway,reference_code,receiving_account,provider_code from bank_transfer_evidence where id=?", evidence);
        assertThat(stored.get("gateway")).isEqualTo(gateway); assertThat(stored.get("reference_code")).isEqualTo(reference);
        assertThat(stored.get("receiving_account")).isEqualTo(account); assertThat(stored.get("provider_code")).isEqualTo(code);
        service.processDueEvidence();
        assertThat(sql.queryForMap("select review_status,review_reason from bank_transfer_evidence where id=?", evidence))
            .containsEntry("review_status", "UNMATCHED").containsEntry("review_reason", "Receiving account does not match the configured account");
        assertThat(sql.queryForObject("select state from payment where id=?", String.class, f.paymentId())).isEqualTo("PENDING");
    }

    /** Review UC8 #4: E1 keeps metadata when it can, but a storage failure must not turn an unauthenticated call into 500. */
    @Test
    void aRejectedCallStaysUnauthorizedWhenItsMetadataCannotBeStored() throws Exception {
        Fixture f = fixture("PENDING_PAYMENT"); long transaction = 880000000000L + next();
        doThrow(new IllegalStateException("test-only metadata storage failure")).when(rejectedDeliveries).save(any());
        try { send("/api/webhooks/sepay", payload(f, transaction), 301, 401); } finally { reset(rejectedDeliveries); }
        assertThat(sql.queryForObject("select count(*) from bank_transfer_evidence where provider_txn_id=?", Long.class, transaction)).isZero();
    }
}
