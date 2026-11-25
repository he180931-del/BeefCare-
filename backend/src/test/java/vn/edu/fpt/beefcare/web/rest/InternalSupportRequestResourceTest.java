package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.anonymous;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.InternalSupportRequestService;
import vn.edu.fpt.beefcare.service.SupportTicketCommandService;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class InternalSupportRequestResourceTest extends DomainTestSupport {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SupportTicketCommandService tickets;
    @Autowired InternalSupportRequestService requests;

    @Test
    void namedRecipientCanAskForMoreInformationOverHttpAndAssignedCsCanClarify() throws Exception {
        Farm farm = farm();
        AppUser owner = owner(farm);
        AppUser cs = staff(PlatformRole.CS);
        AppUser pm = staff(PlatformRole.PM);

        actAs(owner);
        SupportDtos.Ticket created = tickets.create(new SupportDtos.Create(
            "SYSTEM_USAGE", "FARM", farm.getId(), "Không thể dùng hệ thống", "Cần kiểm tra trạng thái dịch vụ"
        ));
        actAs(cs);
        SupportDtos.Ticket assigned = tickets.process(created.id(), new SupportDtos.Processing(
            "CLAIM", null, null, null, null, null, created.version()
        ));
        SupportDtos.InternalView request = requests.create(assigned.id(), new SupportDtos.InternalCreate(
            PlatformRole.PM, pm.getId(), "Kiểm tra trạng thái dịch vụ", List.of(), assigned.version()
        ));

        String needMoreInfo = mapper.writeValueAsString(new SupportDtos.Complete(
            "NEED_MORE_INFO", "Vui lòng bổ sung mã giao dịch.", request.version()
        ));
        mvc.perform(post("/api/platform/internal-requests/{id}/completion", request.id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(pm.getEmail())).with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-needs-more-info")
                .content(needMoreInfo))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("WAITING_CS"))
            .andExpect(jsonPath("$.outcome").value("NEED_MORE_INFO"))
            .andExpect(jsonPath("$.resultNote").value("Vui lòng bổ sung mã giao dịch."))
            .andExpect(jsonPath("$.requestText").value("Kiểm tra trạng thái dịch vụ"))
            .andExpect(jsonPath("$.question").doesNotExist())
            .andExpect(jsonPath("$.context").doesNotExist())
            .andExpect(jsonPath("$.result").doesNotExist())
            .andExpect(jsonPath("$.domainResultAuditId").doesNotExist());

        em.flush();
        em.clear();
        InternalRequest waiting = em.find(InternalRequest.class, request.id());
        assertThat(waiting.getState()).isEqualTo("WAITING_CS");
        assertThat(waiting.getOutcome()).isEqualTo("NEED_MORE_INFO");

        String clarify = mapper.writeValueAsString(new SupportDtos.InternalManage(
            "CLARIFY", null, null, "Bổ sung mã giao dịch và thời điểm phát sinh.", waiting.getVersion()
        ));
        mvc.perform(post("/api/platform/support/tickets/{ticketId}/internal-requests/{id}/management", assigned.id(), request.id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(cs.getEmail())).with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-clarify")
                .content(clarify))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.resultNote").value("Bổ sung mã giao dịch và thời điểm phát sinh."))
            .andExpect(jsonPath("$.requestText").value("Kiểm tra trạng thái dịch vụ"))
            .andExpect(jsonPath("$.question").doesNotExist())
            .andExpect(jsonPath("$.context").doesNotExist())
            .andExpect(jsonPath("$.result").doesNotExist())
            .andExpect(jsonPath("$.domainResultAuditId").doesNotExist())
            .andExpect(jsonPath("$.recipientId").value(pm.getId()));

        em.flush();
        em.clear();
        InternalRequest reopened = em.find(InternalRequest.class, request.id());
        assertThat(reopened.getState()).isEqualTo("OPEN");
        assertThat(reopened.getResultText()).isEqualTo("Bổ sung mã giao dịch và thời điểm phát sinh.");
    }

    @Test
    void namedRecipientResponseOmitsCsContextAndDomainAuditMetadata() throws Exception {
        Scenario scenario = scenario();
        // The CS-facing create response may carry the selected context, but the named PM/SA
        // audience must receive only the minimal request/result/history projection.
        mvc.perform(get("/api/platform/internal-requests/{id}", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(scenario.request().id()))
            .andExpect(jsonPath("$.requestText").value("Kiểm tra trạng thái dịch vụ"))
            .andExpect(jsonPath("$.resultNote").doesNotExist())
            .andExpect(jsonPath("$.history").isArray())
            .andExpect(jsonPath("$.question").doesNotExist())
            .andExpect(jsonPath("$.context").doesNotExist())
            .andExpect(jsonPath("$.result").doesNotExist())
            .andExpect(jsonPath("$.domainResultAuditId").doesNotExist());
    }

    @Test
    void obsoleteDomainResultsRouteIsAbsentOverHttp() throws Exception {
        Scenario scenario = scenario();

        mvc.perform(get("/api/platform/internal-requests/{id}/domain-results", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").doesNotExist());
    }

    @Test
    void commandRoutesRequireAuthenticationAndCurrentNamedOrAssignedActor() throws Exception {
        Scenario scenario = scenario();
        String body = mapper.writeValueAsString(new SupportDtos.Complete(
            "NEED_MORE_INFO", "Cần bổ sung mã giao dịch.", scenario.request().version()
        ));

        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(anonymous()).with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-anonymous")
                .content(body))
            .andExpect(status().isUnauthorized());

        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.otherPm().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-wrong-recipient")
                .content(body))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-FE20-19"));

        String clarify = mapper.writeValueAsString(new SupportDtos.InternalManage(
            "CLARIFY", null, null, "Cần bổ sung mã giao dịch.", scenario.request().version()
        ));
        mvc.perform(post("/api/platform/support/tickets/{ticketId}/internal-requests/{id}/management", scenario.assigned().id(), scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.otherCs().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-wrong-cs")
                .content(clarify))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-FE20-09"));
    }

    @Test
    void commandsRejectBlankTextAndInvalidSourceStateOverHttp() throws Exception {
        Scenario scenario = scenario();
        String blankResult = mapper.writeValueAsString(new SupportDtos.Complete(
            "NEED_MORE_INFO", "   ", scenario.request().version()
        ));
        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-blank-result")
                .content(blankResult))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.fieldErrors[0].field").value("resultNote"));

        String clarifyWhileOpen = mapper.writeValueAsString(new SupportDtos.InternalManage(
            "CLARIFY", null, null, "Không thể làm rõ khi đang OPEN.", scenario.request().version()
        ));
        mvc.perform(post("/api/platform/support/tickets/{ticketId}/internal-requests/{id}/management", scenario.assigned().id(), scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.cs().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-clarify-open")
                .content(clarifyWhileOpen))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));

        String needMoreInfo = mapper.writeValueAsString(new SupportDtos.Complete(
            "NEED_MORE_INFO", "Cần bổ sung dữ liệu.", scenario.request().version()
        ));
        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-valid-needs-more-info")
                .content(needMoreInfo))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("WAITING_CS"));

        InternalRequest waiting = em.find(InternalRequest.class, scenario.request().id());
        String blankClarification = mapper.writeValueAsString(new SupportDtos.InternalManage(
            "CLARIFY", null, null, "  ", waiting.getVersion()
        ));
        mvc.perform(post("/api/platform/support/tickets/{ticketId}/internal-requests/{id}/management", scenario.assigned().id(), scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.cs().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-blank-clarification")
                .content(blankClarification))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06"));
    }

    @ParameterizedTest
    @CsvSource({"CONFIRMED,DONE", "NOT_CONFIRMED,DONE", "NEED_MORE_INFO,WAITING_CS", "OUT_OF_SCOPE,DONE"})
    void targetContractUsesRequestTextResultNoteAndApprovedOutcomesOverHttp(String outcome, String expectedStatus) throws Exception {
        Scenario scenario = scenario();
        String body = mapper.writeValueAsString(java.util.Map.of(
            "outcome", outcome,
            "resultNote", "Đã xác minh thông tin theo phạm vi yêu cầu.",
            "expectedVersion", scenario.request().version()
        ));

        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-target-contract-" + outcome.toLowerCase())
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value(expectedStatus))
            .andExpect(jsonPath("$.outcome").value(outcome))
            .andExpect(jsonPath("$.resultNote").value("Đã xác minh thông tin theo phạm vi yêu cầu."))
            .andExpect(jsonPath("$.requestText").value("Kiểm tra trạng thái dịch vụ"))
            .andExpect(jsonPath("$.question").doesNotExist())
            .andExpect(jsonPath("$.context").doesNotExist())
            .andExpect(jsonPath("$.result").doesNotExist())
            .andExpect(jsonPath("$.domainResultAuditId").doesNotExist());
    }

    @Test
    void legacyDomainCompletionPayloadIsRejectedOverHttp() throws Exception {
        Scenario scenario = scenario();
        String body = "{\"outcome\":\"UNABLE\",\"result\":\"legacy result\",\"domainResultAuditId\":123,\"expectedVersion\":"
            + scenario.request().version() + "}";

        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-legacy-domain-completion")
                .content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void createPayloadRejectsLegacyQuestionAndContextFields() throws Exception {
        SupportDtos.InternalCreate target = mapper.readValue(
            "{\"targetRole\":\"PM\",\"recipientId\":7,\"requestText\":\"Kiểm tra dịch vụ\",\"ticketVersion\":3}",
            SupportDtos.InternalCreate.class
        );
        assertThat(target.requestText()).isEqualTo("Kiểm tra dịch vụ");
        assertThatThrownBy(() -> mapper.readValue(
            "{\"targetRole\":\"PM\",\"recipientId\":7,\"question\":\"Câu hỏi cũ\",\"ticketVersion\":3}",
            SupportDtos.InternalCreate.class
        )).isInstanceOf(com.fasterxml.jackson.databind.JsonMappingException.class);
        assertThatThrownBy(() -> mapper.readValue(
            "{\"targetRole\":\"PM\",\"recipientId\":7,\"requestText\":\"Kiểm tra dịch vụ\",\"context\":[],\"ticketVersion\":3}",
            SupportDtos.InternalCreate.class
        )).isInstanceOf(com.fasterxml.jackson.databind.JsonMappingException.class);
    }

    @Test
    void targetRequestTextIsAcceptedOverHttpAndPersistedThroughLegacyQuestionColumn() throws Exception {
        Farm farm = farm();
        AppUser owner = owner(farm);
        AppUser cs = staff(PlatformRole.CS);
        AppUser pm = staff(PlatformRole.PM);

        actAs(owner);
        SupportDtos.Ticket created = tickets.create(new SupportDtos.Create(
            "SYSTEM_USAGE", "FARM", farm.getId(), "Không thể dùng hệ thống", "Cần kiểm tra trạng thái dịch vụ"
        ));
        actAs(cs);
        SupportDtos.Ticket assigned = tickets.process(created.id(), new SupportDtos.Processing(
            "CLAIM", null, null, null, null, null, created.version()
        ));

        var response = mvc.perform(post("/api/platform/support/tickets/{id}/internal-requests", assigned.id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(cs.getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-target-create")
                .content("{\"targetRole\":\"PM\",\"recipientId\":" + pm.getId()
                    + ",\"requestText\":\"Kiểm tra dịch vụ bằng hợp đồng FE20\",\"ticketVersion\":" + assigned.version() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.requestText").value("Kiểm tra dịch vụ bằng hợp đồng FE20"))
            .andExpect(jsonPath("$.question").doesNotExist())
            .andExpect(jsonPath("$.context").doesNotExist())
            .andExpect(jsonPath("$.result").doesNotExist())
            .andExpect(jsonPath("$.domainResultAuditId").doesNotExist())
            .andReturn();

        mvc.perform(post("/api/platform/support/tickets/{id}/internal-requests", assigned.id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(cs.getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-legacy-create")
                .content("{\"targetRole\":\"PM\",\"recipientId\":" + pm.getId()
                    + ",\"question\":\"legacy\",\"context\":[],\"ticketVersion\":" + assigned.version() + "}"))
            .andExpect(status().isBadRequest());

        long requestId = mapper.readTree(response.getResponse().getContentAsString()).get("id").asLong();
        em.flush();
        em.clear();
        assertThat(em.find(InternalRequest.class, requestId).getQuestion()).isEqualTo("Kiểm tra dịch vụ bằng hợp đồng FE20");
    }

    @Test
    void staleCompletionAndClarificationAreRejectedWithoutChangingPersistedState() throws Exception {
        Scenario scenario = scenario();
        int staleRequestVersion = scenario.request().version();
        String needMoreInfo = mapper.writeValueAsString(new SupportDtos.Complete(
            "NEED_MORE_INFO", "Cần bổ sung dữ liệu.", staleRequestVersion
        ));
        mvc.perform(post("/api/platform/internal-requests/{id}/completion", scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.pm().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-stale-first")
                .content(needMoreInfo))
            .andExpect(status().isOk());

        InternalRequest waiting = em.find(InternalRequest.class, scenario.request().id());
        int waitingVersion = waiting.getVersion();
        String firstClarification = mapper.writeValueAsString(new SupportDtos.InternalManage(
            "CLARIFY", null, null, "Bổ sung mã giao dịch.", waitingVersion
        ));
        mvc.perform(post("/api/platform/support/tickets/{ticketId}/internal-requests/{id}/management", scenario.assigned().id(), scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.cs().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-stale-clarify")
                .content(firstClarification))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"));

        String staleClarification = mapper.writeValueAsString(new SupportDtos.InternalManage(
            "CLARIFY", null, null, "Không được áp dụng với bản cũ.", waitingVersion
        ));
        mvc.perform(post("/api/platform/support/tickets/{ticketId}/internal-requests/{id}/management", scenario.assigned().id(), scenario.request().id())
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(scenario.cs().getEmail()))
                .with(csrf()).contentType("application/json")
                .header("Idempotency-Key", "fe20-http-stale-second")
                .content(staleClarification))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));

        em.flush();
        em.clear();
        InternalRequest reopened = em.find(InternalRequest.class, scenario.request().id());
        assertThat(reopened.getState()).isEqualTo("OPEN");
        assertThat(reopened.getResultText()).isEqualTo("Bổ sung mã giao dịch.");
        assertThat(reopened.getVersion()).isGreaterThan(waitingVersion);
    }

    private Scenario scenario() {
        Farm farm = farm();
        AppUser owner = owner(farm);
        AppUser cs = staff(PlatformRole.CS);
        AppUser otherCs = staff(PlatformRole.CS);
        AppUser pm = staff(PlatformRole.PM);
        AppUser otherPm = staff(PlatformRole.PM);

        actAs(owner);
        SupportDtos.Ticket created = tickets.create(new SupportDtos.Create(
            "SYSTEM_USAGE", "FARM", farm.getId(), "Không thể dùng hệ thống", "Cần kiểm tra trạng thái dịch vụ"
        ));
        actAs(cs);
        SupportDtos.Ticket assigned = tickets.process(created.id(), new SupportDtos.Processing(
            "CLAIM", null, null, null, null, null, created.version()
        ));
        SupportDtos.InternalView request = requests.create(assigned.id(), new SupportDtos.InternalCreate(
            PlatformRole.PM, pm.getId(), "Kiểm tra trạng thái dịch vụ", List.of(), assigned.version()
        ));
        return new Scenario(cs, otherCs, pm, otherPm, assigned, request);
    }

    private record Scenario(AppUser cs, AppUser otherCs, AppUser pm, AppUser otherPm, SupportDtos.Ticket assigned, SupportDtos.InternalView request) {}

    private AppUser owner(Farm farm) {
        AppUser owner = user();
        owner.setOwnerRegistrationCompleted(true);
        owner.setOwnerRegistrationCompletedAt(clock.instant());
        member(farm, owner, "OWNER", "ACTIVE");
        em.flush();
        return owner;
    }

    private AppUser staff(PlatformRole role) {
        AppUser staff = user();
        save(new PlatformStaffAccess().user(staff).role(role.name()).status("ACTIVE"));
        return staff;
    }
}
