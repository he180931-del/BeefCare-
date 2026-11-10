package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * HTTP contract of the Platform Manager farm service API (UC-FE02-04 overview, UC-FE02-05 suspend / restore, SCR-12
 * and its popup): PM only, service data only (GBR-11), tiles, search, sort, the popup preview, suspension and payment
 * kept independent (GBR-15), the history kept in the append-only audit (decision 08/11/2026), and the request key.
 */
@ServiceIntegrationTest
@Transactional
class PlatformFarmResourceTest extends DomainTestSupport {

    private static final Duration DAY = Duration.ofDays(1);

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    // ---- actors and data ----

    private AppUser staff(PlatformRole role) {
        AppUser u = user();
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(u);
        access.setRole(role.name());
        access.setStatus("ACTIVE");
        save(access);
        return u;
    }

    private Farm named(String status, String name) {
        Farm f = farm(status);
        f.setName(name);
        em.flush();
        return f;
    }

    private Subscription subscription(Farm farm, Instant latestEnd) {
        PlanVersion plan = new PlanVersion()
            .price1y(new BigDecimal("1000000"))
            .price2y(new BigDecimal("1900000"))
            .price3y(new BigDecimal("2700000"))
            .effectiveAt(Instant.parse("2026-01-01T00:00:00Z"));
        save(plan);
        Subscription s = new Subscription().entitlementStatus("ACTIVE").latestEnd(latestEnd);
        s.setFarm(farm);
        s.setPlanVersion(plan);
        return save(s);
    }

    private void paidPeriod(Subscription s, AppUser owner, Instant start, Instant end) {
        Payment p = new Payment();
        p.setQuoteRef("BC" + next());
        p.setDurationYears(1);
        p.setAmountVnd(new BigDecimal("1000000"));
        p.setState("PAID");
        p.setExpiresAt(start.plus(DAY));
        p.setSubscription(s);
        p.setRequestedBy(owner);
        p.setPriceVersion(s.getPlanVersion());
        p.setRequestedAt(start);
        p.setPurchasedStart(start);
        p.setPurchasedEnd(end);
        save(p);
    }

    /** An ACTIVE farm whose purchased period runs from 30 days ago to 200 days ahead. */
    private Instant activePeriod(Farm farm, AppUser owner) {
        Instant now = clock.instant();
        Instant end = now.plus(Duration.ofDays(200));
        paidPeriod(subscription(farm, end), owner, now.minus(Duration.ofDays(30)), end);
        return end;
    }

    private void herd(Farm farm, int active, int exited) {
        Breed b = breed(farm);
        ProductionPurpose p = purpose(farm, PurposeType.FATTENING);
        for (int i = 0; i < active; i++) cattle(farm, b, p, Sex.MALE, LifeStage.ADULT);
        for (int i = 0; i < exited; i++) {
            Cattle c = cattle(farm, b, p, Sex.MALE, LifeStage.ADULT);
            c.setHerdStatus(HerdStatus.EXITED);
        }
        em.flush();
    }

    // ---- HTTP ----

    private RequestPostProcessor as(AppUser user, String key) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(user.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (key != null) processed.addHeader("Idempotency-Key", key);
            return processed;
        };
    }

    private ResultActions overview(AppUser user, String query) throws Exception {
        return mvc.perform(get("/api/platform/farms" + query).with(as(user, null)));
    }

    private JsonNode json(ResultActions result) throws Exception {
        return om.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private Map<String, Object> change(Farm farm, String reason) {
        return Map.of("reason", reason, "version", versionOf(Farm.class, farm.getId()));
    }

    private ResultActions command(AppUser user, Farm farm, String action, Map<String, Object> body, String key) throws Exception {
        return mvc.perform(
            post("/api/platform/farms/{id}/" + action, farm.getId())
                .with(as(user, key))
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsBytes(body))
        );
    }

    private ResultActions command(AppUser user, Farm farm, String action, String reason) throws Exception {
        return command(user, farm, action, change(farm, reason), UUID.randomUUID().toString());
    }

    private long audits(Farm farm, String action) {
        return em.createQuery("select count(a) from AuditLog a where a.farm.id=:f and a.action=:a", Long.class)
            .setParameter("f", farm.getId())
            .setParameter("a", action)
            .getSingleResult();
    }

    private List<String> notices(AppUser owner, Farm farm) {
        return em.createQuery("select n.summary from Notification n where n.recipient.id=:u and n.targetType='Farm' and n.targetId=:f", String.class)
            .setParameter("u", owner.getId())
            .setParameter("f", farm.getId())
            .getResultList();
    }

    private static List<String> names(JsonNode items) {
        List<String> names = new ArrayList<>();
        items.forEach(item -> names.add(item.path("farmName").asText()));
        return names;
    }

    // ---- UC-FE02-04 ----

    /** TC-02-30 (UC-FE02-05 E1): CS, SA, an Owner or a plain account can neither read the overview nor suspend. */
    @Test
    void tc0230OnlyAnActivePmUsesTheFarmServiceApi() throws Exception {
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        for (AppUser outsider : List.of(staff(PlatformRole.CS), staff(PlatformRole.SA), owner, user())) {
            overview(outsider, "").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            mvc.perform(get("/api/platform/farms/{id}", farm.getId()).with(as(outsider, null))).andExpect(status().isForbidden());
            command(outsider, farm, "suspend", "Thử quyền").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        assertThat(audits(farm, "FARM_SERVICE_SUSPEND")).isZero();
    }

    /** TC-02-31 (R-02-11, GBR-11): the overview carries service data only, never cattle or care records. */
    @Test
    void tc0231OverviewCarriesServiceDataOnly() throws Exception {
        Farm farm = named("ACTIVE", "Trại TC31 Một");
        memberWithRole(farm, FarmRole.OWNER);
        herd(farm, 2, 0);
        JsonNode body = json(overview(staff(PlatformRole.PM), "?q=TC31").andExpect(status().isOk()));
        List<String> top = new ArrayList<>();
        body.fieldNames().forEachRemaining(top::add);
        assertThat(top).containsExactlyInAnyOrder("tiles", "items", "total");
        List<String> fields = new ArrayList<>();
        body.path("items").get(0).fieldNames().forEachRemaining(fields::add);
        assertThat(fields).isSubsetOf(
            Set.of("farmId", "farmName", "ownerId", "ownerName", "ownerEmail", "serviceStatus", "coverageEnd", "suspended", "suspendedAt", "activeCattle", "version")
        );
    }

    /** TC-02-32: tiles count every farm by status (ACTIVE with %); the status filter narrows the list only. */
    @Test
    void tc0232TilesCountFarmsByStatusAndTheFilterNarrowsTheList() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        JsonNode before = json(overview(pm, "").andExpect(status().isOk())).path("tiles");
        String[] statuses = { "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "EXPIRED", "EXPIRED", "PENDING_PAYMENT", "SUSPENDED" };
        for (int i = 0; i < statuses.length; i++) memberWithRole(named(statuses[i], "Trại TC32 " + i), FarmRole.OWNER);

        JsonNode tiles = json(overview(pm, "").andExpect(status().isOk())).path("tiles");
        assertThat(tiles.path("total").asLong() - before.path("total").asLong()).isEqualTo(10);
        assertThat(tiles.path("active").asLong() - before.path("active").asLong()).isEqualTo(6);
        assertThat(tiles.path("pendingPayment").asLong() - before.path("pendingPayment").asLong()).isEqualTo(1);
        assertThat(tiles.path("expired").asLong() - before.path("expired").asLong()).isEqualTo(2);
        assertThat(tiles.path("suspended").asLong() - before.path("suspended").asLong()).isEqualTo(1);
        assertThat(tiles.path("activePercent").asLong()).isEqualTo(Math.round(tiles.path("active").asLong() * 100.0 / tiles.path("total").asLong()));

        JsonNode expired = json(overview(pm, "?q=TC32&status=EXPIRED").andExpect(status().isOk()));
        assertThat(expired.path("total").asLong()).isEqualTo(2);
        assertThat(expired.path("tiles").path("total").asLong()).isEqualTo(tiles.path("total").asLong());
    }

    /** SCR-12 field 2: the search matches the farm name or the Owner's email. */
    @Test
    void searchMatchesFarmNameOrOwnerEmail() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = named("ACTIVE", "Trại Tìm Kiếm Sông Đà");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        named("ACTIVE", "Trại Khác Hẳn");
        assertThat(names(json(overview(pm, "?q=sông đà")).path("items"))).containsExactly("Trại Tìm Kiếm Sông Đà");
        assertThat(names(json(overview(pm, "?q=" + owner.getEmail().toUpperCase())).path("items"))).containsExactly("Trại Tìm Kiếm Sông Đà");
    }

    /** SCR-12 fields 4-9: Owner, ACTIVE cattle, latest confirmed end, suspension and date; sortable by name and coverage end. */
    @Test
    void listShowsOwnerHerdCoverageAndSuspensionAndSorts() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm early = named("ACTIVE", "Trại TCS B");
        AppUser earlyOwner = memberWithRole(early, FarmRole.OWNER);
        Instant earlyEnd = clock.instant().plus(Duration.ofDays(20));
        paidPeriod(subscription(early, earlyEnd), earlyOwner, clock.instant().minus(DAY), earlyEnd);
        herd(early, 3, 2);
        Farm late = named("ACTIVE", "Trại TCS A");
        AppUser lateOwner = memberWithRole(late, FarmRole.OWNER);
        activePeriod(late, lateOwner);
        Farm none = named("PENDING_PAYMENT", "Trại TCS C");
        memberWithRole(none, FarmRole.OWNER);
        command(pm, late, "suspend", "Kiểm tra hồ sơ").andExpect(status().isOk());

        JsonNode items = json(overview(pm, "?q=TCS&sort=coverageEnd")).path("items");
        assertThat(names(items)).containsExactly("Trại TCS B", "Trại TCS A", "Trại TCS C");
        JsonNode b = items.get(0);
        assertThat(b.path("ownerName").asText()).isEqualTo(earlyOwner.getFullName());
        assertThat(b.path("ownerEmail").asText()).isEqualTo(earlyOwner.getEmail());
        assertThat(b.path("activeCattle").asLong()).isEqualTo(3);
        assertThat(Instant.parse(b.path("coverageEnd").asText())).isEqualTo(earlyEnd);
        assertThat(b.path("suspended").asBoolean()).isFalse();
        JsonNode a = items.get(1);
        assertThat(a.path("suspended").asBoolean()).isTrue();
        assertThat(Instant.parse(a.path("suspendedAt").asText())).isEqualTo(clock.instant());
        assertThat(items.get(2).path("coverageEnd").isNull()).isTrue();

        assertThat(names(json(overview(pm, "?q=TCS&sort=-name")).path("items"))).containsExactly("Trại TCS C", "Trại TCS B", "Trại TCS A");
        assertThat(names(json(overview(pm, "?q=TCS")).path("items"))).containsExactly("Trại TCS A", "Trại TCS B", "Trại TCS C");
        overview(pm, "?sort=cattle").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("sort"));
    }

    // ---- UC-FE02-05 ----

    /** Popup, restore: when, by whom and why it was suspended, the purchased period and the status after restore. */
    @Test
    void previewShowsTheSuspensionThePeriodAndTheStatusAfterRestore() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant end = activePeriod(farm, owner);
        herd(farm, 4, 0);
        command(pm, farm, "suspend", "Vi phạm điều khoản sử dụng").andExpect(status().isOk());

        JsonNode preview = json(mvc.perform(get("/api/platform/farms/{id}", farm.getId()).with(as(pm, null))).andExpect(status().isOk()));
        assertThat(preview.path("farmName").asText()).isEqualTo(farm.getName());
        assertThat(preview.path("ownerName").asText()).isEqualTo(owner.getFullName());
        assertThat(preview.path("activeCattle").asLong()).isEqualTo(4);
        assertThat(preview.path("serviceStatus").asText()).isEqualTo("SUSPENDED");
        assertThat(Instant.parse(preview.path("suspendedAt").asText())).isEqualTo(clock.instant());
        assertThat(preview.path("suspendedBy").asText()).isEqualTo(pm.getFullName());
        assertThat(preview.path("previousReason").asText()).isEqualTo("Vi phạm điều khoản sử dụng");
        assertThat(Instant.parse(preview.path("periodStart").asText())).isEqualTo(clock.instant().minus(Duration.ofDays(30)));
        assertThat(Instant.parse(preview.path("periodEnd").asText())).isEqualTo(end);
        assertThat(Instant.parse(preview.path("coverageEnd").asText())).isEqualTo(end);
        assertThat(preview.path("statusAfterRestore").asText()).isEqualTo("ACTIVE");
        assertThat(preview.path("version").asInt()).isEqualTo(versionOf(Farm.class, farm.getId()));
    }

    /** TC-02-20 (R-02-09, GBR-15): suspension keeps the period, writes one history / audit entry and notifies the Owner. */
    @Test
    void tc0220SuspendKeepsThePeriodWritesHistoryAndNotifiesTheOwner() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant end = activePeriod(farm, owner);

        command(pm, farm, "suspend", "Nghi ngờ dùng sai mục đích")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.serviceStatus").value("SUSPENDED"))
            .andExpect(jsonPath("$.suspended").value(true));
        assertThat(audits(farm, "FARM_SERVICE_SUSPEND")).isEqualTo(1);
        String details = em.createQuery("select a.details from AuditLog a where a.farm.id=:f and a.action='FARM_SERVICE_SUSPEND'", String.class)
            .setParameter("f", farm.getId())
            .getSingleResult();
        assertThat(details).contains("\"statusBefore\":\"ACTIVE\"").contains("Nghi ngờ dùng sai mục đích");
        assertThat(em.find(Subscription.class, em.createQuery("select s.id from Subscription s where s.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).getLatestEnd()).isEqualTo(end);
        assertThat(notices(owner, farm)).singleElement().asString().contains("Tạm ngưng").contains("Nghi ngờ dùng sai mục đích");
    }

    /** TC-02-21 (R-02-10, GBR-09): a member loses farm operations at the very next request. */
    @Test
    void tc0221MembersLoseFarmOperationsAtTheirNextRequest() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("ACTIVE");
        memberWithRole(farm, FarmRole.OWNER);
        AppUser technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        mvc.perform(get("/api/farms/{id}/catalogues", farm.getId()).with(as(technician, null))).andExpect(status().isOk());
        command(pm, farm, "suspend", "Tạm khóa").andExpect(status().isOk());
        mvc.perform(get("/api/farms/{id}/catalogues", farm.getId()).with(as(technician, null)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-COM-12"));
    }

    /** TC-02-23: restoring a farm whose purchased period still runs gives ACTIVE; the period is not changed. */
    @Test
    void tc0223RestoreWithARunningPeriodIsActiveAndKeepsThePeriod() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("SUSPENDED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant end = activePeriod(farm, owner);
        command(pm, farm, "restore", "Đã xác minh").andExpect(status().isOk()).andExpect(jsonPath("$.serviceStatus").value("ACTIVE"));
        assertThat(em.createQuery("select s.latestEnd from Subscription s where s.farm.id=:f", Instant.class).setParameter("f", farm.getId()).getSingleResult()).isEqualTo(end);
        assertThat(audits(farm, "FARM_SERVICE_RESTORE")).isEqualTo(1);
        assertThat(notices(owner, farm)).singleElement().asString().contains("Đang hoạt động");
    }

    /** TC-02-24 (AF2): restoring a farm that never had an accepted payment gives PENDING_PAYMENT, with or without a subscription row. */
    @Test
    void tc0224RestoreWithoutAnyPaymentIsPendingPayment() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm noSubscription = farm("SUSPENDED");
        memberWithRole(noSubscription, FarmRole.OWNER);
        command(pm, noSubscription, "restore", "Mở lại").andExpect(status().isOk()).andExpect(jsonPath("$.serviceStatus").value("PENDING_PAYMENT"));
        Farm requestedOnly = farm("SUSPENDED");
        memberWithRole(requestedOnly, FarmRole.OWNER);
        subscription(requestedOnly, null);
        command(pm, requestedOnly, "restore", "Mở lại").andExpect(status().isOk()).andExpect(jsonPath("$.serviceStatus").value("PENDING_PAYMENT"));
    }

    /** TC-02-25 (AF2): restoring a farm whose period has ended gives EXPIRED. */
    @Test
    void tc0225RestoreAfterThePeriodEndedIsExpired() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("SUSPENDED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant end = clock.instant().minus(Duration.ofDays(3));
        paidPeriod(subscription(farm, end), owner, end.minus(Duration.ofDays(365)), end);
        command(pm, farm, "restore", "Mở lại").andExpect(status().isOk()).andExpect(jsonPath("$.serviceStatus").value("EXPIRED"));
    }

    /** TC-02-26 (PRE-2): a farm still waiting for its first payment can be suspended. */
    @Test
    void tc0226PendingPaymentFarmCanBeSuspended() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("PENDING_PAYMENT");
        memberWithRole(farm, FarmRole.OWNER);
        command(pm, farm, "suspend", "Thông tin đăng ký sai").andExpect(status().isOk()).andExpect(jsonPath("$.serviceStatus").value("SUSPENDED"));
    }

    /** TC-02-27 (E3, R-02-08): already in the requested state gives MSG-FE02-09 and no new record. */
    @Test
    void tc0227AlreadyInTheRequestedStateIsRefusedWithoutANewRecord() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm suspended = farm("SUSPENDED");
        memberWithRole(suspended, FarmRole.OWNER);
        command(pm, suspended, "suspend", "Lần hai")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE02-09"))
            .andExpect(jsonPath("$.params.farm").value(suspended.getName()))
            .andExpect(jsonPath("$.params.status").value("SUSPENDED"));
        assertThat(audits(suspended, "FARM_SERVICE_SUSPEND")).isZero();
        Farm active = farm("ACTIVE");
        memberWithRole(active, FarmRole.OWNER);
        command(pm, active, "restore", "Không cần")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE02-09"))
            .andExpect(jsonPath("$.params.status").value("ACTIVE"));
        assertThat(audits(active, "FARM_SERVICE_RESTORE")).isZero();
    }

    /** TC-02-28: the reason is required and at most 500 characters; a 500-character reason still notifies the Owner. */
    @Test
    void tc0228ReasonIsRequiredAndAtMost500Characters() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        command(pm, farm, "suspend", "   ").andExpect(status().isBadRequest());
        command(pm, farm, "suspend", "x".repeat(501)).andExpect(status().isBadRequest());
        command(pm, farm, "suspend", "x".repeat(500)).andExpect(status().isOk());
        assertThat(notices(owner, farm)).singleElement().asString().hasSizeLessThanOrEqualTo(500);
    }

    /** E4: saving with the version read before another session changed the farm gives MSG-COM-05. */
    @Test
    void e4StaleVersionIsRefused() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("ACTIVE");
        memberWithRole(farm, FarmRole.OWNER);
        Map<String, Object> stale = Map.of("reason", "Cũ", "version", versionOf(Farm.class, farm.getId()) - 1);
        command(pm, farm, "suspend", stale, UUID.randomUUID().toString()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    /** GBR-88 / TC-02-29: re-sending with the same request key returns the first result: one change, one notice. */
    @Test
    void sameRequestKeyReplaysTheFirstResult() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Map<String, Object> body = change(farm, "Gửi lại");
        JsonNode first = json(command(pm, farm, "suspend", body, "uc05-key").andExpect(status().isOk()));
        JsonNode again = json(command(pm, farm, "suspend", body, "uc05-key").andExpect(status().isOk()));
        assertThat(again.path("version").asInt()).isEqualTo(first.path("version").asInt());
        assertThat(audits(farm, "FARM_SERVICE_SUSPEND")).isEqualTo(1);
        assertThat(notices(owner, farm)).hasSize(1);
    }
}
