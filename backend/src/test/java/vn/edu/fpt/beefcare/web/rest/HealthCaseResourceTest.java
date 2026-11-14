package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntrySource;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.CareCatalogueCommandService;
import vn.edu.fpt.beefcare.service.HealthCareCommandService;
import vn.edu.fpt.beefcare.service.HerdExitCheckService;
import vn.edu.fpt.beefcare.service.VaccinationCommandService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * HTTP contract of FE-10 (spec FE-10 §7 A1–A8, §9 TC-10-xx): bodies, statuses and {code, params}. Service helpers
 * only build the preconditions; every assertion goes through the routes.
 */
@ServiceIntegrationTest
@Transactional
class HealthCaseResourceTest extends DomainTestSupport {

    private static final ZoneId FARM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Autowired MockMvc mvc;
    @Autowired HealthCareCommandService health;
    @Autowired CareCatalogueCommandService catalogue;
    @Autowired VaccinationCommandService vaccination;
    @Autowired RecordRevisionRepository revisions;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    Cattle cow;
    CareDtos.CatalogueItem medicine;

    @BeforeEach
    void farmWithOneCow() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        cow = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.YOUNG_STOCK);
        clock.set(TODAY.atTime(10, 0).atZone(FARM_ZONE).toInstant());
        actAs(manager);
        medicine = catalogue.saveMedicine(farm.getId(), null, key(), new CareDtos.MedicineCommand(null, "OXY" + next(), "Oxytetracycline LA", null, "20 ml", "IM", 7, true));
    }

    // ------------------------------------------------------------------ helpers

    static String key() { return UUID.randomUUID().toString(); }

    static RequestPostProcessor as(String email) {
        return request -> {
            MockHttpServletRequest processed = SecurityMockMvcRequestPostProcessors.user(email).postProcessRequest(request);
            SecurityMockMvcRequestPostProcessors.csrf().postProcessRequest(processed);
            if (processed.getHeader("Idempotency-Key") == null) processed.addHeader("Idempotency-Key", UUID.randomUUID().toString());
            return processed;
        };
    }

    String url(String suffix) { return "/api/farms/" + farm.getId() + suffix; }

    Instant hoursAgo(double hours) { return clock.instant().minus(Duration.ofMinutes(Math.round(hours * 60))); }
    Instant daysAgo(int days) { return clock.instant().minus(Duration.ofDays(days)); }

    ResultActions postJson(String suffix, AppUser user, String body) throws Exception {
        return mvc.perform(post(url(suffix)).with(as(user.getEmail())).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    String openBody(Instant at, String extra) {
        return "{\"cattleId\":" + cow.getId() + ",\"observedAt\":\"" + at + "\",\"temperatureC\":39.5,\"signs\":\"Sốt, bỏ ăn\",\"diagnosis\":\"Viêm phổi\",\"suspectedContagious\":false,\"severity\":\"MODERATE\"" + extra + "}";
    }

    CareDtos.HealthCaseResult open(Cattle cattle, Instant at) {
        return health.open(farm.getId(), key(), new CareDtos.OpenHealthCase(cattle.getId(), null, null, at, null, null, "Sốt, bỏ ăn", "Viêm phổi", false, "MODERATE", null));
    }
    CareDtos.HealthCaseResult open(Instant at) { return open(cow, at); }

    CareDtos.TreatmentResult treat(CareDtos.HealthCaseResult opened, Instant at, int courseDays, int withdrawalDays) {
        return health.recordTreatment(farm.getId(), opened.id(), key(), new CareDtos.TreatmentCommand(opened.version(), medicine.id(), at, "20 ml", "INTRAMUSCULAR", courseDays, withdrawalDays, null, "BS. Thú y", null));
    }

    CareDtos.HealthCaseResult close(CareDtos.HealthCaseResult opened, String outcome) {
        return health.updateStatus(farm.getId(), opened.id(), key(), new CareDtos.CaseStatus(versionOf(HealthCase.class, opened.id()), "CLOSE", null, null, null, null, outcome, null, null));
    }

    // ------------------------------------------------------------------ A3 open / add

    @Test
    void tc10_03_openingACaseGivesACodeAndMonitoring() throws Exception {
        postJson("/health-cases", manager, openBody(hoursAgo(3), ""))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.caseCode").value(startsWith("HC-")))
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.healthState").value("MONITORING"))
            .andExpect(jsonPath("$.cattleCode").value(cow.getDisplayCode()))
            .andExpect(jsonPath("$.observationId").isNumber());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(technician.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.healthState").value("MONITORING"))
            .andExpect(jsonPath("$.openCases.length()").value(1))
            .andExpect(jsonPath("$.openCases[0].dayN").value(1))
            .andExpect(jsonPath("$.openCases[0].timeline[0].type").value("OPENING"))
            .andExpect(jsonPath("$.openCases[0].timeline[0].temperatureC").value(39.5))
            .andExpect(jsonPath("$.openCases[0].timeline[0].description").value("Sốt, bỏ ăn"))
            .andExpect(jsonPath("$.openCases[0].timeline[0].recordedBy").value(manager.getFullName()))
            .andExpect(jsonPath("$.openCases[0].timeline[0].observer").value(manager.getFullName()))
            .andExpect(jsonPath("$.previousCases.length()").value(0))
            .andExpect(jsonPath("$.pendingExit").doesNotExist());
    }

    @Test
    void tc10_01_temperatureOutside35To43Is422FE1006() throws Exception {
        for (String bad : List.of("34.9", "43.1")) {
            postJson("/health-cases", manager, openBody(hoursAgo(3), "").replace("39.5", bad))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MSG-FE10-06"))
                .andExpect(jsonPath("$.params.field").value("temperatureC"));
        }
        postJson("/health-cases", manager, openBody(hoursAgo(3), "").replace("39.5", "35.0")).andExpect(status().isCreated());
        postJson("/health-cases", manager, openBody(hoursAgo(2), "").replace("39.5", "43.0")).andExpect(status().isCreated());
    }

    @Test
    void tc10_02_missingSignsOrSeverityIs400COM06() throws Exception {
        postJson("/health-cases", manager, openBody(hoursAgo(3), "").replace("\"Sốt, bỏ ăn\"", "\" \""))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("signs"));
        postJson("/health-cases", manager, openBody(hoursAgo(3), "").replace("\"MODERATE\"", "null"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("severity"));
        postJson("/health-cases", manager, openBody(hoursAgo(3), "").replace("\"Viêm phổi\"", "\"" + "x".repeat(101) + "\""))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("diagnosis"));
    }

    @Test
    void tc10_04_addingAnObservationToAnOpenCaseCreatesNoNewCase() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        postJson("/health-cases", manager, openBody(hoursAgo(1), ",\"existingCaseId\":" + opened.id() + ",\"expectedVersion\":" + opened.version() + ",\"severity\":\"SEVERE\"").replace("\"severity\":\"MODERATE\",", ""))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(opened.id()))
            .andExpect(jsonPath("$.caseCode").value(opened.caseCode()));
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases.length()").value(1))
            .andExpect(jsonPath("$.openCases[0].severity").value("SEVERE"))
            .andExpect(jsonPath("$.openCases[0].timeline.length()").value(2))
            .andExpect(jsonPath("$.openCases[0].timeline[1].type").value("FOLLOW_UP"));
    }

    @Test
    void tc10_05_addingAnObservationToAClosedCaseIs409COM05() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        close(opened, "RECOVERED");
        postJson("/health-cases", manager, openBody(hoursAgo(1), ",\"existingCaseId\":" + opened.id() + ",\"expectedVersion\":" + versionOf(HealthCase.class, opened.id())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"));
    }

    @Test
    void tc10_06_aCaseOpenedFromAVaccinationIsLinkedToIt() throws Exception {
        CareDtos.CatalogueItem vaccine = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "FMD" + next(), "LMLM", "Lở mồm long móng", "Navetco", "2 ml", "SC", 0, 6, true));
        Long vaccinationId = vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null, hoursAgo(6), "LOT-1", "2 ml", "SC", 0, "Manager",
            List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        postJson("/health-cases", manager, openBody(hoursAgo(3), ",\"vaccinationId\":" + vaccinationId)).andExpect(status().isCreated());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].linkedVaccinationId").value(vaccinationId))
            .andExpect(jsonPath("$.openCases[0].timeline[0].linkedVaccinationId").value(vaccinationId));
        postJson("/health-cases", manager, openBody(hoursAgo(2), ",\"vaccinationId\":999999"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("vaccinationId"));
    }

    @Test
    void brD14_anObservationBeforeTheHerdEntryDateIs422COM15() throws Exception {
        var voucher = entryVoucher(farm, manager, partner(farm, manager, true, false), 0L, 0L, EntryVoucherStatus.POSTED);
        HerdEntry line = new HerdEntry();
        line.setFarm(farm); line.setVoucher(voucher); line.setLineNo(1); line.setCattle(cow); line.setSource(EntrySource.EXTERNAL);
        line.setEntryDate(TODAY.minusDays(3)); line.setInitialPen(pen(farm, "P" + next(), 10)); line.setStatus(EntryLineStatus.VALID);
        line.setCreatedAt(clock.instant()); line.setUpdatedAt(clock.instant());
        save(line);
        postJson("/health-cases", manager, openBody(daysAgo(5), ""))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-COM-15"))
            .andExpect(jsonPath("$.params.date").value(TODAY.minusDays(3).toString()));
        postJson("/health-cases", manager, openBody(daysAgo(2), "")).andExpect(status().isCreated());
    }

    @Test
    void observerMayBeAnyActiveMember() throws Exception {
        postJson("/health-cases", manager, openBody(hoursAgo(3), ",\"observerId\":" + owner.getId())).andExpect(status().isCreated());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].timeline[0].observer").value(owner.getFullName()))
            .andExpect(jsonPath("$.openCases[0].timeline[0].recordedBy").value(manager.getFullName()));
        AppUser stranger = user();
        postJson("/health-cases", manager, openBody(hoursAgo(2), ",\"observerId\":" + stranger.getId()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("observerId"));
    }

    // ------------------------------------------------------------------ A4 follow-up

    @Test
    void tc10_07_aFollowUpBeforeTheLatestRecordIs422FE1007() throws Exception {
        Instant openedAt = hoursAgo(3);
        CareDtos.HealthCaseResult opened = open(openedAt);
        String body = "{\"expectedVersion\":" + opened.version() + ",\"observedAt\":\"%s\",\"temperatureC\":39.0,\"progress\":\"IMPROVED\",\"description\":\"Ăn lại\"}";
        postJson("/health-cases/" + opened.id() + "/observations", manager, body.formatted(hoursAgo(4)))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE10-07"))
            .andExpect(jsonPath("$.params.date").value(openedAt.toString()));
        postJson("/health-cases/" + opened.id() + "/observations", manager, body.formatted(hoursAgo(2)).replace("\"IMPROVED\"", "\"\""))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("progress"));
        postJson("/health-cases/" + opened.id() + "/observations", manager, body.formatted(hoursAgo(2)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.observationId").isNumber())
            .andExpect(jsonPath("$.healthState").value("MONITORING"));
    }

    // ------------------------------------------------------------------ A6 treatment

    @Test
    void tc10_08_09_aTreatmentSetsUnderTreatmentAndComputesTheWithdrawalEnd() throws Exception {
        CareDtos.HealthCaseResult opened = open(daysAgo(6));
        // GBR-46: first day + course − 1 + withdrawal days; the withdrawal defaults to the medicine's (7).
        postJson("/health-cases/" + opened.id() + "/treatments", manager, "{\"expectedVersion\":" + opened.version() + ",\"medicineId\":" + medicine.id()
                + ",\"administeredAt\":\"" + daysAgo(5) + "\",\"dose\":\"20 ml\",\"route\":\"INTRAMUSCULAR\",\"courseDays\":3,\"performerName\":\"BS. Hùng\",\"veterinaryAdvice\":\"Theo dõi thêm\"}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.withdrawalEndDate").value(TODAY.minusDays(5).plusDays(2 + 7).toString()))
            .andExpect(jsonPath("$.cattleWithdrawalEndDate").value(TODAY.plusDays(4).toString()))
            .andExpect(jsonPath("$.healthState").value("UNDER_TREATMENT"))
            .andExpect(jsonPath("$.caseStatus").value("OPEN"))
            .andExpect(jsonPath("$.returnedToOpen").value(false))
            .andExpect(jsonPath("$.medicineName").value("Oxytetracycline LA"));
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.healthState").value("UNDER_TREATMENT"))
            .andExpect(jsonPath("$.withdrawalEndDate").value(TODAY.plusDays(4).toString()))
            .andExpect(jsonPath("$.openCases[0].treatmentCount").value(1))
            .andExpect(jsonPath("$.openCases[0].timeline[1].type").value("TREATMENT"))
            .andExpect(jsonPath("$.openCases[0].timeline[1].medicineId").value(medicine.id()))
            .andExpect(jsonPath("$.openCases[0].timeline[1].medicineName").value("Oxytetracycline LA"))
            .andExpect(jsonPath("$.openCases[0].timeline[1].dose").value("20 ml"))
            .andExpect(jsonPath("$.openCases[0].timeline[1].route").value("INTRAMUSCULAR"))
            .andExpect(jsonPath("$.openCases[0].timeline[1].courseDays").value(3))
            .andExpect(jsonPath("$.openCases[0].timeline[1].withdrawalDays").value(7))
            .andExpect(jsonPath("$.openCases[0].timeline[1].performer").value("BS. Hùng"))
            .andExpect(jsonPath("$.openCases[0].timeline[1].veterinaryAdvice").value("Theo dõi thêm"));
    }

    @Test
    void tc10_25_treatmentValidation_withdrawnMedicineIsFE1808() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        CareDtos.CatalogueItem withdrawn = catalogue.saveMedicine(farm.getId(), null, key(), new CareDtos.MedicineCommand(null, "OLD" + next(), "Thuốc ngưng", null, "1 ml", "IM", 0, false));
        String base = "{\"expectedVersion\":" + opened.version() + ",\"medicineId\":%s,\"administeredAt\":\"" + hoursAgo(1) + "\",\"dose\":\"%s\",\"route\":\"%s\"}";
        postJson("/health-cases/" + opened.id() + "/treatments", manager, base.formatted(withdrawn.id(), "1 ml", "ORAL"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE18-08")).andExpect(jsonPath("$.params.field").value("medicineId"));
        postJson("/health-cases/" + opened.id() + "/treatments", manager, base.formatted("null", "1 ml", "ORAL"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("medicineId"));
        postJson("/health-cases/" + opened.id() + "/treatments", manager, base.formatted(medicine.id(), "x".repeat(51), "ORAL"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("dose"));
        postJson("/health-cases/" + opened.id() + "/treatments", manager, base.formatted(medicine.id(), "1 ml", "NASAL"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("route"));
        postJson("/health-cases/" + opened.id() + "/treatments", manager, base.formatted(medicine.id(), "1 ml", "ORAL").replace("}", ",\"performerId\":" + technician.getId() + "}"))
            .andExpect(status().isCreated());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].timeline[1].performer").value(technician.getFullName()));
        // §3.3: a second treatment the same day is a new record, not a correction of the first.
        postJson("/health-cases/" + opened.id() + "/treatments", manager, base.formatted(medicine.id(), "2 ml", "ORAL").replace("\"expectedVersion\":" + opened.version(), "\"expectedVersion\":" + versionOf(HealthCase.class, opened.id())))
            .andExpect(status().isCreated());
    }

    @Test
    void tc10_10_aTreatmentReopensAChronicCase() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        health.updateStatus(farm.getId(), opened.id(), key(), new CareDtos.CaseStatus(opened.version(), "TO_CHRONIC", null, null, null, null, null, null, null));
        postJson("/health-cases/" + opened.id() + "/treatments", manager, "{\"expectedVersion\":" + versionOf(HealthCase.class, opened.id()) + ",\"medicineId\":" + medicine.id()
                + ",\"administeredAt\":\"" + hoursAgo(1) + "\",\"dose\":\"20 ml\",\"route\":\"IM\"}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.caseStatus").value("OPEN"))
            .andExpect(jsonPath("$.returnedToOpen").value(true))
            .andExpect(jsonPath("$.healthState").value("UNDER_TREATMENT"));
        assertThat(em.find(HealthCase.class, opened.id()).getChronicSince()).isNull();
    }

    // ------------------------------------------------------------------ A5 status

    @Test
    void tc10_11_12_chronicAndReopenKeepTheHealthStateRules() throws Exception {
        CareDtos.HealthCaseResult opened = open(daysAgo(6));
        treat(opened, daysAgo(5), 1, 7);
        Integer version = versionOf(HealthCase.class, opened.id());
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + version + ",\"action\":\"KEEP\"}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("latestProgress"));
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + version + ",\"action\":\"KEEP\",\"latestProgress\":\"Vẫn sốt nhẹ\",\"progress\":\"UNCHANGED\",\"suspectedDiagnosis\":\"Viêm phổi cấp\",\"suspectedContagious\":true}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.observationId").isNumber());
        version = versionOf(HealthCase.class, opened.id());
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + version + ",\"action\":\"TO_OPEN\"}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("action"));
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + version + ",\"action\":\"TO_CHRONIC\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CHRONIC"))
            .andExpect(jsonPath("$.chronicSince").value(TODAY.toString()))
            .andExpect(jsonPath("$.healthState").value("MONITORING"))
            .andExpect(jsonPath("$.cattleWithdrawalEndDate").value(TODAY.plusDays(2).toString()));
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].diagnosis").value("Viêm phổi cấp"))
            .andExpect(jsonPath("$.suspectedContagious").value(true))
            .andExpect(jsonPath("$.openCases[0].timeline[2].type").value("FOLLOW_UP"))
            .andExpect(jsonPath("$.openCases[0].timeline[2].description").value("Vẫn sốt nhẹ"));
        version = versionOf(HealthCase.class, opened.id());
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + version + ",\"action\":\"TO_OPEN\",\"latestProgress\":\"Xấu đi\",\"progress\":\"WORSENED\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.chronicSince").doesNotExist())
            .andExpect(jsonPath("$.healthState").value("UNDER_TREATMENT"));
    }

    /**
     * Found while running against the real backend (Việc 5c): the follow-up written by a status change was stored at
     * the exact instant (with seconds), so a treatment or follow-up saved right after with the popup's default "now"
     * (minute precision) in the same minute was refused with MSG-FE10-07.
     */
    @Test
    void aStatusChangeFollowUpDoesNotBlockARecordSavedInTheSameMinute() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        clock.set(TODAY.atTime(10, 0, 40).atZone(FARM_ZONE).toInstant());
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + opened.version() + ",\"action\":\"TO_CHRONIC\",\"latestProgress\":\"Còn ho\"}")
            .andExpect(status().isOk());
        Instant sameMinute = TODAY.atTime(10, 0).atZone(FARM_ZONE).toInstant();
        postJson("/health-cases/" + opened.id() + "/treatments", manager, "{\"expectedVersion\":" + versionOf(HealthCase.class, opened.id()) + ",\"medicineId\":" + medicine.id()
                + ",\"administeredAt\":\"" + sameMinute + "\",\"dose\":\"20 ml\",\"route\":\"IM\"}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.returnedToOpen").value(true));
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].timeline[1].occurredAt").value(sameMinute.toString()));
    }

    @Test
    void tc10_13_closingAsRecoveredMakesTheCattleHealthy() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + opened.version() + ",\"action\":\"CLOSE\"}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.params.field").value("outcome"));
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + opened.version() + ",\"action\":\"CLOSE\",\"outcome\":\"RECOVERED\",\"closedAt\":\"" + hoursAgo(1) + "\",\"confirmedById\":" + owner.getId() + "}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"))
            .andExpect(jsonPath("$.outcome").value("RECOVERED"))
            .andExpect(jsonPath("$.closedAt").value(hoursAgo(1).toString()))
            .andExpect(jsonPath("$.healthState").value("HEALTHY"))
            .andExpect(jsonPath("$.pendingExitVoucherId").doesNotExist());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases.length()").value(0))
            .andExpect(jsonPath("$.previousCases[0].caseCode").value(opened.caseCode()))
            .andExpect(jsonPath("$.previousCases[0].openingSigns").value("Sốt, bỏ ăn"))
            .andExpect(jsonPath("$.previousCases[0].outcome").value("RECOVERED"))
            .andExpect(jsonPath("$.previousCases[0].month").value(String.format("%04d-%02d", TODAY.getYear(), TODAY.getMonthValue())))
            .andExpect(jsonPath("$.previousCases[0].confirmedBy").value(owner.getFullName()));
    }

    @Test
    void tc10_14_18_closingAsDiedProposesAPendingVoucherAndTheCattleStaysActive() throws Exception {
        CareDtos.HealthCaseResult opened = open(daysAgo(6));
        CareDtos.TreatmentResult treated = treat(opened, daysAgo(5), 1, 7);
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + versionOf(HealthCase.class, opened.id()) + ",\"action\":\"CLOSE\",\"outcome\":\"DIED\",\"latestProgress\":\"Chết sáng nay\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"))
            .andExpect(jsonPath("$.outcome").value("DIED"))
            .andExpect(jsonPath("$.pendingExitVoucherId").isNumber());
        em.flush(); em.clear();
        List<HerdExitVoucher> vouchers = em.createQuery("select v from HerdExitVoucher v where v.sourceHealthCase.id=:c", HerdExitVoucher.class).setParameter("c", opened.id()).getResultList();
        assertThat(vouchers).singleElement().satisfies(v -> {
            assertThat(v.getStatus()).isEqualTo(ExitVoucherStatus.PENDING);
            assertThat(v.getExitType()).isEqualTo(ExitType.DEATH);
            assertThat(v.getLossKind()).isEqualTo(LossKind.DIED);
            assertThat(v.getExitDate()).isEqualTo(TODAY);
        });
        assertThat(em.createQuery("select r from Reminder r where r.cattle.id=:c and r.ruleType=:rule", Reminder.class).setParameter("c", cow.getId()).setParameter("rule", HerdExitCheckService.REM_12).getResultList()).hasSize(1);
        assertThat(em.find(Cattle.class, cow.getId()).getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.pendingExit.voucherId").value(vouchers.get(0).getId()))
            .andExpect(jsonPath("$.pendingExit.lossKind").value("DIED"))
            .andExpect(jsonPath("$.pendingExit.caseCode").value(opened.caseCode()));
        // GBR-26 / TC-10-18: no new record while the death voucher is pending, but the old treatment may still be corrected.
        postJson("/health-cases", manager, openBody(hoursAgo(1), ""))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-COM-17"));
        postJson("/treatments/" + treated.id() + "/correction", manager, "{\"expectedVersion\":" + versionOf(vn.edu.fpt.beefcare.domain.Treatment.class, treated.id()) + ",\"withdrawalDays\":14,\"reason\":\"Nhập nhầm\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.withdrawalAfter").value(TODAY.minusDays(5).plusDays(14).toString()));
    }

    @Test
    void tc10_15_closingAsMissingIsAnOtherVoucherWithTheMissingReason() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + opened.version() + ",\"action\":\"CLOSE\",\"outcome\":\"MISSING\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.pendingExitVoucherId").isNumber());
        em.flush(); em.clear();
        HerdExitVoucher v = em.createQuery("select v from HerdExitVoucher v where v.sourceHealthCase.id=:c", HerdExitVoucher.class).setParameter("c", opened.id()).getSingleResult();
        assertThat(v.getExitType()).isEqualTo(ExitType.OTHER);
        assertThat(v.getLossKind()).isEqualTo(LossKind.MISSING);
        assertThat(v.getNotes()).isEqualTo("Missing");
    }

    @Test
    void tc10_16_aClosureWhoseVoucherCannotBeCreatedLeavesTheCaseOpen() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        // The cattle is already on a CONFIRMED exit line (BR-D35): the loss voucher cannot be created → the whole command fails.
        HerdExitVoucher sale = exitVoucher(farm, owner, partner(farm, owner, false, true), 0L, 0L, ExitVoucherStatus.CONFIRMED);
        exitLine(sale, cow, 1, ExitLineStatus.CONFIRMED);
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + opened.version() + ",\"action\":\"CLOSE\",\"outcome\":\"DIED\"}")
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE13-08"));
        em.clear();
        assertThat(em.find(HealthCase.class, opened.id()).getStatus()).isEqualTo("OPEN");
        assertThat(em.createQuery("select count(v) from HerdExitVoucher v where v.sourceHealthCase.id=:c", Long.class).setParameter("c", opened.id()).getSingleResult()).isZero();
    }

    @Test
    void tc10_17_closingBeforeTheLatestRecordIs422FE1007() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        Instant followUpAt = hoursAgo(1);
        health.followUp(farm.getId(), opened.id(), key(), new CareDtos.FollowUp(opened.version(), followUpAt, null, "IMPROVED", "Đỡ hơn", null));
        postJson("/health-cases/" + opened.id() + "/status", manager, "{\"expectedVersion\":" + versionOf(HealthCase.class, opened.id()) + ",\"action\":\"CLOSE\",\"outcome\":\"RECOVERED\",\"closedAt\":\"" + hoursAgo(2) + "\"}")
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("MSG-FE10-07"))
            .andExpect(jsonPath("$.params.date").value(followUpAt.toString()));
    }

    // ------------------------------------------------------------------ A7 / A8 corrections

    @Test
    void tc10_19_correctingTheWithdrawalAnswersBeforeAndAfterAndKeepsTheRevision() throws Exception {
        CareDtos.HealthCaseResult opened = open(daysAgo(6));
        CareDtos.TreatmentResult treated = treat(opened, daysAgo(5), 1, 7);
        Integer version = versionOf(vn.edu.fpt.beefcare.domain.Treatment.class, treated.id());
        postJson("/treatments/" + treated.id() + "/correction", manager, "{\"expectedVersion\":" + version + ",\"withdrawalDays\":14,\"reason\":\"Đọc nhầm nhãn\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("VALID"))
            .andExpect(jsonPath("$.withdrawalBefore").value(TODAY.plusDays(2).toString()))
            .andExpect(jsonPath("$.withdrawalAfter").value(TODAY.plusDays(9).toString()))
            .andExpect(jsonPath("$.healthState").value("UNDER_TREATMENT"))
            .andExpect(jsonPath("$.caseId").value(opened.id()));
        List<RecordRevision> history = revisions.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc("Treatment", treated.id());
        assertThat(history).singleElement().satisfies(r -> {
            assertThat(r.getBeforeSnapshot()).contains("\"withdrawalDays\":7");
            assertThat(r.getAfterSnapshot()).contains("\"withdrawalDays\":14");
            assertThat(r.getReason()).isEqualTo("Đọc nhầm nhãn");
        });
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].timeline[1].corrected").value(true))
            .andExpect(jsonPath("$.openCases[0].timeline[1].withdrawalEndDate").value(TODAY.plusDays(9).toString()));
    }

    @Test
    void tc10_20_voidingTheOnlyTreatmentReturnsToMonitoring() throws Exception {
        CareDtos.HealthCaseResult opened = open(daysAgo(6));
        CareDtos.TreatmentResult treated = treat(opened, daysAgo(5), 1, 7);
        postJson("/treatments/" + treated.id() + "/void", manager, "{\"expectedVersion\":" + versionOf(vn.edu.fpt.beefcare.domain.Treatment.class, treated.id()) + ",\"reason\":\"Ghi trùng\"}")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("VOIDED"))
            .andExpect(jsonPath("$.healthState").value("MONITORING"))
            .andExpect(jsonPath("$.withdrawalBefore").value(TODAY.plusDays(2).toString()))
            .andExpect(jsonPath("$.withdrawalAfter").doesNotExist());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.withdrawalEndDate").doesNotExist())
            .andExpect(jsonPath("$.openCases[0].treatmentCount").value(0))
            .andExpect(jsonPath("$.openCases[0].timeline[1].status").value("VOIDED"));
    }

    @Test
    void tc10_21_22_theOpeningObservationCannotBeVoidedAndAReasonIsRequired() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        postJson("/health-observations/" + opened.observationId() + "/void", manager, "{\"expectedVersion\":0,\"reason\":\"Nhầm\"}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-FE10-13"));
        postJson("/health-observations/" + opened.observationId() + "/correction", manager, "{\"expectedVersion\":0,\"signs\":\"Sốt cao\"}")
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-06")).andExpect(jsonPath("$.params.field").value("reason"));
        postJson("/health-observations/" + opened.observationId() + "/correction", manager, "{\"expectedVersion\":0,\"signs\":\"Sốt cao\",\"temperatureC\":40.2,\"observerId\":" + technician.getId() + ",\"reason\":\"Bổ sung\"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VALID"));
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].openingSigns").value("Sốt cao"))
            .andExpect(jsonPath("$.openCases[0].timeline[0].corrected").value(true))
            .andExpect(jsonPath("$.openCases[0].timeline[0].temperatureC").value(40.2))
            .andExpect(jsonPath("$.openCases[0].timeline[0].observer").value(technician.getFullName()));
    }

    @Test
    void r10_10_aCorrectedTimeMustStayBetweenItsNeighbours() throws Exception {
        Instant openedAt = hoursAgo(3), treatedAt = hoursAgo(1);
        CareDtos.HealthCaseResult opened = open(openedAt);
        CareDtos.HealthCaseResult followed = health.followUp(farm.getId(), opened.id(), key(), new CareDtos.FollowUp(opened.version(), hoursAgo(2), null, "UNCHANGED", "Như cũ", null));
        treat(opened, treatedAt, 1, 0);
        String body = "{\"expectedVersion\":%d,\"observedAt\":\"%s\",\"reason\":\"Sửa giờ\"}";
        postJson("/health-observations/" + followed.observationId() + "/correction", manager, body.formatted(0, hoursAgo(4)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE10-07")).andExpect(jsonPath("$.params.date").value(openedAt.toString()));
        postJson("/health-observations/" + followed.observationId() + "/correction", manager, body.formatted(0, hoursAgo(0.5)))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("MSG-FE10-07")).andExpect(jsonPath("$.params.date").value(treatedAt.toString()));
        postJson("/health-observations/" + followed.observationId() + "/correction", manager, body.formatted(0, hoursAgo(2.5)))
            .andExpect(status().isOk());
        // The opening observation may move as long as it stays first; the case keeps its opening date in step.
        postJson("/health-observations/" + opened.observationId() + "/correction", manager, body.formatted(0, hoursAgo(3.5)))
            .andExpect(status().isOk());
        mvc.perform(get(url("/health-cases/cattle/" + cow.getId())).with(as(manager.getEmail())))
            .andExpect(jsonPath("$.openCases[0].openedAt").value(hoursAgo(3.5).toString()))
            .andExpect(jsonPath("$.openCases[0].timeline[0].type").value("OPENING"))
            .andExpect(jsonPath("$.openCases[0].timeline[1].occurredAt").value(hoursAgo(2.5).toString()));
    }

    @Test
    void tc10_23_recordsOfACaseClosedByExitAreFrozen() throws Exception {
        CareDtos.HealthCaseResult opened = open(daysAgo(6));
        CareDtos.TreatmentResult treated = treat(opened, daysAgo(5), 1, 7);
        HealthCase closedByExit = em.find(HealthCase.class, opened.id());
        closedByExit.setStatus("CLOSED"); closedByExit.setOutcome("CLOSED_BY_EXIT"); closedByExit.setClosedDate(TODAY);
        em.flush();
        postJson("/treatments/" + treated.id() + "/correction", manager, "{\"expectedVersion\":" + versionOf(vn.edu.fpt.beefcare.domain.Treatment.class, treated.id()) + ",\"withdrawalDays\":1,\"reason\":\"x\"}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MSG-COM-05"))
            .andExpect(jsonPath("$.params.reason").value("case_closed_by_exit"));
        postJson("/treatments/" + treated.id() + "/void", manager, "{\"expectedVersion\":" + versionOf(vn.edu.fpt.beefcare.domain.Treatment.class, treated.id()) + ",\"reason\":\"x\"}")
            .andExpect(status().isConflict());
    }

    // ------------------------------------------------------------------ permissions, A1, Q3

    @Test
    void tc10_24_ownerAndTechnicianCannotWrite() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        postJson("/health-cases", owner, openBody(hoursAgo(2), "")).andExpect(status().isForbidden());
        postJson("/health-cases/" + opened.id() + "/treatments", technician, "{\"expectedVersion\":" + opened.version() + ",\"medicineId\":" + medicine.id() + ",\"administeredAt\":\"" + hoursAgo(1) + "\",\"dose\":\"1 ml\",\"route\":\"ORAL\"}")
            .andExpect(status().isForbidden());
        mvc.perform(get(url("/health-cases")).with(as(technician.getEmail()))).andExpect(status().isOk());
    }

    @Test
    void tc10_26_a1_listCountsPagesSortsAndIgnoresThePeriodForOpenCases() throws Exception {
        var breed = breed(farm); var purpose = purpose(farm, PurposeType.FATTENING);
        List<Cattle> herd = List.of(cow, cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT), cattle(farm, breed, purpose, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, purpose, Sex.MALE, LifeStage.ADULT), cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT), cattle(farm, breed, purpose, Sex.MALE, LifeStage.ADULT));
        // 3 OPEN (one opened 40 days ago: outside the default period, still listed on the OPEN tab), 1 CHRONIC, 2 CLOSED opened last month.
        open(herd.get(0), hoursAgo(3)); open(herd.get(1), hoursAgo(2)); open(herd.get(2), daysAgo(40));
        CareDtos.HealthCaseResult chronic = open(herd.get(3), daysAgo(10));
        health.updateStatus(farm.getId(), chronic.id(), key(), new CareDtos.CaseStatus(chronic.version(), "TO_CHRONIC", null, null, null, null, null, null, null));
        close(open(herd.get(4), daysAgo(40)), "RECOVERED");
        close(open(herd.get(5), daysAgo(35)), "RECOVERED");

        mvc.perform(get(url("/health-cases")).with(as(owner.getEmail())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items.length()").value(3))
            .andExpect(jsonPath("$.total").value(3))
            .andExpect(jsonPath("$.counts.open").value(3))
            .andExpect(jsonPath("$.counts.chronic").value(1))
            .andExpect(jsonPath("$.counts.closed").value(0))
            .andExpect(jsonPath("$.counts.all").value(3))
            .andExpect(jsonPath("$.items[0].cattleCode").value(herd.get(1).getDisplayCode()))
            .andExpect(jsonPath("$.items[0].dayN").value(1))
            .andExpect(jsonPath("$.items[0].signs").value("Sốt, bỏ ăn"))
            .andExpect(jsonPath("$.items[2].dayN").value(41));
        mvc.perform(get(url("/health-cases")).param("tab", "CLOSED").param("from", TODAY.minusDays(45).toString()).with(as(owner.getEmail())))
            .andExpect(jsonPath("$.items.length()").value(2))
            .andExpect(jsonPath("$.counts.closed").value(2))
            .andExpect(jsonPath("$.items[0].outcome").value("RECOVERED"))
            .andExpect(jsonPath("$.items[0].closedDate").value(TODAY.toString()));
        mvc.perform(get(url("/health-cases")).param("tab", "ALL").param("size", "2").param("page", "1").param("sort", "caseCode").param("dir", "asc").with(as(owner.getEmail())))
            .andExpect(jsonPath("$.total").value(3))
            .andExpect(jsonPath("$.page").value(1))
            .andExpect(jsonPath("$.size").value(2))
            .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(url("/health-cases")).param("tab", "CHRONIC").param("severity", "SEVERE").with(as(owner.getEmail())))
            .andExpect(jsonPath("$.items.length()").value(0))
            .andExpect(jsonPath("$.counts.chronic").value(0));
        mvc.perform(get(url("/health-cases")).param("search", herd.get(1).getDisplayCode()).with(as(owner.getEmail())))
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.counts.open").value(1));
        mvc.perform(get(url("/health-cases")).param("tab", "x").with(as(owner.getEmail()))).andExpect(status().isBadRequest());
    }

    @Test
    void q3_theClosureCorrectionRouteIsGone() throws Exception {
        CareDtos.HealthCaseResult opened = open(hoursAgo(3));
        close(opened, "RECOVERED");
        postJson("/health-cases/" + opened.id() + "/closure-correction", manager, "{\"expectedVersion\":1,\"outcome\":\"DIED\",\"reason\":\"x\"}")
            .andExpect(status().isNotFound());
    }
}
