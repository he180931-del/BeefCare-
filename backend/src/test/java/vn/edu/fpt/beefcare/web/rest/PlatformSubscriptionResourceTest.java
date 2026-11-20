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
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
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
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** D17 / SCR-61: secured HTTP, persisted periods, read-time state, filters and source payment. */
@ServiceIntegrationTest
@Transactional
class PlatformSubscriptionResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    private AppUser staff(String role) {
        AppUser u = user();
        save(new PlatformStaffAccess().user(u).role(role).status("ACTIVE"));
        return u;
    }

    private Farm named(String name, String state) {
        Farm f = farm(state);
        f.setName(name);
        memberWithRole(f, FarmRole.OWNER);
        em.flush();
        return f;
    }

    private Subscription subscription(Farm f) {
        PlanVersion plan = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(1)));
        return save(new Subscription().farm(f).planVersion(plan).entitlementStatus("PENDING"));
    }

    private Payment period(Subscription s, Instant start, Instant end, Instant confirmed) {
        Payment p = new Payment();
        p.setSubscription(s); p.setRequestedBy(user()); p.setQuoteRef("BCUC4" + next());
        p.setDurationYears(1); p.setAmountVnd(new BigDecimal("1200000")); p.setState("PAID");
        p.setRequestedAt(clock.instant().minusSeconds(60)); p.setExpiresAt(clock.instant().plusSeconds(86400));
        p.setPurchasedStart(start); p.setPurchasedEnd(end); p.setReceiptCode("RC-UC4-" + next());
        p.setPriceVersion(s.getPlanVersion());
        p.setConfirmedAt(confirmed);
        return save(p);
    }

    private ResultActions read(AppUser actor, String path) throws Exception {
        String[] parts = path.split("\\?", 2);
        var request = get("/api/platform/" + parts[0]).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail()));
        if (parts.length > 1) for (String item : parts[1].split("&")) {
            String[] param = item.split("=", 2);
            request.param(param[0], java.net.URLDecoder.decode(param.length == 1 ? "" : param[1], java.nio.charset.StandardCharsets.UTF_8));
        }
        return mvc.perform(request);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return om.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private List<Long> ids(JsonNode page) {
        List<Long> ids = new ArrayList<>();
        page.path("items").forEach(row -> ids.add(row.path("farmId").asLong()));
        return ids;
    }

    @Test
    void onlyActivePmCanReadListDetailAndSourceIncludingAfterRevocation() throws Exception {
        Farm f = named("UC4 quyền", "ACTIVE");
        Payment payment = period(subscription(f), clock.instant(), clock.instant().plusSeconds(86400), clock.instant());
        AppUser owner = em.createQuery("select m.user from FarmMembership m where m.farm.id=:id and m.role='OWNER'", AppUser.class)
            .setParameter("id", f.getId()).getSingleResult();
        AppUser inactivePm = staff("PM"); inactivePm.setAccountStatus("SUSPENDED"); em.flush();
        for (AppUser actor : List.of(staff("SA"), staff("CS"), owner,
            memberWithRole(f, FarmRole.MANAGER), memberWithRole(f, FarmRole.TECHNICIAN))) {
            for (String path : List.of("subscriptions", "subscriptions/" + f.getId(), "payments/" + payment.getId())) {
                read(actor, path).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            }
        }
        // The shared inactive-account security filter rejects before MVC and has no domain JSON body.
        for (String path : List.of("subscriptions", "subscriptions/" + f.getId(), "payments/" + payment.getId())) {
            read(inactivePm, path).andExpect(status().isForbidden());
        }
        AppUser pm = staff("PM");
        read(pm, "subscriptions/" + f.getId()).andExpect(status().isOk());
        em.createQuery("update PlatformStaffAccess a set a.status='INACTIVE' where a.user.id=:id").setParameter("id", pm.getId()).executeUpdate();
        em.clear();
        read(pm, "subscriptions").andExpect(status().isForbidden());
        read(pm, "subscriptions/" + f.getId()).andExpect(status().isForbidden());
        read(pm, "payments/" + payment.getId()).andExpect(status().isForbidden());
        mvc.perform(get("/api/platform/subscriptions")).andExpect(status().isUnauthorized());
    }

    @Test
    void coverageIncludesExpiredFarmsAndRemainsIndependentOfSuspensionAndStaleJobState() throws Exception {
        AppUser pm = staff("PM");
        Instant now = clock.instant();
        Farm expired = named("UC4cov expired", "ACTIVE");
        period(subscription(expired), now.minusSeconds(1000), now, now.minusSeconds(1000));
        Farm current = named("UC4cov suspended", "SUSPENDED");
        period(subscription(current), now, now.plusSeconds(1000), now);
        Farm future = named("UC4cov future", "EXPIRED");
        period(subscription(future), now.plusSeconds(1000), now.plusSeconds(2000), now);
        Farm never = named("UC4cov never", "PENDING_PAYMENT");
        Farm active = named("UC4cov active", "EXPIRED"); // stale stored status: JOB-04 has not run yet
        period(subscription(active), now.minusSeconds(10), now.plusSeconds(1000), now.minusSeconds(10));
        assertThat(ids(body(read(pm, "subscriptions?q=UC4cov&coverage=NONE")))).containsExactlyInAnyOrder(expired.getId(), never.getId());
        assertThat(ids(body(read(pm, "subscriptions?q=UC4cov&coverage=CURRENT&serviceStatus=SUSPENDED")))).containsExactly(current.getId());
        assertThat(ids(body(read(pm, "subscriptions?q=UC4cov&coverage=FUTURE_ONLY")))).containsExactly(future.getId());
        assertThat(body(read(pm, "subscriptions/" + expired.getId())).path("summary").path("serviceStatus").asText()).isEqualTo("EXPIRED");
        assertThat(body(read(pm, "subscriptions/" + never.getId())).path("summary").path("serviceStatus").asText()).isEqualTo("PENDING_PAYMENT");
        assertThat(em.find(Farm.class, expired.getId()).getServiceStatus()).isEqualTo("ACTIVE");
        // The SQL filter and the Java row derivation are two implementations of GBR-13: every status must agree on both.
        java.util.Map<String, List<Long>> expected = java.util.Map.of(
            "ACTIVE", List.of(active.getId()),
            "EXPIRED", List.of(expired.getId(), future.getId()),
            "PENDING_PAYMENT", List.of(never.getId()),
            "SUSPENDED", List.of(current.getId()));
        for (var entry : expected.entrySet()) {
            JsonNode page = body(read(pm, "subscriptions?q=UC4cov&serviceStatus=" + entry.getKey()));
            assertThat(ids(page)).as(entry.getKey()).containsExactlyInAnyOrderElementsOf(entry.getValue());
            page.path("items").forEach(row -> assertThat(row.path("serviceStatus").asText()).as(entry.getKey()).isEqualTo(entry.getKey()));
            for (Long id : entry.getValue()) {
                assertThat(body(read(pm, "subscriptions/" + id)).path("summary").path("serviceStatus").asText()).as(entry.getKey()).isEqualTo(entry.getKey());
            }
        }
        // Each period carries its state at the same read clock as the summary: end == now is PAST, start == now is CURRENT.
        assertThat(body(read(pm, "subscriptions/" + expired.getId())).path("periods").get(0).path("status").asText()).isEqualTo("PAST");
        assertThat(body(read(pm, "subscriptions/" + current.getId())).path("periods").get(0).path("status").asText()).isEqualTo("CURRENT");
        assertThat(body(read(pm, "subscriptions/" + future.getId())).path("periods").get(0).path("status").asText()).isEqualTo("FUTURE");
    }

    @Test
    void searchMatchesOnlyFarmNameOrPaidPaymentCodesAndTreatsWildcardsLiterally() throws Exception {
        AppUser pm = staff("PM");
        Farm f = named("UC4_Search %_ literal", "ACTIVE");
        Payment paid = period(subscription(f), clock.instant(), clock.instant().plusSeconds(2000), clock.instant());
        paid.setQuoteRef("BC-UC4-PaidCode");
        Payment pending = period(paid.getSubscription(), clock.instant(), clock.instant().plusSeconds(3000), null);
        pending.setState("PENDING"); pending.setQuoteRef("BC-UC4-NotPaidCode");
        named("UC4 Search other", "PENDING_PAYMENT");
        em.flush(); em.clear();
        assertThat(ids(body(read(pm, "subscriptions?q=%20uc4-PAIDcode%20")))).containsExactly(f.getId());
        assertThat(ids(body(read(pm, "subscriptions?q=%25_")))).containsExactly(f.getId());
        assertThat(ids(body(read(pm, "subscriptions?q=NotPaidCode")))).isEmpty();
    }

    @Test
    void endFiltersUseTheDisplayedLastCoveredDayWithIndependentInclusiveBounds() throws Exception {
        AppUser pm = staff("PM");
        Farm f = named("UC4date boundary", "ACTIVE");
        period(subscription(f), clock.instant(), Instant.parse("2027-01-01T17:00:00Z"), clock.instant()); // 02/01 00:00 VN
        assertThat(ids(body(read(pm, "subscriptions?q=UC4date&endFrom=2027-01-01&endTo=2027-01-01")))).containsExactly(f.getId());
        assertThat(ids(body(read(pm, "subscriptions?q=UC4date&endFrom=2027-01-02")))).isEmpty();
        assertThat(ids(body(read(pm, "subscriptions?q=UC4date&endTo=2027-01-01")))).containsExactly(f.getId());
        read(pm, "subscriptions?endFrom=2027-01-02&endTo=2027-01-01").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-11"));
    }

    @Test
    void listFiltersCountsSortsAndPagesBeforeReturningTwentyRowsWithNullEndsLast() throws Exception {
        AppUser pm = staff("PM");
        List<Long> ordered = new ArrayList<>();
        for (int i = 0; i < 21; i++) {
            Farm f = named("UC4page " + i, "ACTIVE");
            period(subscription(f), clock.instant(), clock.instant().plus(Duration.ofDays(i + 1)), clock.instant());
            ordered.add(f.getId());
        }
        Farm none = named("UC4page none", "PENDING_PAYMENT");
        JsonNode first = body(read(pm, "subscriptions?q=UC4page"));
        assertThat(first.path("size").asInt()).isEqualTo(20);
        assertThat(first.path("total").asLong()).isEqualTo(22);
        assertThat(first.path("items")).hasSize(20);
        assertThat(ids(first).getFirst()).isEqualTo(ordered.getLast());
        assertThat(ids(body(read(pm, "subscriptions?q=UC4page&page=1")))).containsExactly(ordered.getFirst(), none.getId());
        assertThat(ids(body(read(pm, "subscriptions?q=UC4page&sort=confirmedUntil&dir=asc"))).getFirst()).isEqualTo(ordered.getFirst());
        // A farm without an end date stays last in ascending order too.
        assertThat(ids(body(read(pm, "subscriptions?q=UC4page&sort=confirmedUntil&dir=asc&page=1")))).containsExactly(ordered.getLast(), none.getId());
    }

    @Test
    void rejectsInvalidFiltersPagingAndSortingInsteadOfSilentlyChangingThem() throws Exception {
        AppUser pm = staff("PM");
        for (String query : List.of("coverage=OTHER", "serviceStatus=OTHER", "sort=name", "dir=sideways", "page=-1",
            "page=107374183", "size=0", "size=101", "q=" + "x".repeat(101))) {
            read(pm, "subscriptions?" + query).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        }
        read(pm, "subscriptions/9223372036854775807").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        read(pm, "payments/9223372036854775807").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
    }

    @Test
    void detailUsesPersistedConfirmationLatestPurchaseAndPaidPeriodsInsteadOfCachedEnd() throws Exception {
        AppUser pm = staff("PM");
        Farm f = named("UC4detail", "SUSPENDED");
        Subscription s = subscription(f);
        Instant now = clock.instant();
        Payment current = period(s, now.minusSeconds(1), now.plusSeconds(1000), now.minusSeconds(10));
        Payment future = period(s, now.plusSeconds(1000), now.plusSeconds(2000), now.minusSeconds(20));
        s.setLatestEnd(now.plusSeconds(100)); // deliberately stale cache
        AuditLog suspension = new AuditLog();
        suspension.setAction("FARM_SERVICE_SUSPEND"); suspension.setTargetType("Farm"); suspension.setTargetId(f.getId());
        suspension.setLoggedAt(now.minusSeconds(30)); suspension.setDetails("{\"reason\":\"Kiểm tra\"}");
        suspension.setFarm(f); suspension.setActor(pm); save(suspension);
        em.flush(); em.clear();
        JsonNode detail = body(read(pm, "subscriptions/" + f.getId()));
        assertThat(detail.path("periods")).hasSize(2);
        assertThat(detail.path("summary").path("confirmedUntil").asText()).isEqualTo(now.plusSeconds(2000).toString());
        assertThat(detail.path("summary").path("currentStart").asText()).isEqualTo(current.getPurchasedStart().toString());
        assertThat(detail.path("suspendedSince").asText()).isEqualTo(now.minusSeconds(30).toString());
        assertThat(detail.path("latestPurchase").path("paymentId").asLong()).isEqualTo(current.getId());
        assertThat(detail.path("latestPurchase").path("confirmedAt").asText()).isEqualTo(current.getConfirmedAt().toString());
        assertThat(detail.path("periods").toString()).contains(future.getQuoteRef());
        List<String> fields = new ArrayList<>(); detail.path("summary").fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("farmId", "farmName", "ownerName", "ownerEmail", "serviceStatus", "currentStart", "currentEnd", "confirmedUntil", "paymentCodes");
        JsonNode source = body(read(pm, "payments/" + future.getId()));
        assertThat(source.path("quoteRef").asText()).isEqualTo(future.getQuoteRef());
        assertThat(source.path("farmId").asLong()).isEqualTo(f.getId());
        assertThat(source.path("amount").decimalValue()).isEqualByComparingTo("1200000");
        em.flush(); em.clear();
        assertThat(em.find(Subscription.class, s.getId()).getLatestEnd()).isEqualTo(now.plusSeconds(100));
        assertThat(em.find(Payment.class, current.getId()).getConfirmedAt()).isEqualTo(now.minusSeconds(10));
    }

    @Test
    void emptyStatesDistinguishMissingSubscriptionAndMissingPaidPeriodWithoutAnyWrites() throws Exception {
        AppUser pm = staff("PM");
        Farm never = named("UC4empty never", "PENDING_PAYMENT");
        Farm registered = named("UC4empty registered", "PENDING_PAYMENT");
        Subscription s = subscription(registered);
        long before = em.createQuery("select count(s) from Subscription s", Long.class).getSingleResult();
        JsonNode missing = body(read(pm, "subscriptions/" + never.getId()));
        JsonNode requested = body(read(pm, "subscriptions/" + registered.getId()));
        assertThat(missing.path("subscriptionId").isNull()).isTrue();
        assertThat(requested.path("subscriptionId").asLong()).isEqualTo(s.getId());
        assertThat(missing.path("emptyMessage").asText()).isNotEqualTo(requested.path("emptyMessage").asText());
        assertThat(requested.path("latestPurchase").isNull()).isTrue();
        assertThat(requested.path("summary").path("confirmedUntil").isNull()).isTrue();
        assertThat(requested.path("periods")).isEmpty();
        em.flush(); em.clear();
        assertThat(em.createQuery("select count(s) from Subscription s", Long.class).getSingleResult()).isEqualTo(before);
        assertThat(em.createQuery("select count(p) from Payment p where p.subscription.farm.id in :ids", Long.class)
            .setParameter("ids", List.of(never.getId(), registered.getId())).getSingleResult()).isZero();
    }
}
