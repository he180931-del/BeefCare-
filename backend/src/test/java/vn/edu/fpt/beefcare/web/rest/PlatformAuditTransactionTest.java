package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.ChangeRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE17-01 (R-17-01, R-17-08) without an outer transaction, read back through A1: a rolled-back command leaves no
 * entry; a request repeated with the same key leaves exactly one.
 */
@ServiceIntegrationTest
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:platform_audit_transactions;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1")
class PlatformAuditTransactionTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired PlatformAccountAdministrationService accounts;

    private record Account(long id, String email, long version) {}

    private TransactionTemplate tx() { return new TransactionTemplate(transactionManager); }

    private Account staff(String role) {
        return tx().execute(status -> {
            AppUser user = user();
            save(new PlatformStaffAccess().user(user).role(role).status("ACTIVE"));
            return new Account(user.getId(), user.getEmail(), user.getVersion());
        });
    }

    private long entriesFor(Account admin, Account target) throws Exception {
        String body = mvc.perform(get("/api/platform/audit").param("from", TODAY.toString()).param("to", TODAY.toString()).param("action", "ACCOUNT_SUSPENDED")
                .with(SecurityMockMvcRequestPostProcessors.user(admin.email())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long count = 0;
        for (JsonNode item : mapper.readTree(body).path("items")) {
            String id = mvc.perform(get("/api/platform/audit/{id}", item.path("id").asLong()).with(SecurityMockMvcRequestPostProcessors.user(admin.email())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            if (mapper.readTree(id).path("targetId").asLong() == target.id()) count++;
        }
        return count;
    }

    /** TC-17-04: the same key and body replays the first result; A1 shows one entry. */
    @Test
    void aRepeatedRequestKeyLeavesOneEntry() throws Exception {
        Account admin = staff("SA");
        Account target = staff("CS");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("reason", "Nghỉ việc đột xuất");
        body.put("version", target.version());
        for (int attempt = 0; attempt < 3; attempt++) {
            mvc.perform(post("/api/platform/accounts/{id}/suspend", target.id()).with(SecurityMockMvcRequestPostProcessors.user(admin.email())).with(csrf())
                    .header("Idempotency-Key", "fe17-replay").contentType("application/json").content(mapper.writeValueAsBytes(body)))
                .andExpect(status().isOk());
        }
        assertThat(entriesFor(admin, target)).isEqualTo(1);
    }

    /** TC-17-03: a failure after the audit was flushed rolls it back with the change; A1 shows nothing. */
    @Test
    void aRolledBackCommandLeavesNoEntry() throws Exception {
        Account admin = staff("SA");
        Account target = staff("CS");
        actAs(new AppUser().email(admin.email()));
        try {
            assertThatThrownBy(() -> tx().executeWithoutResult(status -> {
                accounts.suspend(target.id(), new ChangeRequest("Nghỉ việc đột xuất", target.version()));
                em.flush();
                throw DomainException.badRequest("MSG-COM-02");
            })).isInstanceOf(DomainException.class);
        } finally {
            SecurityContextHolder.clearContext();
        }
        assertThat(entriesFor(admin, target)).isZero();
    }
}
