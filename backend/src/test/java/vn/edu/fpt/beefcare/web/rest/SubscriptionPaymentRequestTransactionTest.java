package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** No test transaction: each HTTP command commits/rolls back independently, as in production. */
@ServiceIntegrationTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:uc02-transactions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "beefcare.sepay.bank-code=TESTBANK", "beefcare.sepay.account-number=TEST-ACCOUNT", "beefcare.sepay.account-name=TEST RECIPIENT"
})
class SubscriptionPaymentRequestTransactionTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired TransactionTemplate tx;
    @MockitoSpyBean AuditLogRepository audits;
    record Setup(Farm farm, AppUser owner, PlanVersion price) {}

    private Setup setup() {
        return tx.execute(status -> {
            Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            PlanVersion price = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
                .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant()));
            return new Setup(farm, owner, price);
        });
    }

    private org.springframework.test.web.servlet.MvcResult sendRequest(Setup s, String key) throws Exception {
        return mvc.perform(post("/api/farms/{id}/subscription/payments", s.farm().getId())
            .with(SecurityMockMvcRequestPostProcessors.user(s.owner().getEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json")
            .content("{\"durationYears\":1,\"reviewedPriceVersion\":" + s.price().getId() + "}")).andReturn();
    }

    @Test
    void anAuditFailureRollsBackTheSubscriptionPaymentAndCommandKey() throws Exception {
        Setup s = setup(); String key = UUID.randomUUID().toString();
        doThrow(new IllegalStateException("Injected audit failure"))
            .when(audits).save(argThat(a -> a != null && "PAYMENT_REQUEST".equals(a.getAction())));
        var failed = sendRequest(s, key).getResponse();
        assertThat(failed.getStatus()).isEqualTo(500);
        assertThat(mapper.readTree(failed.getContentAsString()).path("code").asText()).isEqualTo("MSG-COM-02");
        tx.executeWithoutResult(status -> {
            assertThat(em.createQuery("select count(s) from Subscription s where s.farm.id=:f", Long.class).setParameter("f", s.farm().getId()).getSingleResult()).isZero();
            assertThat(em.createQuery("select count(p) from Payment p where p.subscription.farm.id=:f", Long.class).setParameter("f", s.farm().getId()).getSingleResult()).isZero();
            assertThat(em.createQuery("select count(r) from IdempotencyRecord r where r.idempotencyKey=:k", Long.class).setParameter("k", key).getSingleResult()).isZero();
            assertThat(em.createQuery("select count(a) from AuditLog a where a.farm.id=:f", Long.class).setParameter("f", s.farm().getId()).getSingleResult()).isZero();
        });
    }

    @Test
    void twoConcurrentHttpCommandsCommitExactlyOnePendingRequest() throws Exception {
        Setup s = setup(); CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(10, TimeUnit.SECONDS); return sendRequest(s, UUID.randomUUID().toString()); });
            var second = executor.submit(() -> { start.await(10, TimeUnit.SECONDS); return sendRequest(s, UUID.randomUUID().toString()); });
            start.countDown();
            var a = first.get(25, TimeUnit.SECONDS); var b = second.get(25, TimeUnit.SECONDS);
            assertThat(a.getResponse().getStatus()).isEqualTo(200); assertThat(b.getResponse().getStatus()).isEqualTo(200);
            JsonNode one = mapper.readTree(a.getResponse().getContentAsString());
            JsonNode two = mapper.readTree(b.getResponse().getContentAsString());
            assertThat(one.path("id")).isEqualTo(two.path("id"));
            assertThat(List.of(one.path("reopened").asBoolean(), two.path("reopened").asBoolean())).containsExactlyInAnyOrder(true, false);
        }
        tx.executeWithoutResult(status -> {
            assertThat(em.createQuery("select count(s) from Subscription s where s.farm.id=:f", Long.class).setParameter("f", s.farm().getId()).getSingleResult()).isEqualTo(1);
            assertThat(em.createQuery("select count(p) from Payment p where p.subscription.farm.id=:f", Long.class).setParameter("f", s.farm().getId()).getSingleResult()).isEqualTo(1);
        });
    }
}
