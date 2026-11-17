package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.FarmMembershipChange;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-06 / A2 (D30): check order, input rules, history and audit, and that the member's next request follows the
 * change. Real security chain, JSON and database. Commit, rollback and races are in {@link FarmMemberChangeTransactionTest}.
 */
@ServiceIntegrationTest
@Transactional
class FarmMemberChangeResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private FarmMembership membershipOf(Farm farm, AppUser user) {
        return em.createQuery("select m from FarmMembership m where m.farm.id=:f and m.user.id=:u", FarmMembership.class)
            .setParameter("f", farm.getId()).setParameter("u", user.getId()).getSingleResult();
    }

    private Map<String, Object> body(String action, String role, LocalDate date, String reason, Integer version) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", action); if (role != null) body.put("role", role);
        body.put("effectiveDate", date == null ? null : date.toString()); body.put("reason", reason); body.put("expectedVersion", version);
        return body;
    }

    private ResultActions change(Farm farm, AppUser caller, Long membershipId, Map<String, Object> body, String key) throws Exception {
        return mvc.perform(put("/api/farms/{f}/members/{m}", farm.getId(), membershipId).with(SecurityMockMvcRequestPostProcessors.user(caller.getEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content(mapper.writeValueAsBytes(body)));
    }

    private ResultActions refused(ResultActions result, int status, String code) throws Exception {
        return result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code));
    }

    private long historyRows(FarmMembership membership) {
        return em.createQuery("select count(c) from FarmMembershipChange c where c.membership.id=:m", Long.class).setParameter("m", membership.getId()).getSingleResult();
    }

    private long audits(FarmMembership membership) {
        return em.createQuery("select count(a) from AuditLog a where a.targetType='FarmMembership' and a.targetId=:m", Long.class).setParameter("m", membership.getId()).getSingleResult();
    }

    @Test
    void savesTheHistoryRowAndABeforeAfterAuditWithoutTheReason() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership target = membershipOf(farm, manager);
        LocalDate past = TODAY.minusDays(10);
        JsonNode changed = mapper.readTree(change(farm, owner, target.getId(), body("CHANGE_ROLE", "TECHNICIAN", past, "  Chuyển sang khu chuồng C  ", target.getVersion()), "history")
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(changed.path("role").asText()).isEqualTo("TECHNICIAN");
        assertThat(changed.path("actions").toString()).isEqualTo("[\"CHANGE_ROLE\",\"DEACTIVATE\"]");
        em.flush(); em.clear();
        List<FarmMembershipChange> rows = em.createQuery("select c from FarmMembershipChange c join fetch c.changedBy where c.membership.id=:m", FarmMembershipChange.class)
            .setParameter("m", target.getId()).getResultList();
        assertThat(rows).hasSize(1);
        FarmMembershipChange row = rows.getFirst();
        assertThat(row.getAction()).isEqualTo("CHANGE_ROLE");
        assertThat(List.of(row.getRoleBefore(), row.getRoleAfter(), row.getStatusBefore(), row.getStatusAfter())).containsExactly("MANAGER", "TECHNICIAN", "ACTIVE", "ACTIVE");
        assertThat(row.getEffectiveDate()).isEqualTo(past);
        assertThat(row.getReason()).isEqualTo("Chuyển sang khu chuồng C");
        assertThat(row.getChangedBy().getId()).isEqualTo(owner.getId());
        assertThat(row.getChangedAt()).isEqualTo(clock.instant());
        assertThat(row.getFarm().getId()).isEqualTo(farm.getId());
        String details = em.createQuery("select a.details from AuditLog a where a.targetType='FarmMembership' and a.targetId=:m", String.class).setParameter("m", target.getId()).getSingleResult();
        assertThat(details).contains("\"roleBefore\"", "MANAGER", "\"roleAfter\"", "TECHNICIAN", past.toString()).doesNotContain("khu chuồng", manager.getEmail());
    }

    @Test
    void checksOwnerThenFarmThenOwnerTargetBeforeTheInput() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership target = membershipOf(farm, technician);
        Map<String, Object> deactivate = body("DEACTIVATE", null, TODAY, "Nghỉ việc", target.getVersion());
        // E1: not the Owner, even with valid input
        refused(change(farm, manager, target.getId(), deactivate, "manager"), 403, "MSG-COM-01");
        // a membership of another farm through this farm's URL
        Farm other = farm(); memberWithRole(other, FarmRole.OWNER); FarmMembership foreign = membershipOf(other, memberWithRole(other, FarmRole.MANAGER));
        refused(change(farm, owner, foreign.getId(), body("DEACTIVATE", null, TODAY, "Nghỉ việc", foreign.getVersion()), "foreign"), 404, "MSG-COM-08");
        // TC-03-19: the Owner membership, before the (invalid) reason is looked at
        FarmMembership ownerRow = membershipOf(farm, owner);
        refused(change(farm, owner, ownerRow.getId(), body("DEACTIVATE", null, TODAY, "x", ownerRow.getVersion()), "self"), 403, "MSG-COM-01");
        assertThat(historyRows(target) + historyRows(foreign) + historyRows(ownerRow)).isZero();
    }

    @Test
    void validatesTheReasonDateAndRoleWithTheSpecCodes() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); FarmMembership target = membershipOf(farm, memberWithRole(farm, FarmRole.MANAGER));
        Integer v = target.getVersion();
        // Table III-1: at least 5 non-space characters; popup: at most 500 (TC-03-22)
        refused(change(farm, owner, target.getId(), body("DEACTIVATE", null, TODAY, "a b c d", v), "short"), 400, "MSG-COM-10").andExpect(jsonPath("$.params.field").value("reason"));
        refused(change(farm, owner, target.getId(), body("DEACTIVATE", null, TODAY, "x".repeat(501), v), "long"), 400, "MSG-COM-10");
        refused(change(farm, owner, target.getId(), body("DEACTIVATE", null, TODAY, "   ", v), "blank"), 400, "MSG-COM-06");
        refused(change(farm, owner, target.getId(), body("DEACTIVATE", null, TODAY.plusDays(1), "Nghỉ việc", v), "future"), 400, "MSG-COM-07")
            .andExpect(jsonPath("$.params.field").value("effectiveDate"));
        refused(change(farm, owner, target.getId(), body("DEACTIVATE", null, null, "Nghỉ việc", v), "no-date"), 400, "MSG-COM-06");
        refused(change(farm, owner, target.getId(), body("CHANGE_ROLE", null, TODAY, "Đổi việc", v), "no-role"), 400, "MSG-COM-06").andExpect(jsonPath("$.params.field").value("role"));
        // exactly five visible characters and a date far in the past are accepted (the date is history only, FE-03 Q3)
        change(farm, owner, target.getId(), body("DEACTIVATE", null, LocalDate.of(2020, 1, 1), " ab cde ", v), "five").andExpect(status().isOk());
        assertThat(historyRows(target)).isEqualTo(1);
    }

    @Test
    void theFixedUtcPlus7BusinessDayDecidesWhatIsInTheFuture() throws Exception {
        // D39: every farm uses UTC+07:00; a legacy zone left on the farm row must not move the business day.
        Farm farm = farm(); farm.setTimeZone("Pacific/Kiritimati"); em.flush(); // UTC+14
        AppUser owner = memberWithRole(farm, FarmRole.OWNER); FarmMembership target = membershipOf(farm, memberWithRole(farm, FarmRole.MANAGER));
        Map<String, Object> deactivate = body("DEACTIVATE", null, LocalDate.of(2026, 10, 29), "Nghỉ việc", target.getVersion());
        clock.set(Instant.parse("2026-10-28T16:59:59Z")); // 23:59:59 on 28/10 at UTC+7, already 29/10 at UTC+14
        refused(change(farm, owner, target.getId(), deactivate, "tz-before"), 400, "MSG-COM-07")
            .andExpect(jsonPath("$.params.field").value("effectiveDate"));
        assertThat(historyRows(target)).isZero();
        clock.set(Instant.parse("2026-10-28T17:00:00Z")); // the business day turns at 17:00 UTC
        change(farm, owner, target.getId(), deactivate, "tz-after").andExpect(status().isOk());
        assertThat(historyRows(target)).isEqualTo(1);
    }

    @Test
    void anInactiveMemberCanOnlyBeReactivated() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); FarmMembership target = member(farm, user(), "MANAGER", "INACTIVE");
        refused(change(farm, owner, target.getId(), body("CHANGE_ROLE", "TECHNICIAN", TODAY, "Đổi việc", target.getVersion()), "inactive-role"), 400, "MSG-COM-10")
            .andExpect(jsonPath("$.params.field").value("action"));
        assertThat(membershipOf(farm, target.getUser()).getRole()).isEqualTo("MANAGER");
        assertThat(historyRows(target)).isZero();
    }

    @Test
    void anInactiveFarmAllowsOnlyDeactivation() throws Exception {
        Farm farm = farm("EXPIRED"); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmMembership active = membershipOf(farm, memberWithRole(farm, FarmRole.MANAGER)); FarmMembership inactive = member(farm, user(), "TECHNICIAN", "INACTIVE");
        // TC-03-23
        refused(change(farm, owner, active.getId(), body("CHANGE_ROLE", "TECHNICIAN", TODAY, "Đổi việc", active.getVersion()), "role"), 403, "MSG-FE03-04");
        refused(change(farm, owner, inactive.getId(), body("REACTIVATE", null, TODAY, "Quay lại làm", inactive.getVersion()), "back"), 403, "MSG-FE03-04");
        change(farm, owner, active.getId(), body("DEACTIVATE", null, TODAY, "Thu hồi quyền", active.getVersion()), "off")
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE")).andExpect(jsonPath("$.actions.length()").value(0));
    }

    @Test
    void theRequestedValueAlreadyInPlaceIsReportedBeforeAnOutdatedVersion() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmMembership inactive = member(farm, user(), "TECHNICIAN", "INACTIVE");
        FarmMembership manager = membershipOf(farm, memberWithRole(farm, FarmRole.MANAGER));
        Integer stale = manager.getVersion() + 7;
        // E3 with an outdated version: the real reason, not MSG-COM-05 (D30)
        refused(change(farm, owner, inactive.getId(), body("DEACTIVATE", null, TODAY, "Nghỉ việc", inactive.getVersion() + 3), "again"), 409, "MSG-FE03-20")
            .andExpect(jsonPath("$.params.value").value("status"));
        refused(change(farm, owner, manager.getId(), body("CHANGE_ROLE", "MANAGER", TODAY, "Giữ nguyên", stale), "same"), 409, "MSG-FE03-20")
            .andExpect(jsonPath("$.params.value").value("role"));
        refused(change(farm, owner, manager.getId(), body("REACTIVATE", null, TODAY, "Đang làm", manager.getVersion()), "active"), 409, "MSG-FE03-20");
        // a real change with an outdated version (TC-03-21 and E5)
        refused(change(farm, owner, manager.getId(), body("CHANGE_ROLE", "TECHNICIAN", TODAY, "Đổi việc", stale), "stale"), 409, "MSG-COM-05");
        em.flush(); em.clear();
        assertThat(em.find(FarmMembership.class, manager.getId()).getRole()).isEqualTo("MANAGER");
        assertThat(historyRows(manager) + historyRows(inactive) + audits(manager) + audits(inactive)).isZero();
    }

    @Test
    void theMembersNextRequestFollowsTheNewRoleAndDeactivation() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership target = membershipOf(farm, manager);
        mvc.perform(get("/api/farms/{f}/members", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail()))).andExpect(status().isOk());
        // TC-03-20: Manager → Technician applies from the next request (no sign-in needed)
        change(farm, owner, target.getId(), body("CHANGE_ROLE", "TECHNICIAN", TODAY, "Phân công lại", target.getVersion()), "to-tech").andExpect(status().isOk());
        mvc.perform(get("/api/farms/{f}/members", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get("/api/farms/{f}/context", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("TECHNICIAN"));
        em.flush();
        change(farm, owner, target.getId(), body("DEACTIVATE", null, TODAY, "Nghỉ việc", versionOf(FarmMembership.class, target.getId())), "off").andExpect(status().isOk());
        mvc.perform(get("/api/farms/{f}/context", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        assertThat(historyRows(target)).isEqualTo(2);
    }

    /** AF2 and POST-2: a deactivated Manager's drafts stay private and frozen; published records keep their author. */
    @Test
    void aDeactivatedManagersDraftsStayPrivateAndPublishedRecordsKeepTheAuthor() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER); AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        AppUser technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        Map<String, Object> draft = Map.of("title", "Lịch tiêm tuần sau", "body", "Chuẩn bị chuồng B", "recipientRoles", List.of("TECHNICIAN"));
        long draftId = mapper.readTree(mvc.perform(post("/api/farms/{f}/announcements/drafts", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())).with(csrf())
            .header("Idempotency-Key", "draft").contentType("application/json").content(mapper.writeValueAsBytes(draft))).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()).path("id").asLong();
        JsonNode second = mapper.readTree(mvc.perform(post("/api/farms/{f}/announcements/drafts", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())).with(csrf())
            .header("Idempotency-Key", "to-publish").contentType("application/json").content(mapper.writeValueAsBytes(Map.of("title", "Đã tiêm xong", "body", "Chuồng A", "recipientRoles", List.of("TECHNICIAN")))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(post("/api/farms/{f}/announcements/{id}/publish", farm.getId(), second.path("id").asLong()).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())).with(csrf())
            .header("Idempotency-Key", "publish").contentType("application/json").content(mapper.writeValueAsBytes(Map.of("expectedVersion", second.path("version").asInt())))).andExpect(status().isOk());

        FarmMembership target = membershipOf(farm, manager);
        change(farm, owner, target.getId(), body("DEACTIVATE", null, TODAY, "Nghỉ việc", target.getVersion()), "off").andExpect(status().isOk());

        mvc.perform(put("/api/farms/{f}/announcements/{id}/draft", farm.getId(), draftId).with(SecurityMockMvcRequestPostProcessors.user(manager.getEmail())).with(csrf())
            .header("Idempotency-Key", "edit").contentType("application/json").content(mapper.writeValueAsBytes(Map.of("title", "Sửa", "body", "Sửa", "recipientRoles", List.of("TECHNICIAN"), "expectedVersion", 0))))
            .andExpect(status().isForbidden());
        String ownerList = mvc.perform(get("/api/farms/{f}/announcements", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(ownerList).doesNotContain("Lịch tiêm tuần sau", "Chuẩn bị chuồng B");
        mvc.perform(get("/api/farms/{f}/announcements", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(technician.getEmail())))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].authorName").value(manager.getFullName()));
    }
}
