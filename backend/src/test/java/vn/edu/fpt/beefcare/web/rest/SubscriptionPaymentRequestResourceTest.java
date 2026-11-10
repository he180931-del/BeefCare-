package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC-FE19-02: real security, HTTP, persisted readback and authenticated bank events. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:uc02-request;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "beefcare.sepay.bank-code=TESTBANK", "beefcare.sepay.account-number=TEST-ACCOUNT",
    "beefcare.sepay.account-name=TEST RECIPIENT", "beefcare.sepay.environment=TEST",
    "beefcare.sepay.account-namespace=UC02-TEST", "beefcare.sepay.webhook-secret=uc02-fixture-signing-secret"
})
class SubscriptionPaymentRequestResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    protected PlanVersion price() {
        return save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant()));
    }

    protected ResultActions request(AppUser owner, Farm farm, int years, long version, String key) throws Exception {
        return mvc.perform(post("/api/farms/{farm}/subscription/payments", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json")
            .content(mapper.writeValueAsBytes(Map.of("durationYears", years, "reviewedPriceVersion", version))));
    }

    protected JsonNode created(AppUser owner, Farm farm, int years, PlanVersion price, String key) throws Exception {
        return mapper.readTree(request(owner, farm, years, price.getId(), key).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
    }

    protected JsonNode detail(AppUser owner, Farm farm, long id) throws Exception {
        em.flush(); em.clear();
        return mapper.readTree(mvc.perform(get("/api/farms/{farm}/subscription/payments/{id}", farm.getId(), id)
            .with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail()))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    protected long count(String entity, Farm farm) {
        String path = entity.equals("Subscription") ? "e.farm.id" : "e.subscription.farm.id";
        return em.createQuery("select count(e) from " + entity + " e where " + path + "=:f", Long.class)
            .setParameter("f", farm.getId()).getSingleResult();
    }

    @Test
    void createsAllThreeTermsWithImmutableSnapshotsAndDatabaseReadback() throws Exception {
        PlanVersion price = price();
        for (int years : List.of(1, 2, 3)) {
            Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            JsonNode result = created(owner, farm, years, price, "create-" + farm.getId());
            JsonNode read = detail(owner, farm, result.path("id").asLong());
            assertThat(read.path("durationYears").asInt()).isEqualTo(years);
            assertThat(read.path("amountVnd").decimalValue()).isEqualByComparingTo(
                years == 1 ? "1200000" : years == 2 ? "2160000" : "3060000");
            assertThat(read.path("bankCode").asText()).isEqualTo("TESTBANK");
            assertThat(read.path("accountNumber").asText()).isEqualTo("TEST-ACCOUNT");
            assertThat(read.path("accountName").asText()).isEqualTo("TEST RECIPIENT");
            assertThat(read.path("qrImageUrl").asText()).contains("https://qr.sepay.vn/img?", "des=" + read.path("quoteRef").asText());
            assertThat(result.path("reopened").asBoolean()).isFalse();
            for (String field : List.of("bankPaidAt", "receivedAt", "confirmedAt", "confirmationSource", "purchasedStart", "purchasedEnd")) {
                assertThat(read.has(field)).as(field).isTrue();
                assertThat(read.get(field).isNull()).as(field).isTrue();
            }
            Payment stored = em.find(Payment.class, result.path("id").asLong());
            assertThat(stored.getPriceVersion().getId()).isEqualTo(price.getId());
            assertThat(stored.getRequestedBy().getId()).isEqualTo(owner.getId());
            assertThat(stored.getAmountVnd()).isEqualByComparingTo(read.path("amountVnd").decimalValue());
            assertThat(stored.getReceivingAccountNamespace()).isEqualTo("UC02-TEST");
            assertThat(Duration.between(stored.getRequestedAt(), stored.getExpiresAt())).isEqualTo(Duration.ofHours(24));
            assertThat(stored.getState()).isEqualTo("PENDING");
            assertThat(count("Subscription", farm)).isEqualTo(1);
            assertThat(count("Payment", farm)).isEqualTo(1);
            assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("PENDING_PAYMENT");
        }
    }

    @Test
    void replaysOneIntentAndReopensOriginalQuoteDespiteNewPriceTermOrSuspension() throws Exception {
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER); PlanVersion first = price();
        JsonNode original = created(owner, farm, 1, first, "same-intent");
        assertThat(created(owner, farm, 1, first, "same-intent")).isEqualTo(original);
        request(owner, farm, 2, first.getId(), "same-intent").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        clock.set(clock.instant().plusSeconds(10)); PlanVersion second = price();
        Farm storedFarm = em.find(Farm.class, farm.getId()); storedFarm.setServiceStatus("SUSPENDED"); em.flush();
        JsonNode reopened = created(owner, farm, 3, second, "another-intent");
        assertThat(reopened.path("reopened").asBoolean()).isTrue();
        assertThat(reopened.path("id")).isEqualTo(original.path("id"));
        assertThat(reopened.path("amountVnd")).isEqualTo(original.path("amountVnd"));
        assertThat(reopened.path("durationYears").asInt()).isEqualTo(1);
        assertThat(reopened.path("expiresAt")).isEqualTo(original.path("expiresAt"));
        assertThat(count("Payment", farm)).isEqualTo(1);
    }

    @Test
    void staleReviewedPriceAndSuspensionNeverCreateCommercialRows() throws Exception {
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER); PlanVersion old = price();
        clock.set(clock.instant().plusSeconds(1)); PlanVersion current = price();
        request(owner, farm, 1, old.getId(), "old-price").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE19-02"))
            .andExpect(jsonPath("$.params.current.version").value(current.getId()));
        assertThat(count("Subscription", farm)).isZero(); assertThat(count("Payment", farm)).isZero();
        farm.setServiceStatus("SUSPENDED"); em.flush();
        request(owner, farm, 1, current.getId(), "suspended").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE19-09"));
        assertThat(count("Subscription", farm)).isZero();
    }

    @Test
    void renewalUsesPersistedCoverageAtTheExactNinetyDayBoundary() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); PlanVersion price = price();
        JsonNode first = created(owner, farm, 1, price, "first");
        Payment paid = em.find(Payment.class, first.path("id").asLong());
        Instant end = clock.instant().plus(Duration.ofDays(100));
        paid.setState("PAID"); paid.setPurchasedStart(clock.instant().minus(Duration.ofDays(265))); paid.setPurchasedEnd(end);
        paid.getSubscription().setLatestEnd(null); // stale cache must not allow an early renewal
        Instant opens = end.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(90).toInstant();
        clock.set(opens.minusSeconds(1)); em.flush();
        request(owner, farm, 2, price.getId(), "too-early").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE19-03"))
            .andExpect(jsonPath("$.params.opensAt").value(opens.toString()));
        clock.set(opens);
        assertThat(created(owner, farm, 2, price, "on-boundary").path("state").asText()).isEqualTo("PENDING");
    }

    @Test
    void expiryIsImmediateOnReadAndAllowsANewRequestWithoutWaitingForTheJob() throws Exception {
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER); PlanVersion price = price();
        JsonNode original = created(owner, farm, 1, price, "original");
        clock.set(Instant.parse(original.path("expiresAt").asText()));
        JsonNode expired = detail(owner, farm, original.path("id").asLong());
        assertThat(expired.path("state").asText()).isEqualTo("EXPIRED");
        assertThat(em.find(Payment.class, original.path("id").asLong()).getState()).isEqualTo("PENDING");
        JsonNode next = created(owner, farm, 3, price, "after-expiry");
        assertThat(next.path("id")).isNotEqualTo(original.path("id"));
        assertThat(next.path("reopened").asBoolean()).isFalse();
        assertThat(count("Payment", farm)).isEqualTo(2);
    }

    @Test
    void ownershipKeyValidationAndReadAccessAreEnforcedOnEveryRequest() throws Exception {
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER); PlanVersion price = price();
        for (FarmRole role : List.of(FarmRole.MANAGER, FarmRole.TECHNICIAN)) {
            request(memberWithRole(farm, role), farm, 1, price.getId(), "denied-" + role).andExpect(status().isForbidden());
        }
        request(user(), farm, 1, price.getId(), "other-owner").andExpect(status().isForbidden());
        mvc.perform(post("/api/farms/{id}/subscription/payments", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
            .contentType("application/json").content("{\"durationYears\":1,\"reviewedPriceVersion\":" + price.getId() + "}"))
            .andExpect(status().isBadRequest());
        request(owner, farm, 0, price.getId(), "invalid-term").andExpect(status().isBadRequest());
        JsonNode original = created(owner, farm, 1, price, "valid");
        Farm other = farm(); AppUser otherOwner = memberWithRole(other, FarmRole.OWNER);
        mvc.perform(get("/api/farms/{farm}/subscription/payments/{id}", other.getId(), original.path("id").asLong())
            .with(SecurityMockMvcRequestPostProcessors.user(otherOwner.getEmail()))).andExpect(status().isNotFound());
        em.createQuery("update FarmMembership m set m.status='INACTIVE' where m.farm.id=:f and m.user.id=:u")
            .setParameter("f", farm.getId()).setParameter("u", owner.getId()).executeUpdate(); em.clear();
        request(owner, farm, 1, price.getId(), "valid").andExpect(status().isForbidden());
    }

    @Test
    void verifiedWrongAmountShowsReceivedButOnlyValidConfirmationGrantsCoverage() throws Exception {
        Farm farm = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(farm, FarmRole.OWNER); PlanVersion price = price();
        JsonNode original = created(owner, farm, 1, price, "progress"); long id = original.path("id").asLong();
        String ref = original.path("quoteRef").asText(); Instant createdAt = clock.instant();
        clock.set(createdAt.plusSeconds(10)); webhook(ref + "WRONG", "1200000", "TEST-ACCOUNT", createdAt.plusSeconds(2));
        webhook(ref, "1200000", "OTHER-ACCOUNT", createdAt.plusSeconds(2));
        assertThat(detail(owner, farm, id).get("receivedAt").isNull()).isTrue();
        clock.set(createdAt.plusSeconds(20)); webhook(ref, "1100000", "TEST-ACCOUNT", createdAt.plusSeconds(5));
        JsonNode received = detail(owner, farm, id);
        assertThat(received.path("receivedAt").asText()).isEqualTo(clock.instant().toString());
        assertThat(received.path("state").asText()).isEqualTo("PENDING");
        assertThat(received.get("confirmedAt").isNull()).isTrue();
        clock.set(createdAt.plusSeconds(30)); webhook(ref, "1200000", "TEST-ACCOUNT", createdAt.plusSeconds(8));
        JsonNode confirmed = detail(owner, farm, id);
        assertThat(confirmed.path("state").asText()).isEqualTo("PAID");
        assertThat(confirmed.path("confirmedAt").asText()).isEqualTo(clock.instant().toString());
        assertThat(confirmed.path("confirmationSource").asText()).isEqualTo("SEPAY");
        assertThat(confirmed.path("bankPaidAt").asText()).isEqualTo(createdAt.plusSeconds(8).toString());
        assertThat(confirmed.path("receivedAt").asText()).isEqualTo(createdAt.plusSeconds(20).toString());
        assertThat(em.find(Payment.class, id).getPurchasedStart()).isEqualTo(clock.instant());
        Object storedTime = em.createNativeQuery("select confirmed_at from payment where id=:id").setParameter("id", id).getSingleResult();
        assertThat(storedTime).isNotNull();
    }

    protected void webhook(String ref, String amount, String account, Instant bankAt) throws Exception {
        String bankDate = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.of("Asia/Ho_Chi_Minh")).format(bankAt);
        byte[] body = mapper.writeValueAsBytes(Map.of("id", 900000L + next(), "gateway", "Test bank", "transactionDate", bankDate,
            "accountNumber", account, "code", ref, "content", ref, "transferType", "IN", "transferAmount", new BigDecimal(amount)));
        String timestamp = Long.toString(clock.instant().getEpochSecond());
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("uc02-fixture-signing-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.US_ASCII));
        String signature = "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
        mvc.perform(post("/api/webhooks/sepay").contentType("application/json").content(body)
            .header("X-SePay-Timestamp", timestamp).header("X-SePay-Signature", signature)).andExpect(status().isOk());
    }
}
