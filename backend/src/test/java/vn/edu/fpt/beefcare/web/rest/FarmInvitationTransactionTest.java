package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.EmailDeliveryJob;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.EmailDeliveryJobRepository;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmAction;
import vn.edu.fpt.beefcare.service.FarmMembershipService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.InviteRequest;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.InvitationView;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;
import vn.edu.fpt.beefcare.service.email.EmailDeliveryJobService;
import vn.edu.fpt.beefcare.service.email.MockEmailDelivery;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** No outer transaction: every HTTP command commits or rolls back, with fresh DB readback. */
@ServiceIntegrationTest
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:invitation_transactions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1")
class FarmInvitationTransactionTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired EmailDeliveryJobService dispatcher;
    @Autowired EmailDeliveryJobRepository jobs;
    @Autowired MockEmailDelivery inbox;
    @Autowired ActionLinkSigner signer;
    @Autowired FarmMembershipService membershipService;
    @Autowired IdempotencyCommandService commands;

    protected record Fixture(long farmId, String ownerEmail, String email) {}
    protected Fixture fixture() {
        return new TransactionTemplate(transactionManager).execute(tx -> {
            var f = farm(); var owner = memberWithRole(f, FarmRole.OWNER); var invitee = user();
            return new Fixture(f.getId(), owner.getEmail(), invitee.getEmail());
        });
    }

    protected ResultActions send(Fixture f, String role, String key) throws Exception {
        return mvc.perform(post("/api/farms/{id}/invitations", f.farmId()).with(SecurityMockMvcRequestPostProcessors.user(f.ownerEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json")
            .content(mapper.writeValueAsBytes(Map.of("email", f.email(), "role", role, "validityDays", 7))));
    }

    protected JsonNode created(Fixture f, String key) throws Exception {
        return mapper.readTree(send(f, "TECHNICIAN", key).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    protected long count(String table, Fixture f) {
        return jdbc.queryForObject("select count(*) from " + table + " where farm_id=?", Long.class, f.farmId());
    }

    protected EmailDeliveryJob job(Fixture f) {
        return jobs.findAll().stream().filter(j -> f.email().equals(j.getRecipient())).findFirst().orElseThrow();
    }

    @AfterEach
    void resetProvider() { inbox.failNextDeliveries(0); }

    @BeforeEach
    void finishEarlierCommittedMail() {
        inbox.failNextDeliveries(0);
        for (int round = 0; round < 20 && !jobs.findByStatusAndAvailableAtLessThanEqualOrderByCreatedAtAsc("PENDING", Instant.now(), org.springframework.data.domain.PageRequest.of(0, 1)).isEmpty(); round++) {
            dispatcher.dispatchDueJobs();
        }
    }

    @Test
    void commitsOneInvitationAuditOutboxAndMailIntentAndReplaysTheSameResult() throws Exception {
        Fixture f = fixture(); JsonNode first = created(f, "same-intent");
        assertThat(created(f, "same-intent")).isEqualTo(first);
        send(f, "MANAGER", "same-intent").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        assertThat(count("farm_invitation", f)).isEqualTo(1);
        assertThat(count("farm_membership", f)).isEqualTo(1);
        assertThat(count("outbox_event", f)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from audit_log where target_type='FarmInvitation' and target_id=?", Long.class, first.path("id").asLong())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from idempotency_record where farm_scope=?", Long.class, f.farmId())).isEqualTo(1);
        assertThat(jobs.findAll().stream().filter(j -> f.email().equals(j.getRecipient())).toList()).hasSize(1);
        JsonNode read = mapper.readTree(mvc.perform(get("/api/farms/{id}/invitations", f.farmId()).with(SecurityMockMvcRequestPostProcessors.user(f.ownerEmail())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(read.path("items").get(0)).isEqualTo(first);
        assertThat(inbox.findMessagesFor(f.email())).isEmpty();
    }

    @Test
    void rollsBackAllEffectsWhenTheCommandFailsAfterSavingAndCanRetryTheSameKey() throws Exception {
        Fixture f = fixture();
        actAs(new vn.edu.fpt.beefcare.domain.AppUser().email(f.ownerEmail()));
        InviteRequest request = new InviteRequest(f.email(), "TECHNICIAN", 7);
        assertThatThrownBy(() -> commands.execute(f.farmId(), FarmAction.VIEW_FARM_INFORMATION, "INVITE_SEND", "retry-save", request, InvitationView.class, () -> {
            membershipService.invite(f.farmId(), request);
            // A real failure inside the command transaction, after invitation + audit + email intent were flushed.
            throw DomainException.badRequest("MSG-COM-02");
        })).isInstanceOf(DomainException.class);
        assertThat(count("farm_invitation", f)).isZero();
        assertThat(count("audit_log", f)).isZero();
        assertThat(count("outbox_event", f)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from idempotency_record where farm_scope=?", Long.class, f.farmId())).isZero();
        assertThat(jobs.findAll().stream().noneMatch(j -> f.email().equals(j.getRecipient()))).isTrue();
        created(f, "retry-save");
        assertThat(count("farm_invitation", f)).isEqualTo(1);
    }

    @Test
    void sendsAVietnameseSingleUseLinkOnceAfterCommitAndRetriesProviderFailure() throws Exception {
        Fixture f = fixture(); JsonNode invitation = created(f, "mail");
        inbox.failNextDeliveries(1); dispatcher.dispatchDueJobs();
        assertThat(count("farm_invitation", f)).isEqualTo(1);
        assertThat(count("farm_membership", f)).isEqualTo(1);
        EmailDeliveryJob job = job(f); assertThat(job.getStatus()).isEqualTo("PENDING");
        job.setAvailableAt(Instant.now().minusSeconds(1)); jobs.saveAndFlush(job);
        dispatcher.dispatchDueJobs(); dispatcher.dispatchDueJobs();
        assertThat(job(f).getStatus()).isEqualTo("SENT");
        var messages = inbox.findMessagesFor(f.email()); assertThat(messages).hasSize(1);
        String plain = messages.get(0).plainText();
        assertThat(plain).contains("Kỹ thuật viên", "/invitation/accept?token=", "giờ Việt Nam");
        var matcher = java.util.regex.Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(plain);
        assertThat(matcher.find()).isTrue();
        String raw = matcher.group(1);
        assertThat(jdbc.queryForObject("select token_hash from farm_invitation where id=?", String.class, invitation.path("id").asLong())).isEqualTo(signer.hash(raw));
        assertThat(invitation.toString()).doesNotContain(raw);
    }

    @Test
    void invitationRetriesBeyondEightAttemptsUntilTheTwentyFourHourDeadline() throws Exception {
        Fixture f = fixture(); created(f, "long-retry");
        EmailDeliveryJob job = job(f); job.setAttempts(8); job.setAvailableAt(Instant.now().minusSeconds(1)); jobs.saveAndFlush(job);
        inbox.failNextDeliveries(100); dispatcher.dispatchDueJobs();
        job = job(f); assertThat(job.getStatus()).isEqualTo("PENDING");
        assertThat(job.getAttempts()).isEqualTo(9);
        assertThat(job.getAvailableAt()).isAfter(Instant.now()).isBeforeOrEqualTo(job.getCreatedAt().plus(Duration.ofHours(24)));
        job.setCreatedAt(Instant.now().minus(Duration.ofHours(24))); job.setAvailableAt(Instant.now().minusSeconds(1)); jobs.saveAndFlush(job);
        inbox.failNextDeliveries(0); dispatcher.dispatchDueJobs();
        assertThat(job(f).getStatus()).isEqualTo("FAILED");
        assertThat(inbox.findMessagesFor(f.email())).isEmpty();
        assertThat(count("farm_invitation", f)).isEqualTo(1);
    }

    @Test
    void concurrentDifferentIntentsForTheSameEmailCommitOnlyOneInvitation() throws Exception {
        Fixture f = fixture(); CountDownLatch start = new CountDownLatch(1);
        java.util.function.Function<String, Integer> run = key -> {
            try { start.await(); return send(f, "MANAGER", key).andReturn().getResponse().getStatus(); }
            catch (Exception failure) { throw new IllegalStateException(failure); }
        };
        var a = CompletableFuture.supplyAsync(() -> run.apply("concurrent-a"));
        var b = CompletableFuture.supplyAsync(() -> run.apply("concurrent-b")); start.countDown();
        assertThat(java.util.List.of(a.get(20, java.util.concurrent.TimeUnit.SECONDS), b.get(20, java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 409);
        assertThat(count("farm_invitation", f)).isEqualTo(1);
        assertThat(jobs.findAll().stream().filter(j -> f.email().equals(j.getRecipient())).toList()).hasSize(1);
    }

    // ------------------------------------------------------------------ UC-FE03-03 (D27)

    protected ResultActions command(Fixture f, long invitationId, String action, int version, String key) throws Exception {
        return mvc.perform(post("/api/farms/{f}/invitations/{i}/" + action, f.farmId(), invitationId).with(SecurityMockMvcRequestPostProcessors.user(f.ownerEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content("{\"expectedVersion\":" + version + "}"));
    }

    protected long audits(String action, long invitationId) {
        return jdbc.queryForObject("select count(*) from audit_log where action=? and target_type='FarmInvitation' and target_id=?", Long.class, action, invitationId);
    }

    protected String linkIn(String plainText) {
        var matcher = java.util.regex.Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(plainText);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    @Test
    void resendCommitsANewPeriodAndMailsOnlyTheNewestLinkOnce() throws Exception {
        Fixture f = fixture(); JsonNode sent = created(f, "first-send"); long id = sent.path("id").asLong();
        dispatcher.dispatchDueJobs();
        assertThat(inbox.findMessagesFor(f.email())).hasSize(1);
        clock.set(clock.instant().plus(Duration.ofHours(2)));
        JsonNode resent = mapper.readTree(command(f, id, "resend", sent.path("version").asInt(), "resend").andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        assertThat(mapper.readTree(command(f, id, "resend", sent.path("version").asInt(), "resend").andExpect(status().isOk()).andReturn().getResponse().getContentAsString()))
            .isEqualTo(resent);
        assertThat(Duration.between(Instant.parse(sent.path("expiresAt").asText()), Instant.parse(resent.path("expiresAt").asText()))).isEqualTo(Duration.ofHours(2));
        assertThat(jdbc.queryForObject("select status from farm_invitation where id=?", String.class, id)).isEqualTo("PENDING");
        assertThat(audits("INVITE_RESEND", id)).isEqualTo(1);
        assertThat(jobs.findAll().stream().filter(j -> f.email().equals(j.getRecipient())).toList()).hasSize(2);
        dispatcher.dispatchDueJobs();
        var messages = inbox.findMessagesFor(f.email());
        assertThat(messages).hasSize(2);
        String hash = jdbc.queryForObject("select token_hash from farm_invitation where id=?", String.class, id);
        // the mock inbox lists the newest message first
        assertThat(signer.hash(linkIn(messages.get(0).plainText()))).isEqualTo(hash);
        assertThat(signer.hash(linkIn(messages.get(1).plainText()))).isNotEqualTo(hash);
        assertThat(count("farm_membership", f)).isEqualTo(1);
    }

    @Test
    void cancelCommitsTheStatusAndAuditAndDropsTheUnsentEmail() throws Exception {
        Fixture f = fixture(); JsonNode sent = created(f, "to-cancel"); long id = sent.path("id").asLong();
        command(f, id, "cancel", sent.path("version").asInt(), "cancel").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(jdbc.queryForObject("select status from farm_invitation where id=?", String.class, id)).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("select token_hash from farm_invitation where id=?", String.class, id)).isNotNull(); // D28
        assertThat(audits("INVITE_CANCEL", id)).isEqualTo(1);
        assertThat(job(f).getStatus()).isEqualTo("CANCELLED");
        dispatcher.dispatchDueJobs();
        assertThat(inbox.findMessagesFor(f.email())).isEmpty();
        assertThat(count("farm_membership", f)).isEqualTo(1);
    }

    @Test
    void concurrentAcceptAndCancelHaveOneWinnerAndACancelledLinkNeverGrantsAccess() throws Exception {
        Fixture f = fixture(); JsonNode sent = created(f, "race"); long id = sent.path("id").asLong();
        String token = signer.bearer("FARM_INVITATION", id, jdbc.queryForObject("select token_nonce from farm_invitation where id=?", String.class, id));
        CountDownLatch start = new CountDownLatch(1);
        java.util.function.Function<Call, org.springframework.mock.web.MockHttpServletResponse> run = call -> {
            try { start.await(); return call.perform().andReturn().getResponse(); }
            catch (Exception failure) { throw new IllegalStateException(failure); }
        };
        var accept = CompletableFuture.supplyAsync(() -> run.apply(() -> mvc.perform(post("/api/invitations/accept").with(SecurityMockMvcRequestPostProcessors.user(f.email())).with(csrf())
            .contentType("application/json").content(mapper.writeValueAsBytes(Map.of("token", token))))));
        var cancel = CompletableFuture.supplyAsync(() -> run.apply(() -> command(f, id, "cancel", sent.path("version").asInt(), "race-cancel")));
        start.countDown();
        var accepted = accept.get(20, java.util.concurrent.TimeUnit.SECONDS); var cancelled = cancel.get(20, java.util.concurrent.TimeUnit.SECONDS);
        String stored = jdbc.queryForObject("select status from farm_invitation where id=?", String.class, id);
        // On PostgreSQL the row locks make the loser read the committed row (MSG-FE03-08); H2 may report the race as MSG-COM-05.
        var loserCodes = postgres() ? java.util.Set.of("MSG-FE03-08") : java.util.Set.of("MSG-FE03-08", "MSG-COM-05");
        if ("ACCEPTED".equals(stored)) {
            assertThat(accepted.getStatus()).isEqualTo(200); assertThat(count("farm_membership", f)).isEqualTo(2);
            assertThat(cancelled.getStatus()).isEqualTo(409);
            assertThat(mapper.readTree(cancelled.getContentAsString()).path("code").asText()).isIn(loserCodes);
            assertThat(audits("INVITE_CANCEL", id)).isZero();
        } else {
            assertThat(stored).isEqualTo("CANCELLED");
            assertThat(cancelled.getStatus()).isEqualTo(200); assertThat(count("farm_membership", f)).isEqualTo(1);
            assertThat(accepted.getStatus()).isIn(postgres() ? java.util.Set.of(400) : java.util.Set.of(400, 409));
            assertThat(mapper.readTree(accepted.getContentAsString()).path("code").asText()).isIn(loserCodes);
        }
    }

    interface Call { ResultActions perform() throws Exception; }

    protected boolean postgres() {
        return Boolean.TRUE.equals(jdbc.execute((java.sql.Connection connection) -> "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())));
    }

    // ------------------------------------------------------------------ UC-FE03-04 (D28)

    protected String tokenOf(long invitationId) {
        return signer.bearer("FARM_INVITATION", invitationId, jdbc.queryForObject("select token_nonce from farm_invitation where id=?", String.class, invitationId));
    }

    protected ResultActions accept(Fixture f, String token) throws Exception {
        return mvc.perform(post("/api/invitations/accept").with(SecurityMockMvcRequestPostProcessors.user(f.email())).with(csrf())
            .contentType("application/json").content(mapper.writeValueAsBytes(Map.of("token", token))));
    }

    protected java.util.List<EmailDeliveryJob> ownerJobs(long membershipId) {
        return jobs.findAll().stream().filter(j -> "MEMBERSHIP".equals(j.getLinkSource()) && j.getLinkSourceId() == membershipId).toList();
    }

    @Test
    void acceptCommitsTheMembershipAuditAndOneVietnameseOwnerEmailTogether() throws Exception {
        Fixture f = fixture(); long id = created(f, "to-accept").path("id").asLong(); dispatcher.dispatchDueJobs();
        String token = tokenOf(id);
        JsonNode accepted = mapper.readTree(accept(f, token).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long membershipId = accepted.path("membershipId").asLong();
        accept(f, token).andExpect(status().isOk()).andExpect(jsonPath("$.membershipId").value(membershipId));
        assertThat(jdbc.queryForObject("select status from farm_invitation where id=?", String.class, id)).isEqualTo("ACCEPTED");
        assertThat(count("farm_membership", f)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from audit_log where action='MEMBER_ACCEPT' and target_id=?", Long.class, membershipId)).isEqualTo(1);
        assertThat(ownerJobs(membershipId)).singleElement().satisfies(job -> assertThat(job.getRecipient()).isEqualTo(f.ownerEmail()));
        dispatcher.dispatchDueJobs();
        assertThat(ownerJobs(membershipId)).singleElement().satisfies(job -> assertThat(job.getStatus()).isEqualTo("SENT"));
        var messages = inbox.findMessagesFor(f.ownerEmail());
        assertThat(messages).hasSize(1);
        assertThat(messages.get(0).subject()).isEqualTo("Thành viên mới đã tham gia trang trại");
        assertThat(messages.get(0).plainText()).contains(f.email(), "Kỹ thuật viên", "/thanh-vien?farmId=" + f.farmId(), "giờ Việt Nam");
    }

    @Test
    void aFailureAfterAcceptingRollsBackTheMembershipStatusAuditAndOwnerEmail() {
        Fixture f = fixture();
        long id;
        try { id = created(f, "rollback").path("id").asLong(); } catch (Exception failure) { throw new IllegalStateException(failure); }
        String token = tokenOf(id);
        actAs(new vn.edu.fpt.beefcare.domain.AppUser().email(f.email()));
        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            membershipService.accept(token);
            // A real failure inside the acceptance transaction, after membership, status, audit and e-mail intent were flushed.
            throw DomainException.badRequest("MSG-COM-02");
        })).isInstanceOf(DomainException.class);
        assertThat(jdbc.queryForObject("select status from farm_invitation where id=?", String.class, id)).isEqualTo("PENDING");
        assertThat(count("farm_membership", f)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from audit_log where action='MEMBER_ACCEPT' and farm_id=?", Long.class, f.farmId())).isZero();
        assertThat(jobs.findAll().stream().noneMatch(j -> "MEMBERSHIP".equals(j.getLinkSource()) && f.ownerEmail().equals(j.getRecipient()))).isTrue();
    }

    @Test
    void anOwnerWhoLostAccessBeforeDispatchGetsNoEmail() throws Exception {
        Fixture f = fixture(); long id = created(f, "lost-owner").path("id").asLong(); dispatcher.dispatchDueJobs();
        // Suspended before the acceptance: the scheduled JOB-07 poller (every 2 s in tests) cannot send in between.
        // Hikari runs with auto-commit off, so a bare JdbcTemplate update would be rolled back when the connection returns.
        Integer suspended = new TransactionTemplate(transactionManager).execute(tx -> jdbc.update("update app_user set account_status='SUSPENDED' where lower(email)=lower(?)", f.ownerEmail()));
        assertThat(suspended).isEqualTo(1);
        long membershipId = mapper.readTree(accept(f, tokenOf(id)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("membershipId").asLong();
        dispatcher.dispatchDueJobs();
        // JOB-07 "Recipient lost access": the event is closed without sending
        assertThat(ownerJobs(membershipId)).singleElement().satisfies(job -> assertThat(job.getStatus()).isEqualTo("CANCELLED"));
        assertThat(inbox.findMessagesFor(f.ownerEmail())).isEmpty();
    }
}
