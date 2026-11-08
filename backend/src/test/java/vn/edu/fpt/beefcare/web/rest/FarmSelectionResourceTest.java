package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * HTTP contract of {@code GET /api/farms} and {@code GET /api/farms/{farmId}/context} (UC-FE02-02, SCR-09): the farm
 * cards (SCR-09 fields 3-7), who may enter which farm (GBR-09, GBR-14) and the locked card of a Manager or Technician
 * (AF3, decision 08/11/2026: shown locked, not hidden).
 */
@ServiceIntegrationTest
@Transactional
class FarmSelectionResourceTest extends DomainTestSupport {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper om;

    private ResultActions getAs(AppUser user, String url, Object... vars) throws Exception {
        return mvc.perform(get(url, vars).with(SecurityMockMvcRequestPostProcessors.user(user.getEmail())));
    }

    private JsonNode farms(AppUser user) throws Exception {
        String json = getAs(user, "/api/farms").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return om.readTree(json);
    }

    private static JsonNode card(JsonNode list, Farm farm) {
        for (JsonNode item : list) {
            if (item.path("id").asLong() == farm.getId()) return item;
        }
        return null;
    }

    private Farm located(String status, String province, String commune) {
        Farm f = farm(status);
        f.setProvince(province);
        f.setCommune(commune);
        em.flush();
        return f;
    }

    private void subscription(Farm farm, Instant latestEnd) {
        PlanVersion plan = new PlanVersion()
            .price1y(new BigDecimal("1000000"))
            .price2y(new BigDecimal("1900000"))
            .price3y(new BigDecimal("2700000"))
            .effectiveAt(Instant.parse("2026-01-01T00:00:00Z"));
        save(plan);
        Subscription s = new Subscription().entitlementStatus("ACTIVE").latestEnd(latestEnd);
        s.setFarm(farm);
        s.setPlanVersion(plan);
        save(s);
    }

    private void herd(Farm farm, int active, int exited) {
        Breed b = breed(farm);
        ProductionPurpose p = purpose(farm, PurposeType.FATTENING);
        for (int i = 0; i < active; i++) cattle(farm, b, p, Sex.MALE, LifeStage.ADULT);
        for (int i = 0; i < exited; i++) {
            Cattle c = cattle(farm, b, p, Sex.MALE, LifeStage.ADULT);
            c.setHerdStatus(HerdStatus.EXITED);
        }
        em.flush();
    }

    /** SCR-09 fields 3-7: name, commune and province, status, role, ACTIVE cattle of that farm only, service end. */
    @Test
    void cardShowsLocationActiveCattleAndServiceEnd() throws Exception {
        Farm active = located("ACTIVE", "Hà Nội", "Xã Yên Bài");
        Farm pending = located("PENDING_PAYMENT", "Phú Thọ", "Xã Minh Đài");
        AppUser owner = memberWithRole(active, FarmRole.OWNER);
        member(pending, owner, "OWNER", "ACTIVE");
        herd(active, 2, 1);
        herd(farm(), 3, 0);
        Instant end = Instant.parse("2027-01-15T17:00:00Z");
        subscription(active, end);

        JsonNode list = farms(owner);
        JsonNode a = card(list, active);
        assertThat(a).isNotNull();
        assertThat(a.path("name").asText()).isEqualTo(active.getName());
        assertThat(a.path("province").asText()).isEqualTo("Hà Nội");
        assertThat(a.path("commune").asText()).isEqualTo("Xã Yên Bài");
        assertThat(a.path("role").asText()).isEqualTo("OWNER");
        assertThat(a.path("serviceStatus").asText()).isEqualTo("ACTIVE");
        assertThat(a.path("activeCattleCount").asLong()).isEqualTo(2);
        assertThat(Instant.parse(a.path("serviceUntil").asText())).isEqualTo(end);

        JsonNode p = card(list, pending);
        assertThat(p.path("serviceStatus").asText()).isEqualTo("PENDING_PAYMENT");
        assertThat(p.path("activeCattleCount").asLong()).isZero();
        assertThat(p.path("serviceUntil").isNull()).isTrue();
    }

    /** TC-02-11, AF3: a Manager sees the EXPIRED farm as a locked card and is refused with MSG-FE02-04 when entering. */
    @Test
    void tc0211ManagerSeesTheLockedFarmAndCannotEnterIt() throws Exception {
        Farm open = farm("ACTIVE");
        Farm expired = farm("EXPIRED");
        AppUser manager = memberWithRole(open, FarmRole.MANAGER);
        member(expired, manager, "MANAGER", "ACTIVE");

        JsonNode list = farms(manager);
        assertThat(list).hasSize(2);
        assertThat(card(list, expired).path("serviceStatus").asText()).isEqualTo("EXPIRED");
        assertThat(card(list, expired).path("role").asText()).isEqualTo("MANAGER");

        getAs(manager, "/api/farms/{id}/context", open.getId()).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MANAGER"));
        getAs(manager, "/api/farms/{id}/context", expired.getId())
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-FE02-04"))
            .andExpect(jsonPath("$.params.farm").value(expired.getName()))
            .andExpect(jsonPath("$.params.status").value("EXPIRED"));
    }

    /** GBR-14, AF1, AF2: the Owner can still select a farm that is not ACTIVE and open its information. */
    @Test
    void tc0213OwnerCanSelectFarmsThatAreNotActive() throws Exception {
        for (String status : new String[] { "PENDING_PAYMENT", "EXPIRED", "SUSPENDED" }) {
            Farm farm = farm(status);
            AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            getAs(owner, "/api/farms/{id}/context", farm.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.serviceStatus").value(status));
            getAs(owner, "/api/farms/{id}", farm.getId()).andExpect(status().isOk());
        }
    }

    /** TC-02-14 (R-02-06): selecting an EXPIRED farm does not unlock farm operations for the Owner. */
    @Test
    void tc0214OwnerOfExpiredFarmIsStillBlockedFromFarmOperations() throws Exception {
        Farm farm = farm("EXPIRED");
        AppUser owner = memberWithRole(farm, FarmRole.OWNER);
        getAs(owner, "/api/farms/{id}/catalogues", farm.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-12"));
    }

    /** TC-02-15: a Manager of an EXPIRED farm gets 403 from every farm API. */
    @Test
    void tc0215ManagerOfExpiredFarmIsRefusedEverywhere() throws Exception {
        Farm farm = farm("EXPIRED");
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        getAs(manager, "/api/farms/{id}/context", farm.getId()).andExpect(status().isForbidden());
        getAs(manager, "/api/farms/{id}", farm.getId()).andExpect(status().isForbidden());
        getAs(manager, "/api/farms/{id}/catalogues", farm.getId()).andExpect(status().isForbidden());
    }

    /** E1: a membership deactivated after the list was shown is no longer listed and cannot enter (MSG-COM-01). */
    @Test
    void e1DeactivatedMembershipIsNotListedAndCannotEnter() throws Exception {
        Farm farm = farm("ACTIVE");
        AppUser technician = user();
        member(farm, technician, "TECHNICIAN", "INACTIVE");
        assertThat(farms(technician)).isEmpty();
        getAs(technician, "/api/farms/{id}/context", farm.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    /** GBR-12: another Owner's farm is never listed or selectable. */
    @Test
    void anotherOwnersFarmIsNeitherListedNorSelectable() throws Exception {
        Farm mine = farm("ACTIVE");
        Farm theirs = farm("ACTIVE");
        AppUser owner = memberWithRole(mine, FarmRole.OWNER);
        memberWithRole(theirs, FarmRole.OWNER);
        assertThat(card(farms(owner), theirs)).isNull();
        getAs(owner, "/api/farms/{id}/context", theirs.getId()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));
    }

    /** Step 5: a Technician enters an ACTIVE farm with the Technician role. */
    @Test
    void technicianEntersAnActiveFarm() throws Exception {
        Farm farm = farm("ACTIVE");
        AppUser technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        getAs(technician, "/api/farms/{id}/context", farm.getId())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("TECHNICIAN"))
            .andExpect(jsonPath("$.serviceStatus").value("ACTIVE"));
    }
}
