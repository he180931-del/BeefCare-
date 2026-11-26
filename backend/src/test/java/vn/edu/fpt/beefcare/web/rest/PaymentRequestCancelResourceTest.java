package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** D38 (FE-19 Q11) A18: the Owner cancels a payment request; TC-19-97 → TC-19-105. Real security, HTTP and DB readback. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:payment-cancel;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "beefcare.sepay.bank-code=TESTBANK", "beefcare.sepay.account-number=TEST-ACCOUNT",
    "beefcare.sepay.account-name=TEST RECIPIENT", "beefcare.sepay.environment=TEST",
    "beefcare.sepay.account-namespace=D38-TEST", "beefcare.sepay.webhook-secret=d38-fixture-signing-secret",
    "beefcare.sepay.processing-delay-ms=86400000"
})
class PaymentRequestCancelResourceTest extends DomainTestSupport {
    private static final BigDecimal AMOUNT = new BigDecimal("1200000");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private PlanVersion price() {
        return save(new PlanVersion().price1y(AMOUNT).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant()));
    }

    /** Creates a PENDING request through A2, then lets 30 seconds pass. */
    private JsonNode request(AppUser owner, Farm farm, PlanVersion price, String key) throws Exception {
        String body = mvc.perform(post("/api/farms/{farm}/subscription/payments", farm.getId())
                .with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
                .header("Idempotency-Key", key).contentType("application/json")
                .content(mapper.writeValueAsBytes(Map.of("durationYears", 1, "reviewedPriceVersion", price.getId()))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        clock.set(clock.instant().plusSeconds(30));
        return mapper.readTree(body);
    }

    private ResultActions cancel(AppUser actor, Farm farm, long paymentId, String key, Object body) throws Exception {
        var call = post("/api/farms/{farm}/subscription/payments/{id}/cancel", farm.getId(), paymentId)
            .with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())).with(csrf());
        if (key != null) call = call.header("Idempotency-Key", key);
        if (body != null) call = call.contentType("application/json").content(mapper.writeValueAsBytes(body));
        return mvc.perform(call);
    }

    private JsonNode detail(AppUser owner, Farm farm, long paymentId) throws Exception {
        em.flush();
        em.clear();
        return mapper.readTree(mvc.perform(get("/api/farms/{farm}/subscription/payments/{id}", farm.getId(), paymentId)
            .with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private Payment stored(long paymentId) {
        em.flush();
        em.clear();
        return em.find(Payment.class, paymentId);
    }

    private List<AuditLog> cancelAudits(long paymentId) {
        em.flush();
        return em.createQuery("select a from AuditLog a where a.action = 'PAYMENT_REQUEST_CANCELLED' and a.targetId = :id", AuditLog.class)
            .setParameter("id", paymentId).getResultList();
    }

    private AppUser pm() {
        AppUser pm = user();
        save(new PlatformStaffAccess().user(pm).role("PM").status("ACTIVE"));
        return pm;
    }

    /** The PM simulator plays SePay: same settlement path as a verified webhook. */
    private JsonNode transfer(AppUser pm, String quoteRef, BigDecimal amount, Instant bankTime) throws Exception {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("id", 900_000_000L + next());
        event.put("gateway", "TESTBANK");
        event.put("transactionDate", bankTime.toString());
        event.put("accountNumber", "TEST-ACCOUNT");
        event.put("code", quoteRef);
        event.put("content", quoteRef + " thanh toan");
        event.put("transferType", "IN");
        event.put("transferAmount", amount);
        event.put("referenceCode", "D38-" + next());
        return mapper.readTree(mvc.perform(post("/api/dev/sepay/events").with(SecurityMockMvcRequestPostProcessors.user(pm.getEmail())).with(csrf())
                .contentType("application/json").content(mapper.writeValueAsBytes(event)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void tc97OwnerCancelsWithATrimmedReasonOnceAndTheReadbackAndAuditAgree() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long id = request(owner, farm, price(), "d38-97").path("id").asLong();
        Instant cancelledAt = clock.instant();

        cancel(owner, farm, id, "cancel-97", Map.of("reason", "  Chọn nhầm kỳ hạn  ")).andExpect(status().isOk())
            .andExpect(jsonPath("$.state").value("CANCELLED"))
            .andExpect(jsonPath("$.cancelReason").value("Chọn nhầm kỳ hạn"))
            .andExpect(jsonPath("$.cancelledAt").value(cancelledAt.toString()));

        JsonNode read = detail(owner, farm, id);
        assertThat(read.path("state").asText()).isEqualTo("CANCELLED");
        assertThat(read.path("cancelReason").asText()).isEqualTo("Chọn nhầm kỳ hạn");
        assertThat(Instant.parse(read.path("cancelledAt").asText())).isEqualTo(cancelledAt);
        Payment payment = stored(id);
        assertThat(payment.getCancelledBy().getId()).isEqualTo(owner.getId());
        assertThat(payment.bankWindowEnd()).isEqualTo(cancelledAt);
        assertThat(cancelAudits(id)).singleElement().satisfies(audit -> {
            assertThat(audit.getActor().getId()).isEqualTo(owner.getId());
            assertThat(audit.getLoggedAt()).isEqualTo(cancelledAt);
            assertThat(audit.getDetails()).contains("\"stateAfter\":\"CANCELLED\"").doesNotContain("Chọn nhầm");
        });
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("PENDING_PAYMENT");
    }

    @Test
    void tc97NoBodyOrABlankReasonStoresNoReason() throws Exception {
        PlanVersion price = price();
        Farm first = farm("PENDING_PAYMENT");
        AppUser firstOwner = memberWithRole(first, FarmRole.OWNER);
        long noBody = request(firstOwner, first, price, "d38-97-a").path("id").asLong();
        Farm second = farm("PENDING_PAYMENT");
        AppUser secondOwner = memberWithRole(second, FarmRole.OWNER);
        long blank = request(secondOwner, second, price, "d38-97-b").path("id").asLong();

        cancel(firstOwner, first, noBody, "cancel-97-a", null).andExpect(status().isOk()).andExpect(jsonPath("$.cancelReason").isEmpty());
        cancel(secondOwner, second, blank, "cancel-97-b", Map.of("reason", "   ")).andExpect(status().isOk()).andExpect(jsonPath("$.cancelReason").isEmpty());

        assertThat(stored(noBody).getCancelReason()).isNull();
        assertThat(stored(blank).getCancelReason()).isNull();
    }

    @Test
    void tc98OnlyTheOwnerOfTheRequestsFarmCanCancelAndARefusalWritesNothing() throws Exception {
        PlanVersion price = price();
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        Farm otherFarm = farm("PENDING_PAYMENT");
        AppUser otherOwner = memberWithRole(otherFarm, FarmRole.OWNER);
        long id = request(owner, farm, price, "d38-98").path("id").asLong();

        cancel(manager, farm, id, "cancel-98-m", null).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        cancel(otherOwner, farm, id, "cancel-98-o", null).andExpect(status().isForbidden());
        cancel(otherOwner, otherFarm, id, "cancel-98-p", null).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));

        assertThat(stored(id).getState()).isEqualTo("PENDING");
        assertThat(stored(id).getCancelledAt()).isNull();
        assertThat(cancelAudits(id)).isEmpty();
    }

    @Test
    void tc99OnlyAnUnexpiredPendingRequestCanBeCancelled() throws Exception {
        PlanVersion price = price();
        AppUser pm = pm();
        // PAID: the exact transfer arrived first.
        Farm paidFarm = farm("PENDING_PAYMENT");
        AppUser paidOwner = memberWithRole(paidFarm, FarmRole.OWNER);
        JsonNode paid = request(paidOwner, paidFarm, price, "d38-99-paid");
        transfer(pm, paid.path("quoteRef").asText(), AMOUNT, clock.instant().minusSeconds(10));
        cancel(paidOwner, paidFarm, paid.path("id").asLong(), "cancel-99-paid", null)
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        assertThat(stored(paid.path("id").asLong()).getState()).isEqualTo("PAID");

        // Already CANCELLED: a second cancel with another key.
        Farm cancelledFarm = farm("PENDING_PAYMENT");
        AppUser cancelledOwner = memberWithRole(cancelledFarm, FarmRole.OWNER);
        long cancelled = request(cancelledOwner, cancelledFarm, price, "d38-99-cancelled").path("id").asLong();
        cancel(cancelledOwner, cancelledFarm, cancelled, "cancel-99-first", null).andExpect(status().isOk());
        Instant firstCancel = stored(cancelled).getCancelledAt();
        clock.set(clock.instant().plusSeconds(5));
        cancel(cancelledOwner, cancelledFarm, cancelled, "cancel-99-second", Map.of("reason", "lần hai"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        assertThat(stored(cancelled).getCancelledAt()).isEqualTo(firstCancel);
        assertThat(stored(cancelled).getCancelReason()).isNull();

        // Expired by time although JOB-03 has not run yet, then really EXPIRED.
        Farm expiredFarm = farm("PENDING_PAYMENT");
        AppUser expiredOwner = memberWithRole(expiredFarm, FarmRole.OWNER);
        long expired = request(expiredOwner, expiredFarm, price, "d38-99-expired").path("id").asLong();
        clock.set(stored(expired).getExpiresAt());
        cancel(expiredOwner, expiredFarm, expired, "cancel-99-expired", null)
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        assertThat(stored(expired).getState()).isEqualTo("PENDING");
        assertThat(cancelAudits(expired)).isEmpty();
    }

    @Test
    void tc100AReceivedTransferEvenWithAWrongAmountBlocksCancellation() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode created = request(owner, farm, price(), "d38-100");
        long id = created.path("id").asLong();
        transfer(pm(), created.path("quoteRef").asText(), new BigDecimal("1000"), clock.instant().minusSeconds(5));
        JsonNode received = detail(owner, farm, id);
        assertThat(received.path("receivedAt").isNull()).isFalse();

        cancel(owner, farm, id, "cancel-100", null).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE19-19"))
            .andExpect(jsonPath("$.params.code").value(created.path("quoteRef").asText()))
            .andExpect(jsonPath("$.params.receivedAt").value(received.path("receivedAt").asText()));

        assertThat(stored(id).getState()).isEqualTo("PENDING");
        assertThat(cancelAudits(id)).isEmpty();
    }

    @Test
    void tc101ReasonLengthAndMissingKeyAreRejectedWithoutWriting() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long id = request(owner, farm, price(), "d38-101").path("id").asLong();

        cancel(owner, farm, id, "cancel-101-long", Map.of("reason", " " + "x".repeat(1001) + " "))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.field").value("reason"));
        cancel(owner, farm, id, null, null).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        assertThat(stored(id).getState()).isEqualTo("PENDING");

        // Exactly 1,000 characters after trim is accepted.
        cancel(owner, farm, id, "cancel-101-max", Map.of("reason", "  " + "y".repeat(1000) + "  ")).andExpect(status().isOk());
        assertThat(stored(id).getCancelReason()).hasSize(1000);
    }

    @Test
    void tc102TheSameKeyReplaysTheFirstResultAndWritesOnce() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        long id = request(owner, farm, price(), "d38-102").path("id").asLong();
        Map<String, String> body = Map.of("reason", "Đổi ý");

        String first = cancel(owner, farm, id, "cancel-102", body).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        clock.set(clock.instant().plusSeconds(5));
        String replay = cancel(owner, farm, id, "cancel-102", body).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertThat(mapper.readTree(replay)).isEqualTo(mapper.readTree(first));
        assertThat(cancelAudits(id)).hasSize(1);
        cancel(owner, farm, id, "cancel-102", Map.of("reason", "khác")).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-19"));
    }

    @Test
    void tc103AfterCancellingTheOwnerCanCreateANewRequest() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        PlanVersion price = price();
        long old = request(owner, farm, price, "d38-103-old").path("id").asLong();
        cancel(owner, farm, old, "cancel-103", null).andExpect(status().isOk());

        JsonNode fresh = request(owner, farm, price, "d38-103-new");

        assertThat(fresh.path("id").asLong()).isNotEqualTo(old);
        assertThat(fresh.path("reopened").asBoolean()).isFalse();
        assertThat(fresh.path("state").asText()).isEqualTo("PENDING");
        assertThat(stored(old).getState()).isEqualTo("CANCELLED");
    }

    @Test
    void tc104MoneyBankedBeforeTheCancellationStillPaysTheRequestAndKeepsTheCancellationTime() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode created = request(owner, farm, price(), "d38-104");
        long id = created.path("id").asLong();
        Instant bankedBefore = Instant.parse(created.path("requestedAt").asText()).plusSeconds(10);
        cancel(owner, farm, id, "cancel-104", null).andExpect(status().isOk());
        Instant cancelledAt = stored(id).getCancelledAt();
        clock.set(clock.instant().plusSeconds(60));

        JsonNode result = transfer(pm(), created.path("quoteRef").asText(), AMOUNT, bankedBefore);

        assertThat(result.path("paymentId").asLong()).isEqualTo(id);
        assertThat(result.path("reviewStatus").asText()).isEqualTo("ACCEPTED");
        JsonNode read = detail(owner, farm, id);
        assertThat(read.path("state").asText()).isEqualTo("PAID");
        assertThat(read.path("purchasedStart").isNull()).isFalse();
        assertThat(Instant.parse(read.path("cancelledAt").asText())).isEqualTo(cancelledAt);
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void tc105MoneyBankedAtOrAfterTheCancellationWaitsForThePmAndCannotBeAccepted() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        AppUser pm = pm();
        JsonNode created = request(owner, farm, price(), "d38-105");
        long id = created.path("id").asLong();
        cancel(owner, farm, id, "cancel-105", null).andExpect(status().isOk());
        Instant cancelledAt = stored(id).getCancelledAt();
        clock.set(clock.instant().plusSeconds(60));

        JsonNode result = transfer(pm, created.path("quoteRef").asText(), AMOUNT, cancelledAt);

        assertThat(result.path("paymentId").isNull()).isTrue();
        assertThat(stored(id).getState()).isEqualTo("CANCELLED");
        long evidenceId = result.path("evidenceId").asLong();
        JsonNode evidence = mapper.readTree(mvc.perform(get("/api/platform/payments/evidence/{id}", evidenceId)
            .with(SecurityMockMvcRequestPostProcessors.user(pm.getEmail()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(evidence.path("summary").path("matchResult").asText()).isEqualTo("REQUEST_CANCELLED");
        assertThat(evidence.path("summary").path("reviewStatus").asText()).isEqualTo("TO_REVIEW");
        mvc.perform(get("/api/platform/payments/evidence/{id}/candidates", evidenceId).with(SecurityMockMvcRequestPostProcessors.user(pm.getEmail())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        Map<String, Object> accept = new LinkedHashMap<>();
        accept.put("decision", "ACCEPT");
        accept.put("paymentId", id);
        accept.put("reason", "Khách chuyển sau khi hủy");
        accept.put("version", evidence.path("summary").path("version").asLong());
        mvc.perform(post("/api/platform/payments/evidence/{id}/review", evidenceId).with(SecurityMockMvcRequestPostProcessors.user(pm.getEmail()))
                .with(csrf()).header("Idempotency-Key", "accept-105").contentType("application/json").content(mapper.writeValueAsBytes(accept)))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE19-11"))
            .andExpect(jsonPath("$.params.reason").value("OUTSIDE_WINDOW"));
        assertThat(stored(id).getState()).isEqualTo("CANCELLED");
        assertThat(em.createQuery("select count(e) from BankTransferEvidence e where e.payment.id = :id", Long.class)
            .setParameter("id", id).getSingleResult()).isZero();
    }
}
