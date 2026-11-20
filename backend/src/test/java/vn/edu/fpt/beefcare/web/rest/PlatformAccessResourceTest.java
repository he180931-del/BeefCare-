package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
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
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-09 / A13, A11 (D33) over HTTP with the real security chain and database: grant / change / revoke / restore with
 * history and audit, the next request under the new access, order of checks, {@code accessActions}, tickets of a CS who
 * loses access and internal requests of a removed PM. Commit / rollback, replay and the two-SA race:
 * {@code PlatformAccountStatusTransactionTest}.
 */
@ServiceIntegrationTest
@Transactional
class PlatformAccessResourceTest extends DomainTestSupport {
    static final String BASE = "/api/platform/accounts";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private AppUser staff(String role, String status) {
        AppUser user = verified(user());
        save(new PlatformStaffAccess().user(user).role(role).status(status));
        return user;
    }

    private AppUser verified(AppUser account) {
        account.setGoogleSubject("google-uc9-" + next());
        em.flush();
        return account;
    }

    private AppUser sa() { return staff("SA", "ACTIVE"); }

    private String body(String operation, String role, String reason, Long version) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("operation", operation);
        if (role != null) body.put("role", role);
        body.put("reason", reason);
        body.put("version", version);
        return mapper.writeValueAsString(body);
    }

    private ResultActions access(AppUser caller, Long id, String body, String key) throws Exception {
        em.flush(); em.clear();
        var request = post(BASE + "/{id}/platform-access", id).with(csrf()).contentType("application/json").content(body);
        if (key != null) request.header("Idempotency-Key", key);
        return mvc.perform(caller == null ? request : request.with(SecurityMockMvcRequestPostProcessors.user(caller.getEmail())));
    }

    private ResultActions read(AppUser caller, String path, Object... ids) throws Exception {
        em.flush(); em.clear();
        return mvc.perform(get(path, ids).with(SecurityMockMvcRequestPostProcessors.user(caller.getEmail())));
    }

    private JsonNode json(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private JsonNode detail(AppUser caller, AppUser account) throws Exception {
        return json(read(caller, BASE + "/{id}", account.getId()).andExpect(status().isOk()));
    }

    private Long accessVersion(AppUser account) {
        List<Long> versions = em.createQuery("select a.version from PlatformStaffAccess a where a.user.id=:u", Long.class)
            .setParameter("u", account.getId()).getResultList();
        return versions.isEmpty() ? null : versions.get(0);
    }

    private long history(AppUser account) {
        return em.createQuery("select count(c) from PlatformAccessChange c where c.account.id=:id", Long.class).setParameter("id", account.getId()).getSingleResult();
    }

    private List<AuditLog> audits(AppUser account) {
        return em.createQuery("select a from AuditLog a where a.targetType='AppUser' and a.targetId=:id and a.action like 'PLATFORM_ACCESS_%' order by a.id", AuditLog.class)
            .setParameter("id", account.getId()).getResultList();
    }

    private static List<String> texts(JsonNode array) {
        List<String> values = new ArrayList<>();
        array.forEach(value -> values.add(value.asText()));
        return values;
    }

    private SupportTicket ticket(AppUser cs, String status) {
        SupportTicket ticket = new SupportTicket();
        ticket.setRequester(user());
        ticket.setFarm(farm());
        ticket.setAssignedCs(cs);
        ticket.setCategory("ACCOUNT_ACCESS");
        ticket.setPriority("NORMAL");
        ticket.setStatus(status);
        ticket.setCode("UC9-" + next());
        ticket.setSubject("Không đăng nhập được");
        ticket.setCreatedAt(Instant.parse("2026-10-27T01:00:00Z"));
        ticket.setUpdatedAt(Instant.parse("2026-10-27T01:00:00Z"));
        return save(ticket);
    }

    /**
     * TC-03-91: grant → change → revoke → restore, each with one history row (reason, SA, time) and one audit entry without
     * the reason; A11 newest first; the person's next request uses the new access (POST-2).
     */
    @Test
    void grantsChangesRevokesAndRestoresWithHistoryAuditAndNextRequestAccess() throws Exception {
        AppUser admin = sa();
        AppUser person = verified(user());
        assertThat(texts(detail(admin, person).path("accessActions"))).containsExactly("GRANT");

        JsonNode granted = json(access(admin, person.getId(), body("GRANT", "PM", "  Bổ sung nhân sự đối soát  ", null), "uc9-grant").andExpect(status().isOk()));
        assertThat(granted.path("platformRole").asText()).isEqualTo("PM");
        assertThat(granted.path("platformAccessStatus").asText()).isEqualTo("ACTIVE");
        assertThat(texts(granted.path("accessActions"))).containsExactly("CHANGE", "REVOKE");
        read(person, "/api/platform/farms").andExpect(status().isOk());

        JsonNode changed = json(access(admin, person.getId(), body("CHANGE", "CS", "Chuyển sang nhóm hỗ trợ", granted.path("platformAccessVersion").asLong()), "uc9-change")
            .andExpect(status().isOk()));
        assertThat(changed.path("platformRole").asText()).isEqualTo("CS");
        read(person, "/api/platform/farms").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));

        JsonNode revoked = json(access(admin, person.getId(), body("REVOKE", null, "Nghỉ việc", changed.path("platformAccessVersion").asLong()), "uc9-revoke")
            .andExpect(status().isOk()));
        assertThat(revoked.path("platformRole").asText()).isEqualTo("CS");
        assertThat(revoked.path("platformAccessStatus").asText()).isEqualTo("REVOKED");
        assertThat(texts(revoked.path("accessActions"))).containsExactly("RESTORE");

        JsonNode restored = json(access(admin, person.getId(), body("RESTORE", null, "Quay lại làm việc", revoked.path("platformAccessVersion").asLong()), "uc9-restore")
            .andExpect(status().isOk()));
        assertThat(restored.path("platformAccessStatus").asText()).isEqualTo("ACTIVE");

        JsonNode rows = json(read(admin, BASE + "/{id}/history", person.getId()).andExpect(status().isOk()));
        assertThat(rows).hasSize(4);
        List<String> lines = new ArrayList<>();
        rows.forEach(row -> lines.add(String.join("|", row.path("action").asText(), row.path("roleBefore").asText("-"), row.path("statusBefore").asText("-"),
            row.path("roleAfter").asText(), row.path("statusAfter").asText(), row.path("reason").asText(), row.path("byEmail").asText())));
        assertThat(lines).containsExactly(
            "RESTORE|CS|REVOKED|CS|ACTIVE|Quay lại làm việc|" + admin.getEmail(),
            "REVOKE|CS|ACTIVE|CS|REVOKED|Nghỉ việc|" + admin.getEmail(),
            "CHANGE|PM|ACTIVE|CS|ACTIVE|Chuyển sang nhóm hỗ trợ|" + admin.getEmail(),
            "GRANT|-|-|PM|ACTIVE|Bổ sung nhân sự đối soát|" + admin.getEmail()
        );
        assertThat(rows.get(3).path("roleBefore").isNull()).isTrue();
        assertThat(rows.get(0).path("byName").asText()).isEqualTo(admin.getFullName());
        assertThat(rows.get(0).has("at")).isTrue();
        assertThat(history(person)).isEqualTo(4);
        List<AuditLog> audit = audits(person);
        assertThat(audit).extracting(AuditLog::getAction)
            .containsExactly("PLATFORM_ACCESS_GRANT", "PLATFORM_ACCESS_CHANGE", "PLATFORM_ACCESS_REVOKE", "PLATFORM_ACCESS_RESTORE");
        assertThat(audit).allSatisfy(entry -> assertThat(entry.getDetails()).contains("toRole").doesNotContain("Nghỉ việc").doesNotContain("reason"));
    }

    /** TC-03-92: order of checks; every refused command writes nothing. */
    @Test
    void checksAccessAccountInputOwnAccountSuspensionVerificationStateThenVersion() throws Exception {
        AppUser admin = sa();
        AppUser cs = staff("CS", "ACTIVE");
        AppUser person = verified(user());

        access(cs, 999_999_999L, body("GRANT", "PM", "Bổ sung nhân sự", null), "k1").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        access(admin, 999_999_999L, body("FLY", null, "abc", null), "k2").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        access(null, person.getId(), body("GRANT", "PM", "Bổ sung nhân sự", null), "k3").andExpect(status().isUnauthorized());
        access(admin, person.getId(), body("FLY", null, "Bổ sung nhân sự", null), "k4").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("operation"));
        access(admin, person.getId(), body("GRANT", null, "Bổ sung nhân sự", null), "k5").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("role"));
        access(admin, person.getId(), body("GRANT", "OWNER", "Bổ sung nhân sự", null), "k6").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("role"));
        access(admin, person.getId(), body("GRANT", "PM", "a b c d", null), "k7").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("reason"));
        access(admin, person.getId(), body("GRANT", "PM", "   ", null), "k8").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("reason"));
        access(admin, person.getId(), body("GRANT", "PM", "Bổ sung nhân sự", null), null).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("Idempotency-Key"));

        // Own access (SRS: an SA is revoked by another SA): COM-01 after the input checks; A10 offers nothing
        access(admin, admin.getId(), body("REVOKE", null, "abc", accessVersion(admin)), "k9").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        access(admin, admin.getId(), body("REVOKE", null, "Tự thu hồi thử", accessVersion(admin)), "k10").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        assertThat(detail(admin, admin).path("accessActions")).isEmpty();

        // State (D33 Q5): the value already in place → FE03-20 (also with an outdated version); otherwise COM-05
        access(admin, cs.getId(), body("GRANT", "CS", "Cấp lại CS", 99L), "k11").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-20")).andExpect(jsonPath("$.params.value").value("role"))
            .andExpect(jsonPath("$.params.target").value(cs.getEmail()));
        access(admin, cs.getId(), body("GRANT", "PM", "Thêm vai trò PM", accessVersion(cs)), "k12").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        access(admin, cs.getId(), body("CHANGE", "CS", "Đổi sang CS", accessVersion(cs)), "k13").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-20")).andExpect(jsonPath("$.params.value").value("role"));
        access(admin, cs.getId(), body("RESTORE", null, "Khôi phục thử", accessVersion(cs)), "k14").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-20")).andExpect(jsonPath("$.params.value").value("status"));
        access(admin, person.getId(), body("CHANGE", "PM", "Đổi sang PM", null), "k15").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        access(admin, person.getId(), body("REVOKE", null, "Thu hồi thử", null), "k16").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        access(admin, cs.getId(), body("CHANGE", "PM", "Đổi sang PM", accessVersion(cs) + 5), "k17").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        access(admin, person.getId(), body("GRANT", "PM", "Bổ sung nhân sự", 3L), "k18").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));

        assertThat(history(person)).isZero(); assertThat(history(cs)).isZero(); assertThat(history(admin)).isZero();
        assertThat(audits(person)).isEmpty(); assertThat(audits(cs)).isEmpty();
        assertThat(accessVersion(person)).isNull();
    }

    /** TC-03-93 (FE-03 Q4, D33 Q3): a SUSPENDED account keeps only Revoke (FE03-22 otherwise); unverified email: FE03-18. */
    @Test
    void suspendedAccountsCanOnlyBeRevokedAndUnverifiedAccountsGetNoAccess() throws Exception {
        AppUser admin = sa();
        AppUser suspendedPm = staff("PM", "ACTIVE");
        suspendedPm.setAccountStatus("SUSPENDED");
        AppUser suspendedNone = verified(user("SUSPENDED"));
        AppUser unverified = user();
        AppUser revokedUnverified = user();
        save(new PlatformStaffAccess().user(revokedUnverified).role("CS").status("REVOKED"));
        em.flush();

        assertThat(texts(detail(admin, suspendedPm).path("accessActions"))).containsExactly("REVOKE");
        assertThat(detail(admin, suspendedNone).path("accessActions")).isEmpty();
        assertThat(detail(admin, unverified).path("accessActions")).isEmpty();
        assertThat(detail(admin, revokedUnverified).path("accessActions")).isEmpty();

        access(admin, suspendedNone.getId(), body("GRANT", "CS", "Cấp quyền CS", null), "s1").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-22")).andExpect(jsonPath("$.params.email").value(suspendedNone.getEmail()));
        access(admin, suspendedPm.getId(), body("CHANGE", "CS", "Đổi sang CS", accessVersion(suspendedPm)), "s2").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-22"));
        access(admin, unverified.getId(), body("GRANT", "CS", "Cấp quyền CS", null), "s3").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-18"));
        access(admin, revokedUnverified.getId(), body("RESTORE", null, "Khôi phục quyền", accessVersion(revokedUnverified)), "s4").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-18"));

        JsonNode revoked = json(access(admin, suspendedPm.getId(), body("REVOKE", null, "Tài khoản nghi bị lộ", accessVersion(suspendedPm)), "s5").andExpect(status().isOk()));
        assertThat(revoked.path("platformAccessStatus").asText()).isEqualTo("REVOKED");
        assertThat(revoked.path("accountStatus").asText()).isEqualTo("SUSPENDED");
        assertThat(revoked.path("accessActions")).isEmpty();
        assertThat(history(suspendedNone)).isZero(); assertThat(history(unverified)).isZero(); assertThat(history(suspendedPm)).isEqualTo(1);
    }

    /** TC-03-94 (TC-03-29, TC-03-31): a CS who loses CS access hands the open tickets back; a removed PM's OPEN request needs reassignment. */
    @Test
    void removedCustomerSupportReturnsTicketsAndRemovedManagerFlagsInternalRequests() throws Exception {
        AppUser admin = sa();
        AppUser leaving = staff("CS", "ACTIVE");
        AppUser moving = staff("CS", "ACTIVE");
        AppUser cs = staff("CS", "ACTIVE");
        AppUser pm = staff("PM", "ACTIVE");
        SupportTicket ofLeaving = ticket(leaving, "IN_PROGRESS");
        SupportTicket closed = ticket(leaving, "CLOSED");
        SupportTicket ofMoving = ticket(moving, "WAITING_CUSTOMER");
        SupportTicket withRequest = ticket(cs, "IN_PROGRESS");
        InternalRequest request = new InternalRequest();
        request.setTicket(withRequest); request.setRecipient(pm); request.setTargetRole("PM"); request.setState("OPEN");
        request.setCode("IR-" + next()); request.setQuestion("Kiểm tra giao dịch"); request.setCreatedBy(cs);
        request.setCreatedAt(Instant.parse("2026-10-27T02:00:00Z"));
        save(request);

        access(admin, leaving.getId(), body("REVOKE", null, "Nghỉ việc", accessVersion(leaving)), "t1").andExpect(status().isOk());
        access(admin, moving.getId(), body("CHANGE", "PM", "Chuyển sang đối soát", accessVersion(moving)), "t2").andExpect(status().isOk());
        assertThat(em.find(SupportTicket.class, ofLeaving.getId()).getAssignedCs()).isNull();
        assertThat(em.find(SupportTicket.class, ofLeaving.getId()).getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(em.find(SupportTicket.class, closed.getId()).getAssignedCs()).isNotNull();
        assertThat(em.find(SupportTicket.class, ofMoving.getId()).getAssignedCs()).isNull();
        assertThat(em.createQuery("select h.details from SupportHistory h where h.eventType='AUTO_REQUEUE' and h.ticket.id=:t", String.class)
            .setParameter("t", ofLeaving.getId()).getSingleResult()).contains("CS_ACCESS_REMOVED");

        access(admin, pm.getId(), body("REVOKE", null, "Nghỉ việc", accessVersion(pm)), "t3").andExpect(status().isOk());
        JsonNode view = json(read(cs, "/api/platform/support/tickets/{id}", withRequest.getId()).andExpect(status().isOk()));
        assertThat(view.path("internalRequests").get(0).path("needsReassignment").asBoolean()).isTrue();
    }
}
