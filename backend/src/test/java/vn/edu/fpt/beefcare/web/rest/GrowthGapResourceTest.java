package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** HTTP shape of the FE-08 fields added for GAP-FE08-01 / 02 / 03 (spec FE-08 §7, A1 / A2 / A4). */
@ServiceIntegrationTest
@Transactional
class GrowthGapResourceTest extends DomainTestSupport {

    @Autowired
    MockMvc mvc;

    Farm farm;
    AppUser owner;
    AppUser manager;
    Cattle steer;

    @BeforeEach
    void farmWithAFatteningSteer() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        steer = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
    }

    static RequestPostProcessor as(String email) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(email).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", UUID.randomUUID().toString());
            return processed;
        };
    }

    @Test
    void theCattleViewCarriesTheTargetAndEachRecordItsRevisions() throws Exception {
        weight(steer, TODAY.minusDays(60), "340");
        Growth latest = weight(steer, TODAY, "400");
        em.flush();
        String url = "/api/farms/" + farm.getId() + "/cattle/" + steer.getId() + "/growth";
        mvc.perform(post(url + "/" + latest.getId() + "/correction").with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"EXCLUDE\",\"reason\":\"Cân lỗi\",\"expectedVersion\":" + latest.getVersion() + "}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("EXCLUDED"))
            .andExpect(jsonPath("$.revisions[0].action").value("EXCLUDE"))
            .andExpect(jsonPath("$.revisions[0].before.weightKg").value(400.0));
        mvc.perform(get(url).with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetKg").value(450))
            .andExpect(jsonPath("$.missingKg").value(110.0))
            .andExpect(jsonPath("$.finishingStatus").value("INSUFFICIENT_WEIGHTS"))
            .andExpect(jsonPath("$.records[0].revisions[0].reason").value("Cân lỗi"))
            .andExpect(jsonPath("$.records[1].revisions").isEmpty());
    }

    @Test
    void theHerdListAnswersTheActiveCountOfTheWholeFarm() throws Exception {
        cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        em.flush();
        mvc.perform(get("/api/farms/" + farm.getId() + "/growth?herdGroup=FATTENING").with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total").value(1))
            .andExpect(jsonPath("$.activeCount").value(2));
    }
}
