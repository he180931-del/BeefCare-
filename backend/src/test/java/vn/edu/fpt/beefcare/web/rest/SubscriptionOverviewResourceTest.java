package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC-FE19-01, SCR-57, TC-19-32..39: secured HTTP + persisted fixtures, no payment writes. */
@ServiceIntegrationTest
@Transactional
class SubscriptionOverviewResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private PlanVersion price(Instant effectiveAt) {
        return save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(effectiveAt));
    }

    private Subscription subscription(Farm farm) {
        PlanVersion plan = price(clock.instant());
        Subscription s = new Subscription().entitlementStatus("STALE");
        s.setFarm(farm);
        s.setPlanVersion(plan);
        return save(s);
    }

    private Payment payment(Subscription s, AppUser owner, String state, Instant start, Instant end) {
        Payment p = new Payment().quoteRef("BC" + next()).durationYears(1).amountVnd(new BigDecimal("1200000"))
            .state(state).expiresAt(clock.instant().plusSeconds(3600))
            .purchasedStart(start).purchasedEnd(end);
        p.setRequestedAt(clock.instant().minusSeconds(3600));
        p.setSubscription(s);
        p.setRequestedBy(owner);
        p.setPriceVersion(s.getPlanVersion());
        p.setReceivingBankCode("TESTBANK");
        p.setReceivingAccount("TEST-ACCOUNT");
        p.setReceivingAccountName("TEST RECIPIENT");
        return save(p);
    }

    private JsonNode overview(AppUser owner, Farm farm) throws Exception {
        em.flush();
        em.clear(); // Read from persisted rows, not fixture objects in the first-level cache.
        return mapper.readTree(mvc.perform(get("/api/farms/{id}/subscription", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void newFarmHasACompleteEmptyOverviewWithoutCreatingCommercialData() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        price(clock.instant());
        JsonNode o = overview(owner, farm);
        assertThat(o.path("farmId").asLong()).isEqualTo(farm.getId());
        assertThat(o.path("farmName").asText()).isEqualTo(farm.getName());
        assertThat(o.path("serviceStatus").asText()).isEqualTo("PENDING_PAYMENT");
        for (String field : List.of("currentPeriod", "daysRemaining", "latestEnd", "renewalOpensAt", "suspendedSince", "pendingPayment")) {
            assertThat(o.has(field)).as(field + " exists even when null").isTrue();
            assertThat(o.get(field).isNull()).as(field).isTrue();
        }
        assertThat(o.path("periods").isArray()).isTrue();
        assertThat(o.path("periods").size()).isZero();
        assertThat(o.path("futurePeriods").isArray()).isTrue();
        assertThat(o.path("futurePeriods").size()).isZero();
        assertThat(o.path("suspended").asBoolean()).isFalse();
        assertThat(o.path("entitlementStatus").asText()).isEqualTo("NONE");
        assertThat(o.path("eligibility").path("ok").asBoolean()).isTrue();
        assertThat(em.createQuery("select count(s) from Subscription s where s.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(p) from Payment p where p.subscription.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isZero();
    }

    @Test
    void periodsComeFromPaidRowsIncludingFutureCoverageRatherThanCachedTotals() throws Exception {
        Instant now = clock.instant();
        Farm farm = farm("EXPIRED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Subscription s = subscription(farm);
        Payment past = payment(s, owner, "PAID", now.minus(Duration.ofDays(400)), now.minus(Duration.ofDays(35)));
        Payment current = payment(s, owner, "PAID", now.minus(Duration.ofDays(35)), now.plus(Duration.ofDays(330)));
        Payment future = payment(s, owner, "PAID", current.getPurchasedEnd(), now.plus(Duration.ofDays(695)));
        payment(s, owner, "EXPIRED", null, null);
        Payment pending = payment(s, owner, "PENDING", null, null);
        JsonNode o = overview(owner, farm);
        assertThat(o.path("serviceStatus").asText()).isEqualTo("ACTIVE");
        assertThat(o.path("currentPeriod").path("paymentCode").asText()).isEqualTo(current.getQuoteRef());
        assertThat(o.path("currentPeriod").path("amountVnd").decimalValue()).isEqualByComparingTo(current.getAmountVnd());
        assertThat(o.path("currentPeriod").path("durationYears").asInt()).isEqualTo(1);
        assertThat(o.path("currentPeriod").path("start").asText()).isEqualTo(current.getPurchasedStart().toString());
        assertThat(o.path("daysRemaining").asLong()).isEqualTo(330);
        assertThat(o.path("latestEnd").asText()).isEqualTo(future.getPurchasedEnd().toString());
        assertThat(o.path("periods").findValuesAsText("paymentCode")).containsExactly(future.getQuoteRef(), current.getQuoteRef(), past.getQuoteRef());
        assertThat(o.path("periods").findValuesAsText("status")).containsExactly("FUTURE", "CURRENT", "PAST");
        assertThat(o.path("futurePeriods").findValuesAsText("paymentCode")).containsExactly(future.getQuoteRef());
        assertThat(o.path("pendingPayment").path("id").asLong()).isEqualTo(pending.getId());
        assertThat(o.path("pendingPayment").path("quoteRef").asText()).isEqualTo(pending.getQuoteRef());
        assertThat(o.path("entitlementStatus").asText()).isEqualTo("CURRENT");
        assertThat(em.find(Subscription.class, s.getId()).getLatestEnd()).isNull();
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("EXPIRED");
        assertThat(em.find(Payment.class, current.getId()).getPurchasedEnd()).isEqualTo(current.getPurchasedEnd());
    }

    @Test
    void wholeDaysRoundDownAndCoverageEndsAtTheExactInstantWithoutWaitingForTheJob() throws Exception {
        Instant start = clock.instant();
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Subscription s = subscription(farm);
        Instant end = start.plus(Duration.ofDays(1));
        payment(s, owner, "PAID", start, end);
        assertThat(overview(owner, farm).path("daysRemaining").asLong()).isEqualTo(1);
        clock.set(start.plusSeconds(3600));
        JsonNode lastDay = overview(owner, farm);
        assertThat(lastDay.path("daysRemaining").asLong()).isZero();
        assertThat(lastDay.path("serviceStatus").asText()).isEqualTo("ACTIVE");
        clock.set(end);
        JsonNode expired = overview(owner, farm);
        assertThat(expired.path("serviceStatus").asText()).isEqualTo("EXPIRED");
        assertThat(expired.path("currentPeriod").isNull()).isTrue();
        assertThat(expired.path("daysRemaining").isNull()).isTrue();
        assertThat(expired.path("periods").get(0).path("status").asText()).isEqualTo("PAST");
        assertThat(expired.path("eligibility").path("ok").asBoolean()).isTrue();
        assertThat(em.find(Farm.class, farm.getId()).getServiceStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void renewalDateRemainsVisibleBeforeAtAndAfterTheOpeningBoundary() throws Exception {
        Instant now = clock.instant();
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Subscription s = subscription(farm);
        Instant end = now.plus(Duration.ofDays(100));
        payment(s, owner, "PAID", now.minus(Duration.ofDays(265)), end);
        Instant opens = end.atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).minusDays(90).toInstant();
        clock.set(opens.minusNanos(1));
        JsonNode before = overview(owner, farm);
        assertThat(before.path("eligibility").path("reason").asText()).isEqualTo("OUTSIDE_WINDOW");
        assertThat(before.path("eligibility").path("opensAt").asText()).isEqualTo(opens.toString());
        for (Instant time : List.of(opens, opens.plusSeconds(1), end)) {
            clock.set(time);
            JsonNode o = overview(owner, farm);
            assertThat(o.path("renewalOpensAt").asText()).isEqualTo(opens.toString());
            assertThat(o.path("eligibility").path("ok").asBoolean()).isTrue();
        }
    }

    @Test
    void suspensionHasPriorityAndRetainsCoverageAndLastSuspensionDate() throws Exception {
        Instant now = clock.instant();
        Farm farm = farm("SUSPENDED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Subscription s = subscription(farm);
        payment(s, owner, "PAID", now.minus(Duration.ofDays(300)), now.plus(Duration.ofDays(65)));
        Payment pending = payment(s, owner, "PENDING", null, null);
        AuditLog audit = new AuditLog();
        audit.setAction("FARM_SERVICE_SUSPEND"); audit.setTargetType("Farm"); audit.setTargetId(farm.getId());
        audit.setLoggedAt(now.minusSeconds(300)); audit.setDetails("{}");
        audit.setFarm(farm); audit.setActor(owner); save(audit);
        JsonNode o = overview(owner, farm);
        assertThat(o.path("serviceStatus").asText()).isEqualTo("SUSPENDED");
        assertThat(o.path("suspended").asBoolean()).isTrue();
        assertThat(o.path("suspendedSince").asText()).isEqualTo(audit.getLoggedAt().toString());
        assertThat(o.path("daysRemaining").asLong()).isEqualTo(65);
        assertThat(o.path("eligibility").path("reason").asText()).isEqualTo("SUSPENDED");
        assertThat(o.path("pendingPayment").path("id").asLong()).isEqualTo(pending.getId());
    }

    @Test
    void pendingRequestDisappearsAtExpiryWithoutMutatingIt() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Subscription s = subscription(farm);
        Payment p = payment(s, owner, "PENDING", null, null);
        assertThat(overview(owner, farm).path("pendingPayment").path("id").asLong()).isEqualTo(p.getId());
        clock.set(p.getExpiresAt());
        assertThat(overview(owner, farm).path("pendingPayment").isNull()).isTrue();
        assertThat(em.find(Payment.class, p.getId()).getState()).isEqualTo("PENDING");
    }

    @Test
    void pricesUseTheEffectiveVersionAndChangeAtItsExactStart() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        PlanVersion current = price(clock.instant());
        PlanVersion future = price(clock.instant().plusSeconds(60));
        JsonNode prices = overview(owner, farm).path("currentPrices");
        assertThat(prices.path("id").asLong()).isEqualTo(current.getId());
        assertThat(prices.path("price1y").decimalValue()).isEqualByComparingTo("1200000");
        assertThat(prices.path("price2y").decimalValue()).isEqualByComparingTo("2160000");
        assertThat(prices.path("price3y").decimalValue()).isEqualByComparingTo("3060000");
        clock.set(future.getEffectiveAt());
        assertThat(overview(owner, farm).path("currentPrices").path("id").asLong()).isEqualTo(future.getId());
    }

    @Test
    void missingPricesKeepTheFarmOverviewAndBlockPayment() throws Exception {
        clock.set(Instant.EPOCH);
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode o = overview(owner, farm);
        assertThat(o.path("farmName").asText()).isEqualTo(farm.getName());
        assertThat(o.path("currentPrices").isNull()).isTrue();
        assertThat(o.path("eligibility").path("reason").asText()).isEqualTo("PRICE_UNAVAILABLE");
    }

    @Test
    void nonOwnersAndOtherFarmOwnersCannotReadAndRoleChangesApplyImmediately() throws Exception {
        Farm farm = farm();
        for (FarmRole role : List.of(FarmRole.MANAGER, FarmRole.TECHNICIAN)) {
            AppUser member = memberWithRole(farm, role);
            mvc.perform(get("/api/farms/{id}/subscription", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(member.getEmail())))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        AppUser other = memberWithRole(farm(), FarmRole.OWNER);
        mvc.perform(get("/api/farms/{id}/subscription", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(other.getEmail())))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        overview(owner, farm);
        em.createQuery("update FarmMembership m set m.status='INACTIVE' where m.farm.id=:f and m.user.id=:u")
            .setParameter("f", farm.getId()).setParameter("u", owner.getId()).executeUpdate();
        em.clear();
        mvc.perform(get("/api/farms/{id}/subscription", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    @Test
    void anonymousCannotReadSubscription() throws Exception {
        mvc.perform(get("/api/farms/1/subscription")).andExpect(status().isUnauthorized());
    }

    @Test
    void oneOwnerSwitchingBetweenTwoFarmsNeverMixesPeriodsOrPendingRequests() throws Exception {
        Instant now = clock.instant();
        Farm first = farm();
        Farm second = farm();
        AppUser owner = memberWithRole(first, FarmRole.OWNER);
        member(second, owner, "OWNER", "ACTIVE");
        Subscription firstSubscription = subscription(first);
        Subscription secondSubscription = subscription(second);
        Payment firstPeriod = payment(firstSubscription, owner, "PAID", now.minus(Duration.ofDays(1)), now.plus(Duration.ofDays(364)));
        Payment secondPeriod = payment(secondSubscription, owner, "PAID", now.minus(Duration.ofDays(300)), now.plus(Duration.ofDays(65)));
        Payment pending = payment(secondSubscription, owner, "PENDING", null, null);
        JsonNode firstOverview = overview(owner, first);
        assertThat(firstOverview.path("farmName").asText()).isEqualTo(first.getName());
        assertThat(firstOverview.path("periods").findValuesAsText("paymentCode")).containsExactly(firstPeriod.getQuoteRef());
        assertThat(firstOverview.path("pendingPayment").isNull()).isTrue();
        JsonNode secondOverview = overview(owner, second);
        assertThat(secondOverview.path("farmName").asText()).isEqualTo(second.getName());
        assertThat(secondOverview.path("periods").findValuesAsText("paymentCode")).containsExactly(secondPeriod.getQuoteRef());
        assertThat(secondOverview.path("pendingPayment").path("id").asLong()).isEqualTo(pending.getId());
        assertThat(secondOverview.path("daysRemaining").asLong()).isEqualTo(65);
    }
}
