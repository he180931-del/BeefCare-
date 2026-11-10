package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.support.DomainTestSupport;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/** No surrounding test transaction: every HTTP call commits/rolls back independently. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles("testh2")
@Import(TestClockConfiguration.class)
class PlanPriceTransactionPostgresIT extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired TransactionTemplate tx;
    @MockitoSpyBean AuditLogRepository audits;
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) { PlanPricePostgresSupport.configure(p, "uc7_transactions_"); }
    AppUser pm() { return tx.execute(s -> { AppUser p = user(); save(new PlatformStaffAccess().user(p).role("PM").status("ACTIVE")); return p; }); }
    Map<String, Object> publication(Instant at) { return Map.of("price1y", 1300000, "price2y", 2300000, "price3y", 3300000, "applyNow", false, "effectiveAt", at.toString()); }
    MvcResult send(AppUser actor, String suffix, Object body, String key) throws Exception {
        return mvc.perform(post(PlatformPlanPriceResourceTest.BASE + suffix).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content(om.writeValueAsBytes(body))).andReturn();
    }
    java.util.List<MvcResult> race(Callable<MvcResult> first, Callable<MvcResult> second) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> { start.await(10, TimeUnit.SECONDS); return first.call(); });
            var b = executor.submit(() -> { start.await(10, TimeUnit.SECONDS); return second.call(); }); start.countDown();
            return java.util.List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS));
        }
    }
    long plansFor(AppUser p) { return em.createQuery("select count(p) from PlanVersion p where p.publishedBy.id=:id", Long.class).setParameter("id", p.getId()).getSingleResult(); }
    long auditsFor(AppUser p, String action) { return em.createQuery("select count(a) from AuditLog a where a.actor.id=:id and a.action=:action", Long.class).setParameter("id", p.getId()).setParameter("action", action).getSingleResult(); }
    void conflictAndSuccess(java.util.List<MvcResult> responses, String code) throws Exception {
        assertThat(responses.stream().map(r -> r.getResponse().getStatus())).containsExactlyInAnyOrder(200, 409);
        for (var r : responses) if (r.getResponse().getStatus() == 409) assertThat(om.readTree(r.getResponse().getContentAsString()).path("code").asText()).isEqualTo(code);
    }
    @Test
    void competingPublicationsAtTheSameTimeCommitOneVersionAndOneAudit() throws Exception {
        AppUser actor = pm(); var body = publication(clock.instant().plusSeconds(1000L + next()));
        conflictAndSuccess(race(() -> send(actor, "", body, UUID.randomUUID().toString()), () -> send(actor, "", body, UUID.randomUUID().toString())), "MSG-FE19-15");
        tx.executeWithoutResult(s -> { assertThat(plansFor(actor)).isEqualTo(1); assertThat(auditsFor(actor, "PLAN_PRICE_PUBLISH")).isEqualTo(1); });
    }
    @Test
    void competingSameKeyPublicationsReplayOneCommittedResult() throws Exception {
        AppUser actor = pm(); var body = publication(clock.instant().plusSeconds(2000L + next())); String key = UUID.randomUUID().toString();
        var responses = race(() -> send(actor, "", body, key), () -> send(actor, "", body, key));
        assertThat(responses.stream().map(r -> r.getResponse().getStatus())).containsOnly(200);
        assertThat(om.readTree(responses.get(0).getResponse().getContentAsString())).isEqualTo(om.readTree(responses.get(1).getResponse().getContentAsString()));
        tx.executeWithoutResult(s -> { assertThat(plansFor(actor)).isEqualTo(1); assertThat(auditsFor(actor, "PLAN_PRICE_PUBLISH")).isEqualTo(1); });
    }
    @Test
    void competingWithdrawalsCommitOneTransitionAndOneAudit() throws Exception {
        AppUser actor = pm(); var seed = send(actor, "", publication(clock.instant().plusSeconds(3000L + next())), UUID.randomUUID().toString());
        assertThat(seed.getResponse().getStatus()).isEqualTo(200); JsonNode p = om.readTree(seed.getResponse().getContentAsString());
        String suffix = "/" + p.path("id").asLong() + "/withdraw"; var body = Map.of("reason", "Wrong scheduled prices", "expectedVersion", p.path("revision").asLong());
        conflictAndSuccess(race(() -> send(actor, suffix, body, UUID.randomUUID().toString()), () -> send(actor, suffix, body, UUID.randomUUID().toString())), "MSG-COM-05");
        tx.executeWithoutResult(s -> { assertThat(auditsFor(actor, "PLAN_PRICE_WITHDRAW")).isEqualTo(1); assertThat(em.createNativeQuery("select revision from plan_version where id=:id").setParameter("id", p.path("id").asLong()).getSingleResult().toString()).isEqualTo("1"); });
    }
    @Test
    void failedPublicationAuditRollsBackThePriceAndIntentKey() throws Exception {
        AppUser actor = pm(); String key = UUID.randomUUID().toString();
        doThrow(new IllegalStateException("Injected audit failure")).when(audits).saveAndFlush(argThat(a -> a != null && "PLAN_PRICE_PUBLISH".equals(a.getAction())));
        assertThat(send(actor, "", publication(clock.instant().plusSeconds(4000L + next())), key).getResponse().getStatus()).isEqualTo(500);
        tx.executeWithoutResult(s -> { assertThat(plansFor(actor)).isZero(); assertThat(em.createQuery("select count(r) from IdempotencyRecord r where r.idempotencyKey=:key", Long.class).setParameter("key", key).getSingleResult()).isZero(); });
    }
    @Test
    void failedWithdrawalAuditRollsBackMetadataRevisionAndIntentKey() throws Exception {
        AppUser actor = pm(); var seed = send(actor, "", publication(clock.instant().plusSeconds(5000L + next())), UUID.randomUUID().toString());
        assertThat(seed.getResponse().getStatus()).isEqualTo(200); JsonNode p = om.readTree(seed.getResponse().getContentAsString()); String key = UUID.randomUUID().toString();
        doThrow(new IllegalStateException("Injected audit failure")).when(audits).saveAndFlush(argThat(a -> a != null && "PLAN_PRICE_WITHDRAW".equals(a.getAction())));
        var body = Map.of("reason", "Wrong scheduled prices", "expectedVersion", p.path("revision").asLong());
        assertThat(send(actor, "/" + p.path("id").asLong() + "/withdraw", body, key).getResponse().getStatus()).isEqualTo(500);
        tx.executeWithoutResult(s -> {
            Object[] stored = (Object[]) em.createNativeQuery("select withdrawn_at,withdrawn_by_id,withdraw_reason,revision from plan_version where id=:id").setParameter("id", p.path("id").asLong()).getSingleResult();
            assertThat(stored[0]).isNull(); assertThat(stored[1]).isNull(); assertThat(stored[2]).isNull(); assertThat(stored[3].toString()).isEqualTo("0");
            assertThat(em.createQuery("select count(r) from IdempotencyRecord r where r.idempotencyKey=:key", Long.class).setParameter("key", key).getSingleResult()).isZero();
        });
    }
}
