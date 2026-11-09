package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
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
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * HTTP contract of {@code GET} and {@code PUT /api/farms/{farmId}} (UC-FE02-03, SCR-11): Owner only (GBR-07), in every
 * service status, field rules as SCR-10 plus the operating fields, the version check (MSG-COM-05), the request key, and
 * the read-only service summary. Decisions 08/11/2026: Q1 flow from SCR-11, Q2 only the three UTC+7 time zones offered,
 * Q4 days remaining still shown while SUSPENDED.
 */
@ServiceIntegrationTest
@Transactional
class FarmInformationResourceTest extends DomainTestSupport {

    private static final Duration DAY = Duration.ofDays(1);

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    private RequestPostProcessor as(AppUser user, String key) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(user.getEmail()).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (key != null) processed.addHeader("Idempotency-Key", key);
            return processed;
        };
    }

    private ResultActions getFarm(AppUser user, Farm farm) throws Exception {
        return mvc.perform(get("/api/farms/{id}", farm.getId()).with(as(user, null)));
    }

    private ResultActions putFarm(AppUser user, Farm farm, Map<String, Object> body, String key) throws Exception {
        return mvc.perform(
            put("/api/farms/{id}", farm.getId()).with(as(user, key)).contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(body))
        );
    }

    private ResultActions putFarm(AppUser user, Farm farm, Map<String, Object> body) throws Exception {
        return putFarm(user, farm, body, UUID.randomUUID().toString());
    }

    /** A valid SCR-11 form for the farm's current version; {@code changes} overrides fields (a null value sends JSON null). */
    private Map<String, Object> form(Farm farm, Object... changes) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Trại Yên Bài");
        body.put("province", "Hà Nội");
        body.put("commune", "Xã Yên Bài");
        body.put("detailedAddress", "Thôn Muỗi");
        body.put("contactPerson", "Nguyễn Văn Hùng");
        body.put("contactPhone", "0912345678");
        body.put("registrationCertificateInfo", "GCN 12/GCN-TT");
        body.put("timeZone", "Asia/Ho_Chi_Minh");
        body.put("morningShiftStart", "05:30");
        body.put("operatingNotes", "Cho ăn 2 bữa");
        body.put("expectedVersion", versionOf(Farm.class, farm.getId()));
        for (int i = 0; i < changes.length; i += 2) body.put((String) changes[i], changes[i + 1]);
        return body;
    }

    private JsonNode json(ResultActions result) throws Exception {
        return om.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private long audits(Farm farm, String action) {
        return em.createQuery("select count(a) from AuditLog a where a.farm.id=:f and a.action=:a", Long.class)
            .setParameter("f", farm.getId())
            .setParameter("a", action)
            .getSingleResult();
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

    private void suspendedBy(Farm farm, AppUser pm, Instant at) {
        AuditLog a = new AuditLog();
        a.setFarm(farm);
        a.setActor(pm);
        a.setAction("FARM_SERVICE_SUSPEND");
        a.setTargetType("Farm");
        a.setTargetId(farm.getId());
        a.setLoggedAt(at);
        a.setDetails("{}");
        save(a);
    }

    /** TC-02-17 (GBR-07): a Manager or Technician can neither read nor update SCR-11; the farm is unchanged. */
    @Test
    void tc0217OnlyTheOwnerReadsAndUpdatesFarmInformation() throws Exception {
        Farm farm = farm();
        for (FarmRole role : new FarmRole[] { FarmRole.MANAGER, FarmRole.TECHNICIAN }) {
            AppUser member = memberWithRole(farm, role);
            getFarm(member, farm).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            putFarm(member, farm, form(farm)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        assertThat(audits(farm, "FARM_UPDATE")).isZero();
    }

    /** SCR-11 "in any service status" (GBR-14): the Owner saves registration, contact and operating information. */
    @Test
    void ownerUpdatesFarmInformationInEveryServiceStatus() throws Exception {
        for (String status : new String[] { "ACTIVE", "PENDING_PAYMENT", "EXPIRED", "SUSPENDED" }) {
            Farm farm = farm(status);
            AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            putFarm(owner, farm, form(farm, "name", "Trại " + status, "timeZone", "Asia/Bangkok"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Trại " + status))
                .andExpect(jsonPath("$.province").value("Hà Nội"))
                .andExpect(jsonPath("$.timeZone").value("Asia/Bangkok"))
                .andExpect(jsonPath("$.morningShiftStart").value("05:30:00"))
                .andExpect(jsonPath("$.serviceStatus").value(status));
            assertThat(audits(farm, "FARM_UPDATE")).as(status).isEqualTo(1);
        }
    }

    /** TC-02-18: operating notes at most 1,000 characters; morning shift start is a valid HH:mm time. */
    @Test
    void tc0218OperatingNotesAndMorningShiftLimits() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        putFarm(owner, farm, form(farm, "operatingNotes", "x".repeat(1001))).andExpect(status().isBadRequest());
        putFarm(owner, farm, form(farm, "morningShiftStart", "25:00")).andExpect(status().isBadRequest());
        putFarm(owner, farm, form(farm, "operatingNotes", "x".repeat(1000))).andExpect(status().isOk());
    }

    /** TC-02-19: the second person saves with the version they opened, after the first one saved: MSG-COM-05. */
    @Test
    void tc0219SavingWithAnOldVersionIsRejected() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Map<String, Object> opened = form(farm);
        putFarm(owner, farm, form(farm, "name", "Người thứ nhất")).andExpect(status().isOk());
        opened.put("name", "Người thứ hai");
        putFarm(owner, farm, opened).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    /** GBR-88: re-sending the same save with the same request key returns the first result, not MSG-COM-05. */
    @Test
    void sameRequestKeyReturnsTheFirstResult() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Map<String, Object> body = form(farm, "name", "Trại lưu một lần");
        JsonNode first = json(putFarm(owner, farm, body, "uc03-key").andExpect(status().isOk()));
        JsonNode again = json(putFarm(owner, farm, body, "uc03-key").andExpect(status().isOk()));
        assertThat(again.path("version").asInt()).isEqualTo(first.path("version").asInt());
        assertThat(audits(farm, "FARM_UPDATE")).isEqualTo(1);
    }

    /** Decision FE-02 Q3 applies to SCR-11 too: one of the 34 provinces and centrally-run cities, stored by name. */
    @Test
    void provinceMustBeOneOfTheThirtyFourProvinces() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        putFarm(owner, farm, form(farm, "province", "Hà Tây"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.field").value("province"));
        putFarm(owner, farm, form(farm, "province", " Phú Thọ ")).andExpect(status().isOk()).andExpect(jsonPath("$.province").value("Phú Thọ"));
    }

    /** Decision FE-02 Q2: only the UTC+7 time zones offered on SCR-11; blank means Asia/Ho_Chi_Minh. */
    @Test
    void timeZoneMustBeOneOfTheOfferedZones() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        putFarm(owner, farm, form(farm, "timeZone", "Europe/London"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.field").value("timeZone"));
        putFarm(owner, farm, form(farm, "timeZone", "Asia/Vientiane")).andExpect(status().isOk()).andExpect(jsonPath("$.timeZone").value("Asia/Vientiane"));
        putFarm(owner, farm, form(farm, "timeZone", "")).andExpect(status().isOk()).andExpect(jsonPath("$.timeZone").value("Asia/Ho_Chi_Minh"));
    }

    /** SCR-11: a blank optional field means "not provided"; the Owner's phone is a registration default only. */
    @Test
    void blankOptionalFieldsAreNotProvided() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        putFarm(owner, farm, form(farm, "contactPerson", "", "contactPhone", "", "detailedAddress", " ", "registrationCertificateInfo", ""))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contactPerson").doesNotExist())
            .andExpect(jsonPath("$.contactPhone").doesNotExist())
            .andExpect(jsonPath("$.detailedAddress").doesNotExist())
            .andExpect(jsonPath("$.registrationCertificateInfo").doesNotExist());
    }

    /** SCR-11 has no main-breed field: saving without it keeps the main breeds, even one later made unavailable. */
    @Test
    void mainBreedsAreKeptWhenTheFormDoesNotSendThem() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Breed main = breed(farm);
        farm.setMainBreeds(Set.of(main));
        main.setAvailable(false);
        em.flush();
        putFarm(owner, farm, form(farm)).andExpect(status().isOk()).andExpect(jsonPath("$.mainBreedIds[0]").value(main.getId()));
    }

    /** SCR-11 service summary of an ACTIVE farm with a future period: current period end, renewal date, days left, Owner. */
    @Test
    void serviceSummaryOfAnActiveFarm() throws Exception {
        Farm farm = farm("ACTIVE");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant now = clock.instant();
        Instant currentEnd = now.plus(Duration.ofDays(40)).plus(Duration.ofHours(1));
        Instant latestEnd = currentEnd.plus(Duration.ofDays(365));
        Subscription s = subscription(farm, latestEnd);
        paidPeriod(s, owner, now.minus(Duration.ofDays(30)), currentEnd);
        paidPeriod(s, owner, currentEnd, latestEnd);

        JsonNode farmInfo = json(getFarm(owner, farm).andExpect(status().isOk()));
        assertThat(Instant.parse(farmInfo.path("currentPeriodUntil").asText())).isEqualTo(currentEnd);
        assertThat(Instant.parse(farmInfo.path("renewalOpensAt").asText())).isEqualTo(latestEnd.minus(Duration.ofDays(90)));
        assertThat(farmInfo.path("daysRemaining").asLong()).isEqualTo(40);
        assertThat(farmInfo.path("suspendedAt").isNull()).isTrue();
        assertThat(farmInfo.path("ownerName").asText()).isEqualTo(owner.getFullName());
        assertThat(farmInfo.path("ownerEmail").asText()).isEqualTo(owner.getEmail());
    }

    /** Decision Q4: while SUSPENDED the purchased period keeps running, so days remaining are still shown, with the date. */
    @Test
    void q4SuspendedFarmStillShowsTheDaysRemainingOfItsPeriod() throws Exception {
        Farm farm = farm("SUSPENDED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant now = clock.instant();
        Instant end = now.plus(Duration.ofDays(60)).plus(Duration.ofHours(1));
        paidPeriod(subscription(farm, end), owner, now.minus(Duration.ofDays(100)), end);
        Instant suspended = now.minus(Duration.ofDays(2));
        suspendedBy(farm, user(), suspended);

        JsonNode farmInfo = json(getFarm(owner, farm).andExpect(status().isOk()));
        assertThat(farmInfo.path("daysRemaining").asLong()).isEqualTo(60);
        assertThat(Instant.parse(farmInfo.path("suspendedAt").asText())).isEqualTo(suspended);
    }

    /** EXPIRED: no current period, so neither its end nor days remaining; the renewal date still follows the latest end. */
    @Test
    void expiredFarmHasNoCurrentPeriod() throws Exception {
        Farm farm = farm("EXPIRED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        Instant now = clock.instant();
        Instant end = now.minus(Duration.ofDays(35));
        paidPeriod(subscription(farm, end), owner, now.minus(Duration.ofDays(400)), end);

        JsonNode farmInfo = json(getFarm(owner, farm).andExpect(status().isOk()));
        assertThat(farmInfo.path("currentPeriodUntil").isNull()).isTrue();
        assertThat(farmInfo.path("daysRemaining").isNull()).isTrue();
        assertThat(Instant.parse(farmInfo.path("renewalOpensAt").asText())).isEqualTo(end.minus(Duration.ofDays(90)));
    }

    /** PENDING_PAYMENT: nothing purchased yet, the summary is empty but the Owner is shown. */
    @Test
    void pendingFarmHasAnEmptySummary() throws Exception {
        Farm farm = farm("PENDING_PAYMENT");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        JsonNode farmInfo = json(getFarm(owner, farm).andExpect(status().isOk()));
        assertThat(farmInfo.path("currentPeriodUntil").isNull()).isTrue();
        assertThat(farmInfo.path("renewalOpensAt").isNull()).isTrue();
        assertThat(farmInfo.path("daysRemaining").isNull()).isTrue();
        assertThat(farmInfo.path("ownerEmail").asText()).isEqualTo(owner.getEmail());
    }
}
