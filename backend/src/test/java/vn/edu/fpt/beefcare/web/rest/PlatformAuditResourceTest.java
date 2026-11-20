package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.InternalSupportRequestService;
import vn.edu.fpt.beefcare.service.SupportTicketCommandService;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;
import vn.edu.fpt.beefcare.service.payment.SubscriptionLifecycleJob;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE17-01 / SCR-51 (D34) over HTTP with the real security chain and database: SA only, central actions only, the
 * date range in farm days, filters, order, paging, errors, read-only routes, and the entries written by real commands
 * (account suspension, ticket workflow, JOB-04). Commit / rollback and key replay: {@code PlatformAuditTransactionTest};
 * payment acceptance: {@code PlatformReconciliationResourceTest}.
 */
@ServiceIntegrationTest
@Transactional
class PlatformAuditResourceTest extends DomainTestSupport {
    static final String BASE = "/api/platform/audit";
    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Seeded rows use a day no command of the test suite writes on. */
    static final LocalDate DAY = LocalDate.of(2031, 3, 10);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired EntityManagerFactory entityManagerFactory;
    @Autowired SupportTicketCommandService tickets;
    @Autowired InternalSupportRequestService internalRequests;
    @Autowired SubscriptionLifecycleJob lifecycle;

    private AppUser staff(String role, String status) {
        AppUser user = user();
        save(new PlatformStaffAccess().user(user).role(role).status(status));
        return user;
    }

    private AppUser named(AppUser account, String fullName) {
        account.setFullName(fullName);
        em.flush();
        return account;
    }

    private AuditLog entry(String action, String targetType, Long targetId, AppUser actor, Farm farm, Instant at, String details) {
        AuditLog entry = new AuditLog();
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setActor(actor);
        entry.setFarm(farm);
        entry.setLoggedAt(at);
        entry.setDetails(details);
        entry.setActorRole(actor == null ? null : "SA");
        entry.setCorrelationId("seed-" + next() + "-correlation");
        return save(entry);
    }

    private static Instant at(LocalDate day, int hour, int minute) {
        return day.atTime(hour, minute).atZone(ZONE).toInstant();
    }

    private ResultActions read(AppUser caller, String path, Object... params) throws Exception {
        em.flush(); em.clear();
        MockHttpServletRequestBuilder request = get(path);
        for (int i = 0; i < params.length; i += 2) request.param((String) params[i], String.valueOf(params[i + 1]));
        return mvc.perform(caller == null ? request : request.with(SecurityMockMvcRequestPostProcessors.user(caller.getEmail())));
    }

    private ResultActions list(AppUser caller, LocalDate from, LocalDate to, Object... params) throws Exception {
        List<Object> all = new ArrayList<>(List.of("from", from, "to", to));
        all.addAll(List.of(params));
        return read(caller, BASE, all.toArray());
    }

    private JsonNode json(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private static List<String> values(JsonNode items, String field) {
        List<String> values = new ArrayList<>();
        items.forEach(item -> values.add(item.path(field).asText()));
        return values;
    }

    private static List<Long> ids(JsonNode items) {
        List<Long> ids = new ArrayList<>();
        items.forEach(item -> ids.add(item.path("id").asLong()));
        return ids;
    }

    /** TC-17-01 (R-17-03): PM, CS, an Owner and a revoked SA get MSG-COM-01 on A1, A2 and A3; no session is 401. */
    @Test
    void onlyAnActiveSystemAdminReadsTheCentralAudit() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        AuditLog row = entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY, 9, 0), "{\"statusBefore\":\"ACTIVE\",\"statusAfter\":\"SUSPENDED\"}");
        Farm farm = farm();
        AppUser owner = user();
        member(farm, owner, "OWNER", "ACTIVE");
        for (AppUser refused : List.of(staff("PM", "ACTIVE"), staff("CS", "ACTIVE"), owner, staff("SA", "REVOKED"))) {
            list(refused, DAY, DAY).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            read(refused, BASE + "/" + row.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
            read(refused, BASE + "/actions").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        list(null, DAY, DAY).andExpect(status().isUnauthorized());
        list(admin, DAY, DAY).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
    }

    /** A3: the Action filter lists the catalogue codes with their target type. */
    @Test
    void listsTheActionCodesOfTheFilter() throws Exception {
        JsonNode actions = json(read(staff("SA", "ACTIVE"), BASE + "/actions").andExpect(status().isOk()));
        assertThat(values(actions, "code")).startsWith("ACCOUNT_SUSPENDED", "ACCOUNT_RESTORED")
            .contains("PLATFORM_ACCESS_GRANTED", "MEMBERSHIP_ROLE_CHANGED", "FARM_SERVICE_RESTORED", "PAYMENT_CONFIRMED", "FINANCE_RECORD_POSTED", "TICKET_CLOSED")
            .doesNotContain("PLAN_PRICE_PUBLISHED", "HEALTH_CASE_OPEN", "MEMBER_INVITE");
        assertThat(actions.get(0).path("targetType").asText()).isEqualTo("ACCOUNT");
    }

    /**
     * TC-17-02 (R-17-01, D34 K4 / K5): an SA suspends an account; one entry with the SA's role, the request's correlation
     * ID, the target's name and the status before / after – not the reason.
     */
    @Test
    void suspendingAnAccountWritesOneEntryWithRoleCorrelationIdAndAllowlistedValues() throws Exception {
        AppUser admin = named(staff("SA", "ACTIVE"), "Trần Quản Trị");
        AppUser target = named(user(), "Lê Văn Khách");
        User identity = new User();
        identity.setLogin("fe17-" + next());
        identity.setPassword("x".repeat(60));
        identity.setEmail(target.getEmail());
        identity.setActivated(true);
        identity.setLangKey("vi");
        identity.setCreatedBy("system");
        save(identity);
        long version = em.createQuery("select u.version from AppUser u where u.id=:id", Long.class).setParameter("id", target.getId()).getSingleResult();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reason", "Nghi ngờ lộ mật khẩu");
        body.put("version", version);
        em.flush(); em.clear();
        mvc.perform(post("/api/platform/accounts/{id}/suspend", target.getId()).with(csrf()).with(SecurityMockMvcRequestPostProcessors.user(admin.getEmail()))
                .header("Idempotency-Key", "fe17-suspend").header("X-Request-Id", "fe17-request-000001")
                .contentType("application/json").content(mapper.writeValueAsString(body)))
            .andExpect(status().isOk()).andExpect(header().string("X-Request-Id", "fe17-request-000001"));

        JsonNode page = json(list(admin, TODAY, TODAY, "action", "ACCOUNT_SUSPENDED", "actor", "quản trị").andExpect(status().isOk()));
        assertThat(page.path("total").asLong()).isEqualTo(1);
        JsonNode row = page.path("items").get(0);
        assertThat(row.path("action").asText()).isEqualTo("ACCOUNT_SUSPENDED");
        assertThat(row.path("targetType").asText()).isEqualTo("ACCOUNT");
        assertThat(row.path("targetLabel").asText()).isEqualTo("Lê Văn Khách");
        assertThat(row.path("actor").path("name").asText()).isEqualTo("Trần Quản Trị");
        assertThat(row.path("actor").path("initials").asText()).isEqualTo("TT");
        assertThat(row.path("actor").path("role").asText()).isEqualTo("SA");

        ResultActions detailResult = read(admin, BASE + "/" + row.path("id").asLong()).andExpect(status().isOk());
        String raw = detailResult.andReturn().getResponse().getContentAsString();
        JsonNode detail = mapper.readTree(raw);
        assertThat(detail.path("targetId").asLong()).isEqualTo(target.getId());
        assertThat(detail.path("before").path("status").asText()).isEqualTo("ACTIVE");
        assertThat(detail.path("after").path("status").asText()).isEqualTo("SUSPENDED");
        assertThat(detail.path("correlationId").asText()).isEqualTo("fe17-request-000001");
        assertThat(detail.path("farm").isNull()).isTrue();
        assertThat(raw).doesNotContain("Nghi ngờ lộ mật khẩu").doesNotContain("reason");
    }

    /** A request without (or with an unusable) X-Request-Id gets a new one, returned in the header. */
    @Test
    void everyResponseCarriesACorrelationId() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        String issued = list(admin, DAY, DAY).andExpect(status().isOk()).andReturn().getResponse().getHeader("X-Request-Id");
        assertThat(issued).hasSize(36);
        em.flush(); em.clear();
        String replaced = mvc.perform(get(BASE).param("from", DAY.toString()).param("to", DAY.toString()).header("X-Request-Id", "bad id with spaces")
            .with(SecurityMockMvcRequestPostProcessors.user(admin.getEmail()))).andExpect(status().isOk()).andReturn().getResponse().getHeader("X-Request-Id");
        assertThat(replaced).hasSize(36).isNotEqualTo(issued);
    }

    /**
     * K1 / R-17-05 / R-17-06: farm data and excluded platform actions never appear; days are farm-zone days with both ends
     * included; newest first, reversible; ties keep the id order.
     */
    @Test
    void listsOnlyCentralActionsOfTheFarmDaysNewestFirst() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        Farm farm = farm();
        AuditLog firstMinute = entry("ACCOUNT_RESTORE", "AppUser", admin.getId(), admin, null, at(DAY, 0, 0), "{}");
        AuditLog morning = entry("FARM_SERVICE_SUSPEND", "Farm", farm.getId(), admin, farm, at(DAY, 8, 0), "{\"statusBefore\":\"ACTIVE\",\"statusAfter\":\"SUSPENDED\",\"reason\":\"Vi phạm\"}");
        AuditLog sameTimeA = entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY, 10, 0), "{}");
        AuditLog sameTimeB = entry("ACCOUNT_RESTORE", "AppUser", admin.getId(), admin, null, at(DAY, 10, 0), "{}");
        AuditLog lastMinute = entry("FARM_SERVICE_RESTORE", "Farm", farm.getId(), admin, farm, at(DAY, 23, 59), "{}");
        AuditLog clinical = entry("HEALTH_CASE_OPEN", "HealthCase", 1L, admin, farm, at(DAY, 9, 0), "{\"cattleId\":7}");
        entry("VACCINATION_RECORD_BATCH", "Vaccination", 2L, admin, farm, at(DAY, 9, 30), "{}");
        entry("MEMBER_INVITE", "FarmInvitation", 3L, admin, farm, at(DAY, 9, 40), "{\"role\":\"MANAGER\"}");
        entry("PLAN_PRICE_PUBLISH", "PlanVersion", 4L, admin, null, at(DAY, 9, 50), "{}");
        entry("SUPPORT_REPLY", "SupportTicket", 5L, admin, null, at(DAY, 9, 55), "{\"status\":\"OPEN\"}");
        entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY, 0, 0).minusSeconds(1), "{}");
        entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY.plusDays(1), 0, 0), "{}");

        JsonNode newest = json(list(admin, DAY, DAY).andExpect(status().isOk()));
        assertThat(newest.path("total").asLong()).isEqualTo(5);
        assertThat(newest.path("page").asInt()).isZero();
        assertThat(newest.path("size").asInt()).isEqualTo(20);
        assertThat(ids(newest.path("items"))).containsExactly(lastMinute.getId(), sameTimeB.getId(), sameTimeA.getId(), morning.getId(), firstMinute.getId());
        JsonNode oldest = json(list(admin, DAY, DAY, "dir", "asc").andExpect(status().isOk()));
        assertThat(ids(oldest.path("items"))).containsExactly(firstMinute.getId(), morning.getId(), sameTimeA.getId(), sameTimeB.getId(), lastMinute.getId());
        assertThat(values(newest.path("items"), "action")).containsExactly(
            "FARM_SERVICE_RESTORED", "ACCOUNT_RESTORED", "ACCOUNT_SUSPENDED", "FARM_SERVICE_SUSPENDED", "ACCOUNT_RESTORED");
        assertThat(newest.path("items").get(0).path("targetLabel").asText()).isEqualTo(farm.getName());

        // An entry outside the central audit cannot be opened either (GBR-86): not found, like a missing one
        read(admin, BASE + "/" + clinical.getId()).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        read(admin, BASE + "/999999999").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        JsonNode suspended = json(read(admin, BASE + "/" + morning.getId()).andExpect(status().isOk()));
        assertThat(suspended.path("farm").path("name").asText()).isEqualTo(farm.getName());
        assertThat(suspended.path("before").path("status").asText()).isEqualTo("ACTIVE");
        assertThat(suspended.path("after").path("status").asText()).isEqualTo("SUSPENDED");
        assertThat(suspended.toString()).doesNotContain("Vi phạm");
    }

    /** TC-17-13 / TC-17-14 and the Actor search (name or email, case-insensitive, or "System"). */
    @Test
    void filtersByActionTargetTypeActorAndSystem() throws Exception {
        AppUser admin = named(staff("SA", "ACTIVE"), "Phạm Thị Quản Trị");
        AppUser pm = named(staff("PM", "ACTIVE"), "Đỗ Văn Tài Chính");
        Farm farm = farm();
        AuditLog paidByPm = entry("PM_ACCEPT_PAYMENT_PAID", "Payment", 11L, pm, farm, at(DAY, 9, 0), "{\"amountVnd\":1200000}");
        AuditLog paidBySepay = entry("SEPAY_PAYMENT_PAID", "Payment", 12L, null, farm, at(DAY, 9, 5), "{\"amountVnd\":1200000}");
        AuditLog reviewed = entry("EVIDENCE_REVIEW", "EvidenceReview", 13L, pm, farm, at(DAY, 9, 10), "{\"decision\":\"ACCEPT\"}");
        entry("SEPAY_EVIDENCE", "BankTransferEvidence", 14L, null, farm, at(DAY, 9, 15), "{\"providerTxnId\":\"FT1\"}");
        AuditLog job = entry("SERVICE_STATUS_JOB", "Farm", farm.getId(), null, farm, at(DAY, 9, 20), "{\"statusBefore\":\"ACTIVE\",\"statusAfter\":\"EXPIRED\"}");
        AuditLog suspended = entry("ACCOUNT_SUSPEND", "AppUser", pm.getId(), admin, null, at(DAY, 9, 25), "{}");

        JsonNode confirmed = json(list(admin, DAY, DAY, "action", "PAYMENT_CONFIRMED", "targetType", "PAYMENT").andExpect(status().isOk()));
        assertThat(ids(confirmed.path("items"))).containsExactly(paidBySepay.getId(), paidByPm.getId());
        assertThat(values(confirmed.path("items"), "action")).containsOnly("PAYMENT_CONFIRMED");
        assertThat(ids(json(list(admin, DAY, DAY, "targetType", "payment").andExpect(status().isOk())).path("items")))
            .containsExactly(reviewed.getId(), paidBySepay.getId(), paidByPm.getId());
        assertThat(json(list(admin, DAY, DAY, "action", "PAYMENT_CONFIRMED", "targetType", "TICKET").andExpect(status().isOk())).path("total").asLong()).isZero();

        JsonNode system = json(list(admin, DAY, DAY, "system", true).andExpect(status().isOk()));
        assertThat(ids(system.path("items"))).containsExactly(job.getId(), paidBySepay.getId());
        assertThat(system.path("items").get(0).path("actor").isNull()).isTrue();
        assertThat(system.path("items").get(0).path("action").asText()).isEqualTo("FARM_SERVICE_STATUS_CHANGED");

        assertThat(ids(json(list(admin, DAY, DAY, "actor", "QUẢN TRỊ").andExpect(status().isOk())).path("items"))).containsExactly(suspended.getId());
        String emailPart = pm.getEmail().substring(0, pm.getEmail().indexOf('@')).toUpperCase(java.util.Locale.ROOT);
        assertThat(ids(json(list(admin, DAY, DAY, "actor", emailPart).andExpect(status().isOk())).path("items"))).containsExactly(reviewed.getId(), paidByPm.getId());
        assertThat(json(list(admin, DAY, DAY, "actor", "100%_").andExpect(status().isOk())).path("total").asLong()).isZero();
    }

    /** TC-17-09 / TC-17-10 (R-17-05): required days, from ≤ to, at most 12 months; wrong values are MSG-COM-10 with the field. */
    @Test
    void validatesTheRangeAndTheFilterValues() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        read(admin, BASE).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("from"));
        read(admin, BASE, "from", DAY).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("to"));
        list(admin, DAY, DAY.minusDays(1)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-11"));
        list(admin, DAY, DAY.plusMonths(12).plusDays(1)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("dateRange"));
        list(admin, DAY, DAY.plusMonths(12)).andExpect(status().isOk());
        list(admin, DAY, DAY).andExpect(status().isOk());
        read(admin, BASE, "from", "10/03/2031", "to", DAY).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("from"));
        list(admin, DAY, DAY, "action", "PEN_MOVE").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("action"));
        list(admin, DAY, DAY, "targetType", "Cattle").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("targetType"));
        list(admin, DAY, DAY, "dir", "sideways").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("dir"));
        list(admin, DAY, DAY, "system", true, "actor", "an").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("actor"));
        list(admin, DAY, DAY, "page", "abc").andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("page"));
    }

    /** SCR-51 paging: 20 per page by default, at most 100. */
    @Test
    void pagesTwentyEntriesAtATime() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        for (int minute = 0; minute < 23; minute++) entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY, 7, minute), "{}");
        JsonNode first = json(list(admin, DAY, DAY).andExpect(status().isOk()));
        assertThat(first.path("total").asLong()).isEqualTo(23);
        assertThat(first.path("items")).hasSize(20);
        JsonNode second = json(list(admin, DAY, DAY, "page", 1).andExpect(status().isOk()));
        assertThat(second.path("items")).hasSize(3);
        assertThat(json(list(admin, DAY, DAY, "size", 500).andExpect(status().isOk())).path("size").asInt()).isEqualTo(100);
    }

    /** TC-17-12 (R-17-02): no route changes or deletes an entry. */
    @Test
    void offersNoRouteToChangeOrDeleteAnEntry() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        AuditLog row = entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY, 9, 0), "{}");
        for (MockHttpServletRequestBuilder request : List.of(put(BASE + "/" + row.getId()), patch(BASE + "/" + row.getId()), delete(BASE + "/" + row.getId()), post(BASE), delete(BASE))) {
            em.flush(); em.clear();
            mvc.perform(request.with(csrf()).with(SecurityMockMvcRequestPostProcessors.user(admin.getEmail())).contentType("application/json").content("{}"))
                .andExpect(status().isMethodNotAllowed());
        }
        assertThat(em.find(AuditLog.class, row.getId())).isNotNull();
    }

    /** Target names: account name or masked email, member name with the farm, codes for tickets / requests / payments. */
    @Test
    void namesTheTargetOrMasksItsIdentifier() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        AppUser nameless = user();
        nameless.setFullName(""); // NOT NULL column; an account can still have no name yet
        nameless.setEmail("ngovanduc" + next() + "@example.test");
        em.flush();
        Farm farm = farm();
        AppUser member = named(user(), "Vũ Thị Kỹ Thuật");
        FarmMembership membership = member(farm, member, "TECHNICIAN", "ACTIVE");
        entry("ACCOUNT_SUSPEND", "AppUser", nameless.getId(), nameless, null, at(DAY, 9, 0), "{}");
        entry("MEMBER_CHANGE_ROLE", "FarmMembership", membership.getId(), member, farm, at(DAY, 9, 5), "{}");
        entry("SUPPORT_CLOSE", "SupportTicket", 987_654L, admin, null, at(DAY, 9, 10), "{}");

        JsonNode items = json(list(admin, DAY, DAY, "dir", "asc").andExpect(status().isOk())).path("items");
        assertThat(items.get(0).path("targetLabel").asText()).isEqualTo("ng***@example.test");
        assertThat(items.get(0).path("actor").path("name").asText()).isEqualTo("ng***@example.test");
        assertThat(items.get(0).path("actor").path("initials").asText()).isEqualTo("N");
        assertThat(items.get(1).path("targetLabel").asText()).isEqualTo("Vũ Thị Kỹ Thuật · " + farm.getName());
        assertThat(items.get(1).path("targetType").asText()).isEqualTo("MEMBERSHIP");
        assertThat(items.get(2).path("targetLabel").asText()).isEqualTo("#987654");
        assertThat(items.toString()).doesNotContain(nameless.getEmail());
    }

    /** Names are read as columns: the statements of a page do not grow with the number of actors (no AppUser N+1). */
    @Test
    void readsAPageWithAFixedNumberOfStatements() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        LocalDate other = DAY.plusDays(3);
        entry("ACCOUNT_SUSPEND", "AppUser", admin.getId(), admin, null, at(DAY, 9, 0), "{}");
        for (int i = 0; i < 6; i++) {
            AppUser actor = staff("SA", "ACTIVE");
            entry("ACCOUNT_SUSPEND", "AppUser", actor.getId(), actor, null, at(other, 9, i), "{}");
        }
        em.flush(); em.clear();
        long one = statements(() -> list(admin, DAY, DAY).andExpect(status().isOk()));
        long six = statements(() -> list(admin, other, other).andExpect(status().isOk()));
        assertThat(six).isEqualTo(one);
    }

    /** TC-17-08 (R-17-07): JOB-04 expires a farm's service; the entry has no actor ("System"), no role, a correlation ID. */
    @Test
    void aJobChangeIsShownAsSystem() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        Farm farm = farm("ACTIVE");
        PlanVersion price = new PlanVersion();
        price.setPrice1y(new BigDecimal("1200000"));
        price.setPrice2y(new BigDecimal("2000000"));
        price.setPrice3y(new BigDecimal("2700000"));
        price.setEffectiveAt(clock.instant().minusSeconds(86_400));
        save(price);
        Subscription subscription = new Subscription();
        subscription.setFarm(farm);
        subscription.setPlanVersion(price);
        subscription.setEntitlementStatus("ACTIVE");
        subscription.setLatestEnd(clock.instant().minusSeconds(60));
        save(subscription);

        lifecycle.evaluateCoverage();

        JsonNode items = json(list(admin, TODAY, TODAY, "system", true, "action", "FARM_SERVICE_STATUS_CHANGED").andExpect(status().isOk())).path("items");
        JsonNode row = null;
        for (JsonNode item : items) if (farm.getName().equals(item.path("targetLabel").asText())) row = item;
        assertThat(row).isNotNull();
        assertThat(row.path("actor").isNull()).isTrue();
        JsonNode detail = json(read(admin, BASE + "/" + row.path("id").asLong()).andExpect(status().isOk()));
        assertThat(detail.path("before").path("status").asText()).isEqualTo("ACTIVE");
        assertThat(detail.path("after").path("status").asText()).isEqualTo("EXPIRED");
        assertThat(detail.path("actor").isNull()).isTrue();
        assertThat(detail.path("correlationId").asText()).hasSize(36);
    }

    /**
     * TC-17-07 (R-17-04, D34 K6): the ticket workflow is audited per operation with the role of each actor, the status
     * before / after and the CS in charge; the internal request is its own target. No ticket content is shown.
     */
    @Test
    void theTicketWorkflowIsAuditedPerOperationWithoutTicketContent() throws Exception {
        AppUser admin = staff("SA", "ACTIVE");
        Farm farm = farm();
        AppUser owner = named(user(), "Chủ Trại Một");
        owner.setOwnerRegistrationCompleted(true);
        owner.setOwnerRegistrationCompletedAt(clock.instant());
        member(farm, owner, "OWNER", "ACTIVE");
        AppUser cs = named(staff(PlatformRole.CS.name(), "ACTIVE"), "Hỗ Trợ Viên");
        AppUser pm = named(staff(PlatformRole.PM.name(), "ACTIVE"), "Quản Lý Gói");

        actAs(owner);
        SupportDtos.Ticket t = tickets.create(new SupportDtos.Create("SYSTEM_USAGE", "FARM", farm.getId(), "Không xem được báo cáo", "Mô tả riêng của chủ trại"));
        actAs(cs);
        t = tickets.process(t.id(), new SupportDtos.Processing("CLAIM", null, null, null, null, null, t.version()));
        SupportDtos.InternalView request = internalRequests.create(t.id(), new SupportDtos.InternalCreate(PlatformRole.PM, pm.getId(), "Câu hỏi nội bộ riêng", List.of(), t.version()));
        actAs(pm);
        internalRequests.complete(request.id(), new SupportDtos.Complete("UNABLE", "Kết quả nội bộ riêng", null, versionOf(vn.edu.fpt.beefcare.domain.InternalRequest.class, request.id())));
        actAs(cs);
        t = tickets.get(t.id(), true);
        t = tickets.resolve(t.id(), new SupportDtos.Resolution("Nội dung giải quyết riêng", t.version()));
        actAs(owner);
        t = tickets.acknowledge(t.id(), new SupportDtos.Acknowledge(1, "Đã dùng được", t.version()));
        actAs(cs);
        t = tickets.close(t.id(), new SupportDtos.Close(true, "Ghi chú đóng", t.version()));
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        String ticketCode = t.code();

        JsonNode ticketRows = json(list(admin, TODAY, TODAY, "targetType", "TICKET", "dir", "asc").andExpect(status().isOk())).path("items");
        List<JsonNode> mine = new ArrayList<>();
        ticketRows.forEach(row -> { if (ticketCode.equals(row.path("targetLabel").asText())) mine.add(row); });
        assertThat(mine).extracting(row -> row.path("action").asText())
            .containsExactly("TICKET_CREATED", "TICKET_ASSIGNED", "TICKET_RESOLVED", "TICKET_ACKNOWLEDGED", "TICKET_CLOSED");
        assertThat(mine).extracting(row -> row.path("actor").path("role").asText()).containsExactly("OWNER", "CS", "CS", "OWNER", "CS");

        JsonNode closed = json(read(admin, BASE + "/" + mine.get(4).path("id").asLong()).andExpect(status().isOk()));
        assertThat(closed.path("before").path("status").asText()).isEqualTo("RESOLVED");
        assertThat(closed.path("after").path("status").asText()).isEqualTo("CLOSED");
        assertThat(closed.path("after").path("assignee").asText()).isEqualTo("Hỗ Trợ Viên");
        JsonNode assigned = json(read(admin, BASE + "/" + mine.get(1).path("id").asLong()).andExpect(status().isOk()));
        assertThat(assigned.path("before").path("status").asText()).isEqualTo("OPEN");
        assertThat(assigned.path("after").path("status").asText()).isEqualTo("IN_PROGRESS");

        JsonNode internal = json(list(admin, TODAY, TODAY, "targetType", "INTERNAL_REQUEST", "dir", "asc").andExpect(status().isOk())).path("items");
        List<JsonNode> requestRows = new ArrayList<>();
        internal.forEach(row -> { if (request.code().equals(row.path("targetLabel").asText())) requestRows.add(row); });
        assertThat(requestRows).extracting(row -> row.path("action").asText()).containsExactly("INTERNAL_REQUEST_CREATED", "INTERNAL_REQUEST_COMPLETED");
        assertThat(requestRows).extracting(row -> row.path("actor").path("role").asText()).containsExactly("CS", "PM");
        JsonNode completed = json(read(admin, BASE + "/" + requestRows.get(1).path("id").asLong()).andExpect(status().isOk()));
        assertThat(completed.path("targetId").asLong()).isEqualTo(request.id());
        assertThat(completed.path("before").path("status").asText()).isEqualTo("OPEN");
        assertThat(completed.path("after").path("status").asText()).isEqualTo("DONE");

        String all = ticketRows.toString() + internal + closed + assigned + completed;
        assertThat(all).doesNotContain("Mô tả riêng của chủ trại", "Nội dung giải quyết riêng", "Câu hỏi nội bộ riêng", "Kết quả nội bộ riêng", "Ghi chú đóng", "Đã dùng được");
    }

    interface Call { void run() throws Exception; }

    private long statements(Call call) throws Exception {
        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            call.run();
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }
}
