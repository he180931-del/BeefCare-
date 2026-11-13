package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC-FE03-02: real security, query, JSON and persisted read-only state. Also run on PostgreSQL. */
@ServiceIntegrationTest
@Transactional
class FarmInvitationListResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private MockHttpServletRequestBuilder list(Farm farm, AppUser owner) {
        return get("/api/farms/{id}/invitations", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail()));
    }

    private JsonNode read(MockHttpServletRequestBuilder request) throws Exception {
        return mapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private FarmInvitation invitation(Farm farm, AppUser owner, String state, Instant sent, Instant expires) {
        FarmInvitation row = new FarmInvitation();
        row.setFarm(farm); row.setInvitedBy(owner); row.setInvitedEmail("invite" + next() + "@example.test");
        row.setProposedRole("TECHNICIAN"); row.setStatus(state); row.setCreatedAt(clock.instant());
        row.setLastSentAt(sent); row.setExpiresAt(expires); row.setValidityDays(7);
        return save(row);
    }

    private FarmInvitation invitation(Farm farm, AppUser owner, String state) {
        return invitation(farm, owner, state, clock.instant().minusSeconds(60), clock.instant().plusSeconds(3600));
    }

    @Test
    void pagesByLastSentWithStableTiesAndCountsAllStatusesOfOnlyThisFarm() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        List<Long> ids = new ArrayList<>();
        for (int i = 0; i < 23; i++) {
            // Created time deliberately disagrees with last-sent order; duplicate send times span page boundaries.
            ids.add(invitation(farm, owner, "PENDING", clock.instant().minusSeconds(23 - i / 2), clock.instant().plusSeconds(3600)).getId());
        }
        invitation(farm, owner, "ACCEPTED"); invitation(farm, owner, "CANCELLED"); invitation(farm, owner, "EXPIRED");
        Farm other = farm(); invitation(other, memberWithRole(other, FarmRole.OWNER), "PENDING");
        JsonNode first = read(list(farm, owner).param("status", "PENDING"));
        assertThat(first.path("items").size()).isEqualTo(20);
        assertThat(first.path("total").asLong()).isEqualTo(23);
        assertThat(first.path("page").asInt()).isZero(); assertThat(first.path("size").asInt()).isEqualTo(20);
        assertThat(first.path("counts").toString()).isEqualTo("{\"PENDING\":23,\"ACCEPTED\":1,\"EXPIRED\":1,\"CANCELLED\":1}");
        assertThat(first.path("items").get(0).path("id").asLong()).isEqualTo(ids.getLast());
        assertThat(Instant.parse(first.path("asOf").asText())).isEqualTo(clock.instant());
        JsonNode second = read(list(farm, owner).param("status", "PENDING").param("page", "1"));
        assertThat(second.path("items").size()).isEqualTo(3);
        assertThat(second.path("counts")).isEqualTo(first.path("counts"));
        List<Long> actual = new ArrayList<>(); first.path("items").forEach(row -> actual.add(row.path("id").asLong()));
        second.path("items").forEach(row -> actual.add(row.path("id").asLong()));
        assertThat(actual).containsExactlyElementsOf(ids.reversed());
        JsonNode ascending = read(list(farm, owner).param("status", "PENDING").param("dir", "asc"));
        assertThat(ascending.path("items").get(0).path("id").asLong()).isEqualTo(ids.get(1));
        JsonNode beyond = read(list(farm, owner).param("status", "PENDING").param("page", "99"));
        assertThat(beyond.path("items")).isEmpty(); assertThat(beyond.path("total").asInt()).isEqualTo(23);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"})
    void filtersEachStatusWithoutChangingOtherTabCounts(String state) throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        for (String status : List.of("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED")) invitation(farm, owner, status);
        JsonNode result = read(list(farm, owner).param("status", " " + state.toLowerCase(java.util.Locale.ROOT) + " "));
        assertThat(result.path("total").asInt()).isEqualTo(1);
        assertThat(result.path("items").get(0).path("status").asText()).isEqualTo(state);
        assertThat(result.path("counts").toString()).isEqualTo("{\"PENDING\":1,\"ACCEPTED\":1,\"EXPIRED\":1,\"CANCELLED\":1}");
        assertThat(read(list(farm, owner)).path("total").asInt()).isEqualTo(4);
    }

    @Test
    void treatsTheExactExpiryAsExpiredAtOneReadClockWithoutWritingToTheDatabase() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmInvitation expired = invitation(farm, owner, "PENDING", clock.instant().minusSeconds(100), clock.instant());
        Long id = expired.getId(); Integer version = expired.getVersion();
        invitation(farm, owner, "PENDING", clock.instant(), clock.instant().plusSeconds(1));
        JsonNode result = read(list(farm, owner).param("status", "EXPIRED"));
        assertThat(result.path("items").get(0).path("id").asLong()).isEqualTo(id);
        assertThat(result.path("counts").path("PENDING").asInt()).isEqualTo(1);
        assertThat(result.path("counts").path("EXPIRED").asInt()).isEqualTo(1);
        em.flush(); em.clear();
        assertThat(em.find(FarmInvitation.class, id).getStatus()).isEqualTo("PENDING");
        assertThat(em.find(FarmInvitation.class, id).getVersion()).isEqualTo(version);
        assertThat(em.createQuery("select count(a) from AuditLog a where a.farm.id=:f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isZero();
        clock.set(clock.instant().plusSeconds(1));
        assertThat(read(list(farm, owner)).path("counts").path("EXPIRED").asInt()).isEqualTo(2);
    }

    @Test
    void exactIdLookupFindsTheUc1ConflictOutsideTheFirstPageWithoutLeakingAnotherFarm() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmInvitation oldest = invitation(farm, owner, "PENDING");
        for (int i = 0; i < 21; i++) invitation(farm, owner, "PENDING");
        JsonNode result = read(list(farm, owner).param("invitationId", oldest.getId().toString()));
        assertThat(result.path("total").asInt()).isEqualTo(1);
        assertThat(result.path("items").size()).isEqualTo(1);
        assertThat(result.path("items").get(0).path("id").asLong()).isEqualTo(oldest.getId());
        assertThat(result.path("counts").path("PENDING").asInt()).isEqualTo(22);
        Farm other = farm(); AppUser otherOwner = memberWithRole(other, FarmRole.OWNER);
        JsonNode hidden = read(list(other, otherOwner).param("invitationId", oldest.getId().toString()));
        assertThat(hidden.path("items")).isEmpty(); assertThat(hidden.path("total").asInt()).isZero();
    }

    @Test
    void returnsCurrentAccountExistenceWithoutAccountStatusOrSecrets() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmInvitation row = invitation(farm, owner, "PENDING");
        assertThat(read(list(farm, owner)).path("items").get(0).path("hasAccount").asBoolean()).isFalse();
        AppUser suspended = user("SUSPENDED"); suspended.setEmail(row.getInvitedEmail().toUpperCase(java.util.Locale.ROOT)); em.flush();
        JsonNode result = read(list(farm, owner)).path("items").get(0);
        assertThat(result.path("hasAccount").asBoolean()).isTrue();
        assertThat(result.toString()).doesNotContain("accountStatus", "SUSPENDED", "token", "nonce", "password");
        assertThat(result.path("email").asText()).isEqualTo(row.getInvitedEmail());
        assertThat(result.path("role").asText()).isEqualTo("TECHNICIAN");
        assertThat(result.path("validityDays").asInt()).isEqualTo(7);
        assertThat(result.has("version")).isTrue(); assertThat(result.has("createdAt")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING_PAYMENT", "EXPIRED", "SUSPENDED"})
    void ownerCanReadAndWithdrawPendingInvitationsDuringInactiveService(String service) throws Exception {
        Farm farm = farm(service); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        FarmInvitation row = invitation(farm, owner, "PENDING");
        assertThat(read(list(farm, owner)).path("total").asInt()).isEqualTo(1);
        mvc.perform(post("/api/farms/{f}/invitations/{i}/cancel", farm.getId(), row.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
            .header("Idempotency-Key", "cancel-inactive").contentType("application/json").content("{\"expectedVersion\":" + row.getVersion() + "}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(read(list(farm, owner)).path("counts").path("CANCELLED").asInt()).isEqualTo(1);
    }

    @Test
    void rejectsOtherRolesOtherOwnersInactiveMembershipAndSuspendedAccount() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        invitation(farm, owner, "PENDING");
        for (FarmRole role : List.of(FarmRole.MANAGER, FarmRole.TECHNICIAN)) {
            mvc.perform(list(farm, memberWithRole(farm, role))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        }
        AppUser outsider = memberWithRole(farm(), FarmRole.OWNER);
        mvc.perform(list(farm, outsider)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        AppUser inactive = user(); member(farm, inactive, "OWNER", "INACTIVE");
        mvc.perform(list(farm, inactive)).andExpect(status().isForbidden());
        owner.setAccountStatus("SUSPENDED"); em.flush();
        mvc.perform(list(farm, owner)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE01-03"));
        mvc.perform(get("/api/farms/{id}/invitations", farm.getId())).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @CsvSource({"status,WRONG", "page,-1", "page,2147483647", "page,abc", "size,0", "size,101", "sort,email", "dir,sideways", "invitationId,0", "invitationId,abc"})
    void rejectsInvalidQueryValues(String field, String value) throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        mvc.perform(list(farm, owner).param(field, value)).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value(field));
    }
}
