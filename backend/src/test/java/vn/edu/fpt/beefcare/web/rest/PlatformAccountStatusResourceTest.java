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
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-08 / A12 (D32) over HTTP with the real security chain and database: history and audit, order of checks, the
 * next request of a suspended account, roles and memberships left as they are, tickets back to the queue and internal
 * requests flagged for reassignment. Commit / rollback, key replay and the two-SA race: {@code PlatformAccountStatusTransactionTest}.
 */
@ServiceIntegrationTest
@Transactional
class PlatformAccountStatusResourceTest extends DomainTestSupport {
    static final String BASE = "/api/platform/accounts";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired org.springframework.security.core.session.SessionRegistry sessionRegistry;

    private AppUser staff(String role, String status) {
        AppUser user = user();
        save(new PlatformStaffAccess().user(user).role(role).status(status));
        return user;
    }

    private AppUser sa() { return staff("SA", "ACTIVE"); }

    private void identity(AppUser account, boolean activated) {
        User identity = new User();
        identity.setLogin("uc8-" + next());
        identity.setPassword("x".repeat(60));
        identity.setEmail(account.getEmail());
        identity.setActivated(activated);
        identity.setLangKey("vi");
        identity.setCreatedBy("system");
        save(identity);
    }

    private String body(String reason, Long version) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reason", reason);
        body.put("version", version);
        return mapper.writeValueAsString(body);
    }

    /** Flushes and clears first: each request reads the committed-looking rows, not the entities built by the test. */
    private ResultActions command(AppUser caller, Long id, String verb, String body, String key) throws Exception {
        em.flush(); em.clear();
        var request = post(BASE + "/{id}/" + verb, id).with(csrf()).contentType("application/json").content(body);
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

    private long version(AppUser account) {
        return em.createQuery("select u.version from AppUser u where u.id=:id", Long.class).setParameter("id", account.getId()).getSingleResult();
    }

    private String accountStatus(AppUser account) {
        return em.createQuery("select u.accountStatus from AppUser u where u.id=:id", String.class).setParameter("id", account.getId()).getSingleResult();
    }

    private long history(AppUser account) {
        return em.createQuery("select count(c) from AppUserStatusChange c where c.account.id=:id", Long.class).setParameter("id", account.getId()).getSingleResult();
    }

    private List<AuditLog> audits(AppUser account) {
        return em.createQuery("select a from AuditLog a where a.targetType='AppUser' and a.targetId=:id order by a.id", AuditLog.class)
            .setParameter("id", account.getId()).getResultList();
    }

    private SupportTicket ticket(AppUser cs, String status) {
        SupportTicket ticket = new SupportTicket();
        ticket.setRequester(user());
        ticket.setFarm(farm());
        ticket.setAssignedCs(cs);
        ticket.setCategory("ACCOUNT_ACCESS");
        ticket.setPriority("NORMAL");
        ticket.setStatus(status);
        ticket.setCode("UC8-" + next());
        ticket.setSubject("Không đăng nhập được");
        ticket.setCreatedAt(Instant.parse("2026-10-27T01:00:00Z"));
        ticket.setUpdatedAt(Instant.parse("2026-10-27T01:00:00Z"));
        return save(ticket);
    }

    private InternalRequest internalRequest(SupportTicket ticket, AppUser cs, AppUser recipient, String role, String state) {
        InternalRequest request = new InternalRequest();
        request.setTicket(ticket);
        request.setRecipient(recipient);
        request.setTargetRole(role);
        request.setState(state);
        request.setCode("IR-" + next());
        request.setQuestion("Kiểm tra giúp tài khoản");
        request.setCreatedBy(cs);
        request.setCreatedAt(Instant.parse("2026-10-27T02:00:00Z"));
        return save(request);
    }

    /** TC-03-83: suspension saves the status, one history row and an audit without the reason; the next request is refused. */
    @Test
    void suspendsWithHistoryAndAuditAndRefusesTheAccountsNextRequest() throws Exception {
        AppUser admin = sa();
        AppUser target = staff("PM", "ACTIVE");
        Farm farm = farm();
        member(farm, target, "MANAGER", "ACTIVE");
        identity(target, true);
        long before = version(target);

        JsonNode detail = json(command(admin, target.getId(), "suspend", body("  Nghi ngờ lộ mật khẩu  ", before), "uc8-suspend").andExpect(status().isOk()));
        assertThat(detail.path("accountStatus").asText()).isEqualTo("SUSPENDED");
        assertThat(detail.path("version").asLong()).isGreaterThan(before);
        assertThat(detail.path("actions")).hasSize(1);
        assertThat(detail.path("actions").get(0).asText()).isEqualTo("RESTORE");
        assertThat(detail.has("phone")).isFalse();
        // D32 Q1: suspension blocks sign-in only; the platform role and the membership are left as they are
        assertThat(detail.path("platformRole").asText()).isEqualTo("PM");
        assertThat(detail.path("platformAccessStatus").asText()).isEqualTo("ACTIVE");
        assertThat(detail.path("farmCount").asLong()).isEqualTo(1);

        assertThat(history(target)).isEqualTo(1);
        Object[] row = em.createQuery("select c.action, c.statusBefore, c.statusAfter, c.reason, c.changedBy.id from AppUserStatusChange c where c.account.id=:id", Object[].class)
            .setParameter("id", target.getId()).getSingleResult();
        assertThat(row).containsExactly("SUSPEND", "ACTIVE", "SUSPENDED", "Nghi ngờ lộ mật khẩu", admin.getId());
        List<AuditLog> audit = audits(target);
        assertThat(audit).hasSize(1);
        assertThat(audit.get(0).getAction()).isEqualTo("ACCOUNT_SUSPEND");
        assertThat(audit.get(0).getActor().getId()).isEqualTo(admin.getId());
        assertThat(audit.get(0).getDetails()).contains("\"statusBefore\":\"ACTIVE\"").contains("\"statusAfter\":\"SUSPENDED\"").doesNotContain("mật khẩu");

        // GBR-04: the suspended account's next request is refused, whatever it asks for
        read(target, "/api/farms/{farmId}/members", farm.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE01-03"));
    }

    /**
     * TC-03-83 (runtime regression, 14/11/2026): real accounts sign in with their email as login. Suspension expires the
     * registered sessions of that principal instead of failing with 500 ("duplicate element" from Set.of(login, email)).
     */
    @Test
    void suspendsAnAccountWhoseLoginIsItsEmailAndExpiresItsRegisteredSessions() throws Exception {
        AppUser admin = sa();
        AppUser target = staff("CS", "ACTIVE");
        User identity = new User();
        identity.setLogin(target.getEmail().toLowerCase(java.util.Locale.ROOT));
        identity.setPassword("x".repeat(60));
        identity.setEmail(target.getEmail());
        identity.setActivated(true);
        identity.setLangKey("vi");
        identity.setCreatedBy("system");
        save(identity);
        String sessionId = "uc8-session-" + next();
        sessionRegistry.registerNewSession(sessionId, identity.getLogin());

        command(admin, target.getId(), "suspend", body("Nghi ngờ lộ mật khẩu", version(target)), "uc8-login-email").andExpect(status().isOk())
            .andExpect(jsonPath("$.accountStatus").value("SUSPENDED"));
        assertThat(sessionRegistry.getSessionInformation(sessionId).isExpired()).isTrue();
        sessionRegistry.removeSessionInformation(sessionId);
    }

    /** TC-03-84 (TC-03-32): restore, also of an unverified account (D32 Q4); a revoked role and an INACTIVE membership stay. */
    @Test
    void restoresAnUnverifiedAccountWithoutGivingBackRevokedAccessOrMemberships() throws Exception {
        AppUser admin = sa();
        AppUser target = staff("CS", "REVOKED");
        Farm farm = farm();
        member(farm, target, "MANAGER", "INACTIVE");
        identity(target, false);
        target.setAccountStatus("SUSPENDED");
        em.flush();

        JsonNode detail = json(command(admin, target.getId(), "restore", body("Đã xác minh chủ tài khoản", version(target)), "uc8-restore").andExpect(status().isOk()));
        assertThat(detail.path("accountStatus").asText()).isEqualTo("ACTIVE");
        assertThat(detail.path("emailVerified").asBoolean()).isFalse();
        assertThat(detail.path("actions").get(0).asText()).isEqualTo("SUSPEND");
        assertThat(detail.path("platformAccessStatus").asText()).isEqualTo("REVOKED");
        assertThat(detail.path("farmCount").asLong()).isZero();
        assertThat(em.createQuery("select m.status from FarmMembership m where m.user.id=:u", String.class).setParameter("u", target.getId()).getSingleResult())
            .isEqualTo("INACTIVE");
        Object[] row = em.createQuery("select c.action, c.statusBefore, c.statusAfter from AppUserStatusChange c where c.account.id=:id", Object[].class)
            .setParameter("id", target.getId()).getSingleResult();
        assertThat(row).containsExactly("RESTORE", "SUSPENDED", "ACTIVE");
        assertThat(audits(target)).extracting(AuditLog::getAction).containsExactly("ACCOUNT_RESTORE");
    }

    /** TC-03-85: order of checks after the locks; every refused command writes nothing. */
    @Test
    void checksAccessAccountReasonOwnAccountStatusThenVersion() throws Exception {
        AppUser admin = sa();
        AppUser cs = staff("CS", "ACTIVE");
        AppUser target = user();
        long v = version(target);

        // COM-01 before the account lookup; COM-08 before the reason
        command(cs, 999_999_999L, "suspend", body("Nghi ngờ lộ", v), "k1").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        command(cs, target.getId(), "suspend", body("Nghi ngờ lộ", v), "k2").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        command(admin, 999_999_999L, "suspend", body("abc", v), "k3").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MSG-COM-08"));
        command(null, target.getId(), "suspend", body("Nghi ngờ lộ", v), "k4").andExpect(status().isUnauthorized());

        // Reason: trimmed, 5–500, at least 5 characters that are not spaces (Table III-1)
        command(admin, target.getId(), "suspend", body("a b c d", v), "k5").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("reason"));
        command(admin, target.getId(), "suspend", body("x".repeat(501), v), "k6").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        command(admin, target.getId(), "suspend", body("   ", v), "k7").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
        command(admin, target.getId(), "suspend", body("Nghi ngờ lộ", null), "k8").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("version"));
        command(admin, target.getId(), "suspend", body("Nghi ngờ lộ", v), null).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("Idempotency-Key"));

        // Own account: FE03-17 (after the reason); A10 of one's own account offers no suspension
        command(admin, admin.getId(), "suspend", body("abc", version(admin)), "k9").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10"));
        command(admin, admin.getId(), "suspend", body("Tự khóa thử", version(admin)), "k10").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE03-17"));
        assertThat(json(read(admin, BASE + "/{id}", admin.getId()).andExpect(status().isOk())).path("actions")).isEmpty();

        // Requested status already in place: FE03-20 even with an outdated version; then the version: COM-05
        command(admin, target.getId(), "restore", body("Khôi phục thử", v + 7), "k11").andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE03-20")).andExpect(jsonPath("$.params.target").value(target.getEmail()))
            .andExpect(jsonPath("$.params.value").value("status"));
        command(admin, target.getId(), "suspend", body("Nghi ngờ lộ", v + 7), "k12").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));

        assertThat(accountStatus(target)).isEqualTo("ACTIVE");
        assertThat(version(target)).isEqualTo(v);
        assertThat(history(target)).isZero();
        assertThat(audits(target)).isEmpty();
        assertThat(history(admin)).isZero();
    }

    /** TC-03-88 (TC-03-31): the suspended CS's non-CLOSED tickets return to the queue in the same command, status unchanged. */
    @Test
    void returnsTheSuspendedSupportStaffTicketsToTheQueue() throws Exception {
        AppUser admin = sa();
        AppUser cs = staff("CS", "ACTIVE");
        SupportTicket inProgress = ticket(cs, "IN_PROGRESS");
        SupportTicket waiting = ticket(cs, "WAITING_CUSTOMER");
        SupportTicket resolved = ticket(cs, "RESOLVED");
        SupportTicket closed = ticket(cs, "CLOSED");
        SupportTicket other = ticket(staff("CS", "ACTIVE"), "IN_PROGRESS");

        command(admin, cs.getId(), "suspend", body("Nghỉ việc đột xuất", version(cs)), "uc8-cs").andExpect(status().isOk());

        for (SupportTicket ticket : List.of(inProgress, waiting, resolved)) {
            SupportTicket now = em.find(SupportTicket.class, ticket.getId());
            assertThat(now.getAssignedCs()).isNull();
            assertThat(now.getStatus()).isEqualTo(ticket.getStatus());
        }
        assertThat(em.find(SupportTicket.class, closed.getId()).getAssignedCs().getId()).isEqualTo(cs.getId());
        assertThat(em.find(SupportTicket.class, other.getId()).getAssignedCs()).isNotNull();
        assertThat(em.createQuery("select count(h) from SupportHistory h where h.eventType='AUTO_REQUEUE' and h.ticket.id in :ids", Long.class)
            .setParameter("ids", List.of(inProgress.getId(), waiting.getId(), resolved.getId(), closed.getId())).getSingleResult()).isEqualTo(3);
    }

    /** TC-03-89: an OPEN internal request of a suspended recipient is flagged for reassignment until the account is restored. */
    @Test
    void flagsOpenInternalRequestsOfASuspendedRecipientForReassignment() throws Exception {
        AppUser admin = sa();
        AppUser cs = staff("CS", "ACTIVE");
        AppUser pm = staff("PM", "ACTIVE");
        SupportTicket ticket = ticket(cs, "IN_PROGRESS");
        InternalRequest open = internalRequest(ticket, cs, pm, "PM", "OPEN");
        InternalRequest done = internalRequest(ticket, cs, pm, "PM", "DONE");

        assertThat(flags(cs, ticket)).containsEntry(open.getId(), false).containsEntry(done.getId(), false);
        command(admin, pm.getId(), "suspend", body("Nghi ngờ lộ mật khẩu", version(pm)), "uc8-pm-off").andExpect(status().isOk());
        assertThat(flags(cs, ticket)).containsEntry(open.getId(), true).containsEntry(done.getId(), false);
        command(admin, pm.getId(), "restore", body("Đã đổi mật khẩu", version(pm)), "uc8-pm-on").andExpect(status().isOk());
        assertThat(flags(cs, ticket)).containsEntry(open.getId(), false);
    }

    private Map<Long, Boolean> flags(AppUser cs, SupportTicket ticket) throws Exception {
        JsonNode view = json(read(cs, "/api/platform/support/tickets/{id}", ticket.getId()).andExpect(status().isOk()));
        Map<Long, Boolean> flags = new LinkedHashMap<>();
        view.path("internalRequests").forEach(request -> flags.put(request.path("id").asLong(), request.path("needsReassignment").asBoolean()));
        return flags;
    }
}
