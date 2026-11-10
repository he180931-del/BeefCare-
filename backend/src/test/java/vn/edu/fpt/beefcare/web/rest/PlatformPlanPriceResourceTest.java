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
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC7: the complete PM publication command/read slice, inherited unchanged on PostgreSQL. */
@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:uc7;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "beefcare.sepay.bank-code=TESTBANK", "beefcare.sepay.account-number=TEST-ACCOUNT", "beefcare.sepay.account-name=TEST RECIPIENT"
})
class PlatformPlanPriceResourceTest extends DomainTestSupport {
    static final String BASE = "/api/platform/plan-prices";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    AppUser staff(String role) {
        AppUser actor = user(); save(new PlatformStaffAccess().user(actor).role(role).status("ACTIVE")); return actor;
    }
    Map<String, Object> publish(boolean now, Instant at) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("price1y", 1300000); body.put("price2y", 2300000); body.put("price3y", 3300000);
        body.put("applyNow", now); body.put("effectiveAt", at == null ? null : at.toString()); body.put("terms", "  Không tự gia hạn  ");
        return body;
    }
    ResultActions command(AppUser actor, String suffix, Map<String, Object> body, String key) throws Exception {
        var req = post(BASE + suffix).with(csrf()).contentType("application/json").content(om.writeValueAsBytes(body));
        if (actor != null) req.with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail()));
        if (key != null) req.header("Idempotency-Key", key);
        return mvc.perform(req);
    }
    JsonNode json(ResultActions r) throws Exception { return om.readTree(r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()); }
    JsonNode history(AppUser actor, String query) throws Exception { return json(mvc.perform(get(BASE + query).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail())))); }
    Map<String, Object> withdrawal(JsonNode version, String reason) { return Map.of("reason", reason, "expectedVersion", version.path("revision").asLong()); }
    long count(String entity) { return em.createQuery("select count(e) from " + entity + " e", Long.class).getSingleResult(); }
    void bad(ResultActions result, String code) throws Exception { result.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(code)); }

    @Test
    void publicationIsServerTimedAndStoresFullPricesTermsPublisherAndAuditOnce() throws Exception {
        AppUser pm = staff("PM"); Map<String, Object> payload = publish(true, Instant.EPOCH); payload.put("terms", "x".repeat(500));
        JsonNode created = json(command(pm, "", payload, "uc7-publish"));
        assertThat(created.path("status").asText()).isEqualTo("EFFECTIVE");
        assertThat(Instant.parse(created.path("effectiveAt").asText())).isEqualTo(clock.instant());
        assertThat(Instant.parse(created.path("publishedAt").asText())).isEqualTo(clock.instant());
        assertThat(created.path("publishedBy").asText()).isEqualTo(pm.getFullName());
        assertThat(created.path("publishedById").asLong()).isEqualTo(pm.getId());
        assertThat(json(command(pm, "", payload, "uc7-publish"))).isEqualTo(created);
        var changed = publish(true, null); changed.put("price1y", 1700000);
        command(pm, "", changed, "uc7-publish").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        em.flush(); em.clear();
        PlanVersion stored = em.find(PlanVersion.class, created.path("id").asLong());
        assertThat(stored.getPrice1y()).isEqualByComparingTo("1300000"); assertThat(stored.getPrice2y()).isEqualByComparingTo("2300000");
        assertThat(stored.getPrice3y()).isEqualByComparingTo("3300000"); assertThat(stored.getTerms()).hasSize(500);
        assertThat(em.createNativeQuery("select published_at from plan_version where id=:id").setParameter("id", stored.getId()).getSingleResult()).isNotNull();
        assertThat(count("PlanVersion")).isEqualTo(1);
        assertThat(em.createQuery("select count(a) from AuditLog a where a.action='PLAN_PRICE_PUBLISH' and a.targetId=:id", Long.class).setParameter("id", stored.getId()).getSingleResult()).isEqualTo(1);
    }

    @Test
    void everyReadAndCommandRequiresCurrentActivePmAndEveryCommandRequiresKey() throws Exception {
        AppUser pm = staff("PM"); JsonNode future = json(command(pm, "", publish(false, clock.instant().plusSeconds(100)), "seed"));
        for (AppUser actor : List.of(user(), staff("SA"), staff("CS"), user("INACTIVE"))) {
            mvc.perform(get(BASE).with(SecurityMockMvcRequestPostProcessors.user(actor.getEmail()))).andExpect(status().isForbidden());
            command(actor, "", publish(true, null), "key-" + next()).andExpect(status().isForbidden());
            command(actor, "/" + future.path("id").asLong() + "/withdraw", withdrawal(future, "Sai bảng giá"), "key-" + next()).andExpect(status().isForbidden());
        }
        bad(command(pm, "", publish(true, null), null), "MSG-COM-19");
        bad(command(pm, "/" + future.path("id").asLong() + "/withdraw", withdrawal(future, "Sai bảng giá"), null), "MSG-COM-19");
        command(null, "", publish(true, null), "anonymous").andExpect(status().isUnauthorized());
        PlatformStaffAccess access = em.createQuery("select a from PlatformStaffAccess a where a.user.id=:id", PlatformStaffAccess.class).setParameter("id", pm.getId()).getSingleResult();
        access.setStatus("INACTIVE"); em.flush();
        command(pm, "", publish(false, clock.instant().plusSeconds(100)), "seed").andExpect(status().isForbidden());
    }

    @Test
    void validatesEveryPriceAndSupportedTextAtExactBoundaries() throws Exception {
        AppUser pm = staff("PM");
        for (String field : List.of("price1y", "price2y", "price3y")) {
            for (Object invalid : List.of(999, 1000000001L, new BigDecimal("1500.5"), 0, -1)) {
                var payload = publish(true, null); payload.put(field, invalid);
                bad(command(pm, "", payload, "bad-" + next()), "MSG-FE19-13");
            }
            var missing = publish(true, null); missing.put(field, null);
            bad(command(pm, "", missing, "missing-" + next()), "MSG-COM-06");
        }
        var tooLong = publish(true, null); tooLong.put("terms", "x".repeat(501)); bad(command(pm, "", tooLong, "long"), "MSG-COM-10");
        var bounds = publish(true, null); bounds.put("price1y", 1000); bounds.put("price2y", 1000000000); bounds.put("price3y", 1000); bounds.put("terms", "  ");
        JsonNode result = json(command(pm, "", bounds, "bounds")); assertThat(result.get("terms").isNull()).isTrue();
        assertThat(count("PlanVersion")).isEqualTo(1);
    }

    @Test
    void validatesApplicationTimeAndConflictsWhileEqualNowIsAllowed() throws Exception {
        AppUser pm = staff("PM"); var missingMode = publish(true, null); missingMode.remove("applyNow");
        bad(command(pm, "", missingMode, "missing-mode"), "MSG-COM-06");
        bad(command(pm, "", publish(false, null), "missing-time"), "MSG-COM-06");
        bad(command(pm, "", publish(false, clock.instant().minusNanos(1000000)), "past"), "MSG-FE19-14");
        JsonNode atNow = json(command(pm, "", publish(false, clock.instant()), "equal")); assertThat(atNow.path("status").asText()).isEqualTo("EFFECTIVE");
        Instant futureTime = clock.instant().plusSeconds(3600);
        JsonNode future = json(command(pm, "", publish(false, futureTime), "future"));
        command(pm, "", publish(false, futureTime), "clash").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE19-15"))
            .andExpect(jsonPath("$.params.version").value(future.path("id").asLong()))
            .andExpect(jsonPath("$.params.time").value(futureTime.toString()));
        assertThat(count("PlanVersion")).isEqualTo(2);
    }

    @Test
    void withdrawingKeepsHistoryReleasesTimeAndNeverChangesEffectivePrices() throws Exception {
        AppUser pm = staff("PM"); JsonNode current = json(command(pm, "", publish(true, null), "current"));
        Instant at = clock.instant().plusSeconds(3600); JsonNode future = json(command(pm, "", publish(false, at), "scheduled"));
        long id = future.path("id").asLong(); var payload = withdrawal(future, "  " + "x".repeat(1000) + "  ");
        JsonNode withdrawn = json(command(pm, "/" + id + "/withdraw", payload, "withdraw"));
        assertThat(withdrawn.path("status").asText()).isEqualTo("WITHDRAWN");
        assertThat(withdrawn.path("withdrawReason").asText()).hasSize(1000);
        assertThat(withdrawn.path("withdrawnBy").asText()).isEqualTo(pm.getFullName());
        assertThat(Instant.parse(withdrawn.path("withdrawnAt").asText())).isEqualTo(clock.instant());
        assertThat(json(command(pm, "/" + id + "/withdraw", payload, "withdraw"))).isEqualTo(withdrawn);
        command(pm, "/" + id + "/withdraw", payload, "new-withdraw").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        JsonNode replacement = json(command(pm, "", publish(false, at), "replacement"));
        em.flush(); em.clear();
        Object[] stored = (Object[]) em.createNativeQuery("select withdraw_reason,withdrawn_by_id,withdrawn_at,price_1_y,effective_at from plan_version where id=:id").setParameter("id", id).getSingleResult();
        assertThat(stored[0].toString()).hasSize(1000); assertThat(((Number) stored[1]).longValue()).isEqualTo(pm.getId()); assertThat(stored[2]).isNotNull();
        assertThat(new BigDecimal(stored[3].toString())).isEqualByComparingTo("1300000");
        assertThat(history(pm, "").path("current").path("id").asLong()).isEqualTo(current.path("id").asLong());
        clock.set(at); JsonNode read = history(pm, ""); assertThat(read.path("current").path("id").asLong()).isEqualTo(replacement.path("id").asLong());
        assertThat(read.path("items").toString()).contains("WITHDRAWN", "SUPERSEDED", "EFFECTIVE");
        assertThat(count("PlanVersion")).isEqualTo(3);
    }

    @Test
    void withdrawalEnforcesReasonObservedVersionAndStrictlyFutureLifecycle() throws Exception {
        AppUser pm = staff("PM"); JsonNode future = json(command(pm, "", publish(false, clock.instant().plusSeconds(10)), "future"));
        String path = "/" + future.path("id").asLong() + "/withdraw";
        bad(command(pm, path, Map.of("expectedVersion", 0), "missing-reason"), "MSG-COM-06");
        bad(command(pm, path, withdrawal(future, "   "), "blank"), "MSG-COM-06");
        bad(command(pm, path, withdrawal(future, "a b c d"), "short"), "MSG-COM-10");
        bad(command(pm, path, withdrawal(future, "x".repeat(1001)), "long"), "MSG-COM-10");
        bad(command(pm, path, Map.of("reason", "Sai bảng giá"), "missing-version"), "MSG-COM-06");
        command(pm, path, Map.of("reason", "Sai bảng giá", "expectedVersion", 999), "stale").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        command(pm, "/99999999/withdraw", withdrawal(future, "Sai bảng giá"), "missing").andExpect(status().isNotFound());
        clock.set(clock.instant().plusSeconds(10));
        command(pm, path, withdrawal(future, "Sai bảng giá"), "effective").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        assertThat(history(pm, "").path("current").path("id").asLong()).isEqualTo(future.path("id").asLong());
    }

    @Test
    void currentAndNextBoundaryAreIndependentOfPagedPublicationHistoryAndReadsNeverWrite() throws Exception {
        AppUser pm = staff("PM"); JsonNode scheduled = json(command(pm, "", publish(false, clock.instant().plusSeconds(3600)), "scheduled-first"));
        clock.set(clock.instant().plusSeconds(1)); JsonNode current = json(command(pm, "", publish(true, null), "immediate-later"));
        for (int i = 0; i < 20; i++) { clock.set(clock.instant().plusSeconds(1)); json(command(pm, "", publish(false, clock.instant().plusSeconds(7200 + i)), "scheduled-" + i)); }
        long audits = count("AuditLog"); JsonNode first = history(pm, ""); JsonNode second = history(pm, "?page=1&size=20");
        assertThat(first.path("items")).hasSize(20); assertThat(second.path("items")).hasSize(2); assertThat(first.path("total").asLong()).isEqualTo(22);
        assertThat(second.path("current").path("id").asLong()).isEqualTo(current.path("id").asLong());
        assertThat(second.path("items").get(0).path("id").asLong()).isEqualTo(current.path("id").asLong());
        assertThat(second.path("items").get(1).path("id").asLong()).isEqualTo(scheduled.path("id").asLong());
        assertThat(first.path("nextEffectiveAt")).isEqualTo(scheduled.path("effectiveAt"));
        for (String query : List.of("?page=-1", "?size=0", "?size=101", "?page=2147483647&size=20")) {
            mvc.perform(get(BASE + query).with(SecurityMockMvcRequestPostProcessors.user(pm.getEmail()))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        }
        assertThat(count("AuditLog")).isEqualTo(audits);
    }

    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;
    interface Call { void run() throws Exception; }
    long statements(Call call) throws Exception {
        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled(); statistics.setStatisticsEnabled(true); statistics.clear();
        try { call.run(); return statistics.getPrepareStatementCount(); } finally { statistics.setStatisticsEnabled(enabled); }
    }

    @Test
    void historyLoadsPublishersAndWithdrawersWithoutOneQueryPerUser() throws Exception {
        AppUser pm = staff("PM");
        for (int i = 0; i < 3; i++) json(command(pm, "", publish(false, clock.instant().plusSeconds(3600 + i)), "own-" + i));
        em.flush(); em.clear();
        long onePublisher = statements(() -> history(pm, ""));
        for (AppUser other : List.of(staff("PM"), staff("PM"))) json(command(other, "", publish(false, clock.instant().plusSeconds(7200 + next())), "other-" + next()));
        AppUser withdrawer = staff("PM"); JsonNode first = history(pm, "").path("items").get(4);
        json(command(withdrawer, "/" + first.path("id").asLong() + "/withdraw", withdrawal(first, "Sai bảng giá"), "withdraw-other"));
        em.flush(); em.clear();
        JsonNode read = history(pm, ""); assertThat(read.path("items").toString()).contains("WITHDRAWN", withdrawer.getFullName());
        em.clear();
        long fourUsers = statements(() -> history(pm, ""));
        assertThat(fourUsers).as("no per-user query: 1 publisher %d, 3 publishers + 1 withdrawer %d", onePublisher, fourUsers).isEqualTo(onePublisher);
    }

    @Test
    void publicAndNewQuotesUseEffectiveUnwithdrawnPriceAndOldQuoteRemainsUnchanged() throws Exception {
        AppUser pm = staff("PM"); JsonNode v1 = json(command(pm, "", publish(true, null), "v1"));
        Farm f1 = farm("PENDING_PAYMENT"); AppUser owner = memberWithRole(f1, FarmRole.OWNER);
        JsonNode quote = json(mvc.perform(post("/api/farms/{farm}/subscription/payments", f1.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
            .header("Idempotency-Key", "old-quote").contentType("application/json").content(om.writeValueAsBytes(Map.of("durationYears", 1, "reviewedPriceVersion", v1.path("id").asLong())))));
        Instant at = clock.instant().plusSeconds(10); var newPrice = publish(false, at); newPrice.put("price1y", 1900000);
        JsonNode v2 = json(command(pm, "", newPrice, "v2"));
        JsonNode cancelled = json(command(pm, "", publish(false, at.plusSeconds(5)), "cancelled"));
        json(command(pm, "/" + cancelled.path("id").asLong() + "/withdraw", withdrawal(cancelled, "Sai bảng giá"), "cancel"));
        assertThat(json(mvc.perform(get("/api/public/prices"))).path("id").asLong()).isEqualTo(v1.path("id").asLong());
        clock.set(at.plusSeconds(6));
        JsonNode publicPrice = json(mvc.perform(get("/api/public/prices")));
        assertThat(publicPrice.path("id").asLong()).isEqualTo(v2.path("id").asLong()); assertThat(publicPrice.has("publishedBy")).isFalse();
        Farm f2 = farm("PENDING_PAYMENT"); AppUser owner2 = memberWithRole(f2, FarmRole.OWNER);
        var payload = Map.of("durationYears", 1, "reviewedPriceVersion", v1.path("id").asLong());
        mvc.perform(post("/api/farms/{farm}/subscription/payments", f2.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner2.getEmail())).with(csrf()).header("Idempotency-Key", "stale-price")
            .contentType("application/json").content(om.writeValueAsBytes(payload))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE19-02"));
        JsonNode nextQuote = json(mvc.perform(post("/api/farms/{farm}/subscription/payments", f2.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner2.getEmail())).with(csrf()).header("Idempotency-Key", "new-quote")
            .contentType("application/json").content(om.writeValueAsBytes(Map.of("durationYears", 1, "reviewedPriceVersion", v2.path("id").asLong())))));
        assertThat(nextQuote.path("amountVnd").decimalValue()).isEqualByComparingTo("1900000");
        em.flush(); em.clear(); assertThat(em.find(Payment.class, quote.path("id").asLong()).getAmountVnd()).isEqualByComparingTo("1300000");
        assertThat(em.find(Payment.class, quote.path("id").asLong()).getPriceVersion().getId()).isEqualTo(v1.path("id").asLong());
    }
}
