package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.ChangeRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-08 (D32) without an outer transaction: the account, its history row, the audit entry and the requeued tickets
 * commit or roll back together; a repeated key replays; two SAs suspending each other leave one ACTIVE SA (BR-D06).
 * Also run on PostgreSQL ({@code PlatformAccountStatusPostgresIT}).
 */
@ServiceIntegrationTest
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:account_status_transactions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1")
class PlatformAccountStatusTransactionTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired PlatformAccountAdministrationService service;

    protected record Account(long id, String email, long version) {}

    private TransactionTemplate tx() { return new TransactionTemplate(transactionManager); }

    private Account staff(String role) {
        return tx().execute(status -> {
            AppUser user = user();
            save(new PlatformStaffAccess().user(user).role(role).status("ACTIVE"));
            return new Account(user.getId(), user.getEmail(), user.getVersion());
        });
    }

    private void ticketFor(Account cs) {
        tx().executeWithoutResult(status -> {
            SupportTicket ticket = new SupportTicket();
            ticket.setRequester(user()); ticket.setFarm(farm()); ticket.setAssignedCs(em.find(AppUser.class, cs.id()));
            ticket.setCategory("ACCOUNT_ACCESS"); ticket.setPriority("NORMAL"); ticket.setStatus("IN_PROGRESS");
            ticket.setCode("UC8T-" + next()); ticket.setSubject("Không đăng nhập được");
            ticket.setCreatedAt(Instant.parse("2026-10-27T01:00:00Z")); ticket.setUpdatedAt(Instant.parse("2026-10-27T01:00:00Z"));
            save(ticket);
        });
    }

    private Map<String, Object> body(String reason, long version) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reason", reason); body.put("version", version);
        return body;
    }

    protected ResultActions suspend(Account caller, Account target, Map<String, Object> body, String key) throws Exception {
        return mvc.perform(post("/api/platform/accounts/{id}/suspend", target.id()).with(SecurityMockMvcRequestPostProcessors.user(caller.email())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content(mapper.writeValueAsBytes(body)));
    }

    protected long count(String sql, Object... args) { return jdbc.queryForObject(sql, Long.class, args); }

    private String accountStatus(Account a) { return jdbc.queryForObject("select account_status from app_user where id=?", String.class, a.id()); }
    private long history(Account a) { return count("select count(*) from app_user_status_change where app_user_id=?", a.id()); }
    private long audits(Account a) { return count("select count(*) from audit_log where target_type='AppUser' and target_id=?", a.id()); }
    private long assignedTickets(Account a) { return count("select count(*) from support_ticket where assigned_cs_id=?", a.id()); }

    protected boolean postgres() {
        return Boolean.TRUE.equals(jdbc.execute((java.sql.Connection connection) -> "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())));
    }

    /** TC-03-86: status, history, audit and requeued tickets commit together; the same key replays, other data is COM-19. */
    @Test
    void commitsTheAccountHistoryAuditAndTicketsTogetherAndReplaysTheSameKey() throws Exception {
        Account admin = staff("SA");
        Account cs = staff("CS");
        ticketFor(cs);

        String first = suspend(admin, cs, body("Nghỉ việc đột xuất", cs.version()), "off").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(accountStatus(cs)).isEqualTo("SUSPENDED");
        assertThat(jdbc.queryForObject("select status_before || '>' || status_after || ':' || reason from app_user_status_change where app_user_id=?", String.class, cs.id()))
            .isEqualTo("ACTIVE>SUSPENDED:Nghỉ việc đột xuất");
        assertThat(history(cs)).isEqualTo(1); assertThat(audits(cs)).isEqualTo(1); assertThat(assignedTickets(cs)).isZero();
        // GBR-88: the same key and body returns the first result and writes nothing more
        assertThat(suspend(admin, cs, body("Nghỉ việc đột xuất", cs.version()), "off").andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).isEqualTo(first);
        assertThat(history(cs)).isEqualTo(1); assertThat(audits(cs)).isEqualTo(1);
        // ... and the same key with other data is refused
        suspend(admin, cs, body("Lý do khác hẳn", cs.version()), "off").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        assertThat(history(cs)).isEqualTo(1);
    }

    /** TC-03-86: a failure after everything was flushed rolls back the account, history, audit and the requeued tickets. */
    @Test
    void aFailureAfterSavingRollsBackTheAccountHistoryAuditAndTickets() {
        Account admin = staff("SA");
        Account cs = staff("CS");
        ticketFor(cs);
        actAs(new AppUser().email(admin.email()));
        try {
            assertThatThrownBy(() -> tx().executeWithoutResult(status -> {
                service.suspend(cs.id(), new ChangeRequest("Nghỉ việc đột xuất", cs.version()));
                // A real failure inside the same transaction, after the account, history, audit and tickets were flushed.
                throw DomainException.badRequest("MSG-COM-02");
            })).isInstanceOf(DomainException.class);
        } finally {
            SecurityContextHolder.clearContext();
        }
        assertThat(accountStatus(cs)).isEqualTo("ACTIVE");
        assertThat(count("select version from app_user where id=?", cs.id())).isEqualTo(cs.version());
        assertThat(history(cs)).isZero(); assertThat(audits(cs)).isZero(); assertThat(assignedTickets(cs)).isEqualTo(1);
    }

    /**
     * TC-03-87 (G9): the last two ACTIVE SAs suspend each other. The first command holds its row locks while the second
     * starts; the second waits for them, then reads the committed suspension of its own SA and is refused. One SA stays.
     */
    @Test
    void twoAdministratorsSuspendingEachOtherLeaveOneActiveAdministrator() throws Exception {
        assumeTrue(postgres(), "row locks that wait for the other transaction: PostgreSQL only");
        tx().executeWithoutResult(status -> jdbc.update("update platform_staff_access set status='REVOKED' where upper(role)='SA'"));
        Account a = staff("SA");
        Account b = staff("SA");

        CountDownLatch firstHoldsLocks = new CountDownLatch(1);
        CountDownLatch releaseFirst = new CountDownLatch(1);
        CompletableFuture<Void> first = CompletableFuture.runAsync(() -> {
            actAs(new AppUser().email(a.email()));
            try {
                tx().executeWithoutResult(status -> {
                    service.suspend(b.id(), new ChangeRequest("SA B nghi bị lộ", b.version()));
                    firstHoldsLocks.countDown();
                    try { releaseFirst.await(20, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                });
            } finally {
                SecurityContextHolder.clearContext();
            }
        });
        assertThat(firstHoldsLocks.await(20, TimeUnit.SECONDS)).isTrue();
        CompletableFuture<MockHttpServletResponse> second = CompletableFuture.supplyAsync(() -> {
            try { return suspend(b, a, body("SA A nghi bị lộ", a.version()), "race-b").andReturn().getResponse(); }
            catch (Exception failure) { throw new IllegalStateException(failure); }
        });
        Thread.sleep(800);
        assertThat(second).as("the second command waits for the first one's row locks").isNotDone();
        releaseFirst.countDown();
        first.get(20, TimeUnit.SECONDS);
        MockHttpServletResponse refused = second.get(20, TimeUnit.SECONDS);

        assertThat(refused.getStatus()).as(refused.getContentAsString()).isEqualTo(403);
        assertThat(mapper.readTree(refused.getContentAsString()).path("code").asText()).isEqualTo("MSG-COM-01");
        assertThat(accountStatus(a)).isEqualTo("ACTIVE");
        assertThat(accountStatus(b)).isEqualTo("SUSPENDED");
        assertThat(count("select count(*) from platform_staff_access p join app_user u on u.id=p.user_id where upper(p.role)='SA' and upper(p.status)='ACTIVE' and upper(u.account_status)='ACTIVE'"))
            .isEqualTo(1);
        assertThat(history(a)).isZero(); assertThat(history(b)).isEqualTo(1);
    }
}
