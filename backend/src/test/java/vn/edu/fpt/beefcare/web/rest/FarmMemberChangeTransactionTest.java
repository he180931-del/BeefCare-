package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmMembershipService;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.MemberChange;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-06 (D30) without an outer transaction: the membership, its history row and the audit entry commit or roll back
 * together; a repeated key replays; two concurrent commands on one row leave one change. Also run on PostgreSQL.
 */
@ServiceIntegrationTest
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:member_change_transactions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1")
class FarmMemberChangeTransactionTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired FarmMembershipService service;

    protected record Fixture(long farmId, String ownerEmail, long membershipId, int version) {}

    protected Fixture fixture() {
        return new TransactionTemplate(transactionManager).execute(tx -> {
            var farm = farm(); var owner = memberWithRole(farm, FarmRole.OWNER); var manager = memberWithRole(farm, FarmRole.MANAGER);
            Long id = em.createQuery("select m.id from FarmMembership m where m.user.id=:u", Long.class).setParameter("u", manager.getId()).getSingleResult();
            return new Fixture(farm.getId(), owner.getEmail(), id, 0);
        });
    }

    private Map<String, Object> deactivate(Fixture f, String reason) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", "DEACTIVATE"); body.put("effectiveDate", TODAY.toString()); body.put("reason", reason); body.put("expectedVersion", f.version());
        return body;
    }

    protected ResultActions change(Fixture f, Map<String, Object> body, String key) throws Exception {
        return mvc.perform(put("/api/farms/{f}/members/{m}", f.farmId(), f.membershipId()).with(SecurityMockMvcRequestPostProcessors.user(f.ownerEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content(mapper.writeValueAsBytes(body)));
    }

    protected long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }

    private long history(Fixture f) { return count("select count(*) from farm_membership_change where membership_id=?", f.membershipId()); }
    private long audits(Fixture f) { return count("select count(*) from audit_log where target_type='FarmMembership' and target_id=?", f.membershipId()); }
    private String memberStatus(Fixture f) { return jdbc.queryForObject("select status from farm_membership where id=?", String.class, f.membershipId()); }

    protected boolean postgres() {
        return Boolean.TRUE.equals(jdbc.execute((java.sql.Connection connection) -> "PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())));
    }

    @Test
    void commitsTheMembershipHistoryAndAuditTogetherAndReplaysTheSameKey() throws Exception {
        Fixture f = fixture();
        String first = change(f, deactivate(f, "Nghỉ việc cuối tháng"), "off").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(memberStatus(f)).isEqualTo("INACTIVE");
        assertThat(jdbc.queryForObject("select role_before || '/' || status_before || '>' || role_after || '/' || status_after || ':' || reason from farm_membership_change where membership_id=?",
            String.class, f.membershipId())).isEqualTo("MANAGER/ACTIVE>MANAGER/INACTIVE:Nghỉ việc cuối tháng");
        assertThat(history(f)).isEqualTo(1); assertThat(audits(f)).isEqualTo(1);
        // GBR-88: the same key and body returns the first result and writes nothing more
        assertThat(change(f, deactivate(f, "Nghỉ việc cuối tháng"), "off").andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).isEqualTo(first);
        assertThat(history(f)).isEqualTo(1); assertThat(audits(f)).isEqualTo(1);
        // ... and the same key with other data is refused
        change(f, deactivate(f, "Lý do khác hẳn"), "off").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        assertThat(history(f)).isEqualTo(1);
    }

    @Test
    void aFailureAfterSavingRollsBackTheMembershipHistoryAndAudit() {
        Fixture f = fixture();
        actAs(new AppUser().email(f.ownerEmail()));
        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
            service.changeMember(f.farmId(), f.membershipId(), new MemberChange("DEACTIVATE", null, TODAY, "Nghỉ việc", f.version()));
            // A real failure inside the same transaction, after the membership, history and audit were flushed.
            throw DomainException.badRequest("MSG-COM-02");
        })).isInstanceOf(DomainException.class);
        assertThat(memberStatus(f)).isEqualTo("ACTIVE");
        assertThat(count("select version from farm_membership where id=?", f.membershipId())).isEqualTo(f.version());
        assertThat(history(f)).isZero(); assertThat(audits(f)).isZero();
    }

    @Test
    void concurrentCommandsOnOneMemberLeaveOneChange() throws Exception {
        Fixture f = fixture();
        CountDownLatch start = new CountDownLatch(1);
        java.util.function.Function<String, MockHttpServletResponse> run = key -> {
            try { start.await(); return change(f, deactivate(f, "Nghỉ việc " + key), key).andReturn().getResponse(); }
            catch (Exception failure) { throw new IllegalStateException(failure); }
        };
        var a = CompletableFuture.supplyAsync(() -> run.apply("race-a"));
        var b = CompletableFuture.supplyAsync(() -> run.apply("race-b"));
        start.countDown();
        var results = java.util.List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
        assertThat(results.stream().filter(r -> r.getStatus() == 200)).hasSize(1);
        MockHttpServletResponse loser = results.stream().filter(r -> r.getStatus() != 200).findFirst().orElseThrow();
        assertThat(loser.getStatus()).isEqualTo(409);
        // On PostgreSQL the row lock makes the loser read the committed status (MSG-FE03-20); H2 may report MSG-COM-05.
        assertThat(mapper.readTree(loser.getContentAsString()).path("code").asText()).isIn(postgres() ? Set.of("MSG-FE03-20") : Set.of("MSG-FE03-20", "MSG-COM-05"));
        assertThat(memberStatus(f)).isEqualTo("INACTIVE");
        assertThat(history(f)).isEqualTo(1); assertThat(audits(f)).isEqualTo(1);
    }
}
