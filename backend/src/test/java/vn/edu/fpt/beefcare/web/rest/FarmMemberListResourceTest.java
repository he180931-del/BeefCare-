package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * UC-FE03-05 / A1 (D29): who may read SCR-13, which rows, tab counts, name order, joined time, available actions and
 * the absence of the last change's reason. Real security chain, JSON and database. Also run on PostgreSQL.
 */
@ServiceIntegrationTest
@Transactional
class FarmMemberListResourceTest extends DomainTestSupport {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;

    private ResultActions list(Farm farm, AppUser caller) throws Exception {
        return mvc.perform(get("/api/farms/{id}/members", farm.getId()).with(SecurityMockMvcRequestPostProcessors.user(caller.getEmail())));
    }

    private JsonNode read(Farm farm, AppUser caller) throws Exception {
        return mapper.readTree(list(farm, caller).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private AppUser named(String fullName) {
        AppUser user = user(); user.setFullName(fullName); em.flush();
        return user;
    }

    private FarmMembership joined(Farm farm, AppUser user, String role, String status, Instant joinedAt) {
        FarmMembership membership = new FarmMembership();
        membership.setFarm(farm); membership.setUser(user); membership.setRole(role); membership.setStatus(status);
        membership.setJoinedAt(joinedAt); membership.setEffectiveDate(TODAY); membership.setChangeReason("Lý do riêng của Chủ trại");
        return save(membership);
    }

    private static List<String> names(JsonNode result) {
        List<String> names = new ArrayList<>();
        result.path("items").forEach(row -> names.add(row.path("fullName").asText()));
        return names;
    }

    private static JsonNode row(JsonNode result, Long membershipId) {
        for (JsonNode row : result.path("items")) if (row.path("id").asLong() == membershipId) return row;
        throw new AssertionError("no row " + membershipId + " in " + result);
    }

    @Test
    void ownerSeesEveryMemberByVietnameseNameWithTabCountsJoinedTimeAndActions() throws Exception {
        Farm farm = farm();
        AppUser owner = named("Nguyễn Văn Hùng");
        Instant ownerJoined = Instant.parse("2024-03-01T01:00:00Z");
        FarmMembership ownerRow = joined(farm, owner, "OWNER", "ACTIVE", ownerJoined);
        // Case is ignored and Đ sorts after D (Vietnamese); a member without a name is ordered by the email.
        FarmMembership manager = joined(farm, named("trần quốc long"), "MANAGER", "ACTIVE", Instant.parse("2024-05-02T02:00:00Z"));
        joined(farm, named("Dương Thị Hoa"), "MANAGER", "ACTIVE", Instant.parse("2025-01-02T02:00:00Z"));
        joined(farm, named("Đỗ Văn Bình"), "TECHNICIAN", "ACTIVE", Instant.parse("2025-09-02T02:00:00Z"));
        AppUser unnamed = named(" "); unnamed.setEmail("an.kt" + next() + "@beefcare.test"); em.flush();
        joined(farm, unnamed, "TECHNICIAN", "ACTIVE", Instant.parse("2026-02-02T02:00:00Z"));
        FarmMembership inactive = joined(farm, named("Bùi Văn Khoa"), "TECHNICIAN", "INACTIVE", Instant.parse("2024-06-02T02:00:00Z"));
        Farm other = farm(); joined(other, named("An Khác Trại"), "MANAGER", "ACTIVE", Instant.parse("2024-01-01T00:00:00Z"));

        JsonNode result = read(farm, owner);
        assertThat(result.path("farmName").asText()).isEqualTo(farm.getName());
        assertThat(result.path("timeZone").asText()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(result.path("serviceStatus").asText()).isEqualTo("ACTIVE");
        // D29 Q3: all = every row; managers / technicians = ACTIVE of that role; inactive = INACTIVE
        assertThat(result.path("counts").toString()).isEqualTo("{\"all\":6,\"managers\":2,\"technicians\":2,\"inactive\":1}");
        assertThat(names(result)).containsExactly(" ", "Bùi Văn Khoa", "Dương Thị Hoa", "Đỗ Văn Bình", "Nguyễn Văn Hùng", "trần quốc long");
        JsonNode ownerJson = row(result, ownerRow.getId());
        assertThat(ownerJson.path("role").asText()).isEqualTo("OWNER");
        assertThat(ownerJson.path("userId").asLong()).isEqualTo(owner.getId());
        assertThat(Instant.parse(ownerJson.path("joinedAt").asText())).isEqualTo(ownerJoined);
        assertThat(ownerJson.path("actions")).isEmpty();
        assertThat(row(result, manager.getId()).path("actions").toString()).isEqualTo("[\"CHANGE_ROLE\",\"DEACTIVATE\"]");
        assertThat(row(result, inactive.getId()).path("actions").toString()).isEqualTo("[\"REACTIVATE\"]");
        assertThat(row(result, inactive.getId()).path("status").asText()).isEqualTo("INACTIVE");
        // SCR-13 has no reason / effective date: the Owner's note on the last change is not returned
        result.path("items").forEach(item -> {
            assertThat(item.has("reason")).isFalse(); assertThat(item.has("effectiveDate")).isFalse();
            assertThat(item.path("version").isInt()).isTrue();
        });
    }

    @Test
    void managerSeesOnlyActiveMembersWithoutActionsOrAnInactiveCount() throws Exception {
        Farm farm = farm();
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        memberWithRole(farm, FarmRole.TECHNICIAN);
        FarmMembership inactive = member(farm, user(), "MANAGER", "INACTIVE");
        JsonNode result = read(farm, manager);
        assertThat(result.path("counts").toString()).isEqualTo("{\"all\":3,\"managers\":1,\"technicians\":1}");
        assertThat(result.path("items")).hasSize(3);
        result.path("items").forEach(item -> {
            assertThat(item.path("status").asText()).isEqualTo("ACTIVE");
            assertThat(item.path("id").asLong()).isNotEqualTo(inactive.getId());
            assertThat(item.path("actions")).isEmpty();
            assertThat(item.has("reason")).isFalse();
        });
        assertThat(read(farm, owner).path("counts").path("inactive").asInt()).isEqualTo(1);
    }

    @Test
    void technicianOutsidersAndLostAccessAreRefused() throws Exception {
        Farm farm = farm(); memberWithRole(farm, FarmRole.OWNER);
        // TC-03-26 / Table III-2: Members and roles "—" for a Technician
        list(farm, memberWithRole(farm, FarmRole.TECHNICIAN)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        Farm other = farm();
        list(farm, memberWithRole(other, FarmRole.OWNER)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        AppUser deactivated = user(); member(farm, deactivated, "MANAGER", "INACTIVE");
        list(farm, deactivated).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
        AppUser suspended = memberWithRole(farm, FarmRole.MANAGER); suspended.setAccountStatus("SUSPENDED"); em.flush();
        list(farm, suspended).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE01-03"));
        mvc.perform(get("/api/farms/{id}/members", farm.getId())).andExpect(status().isUnauthorized());
    }

    /** D29 Q2 / GBR-14: the Owner reads the list to deactivate members; the other commands wait for an ACTIVE farm. */
    @ParameterizedTest
    @ValueSource(strings = { "PENDING_PAYMENT", "EXPIRED", "SUSPENDED" })
    void ownerReadsAnInactiveFarmWhereOnlyDeactivateRemains(String serviceStatus) throws Exception {
        Farm farm = farm(serviceStatus);
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        FarmMembership inactive = member(farm, user(), "TECHNICIAN", "INACTIVE");
        JsonNode result = read(farm, owner);
        assertThat(result.path("serviceStatus").asText()).isEqualTo(serviceStatus);
        assertThat(result.path("counts").path("all").asInt()).isEqualTo(3);
        for (JsonNode item : result.path("items")) {
            String expected = "OWNER".equals(item.path("role").asText()) || item.path("id").asLong() == inactive.getId() ? "[]" : "[\"DEACTIVATE\"]";
            assertThat(item.path("actions").toString()).as(item.toString()).isEqualTo(expected);
        }
        // A Manager cannot open a farm that is not ACTIVE (GBR-14)
        list(farm, manager).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-12"));
    }

    @Test
    void registrationSetsTheOwnersJoinedTimeAndLaterChangesKeepIt() throws Exception {
        AppUser owner = user(); owner.setOwnerRegistrationCompleted(true); owner.setOwnerRegistrationCompletedAt(clock.instant()); owner.setPhone("0900000000"); em.flush();
        String created = mvc.perform(post("/api/farms").with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
                .header("Idempotency-Key", "uc5-register").contentType("application/json")
                .content("{\"name\":\"Trại Thung Mây\",\"province\":\"Phú Thọ\",\"commune\":\"Xã Minh Đài\"}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Farm farm = em.find(Farm.class, mapper.readTree(created).path("id").asLong());
        Instant registeredAt = clock.instant();
        // A new farm waits for payment; its Owner already reads SCR-13 (D29 Q2)
        JsonNode list = read(farm, owner);
        assertThat(list.path("items")).hasSize(1);
        assertThat(Instant.parse(list.path("items").get(0).path("joinedAt").asText())).isEqualTo(registeredAt);

        farm.setServiceStatus("ACTIVE"); em.flush();
        Instant memberJoined = Instant.parse("2025-04-10T03:00:00Z");
        FarmMembership target = joined(farm, user(), "MANAGER", "ACTIVE", memberJoined);
        clock.set(clock.instant().plusSeconds(86_400));
        change(farm, owner, target, "CHANGE_ROLE", "TECHNICIAN", "uc5-role")
            .andExpect(jsonPath("$.role").value("TECHNICIAN")).andExpect(jsonPath("$.joinedAt").value(memberJoined.toString()))
            .andExpect(jsonPath("$.actions[0]").value("CHANGE_ROLE")).andExpect(jsonPath("$.reason").doesNotExist());
        change(farm, owner, target, "DEACTIVATE", null, "uc5-off").andExpect(jsonPath("$.actions[0]").value("REACTIVATE"));
        change(farm, owner, target, "REACTIVATE", null, "uc5-on").andExpect(jsonPath("$.status").value("ACTIVE"));
        em.flush(); em.clear();
        assertThat(em.find(FarmMembership.class, target.getId()).getJoinedAt()).isEqualTo(memberJoined);
        assertThat(Instant.parse(row(read(farm, owner), target.getId()).path("joinedAt").asText())).isEqualTo(memberJoined);
    }

    private ResultActions change(Farm farm, AppUser owner, FarmMembership target, String action, String role, String key) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", action); if (role != null) body.put("role", role);
        body.put("effectiveDate", TODAY.toString()); body.put("reason", "Sắp xếp lại công việc");
        body.put("expectedVersion", versionOf(FarmMembership.class, target.getId()));
        return mvc.perform(put("/api/farms/{f}/members/{m}", farm.getId(), target.getId()).with(SecurityMockMvcRequestPostProcessors.user(owner.getEmail())).with(csrf())
            .header("Idempotency-Key", key).contentType("application/json").content(mapper.writeValueAsBytes(body))).andExpect(status().isOk());
    }

    @Test
    void readsAccountsInOneQueryWhateverTheNumberOfMembers() throws Exception {
        Farm farm = farm(); AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        memberWithRole(farm, FarmRole.MANAGER);
        em.flush(); em.clear();
        long twoMembers = statements(() -> assertThat(read(farm, owner).path("items")).hasSize(2));
        Farm attached = em.find(Farm.class, farm.getId());
        for (int i = 0; i < 10; i++) memberWithRole(attached, i % 2 == 0 ? FarmRole.MANAGER : FarmRole.TECHNICIAN);
        em.flush(); em.clear();
        long twelveMembers = statements(() -> assertThat(read(farm, owner).path("items")).hasSize(12));
        assertThat(twoMembers).as("statistics must observe the request").isPositive();
        assertThat(twelveMembers).as("no query per member: 2 members %d, 12 members %d", twoMembers, twelveMembers).isEqualTo(twoMembers);
    }

    interface Call { void run() throws Exception; }

    private long statements(Call call) throws Exception {
        org.hibernate.stat.Statistics statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            call.run();
            return statistics.getPrepareStatementCount();
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
    }
}
