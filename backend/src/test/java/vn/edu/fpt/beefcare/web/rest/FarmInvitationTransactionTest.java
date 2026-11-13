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
}
