package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.ZoneId;
import java.util.List;
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
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.CareCatalogueCommandService;
import vn.edu.fpt.beefcare.service.VaccinationCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** HTTP contract of the FE-09 routes changed for the backend gaps (spec FE-09 §7): body, status and {code, params}. */
@ServiceIntegrationTest
@Transactional
class VaccinationCommandResourceTest extends DomainTestSupport {

    @Autowired
    MockMvc mvc;

    @Autowired
    VaccinationCommandService vaccination;

    @Autowired
    CareCatalogueCommandService catalogue;

    Farm farm;
    AppUser owner;
    AppUser manager;
    List<Cattle> herd;
    CareDtos.CatalogueItem vaccine;

    @BeforeEach
    void farmWithTwoCattle() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        var breed = breed(farm);
        var fattening = purpose(farm, PurposeType.FATTENING);
        herd = List.of(cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK), cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK));
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        actAs(manager);
        vaccine = catalogue.saveVaccine(farm.getId(), null, UUID.randomUUID().toString(),
            new CareDtos.VaccineCommand(null, "FMD" + next(), "LMLM", "Lở mồm long móng", "Navetco", "2 ml", "SC", 21, 6, true));
    }

    static RequestPostProcessor as(String email) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(email).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", UUID.randomUUID().toString());
            return processed;
        };
    }

    String url(String suffix) {
        return "/api/farms/" + farm.getId() + suffix;
    }

    CareDtos.VaccinationScheduleResult schedule(int doses) {
        return vaccination.createSchedule(farm.getId(), UUID.randomUUID().toString(), new CareDtos.CreateVaccinationSchedule("LMLM " + next(), vaccine.id(), TODAY, doses, 21, null,
            herd.stream().map(Cattle::getId).toList()));
    }

    // ------------------------------------------------------------ GAP-FE09-02

    @Test
    void stopTakesTheReasonFromTheBodyAndTheVersionFromIfMatch() throws Exception {
        CareDtos.VaccinationScheduleResult created = schedule(2);
        Integer version = versionOf(VaccinationSchedule.class, created.id());
        mvc.perform(post(url("/vaccination-schedules/" + created.id() + "/stop")).with(as(manager.getEmail())).header("If-Match", version)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Đổi vắc-xin\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("STOPPED"));
        mvc.perform(get(url("/vaccination-schedules")).with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].stopReason").value("Đổi vắc-xin"));
    }

    @Test
    void stopWithoutAReasonIs400WithTheReasonField() throws Exception {
        CareDtos.VaccinationScheduleResult created = schedule(1);
        Integer version = versionOf(VaccinationSchedule.class, created.id());
        mvc.perform(post(url("/vaccination-schedules/" + created.id() + "/stop")).with(as(manager.getEmail())).header("If-Match", version))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-06"))
            .andExpect(jsonPath("$.params.field").value("reason"));
        mvc.perform(post(url("/vaccination-schedules/" + created.id() + "/stop")).with(as(owner.getEmail())).header("If-Match", version)
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\"}"))
            .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ GAP-FE09-04

    @Test
    void correctionAcceptsWithdrawalDaysAndAnswersTheCattleWithdrawalEnd() throws Exception {
        Long id = vaccination.record(farm.getId(), UUID.randomUUID().toString(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null,
            clock.instant().minusSeconds(3600), "LOT-1", "2 ml", "SC", 21, "Manager",
            List.of(new CareDtos.VaccinationAnimal(herd.get(0).getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        em.flush();
        Integer version = versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id);
        mvc.perform(post(url("/vaccinations/" + id + "/correction")).with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + version + ",\"withdrawalDays\":30,\"reason\":\"Sửa ngưng thịt\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.withdrawalDays").value(30))
            .andExpect(jsonPath("$.withdrawalEndDate").value(TODAY.plusDays(30).toString()))
            .andExpect(jsonPath("$.cattleWithdrawalEndDate").value(TODAY.plusDays(30).toString()));
        mvc.perform(post(url("/vaccinations/" + id + "/correction")).with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + (version + 1) + ",\"withdrawalDays\":366,\"reason\":\"x\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.field").value("withdrawalDays"));
    }

    // ------------------------------------------------------------ GAP-FE09-03

    @Test
    void historyRowsCarryTheRouteAndTheRevisions() throws Exception {
        Long id = vaccination.record(farm.getId(), UUID.randomUUID().toString(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null,
            clock.instant().minusSeconds(3600), "LOT-1", "2 ml", "SC", 21, "Manager",
            List.of(new CareDtos.VaccinationAnimal(herd.get(0).getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        em.flush();
        vaccination.correct(farm.getId(), id, UUID.randomUUID().toString(), new CareDtos.CorrectVaccination(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id),
            null, null, null, "LOT-2", null, null, null, "Ghi nhầm số lô", null));
        em.flush();
        mvc.perform(get(url("/vaccinations/history?cattleId=" + herd.get(0).getId())).with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].route").value("SC"))
            .andExpect(jsonPath("$[0].withdrawalDays").value(21))
            .andExpect(jsonPath("$[0].batchNo").value("LOT-2"))
            .andExpect(jsonPath("$[0].revisions[0].action").value("CORRECT"))
            .andExpect(jsonPath("$[0].revisions[0].reason").value("Ghi nhầm số lô"))
            .andExpect(jsonPath("$[0].revisions[0].before.batchNo").value("LOT-1"))
            .andExpect(jsonPath("$[0].revisions[0].after.batchNo").value("LOT-2"));
    }

    // ------------------------------------------------------------ GAP-FE09-01

    @Test
    void editTakesTheNewTargetAndDoseCountAndTheViewReturnsTheStoredTarget() throws Exception {
        CareDtos.VaccinationScheduleResult created = schedule(1);
        Integer version = versionOf(VaccinationSchedule.class, created.id());
        Cattle kept = herd.get(0);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(url("/vaccination-schedules/" + created.id())).with(as(manager.getEmail()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedVersion\":" + version + ",\"doseCount\":2,\"target\":{\"cattleIds\":[" + kept.getId() + "]}}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetCount").value(1))
            .andExpect(jsonPath("$.plannedDoseCount").value(2));
        mvc.perform(get(url("/vaccination-schedules")).with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].doseCount").value(2))
            .andExpect(jsonPath("$[0].target.cattleIds[0]").value(kept.getId()))
            .andExpect(jsonPath("$[0].target.cattleCodes[0]").value(kept.getDisplayCode()));
    }

    @Test
    void editWithAnEmptyTargetIs400TargetCattle() throws Exception {
        CareDtos.VaccinationScheduleResult created = schedule(1);
        Integer version = versionOf(VaccinationSchedule.class, created.id());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(url("/vaccination-schedules/" + created.id())).with(as(manager.getEmail()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":" + version + ",\"target\":{\"cattleIds\":[]}}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MSG-COM-10"))
            .andExpect(jsonPath("$.params.field").value("targetCattle"));
    }

    // ------------------------------------------------------------ TC-09-17

    @Test
    void aBatchWithOnlySkippedAnimalsAnswers200WithTheSkippedList() throws Exception {
        CareDtos.VaccinationScheduleResult created = schedule(1);
        var dose = em.createQuery("select d from vn.edu.fpt.beefcare.domain.ScheduledDose d where d.schedule.id=:id and d.cattle.id=:cattle", vn.edu.fpt.beefcare.domain.ScheduledDose.class)
            .setParameter("id", created.id()).setParameter("cattle", herd.get(0).getId()).getSingleResult();
        String body = "{\"vaccineId\":" + vaccine.id() + ",\"source\":\"ON_FARM\",\"administeredAt\":\"" + clock.instant().minusSeconds(3600) + "\",\"batchNo\":\"L1\","
            + "\"dose\":\"2 ml\",\"route\":\"SC\",\"withdrawalDays\":21,\"vaccinator\":\"Manager\",\"animals\":[{\"cattleId\":" + herd.get(0).getId()
            + ",\"scheduledDoseId\":" + dose.getId() + ",\"expectedDoseVersion\":" + dose.getVersion() + ",\"decision\":\"VACCINATE\"}]}";
        mvc.perform(post(url("/vaccinations")).with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.vaccinatedCount").value(1))
            .andExpect(jsonPath("$.skipped").isEmpty());
        em.flush();
        mvc.perform(post(url("/vaccinations")).with(as(manager.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.vaccinatedCount").value(0))
            .andExpect(jsonPath("$.skipped[0].cattleCode").value(herd.get(0).getDisplayCode()))
            .andExpect(jsonPath("$.skipped[0].messageCode").value("MSG-FE09-09"))
            .andExpect(jsonPath("$.skipped[0].doseNo").value(1));
    }
}
