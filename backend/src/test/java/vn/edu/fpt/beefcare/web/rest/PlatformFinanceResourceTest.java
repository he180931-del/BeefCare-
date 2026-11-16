package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.CashReportSnapshotRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceHistoryRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.CreateRecord;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.RecordFields;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.ReportRequest;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.VersionedAction;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** Real HTTP contract for FE21, including session role, CSRF, idempotency and database readback. */
@ServiceIntegrationTest
@Transactional
class PlatformFinanceResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ManualFinanceRecordRepository records;
    @Autowired ManualFinanceHistoryRepository history;
    @Autowired CashReportSnapshotRepository snapshots;

    private AppUser staff(PlatformRole role) {
        AppUser actor = user();
        User identity = new User();
        identity.setLogin(actor.getEmail());
        identity.setEmail(actor.getEmail());
        identity.setPassword("$2a$10$01234567890123456789012345678901234567890123456789012");
        identity.setActivated(true);
        save(identity);
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(actor);
        access.setRole(role.name());
        access.setStatus("ACTIVE");
        save(access);
        return actor;
    }

    private String json(Object value) throws Exception { return mapper.writeValueAsString(value); }
    private RequestPostProcessor as(AppUser actor) {
        return org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(actor.getEmail());
    }

    @Test
    void pmCompletesHttpWorkflowAndReadsBackThePersistedSnapshot() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        CreateRecord create = new CreateRecord(new RecordFields(
            "INCOME", "OTHER_INCOME", new BigDecimal("125000"), TODAY.minusDays(1), "GENERAL", null,
            "PT-HTTP-01", "Thu thử qua API", "MANUAL"), null);

        String createdBody = mvc.perform(post("/api/platform/finance/records")
                .with(as(pm)).with(csrf())
                .header("Idempotency-Key", "fe21-http-create")
                .contentType(MediaType.APPLICATION_JSON).content(json(create)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.state").value("DRAFT"))
            .andReturn().getResponse().getContentAsString();
        JsonNode created = mapper.readTree(createdBody);
        long recordId = created.path("id").asLong();
        long draftVersion = created.path("version").asLong();

        // Replay is durable and does not create a second record/history row.
        mvc.perform(post("/api/platform/finance/records")
                .with(as(pm)).with(csrf())
                .header("Idempotency-Key", "fe21-http-create")
                .contentType(MediaType.APPLICATION_JSON).content(json(create)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(recordId));
        assertThat(records.count()).isEqualTo(1);
        assertThat(history.findAllByRecord_IdOrderByChangedAtAscIdAsc(recordId)).hasSize(1);

        String postedBody = mvc.perform(post("/api/platform/finance/records/{id}/post", recordId)
                .with(as(pm)).with(csrf())
                .header("Idempotency-Key", "fe21-http-post")
                .contentType(MediaType.APPLICATION_JSON).content(json(new VersionedAction(draftVersion, null))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("POSTED"))
            .andReturn().getResponse().getContentAsString();
        long postedVersion = mapper.readTree(postedBody).path("version").asLong();

        String reportBody = mvc.perform(post("/api/platform/finance/reports")
                .with(as(pm)).with(csrf())
                .header("Idempotency-Key", "fe21-http-report")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new ReportRequest(TODAY.minusDays(2), TODAY, null, "ALL"))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.summary.totalIncome").value(125000))
            .andExpect(jsonPath("$.lines[0].sourceVersion").isNumber())
            .andReturn().getResponse().getContentAsString();
        long reportId = mapper.readTree(reportBody).path("id").asLong();

        mvc.perform(get("/api/platform/finance/reports/{id}/xlsx", reportId).with(as(pm)))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", "attachment; filename=beefcare-cash-report-" + reportId + ".xlsx"))
            .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));

        mvc.perform(post("/api/platform/finance/records/{id}/void", recordId)
                .with(as(pm)).with(csrf())
                .header("Idempotency-Key", "fe21-http-void")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(new VersionedAction(postedVersion, "Chứng từ không hợp lệ"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("VOID"));

        assertThat(records.findById(recordId).orElseThrow().getState()).isEqualTo("VOID");
        assertThat(history.findAllByRecord_IdOrderByChangedAtAscIdAsc(recordId))
            .extracting(item -> item.getAction()).containsExactly("CREATE", "POST", "VOID");
        assertThat(snapshots.findById(reportId).orElseThrow().getDetailsJson())
            .contains("\"amount\":125000", "\"sourceVersion\":");
        // S1 remains immutable after the source record is voided.
        mvc.perform(get("/api/platform/finance/reports/{id}", reportId).with(as(pm)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.totalIncome").value(125000));
    }

    @Test
    void httpBoundaryRejectsMissingKeyWrongRoleAndAnonymousSession() throws Exception {
        AppUser pm = staff(PlatformRole.PM);
        AppUser cs = staff(PlatformRole.CS);
        CreateRecord body = new CreateRecord(new RecordFields(
            "EXPENSE", "DOMAIN_SOFTWARE", BigDecimal.ONE, TODAY, "GENERAL", null, null, null, "MANUAL"), null);

        mvc.perform(post("/api/platform/finance/records")
                .with(as(pm)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(json(body)))
            .andExpect(status().isBadRequest());
        mvc.perform(get("/api/platform/finance/records").with(as(cs)))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        mvc.perform(get("/api/platform/finance/records").with(anonymous()))
            .andExpect(status().isUnauthorized());
        assertThat(records.count()).isZero();
    }
}
