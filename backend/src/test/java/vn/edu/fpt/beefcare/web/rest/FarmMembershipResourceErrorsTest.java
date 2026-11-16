package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import vn.edu.fpt.beefcare.service.DomainMessages;
import vn.edu.fpt.beefcare.service.FarmMembershipService;
import vn.edu.fpt.beefcare.service.IdempotencyCommandService;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.InvitationView;

/** Controller error contract only; real security/transactions are covered by the database tests. */
class FarmMembershipResourceErrorsTest {
    IdempotencyCommandService commands;
    FarmMembershipService service;
    MockMvc mvc;
    @BeforeEach
    void setup() {
        commands = mock(IdempotencyCommandService.class);
        service = mock(FarmMembershipService.class);
        mvc = MockMvcBuilders.standaloneSetup(new FarmMembershipResource(service, commands, new DomainMessages())).build();
    }
    @Test
    void storageFailureUsesTheSpecMessageWithoutExposingDatabaseDetails() throws Exception {
        doThrow(new DataIntegrityViolationException("private database detail")).when(commands)
            .execute(anyLong(), any(), anyString(), anyString(), any(), eq(InvitationView.class), any());
        var result = mvc.perform(post("/api/farms/1/invitations").header("Idempotency-Key", "save")
            .contentType("application/json").content("{\"email\":\"new@example.test\",\"role\":\"MANAGER\"}"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("MSG-COM-02")).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("private database detail");
    }
    @Test
    void concurrentUpdateRemainsAConflict() throws Exception {
        doThrow(new OptimisticLockingFailureException("stale")).when(commands)
            .execute(anyLong(), any(), anyString(), anyString(), any(), eq(InvitationView.class), any());
        mvc.perform(post("/api/farms/1/invitations").header("Idempotency-Key", "save")
            .contentType("application/json").content("{\"email\":\"new@example.test\",\"role\":\"MANAGER\"}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }
    @Test
    void aMissingIntentKeyHasARequiredFieldMessage() throws Exception {
        mvc.perform(post("/api/farms/1/invitations").contentType("application/json")
            .content("{\"email\":\"new@example.test\",\"role\":\"MANAGER\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06"));
    }

    @Test
    void listStorageFailureUsesTheLoadingMessageAndDoesNotExposeSql() throws Exception {
        doThrow(new DataIntegrityViolationException("private SQL detail")).when(service)
            .listInvitations(anyLong(), any(), anyInt(), anyInt(), anyString(), anyString(), any());
        var result = mvc.perform(get("/api/farms/1/invitations"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("MSG-COM-03")).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("private SQL detail");
    }
}
