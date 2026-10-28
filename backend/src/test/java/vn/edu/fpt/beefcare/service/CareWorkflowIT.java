package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-09 vaccination, FE-10 health and treatment, FE-18 vaccine / medicine references: roles, history and recalculation. */
@ServiceIntegrationTest
@Transactional
class CareWorkflowIT extends DomainTestSupport {

    @Autowired
    HealthCareCommandService health;

    @Autowired
    CareReadService reads;

    @Autowired
    VaccinationCommandService vaccination;

    @Autowired
    CareCatalogueCommandService catalogue;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    Cattle cow;

    @BeforeEach
    void farmWithOneCow() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        cow = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
    }

    private static String key() {
        return UUID.randomUUID().toString();
    }

    private Instant hoursAgo(int hours) {
        return clock.instant().minusSeconds(hours * 3600L);
    }

    // ------------------------------------------------------------------ FE-10

    @Test
    void managerRecordsACaseAndTreatmentAndVoidingTheTreatmentClearsTheWithdrawal() {
        actAs(manager);
        CareDtos.CatalogueItem medicine = catalogue.saveMedicine(farm.getId(), null, key(),
            new CareDtos.MedicineCommand(null, "OXY" + next(), "Oxytetracycline", null, "1 ml/10 kg", "IM", 28, true));
        CareDtos.HealthCaseResult opened = health.open(farm.getId(), key(), new CareDtos.OpenHealthCase(cow.getId(), null, null, hoursAgo(3), null,
            new BigDecimal("40.1"), "Fever, low appetite", "Suspected pneumonia", false, "moderate"));
        assertThat(opened.status()).isEqualTo("OPEN");

        CareDtos.HealthCaseResult followed = health.followUp(farm.getId(), opened.id(), key(),
            new CareDtos.FollowUp(opened.version(), hoursAgo(2), new BigDecimal("39.5"), "improved", "Eating again"));
        CareDtos.TreatmentResult treated = health.recordTreatment(farm.getId(), opened.id(), key(),
            new CareDtos.TreatmentCommand(medicine.id(), hoursAgo(1), "Oxytetracycline LA", "25 ml", "IM", 3, 28, "Manager", null));
        // GBR-46: first administration + course days - 1 + withdrawal days
        assertThat(treated.withdrawalEndDate()).isEqualTo(TODAY.plusDays(3 - 1 + 28));

        // FE-10 reads: open tab and the cattle profile with case card and chronology
        assertThat(reads.healthCases(farm.getId(), "OPEN", null, null, null, null, null)).extracting(CareDtos.HealthCaseRow::id).contains(opened.id());
        actAs(technician); // read-only access
        CareDtos.HealthProfile profile = reads.healthProfile(farm.getId(), cow.getId());
        assertThat(profile.activeCases()).extracting(CareDtos.HealthCaseCard::id).containsExactly(opened.id());
        assertThat(profile.withdrawalEndDate()).isEqualTo(TODAY.plusDays(3 - 1 + 28));
        assertThat(profile.timeline()).hasSizeGreaterThanOrEqualTo(3);
        assertThatThrownBy(() -> health.followUp(farm.getId(), opened.id(), key(), new CareDtos.FollowUp(followed.version(), hoursAgo(1), null, "unchanged", "x")))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));

        // UC-FE10-05: a void keeps the row, needs the version and a reason, and recalculates the withdrawal
        actAs(manager);
        Integer treatmentVersion = versionOf(vn.edu.fpt.beefcare.domain.Treatment.class, treated.id());
        assertThatThrownBy(() -> health.voidTreatment(farm.getId(), treated.id(), key(), new CareDtos.VoidRecord(treatmentVersion, " ")))
            .isInstanceOf(DomainException.class);
        CareDtos.RecordStatus voided = health.voidTreatment(farm.getId(), treated.id(), key(), new CareDtos.VoidRecord(treatmentVersion, "Entered twice"));
        assertThat(voided.status()).isEqualTo("VOIDED");
        assertThat(reads.healthProfile(farm.getId(), cow.getId()).withdrawalEndDate()).isNull();
    }

    @Test
    void ownerCannotRecordCareAndAnotherFarmSeesNothing() {
        actAs(owner);
        assertThatThrownBy(() -> health.open(farm.getId(), key(), new CareDtos.OpenHealthCase(cow.getId(), null, null, hoursAgo(1), null, null, "Limping", null, false, "MILD")))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        assertThat(reads.healthCases(farm.getId(), "OPEN", null, null, null, null, null)).isEmpty(); // Owner reads

        Farm other = farm();
        AppUser otherManager = memberWithRole(other, FarmRole.MANAGER);
        actAs(otherManager);
        assertThatThrownBy(() -> reads.healthProfile(farm.getId(), cow.getId())).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> health.open(other.getId(), key(), new CareDtos.OpenHealthCase(cow.getId(), null, null, hoursAgo(1), null, null, "Limping", null, false, "MILD")))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getStatus().value()).isEqualTo(404));
    }

    @Test
    void closingACaseAsDiedProposesAPendingDeathVoucherForTheOwner() {
        actAs(manager);
        CareDtos.HealthCaseResult opened = health.open(farm.getId(), key(), new CareDtos.OpenHealthCase(cow.getId(), null, null, hoursAgo(5), null,
            null, "Bloat", null, false, "SEVERE"));
        CareDtos.HealthCaseResult closed = health.updateStatus(farm.getId(), opened.id(), key(),
            new CareDtos.CaseStatus(opened.version(), "CLOSE", "DIED", TODAY, "Found dead"));
        assertThat(closed.status()).isEqualTo("CLOSED");
        List<HerdExitVoucher> pending = em.createQuery("select v from HerdExitVoucher v where v.farm.id = :f", HerdExitVoucher.class)
            .setParameter("f", farm.getId()).getResultList();
        assertThat(pending).singleElement().satisfies(v -> assertThat(v.getStatus().name()).isEqualTo("PENDING"));
        // the animal accepts no new event while the death voucher is pending (GBR-26)
        assertThatThrownBy(() -> health.open(farm.getId(), key(), new CareDtos.OpenHealthCase(cow.getId(), null, null, hoursAgo(1), null, null, "x", null, false, "MILD")))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_17));
    }

    // ------------------------------------------------------------------ FE-09

    @Test
    void scheduleDosesAreRecordedDeferredRestoredOnVoidAndCancelledOnStop() {
        actAs(manager);
        CareDtos.CatalogueItem vaccine = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "FMD" + next(), "FMD vaccine", "Foot-and-mouth disease", "Navetco", "2 ml", "SC", 0, 6, true));
        CareDtos.VaccinationScheduleResult schedule = vaccination.createSchedule(farm.getId(), key(),
            new CareDtos.CreateVaccinationSchedule("FMD round", vaccine.id(), TODAY, 2, 21, null, List.of(cow.getId())));
        assertThat(schedule.plannedDoseCount()).isEqualTo(2);
        List<ScheduledDose> doses = doses(schedule.id());
        ScheduledDose first = doses.get(0);

        CareDtos.VaccinationBatchResult recorded = vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null,
            hoursAgo(1), "LOT-1", "2 ml", "SC", 0, "Manager",
            List.of(new CareDtos.VaccinationAnimal(cow.getId(), first.getId(), first.getVersion(), "VACCINATE", null, null))));
        assertThat(recorded.vaccinatedCount()).isEqualTo(1);
        em.flush();
        em.clear();
        assertThat(em.find(ScheduledDose.class, first.getId()).getStatus()).isEqualTo("DONE");
        assertThat(reads.vaccinationHistory(farm.getId(), null, null, null, null, null, cow.getId())).hasSize(1);

        Long vaccinationId = recorded.vaccinationIds().get(0);
        Integer vaccinationVersion = versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, vaccinationId);
        vaccination.voidRecord(farm.getId(), vaccinationId, key(), new CareDtos.VoidRecord(vaccinationVersion, "Wrong animal"));
        em.flush();
        em.clear();
        assertThat(em.find(ScheduledDose.class, first.getId()).getStatus()).isIn("PLANNED", "DEFERRED");

        ScheduledDose second = em.find(ScheduledDose.class, doses.get(1).getId());
        CareDtos.DoseResult deferred = vaccination.deferDose(farm.getId(), second.getId(), key(),
            new CareDtos.DeferDose(second.getVersion(), "Animal unwell", TODAY.plusDays(30), null));
        assertThat(deferred.status()).isEqualTo("DEFERRED");

        Integer scheduleVersion = versionOf(vn.edu.fpt.beefcare.domain.VaccinationSchedule.class, schedule.id());
        assertThat(vaccination.stopSchedule(farm.getId(), schedule.id(), key(), scheduleVersion).status()).isEqualTo("STOPPED");
        em.flush();
        em.clear();
        assertThat(doses(schedule.id())).extracting(ScheduledDose::getStatus).containsOnly("CANCELLED");

        actAs(owner);
        assertThatThrownBy(() -> vaccination.createSchedule(farm.getId(), key(),
            new CareDtos.CreateVaccinationSchedule("x", vaccine.id(), TODAY, 1, 21, null, List.of(cow.getId()))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
    }

    // ------------------------------------------------------------------ FE-18 references

    @Test
    void anUnusedVaccineCanBeDeletedButAUsedOneOnlyDeactivated() {
        actAs(owner);
        CareDtos.CatalogueItem unused = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "LSD" + next(), "LSD vaccine", "Lumpy skin", null, "1 ml", "SC", 0, 12, true));
        assertThat(catalogue.deleteUnusedVaccine(farm.getId(), unused.id(), key(), versionOf(vn.edu.fpt.beefcare.domain.Vaccine.class, unused.id()))).isTrue();

        CareDtos.CatalogueItem used = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "HS" + next(), "HS vaccine", "Haemorrhagic septicaemia", null, "2 ml", "IM", 0, 6, true));
        actAs(manager);
        vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(used.id(), "ON_FARM", null, hoursAgo(1), "LOT-2", "2 ml", "IM", 0, "Manager",
            List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null, "VACCINATE", null, null))));
        actAs(owner);
        Integer usedVersion = versionOf(vn.edu.fpt.beefcare.domain.Vaccine.class, used.id());
        assertThatThrownBy(() -> catalogue.deleteUnusedVaccine(farm.getId(), used.id(), key(), usedVersion)).isInstanceOf(DomainException.class);

        actAs(technician);
        assertThatThrownBy(() -> catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "T" + next(), "T", "x", null, "1 ml", "SC", 0, null, true))).isInstanceOf(DomainException.class);
    }

    private List<ScheduledDose> doses(Long scheduleId) {
        return em.createQuery("select d from ScheduledDose d where d.schedule.id = :s order by d.doseNo", ScheduledDose.class)
            .setParameter("s", scheduleId).getResultList();
    }
}
