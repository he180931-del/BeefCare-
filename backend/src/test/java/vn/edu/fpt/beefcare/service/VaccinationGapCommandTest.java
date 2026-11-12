package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * FE-09 backend gaps (spec FE-09 §7): stop reason (GAP-FE09-02), withdrawal correction (GAP-FE09-04), history route and
 * revisions (GAP-FE09-03), schedule target / dose-count edits (GAP-FE09-01) and skipping cattle in a batch (TC-09-17).
 */
@ServiceIntegrationTest
@Transactional
class VaccinationGapCommandTest extends DomainTestSupport {

    @Autowired
    VaccinationCommandService vaccination;

    @Autowired
    CareCatalogueCommandService catalogue;

    @Autowired
    CareReadService reads;

    Farm farm;
    AppUser manager;
    CareDtos.CatalogueItem vaccine;
    List<Cattle> herd;

    @BeforeEach
    void farmWithFourCattle() {
        farm = farm();
        memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        var breed = breed(farm);
        var fattening = purpose(farm, PurposeType.FATTENING);
        herd = List.of(
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK)
        );
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        actAs(manager);
        vaccine = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "FMD" + next(), "LMLM", "Lở mồm long móng", "Navetco", "2 ml", "SC", 21, 6, true));
    }

    static String key() {
        return UUID.randomUUID().toString();
    }

    Instant hoursAgo(int hours) {
        return clock.instant().minusSeconds(hours * 3600L);
    }

    CareDtos.VaccinationScheduleResult schedule(String name, int doses, List<Cattle> cattle) {
        return vaccination.createSchedule(farm.getId(), key(), new CareDtos.CreateVaccinationSchedule(name, vaccine.id(), TODAY, doses, 21, null,
            cattle.stream().map(Cattle::getId).toList()));
    }

    List<ScheduledDose> doses(Long scheduleId) {
        return em.createQuery("select d from ScheduledDose d where d.schedule.id=:id order by d.cattle.id, d.doseNo", ScheduledDose.class)
            .setParameter("id", scheduleId).getResultList();
    }

    void reload() {
        em.flush();
        em.clear();
    }

    // ------------------------------------------------------------ GAP-FE09-02 (R-09-06, SCR-32 #11)

    @Test
    void stoppingAScheduleStoresTheReasonAndShowsItInTheScheduleView() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);
        Integer version = versionOf(VaccinationSchedule.class, created.id());

        CareDtos.VaccinationScheduleResult stopped = vaccination.stopSchedule(farm.getId(), created.id(), key(), version, "  Đổi vắc-xin theo thú y  ");
        assertThat(stopped.status()).isEqualTo("STOPPED");
        reload();

        assertThat(em.find(VaccinationSchedule.class, created.id()).getStopReason()).isEqualTo("Đổi vắc-xin theo thú y");
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("CANCELLED");
        assertThat(vaccination.schedules(farm.getId())).singleElement()
            .satisfies(view -> assertThat(view.stopReason()).isEqualTo("Đổi vắc-xin theo thú y"));
    }

    @Test
    void stoppingWithoutAReasonOrWithMoreThan500CharactersChangesNothing() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        Integer version = versionOf(VaccinationSchedule.class, created.id());

        assertThatThrownBy(() -> vaccination.stopSchedule(farm.getId(), created.id(), key(), version, "   "))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_06);
                assertThat(e.getParams()).containsEntry("field", "reason");
            });
        assertThatThrownBy(() -> vaccination.stopSchedule(farm.getId(), created.id(), key(), version, "x".repeat(501)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));
        reload();
        assertThat(em.find(VaccinationSchedule.class, created.id()).getStatus()).isEqualTo("ACTIVE");
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("PLANNED");
    }

    // ------------------------------------------------------------ GAP-FE09-04 (R-09-14, TC-09-27)

    Long recordOnFarm(Cattle cow, int withdrawalDays) {
        return vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null, hoursAgo(1), "LOT-1", "2 ml", "SC",
            withdrawalDays, "Manager", List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
    }

    CareDtos.CorrectVaccination withdrawal(Long id, Integer days) {
        return new CareDtos.CorrectVaccination(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), null, null, null, null, null, null, null,
            "Sửa ngưng thịt", days);
    }

    @Test
    void correctingTheWithdrawalPeriodRecalculatesTheEndDatesAndKeepsTheOldPeriodInTheRevision() {
        Cattle cow = herd.get(0);
        Long id = recordOnFarm(cow, 21);
        reload();

        CareDtos.VaccinationResult corrected = vaccination.correct(farm.getId(), id, key(), withdrawal(id, 30));
        assertThat(corrected.withdrawalDays()).isEqualTo(30);
        assertThat(corrected.withdrawalEndDate()).isEqualTo(TODAY.plusDays(30));
        assertThat(corrected.cattleWithdrawalEndDate()).isEqualTo(TODAY.plusDays(30));
        assertThat(corrected.corrected()).isTrue();
        reload();

        var record = em.find(vn.edu.fpt.beefcare.domain.Vaccination.class, id);
        assertThat(record.getWithdrawalDays()).isEqualTo(30);
        assertThat(record.getWithdrawalEndDate()).isEqualTo(TODAY.plusDays(30));
        String before = em.createQuery("select r.beforeSnapshot from RecordRevision r where r.sourceType='Vaccination' and r.sourceId=:id", String.class)
            .setParameter("id", id).getSingleResult();
        assertThat(before).contains("\"withdrawalDays\":21").contains("\"withdrawalEndDate\":\"" + TODAY.plusDays(21) + "\"");

        CareDtos.VaccinationResult none = vaccination.correct(farm.getId(), id, key(), withdrawal(id, 0));
        assertThat(none.withdrawalEndDate()).isNull();
        assertThat(none.cattleWithdrawalEndDate()).isNull();
    }

    @Test
    void anOutOfRangeWithdrawalOrAWithdrawalOnAHistoricalRecordIsRejected() {
        Cattle cow = herd.get(0);
        Long onFarm = recordOnFarm(cow, 21);
        reload();
        assertThatThrownBy(() -> vaccination.correct(farm.getId(), onFarm, key(), withdrawal(onFarm, 366)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "withdrawalDays"));

        Long historical = vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "HISTORICAL", TODAY.minusMonths(3), null, null,
            "2 ml", "SC", null, "Trại cũ", List.of(new CareDtos.VaccinationAnimal(herd.get(1).getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        reload();
        assertThatThrownBy(() -> vaccination.correct(farm.getId(), historical, key(), withdrawal(historical, 5)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "withdrawalDays"));
    }

    @Test
    void voidingTheOnlyOnFarmRecordClearsTheWithdrawalOfTheCattle() {
        Cattle cow = herd.get(0);
        Long id = recordOnFarm(cow, 21);
        reload();
        CareDtos.VaccinationResult voided = vaccination.voidRecord(farm.getId(), id, key(),
            new CareDtos.VoidRecord(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), "Ghi nhầm bò"));
        assertThat(voided.status()).isEqualTo("VOIDED");
        assertThat(voided.cattleWithdrawalEndDate()).isNull();
    }

    // ------------------------------------------------------------ GAP-FE09-03 (A8 / A9, BR-D15)

    @Test
    void historyReturnsTheRouteTheWithdrawalPeriodAndTheRevisionsOldestFirst() {
        Cattle cow = herd.get(0);
        Long id = recordOnFarm(cow, 21);
        reload();
        vaccination.correct(farm.getId(), id, key(), withdrawal(id, 30));
        reload();
        vaccination.voidRecord(farm.getId(), id, key(), new CareDtos.VoidRecord(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), "Ghi nhầm bò"));
        Long other = recordOnFarm(herd.get(1), 7);
        reload();

        List<CareDtos.VaccinationHistoryRow> rows = reads.vaccinationHistory(farm.getId(), null, null, null, null, null, null);
        CareDtos.VaccinationHistoryRow row = rows.stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow();
        assertThat(row.route()).isEqualTo("SC");
        assertThat(row.withdrawalDays()).isEqualTo(30);
        assertThat(row.revisions()).extracting(CareDtos.VaccinationRevision::action).containsExactly("CORRECT", "VOID");
        CareDtos.VaccinationRevision correction = row.revisions().get(0);
        assertThat(correction.reason()).isEqualTo("Sửa ngưng thịt");
        assertThat(correction.changedBy()).isEqualTo(manager.getFullName());
        assertThat(correction.changedAt()).isNotNull();
        assertThat(correction.before()).containsEntry("withdrawalDays", 21).containsEntry("route", "SC");
        assertThat(correction.after()).containsEntry("withdrawalDays", 30);
        assertThat(rows.stream().filter(r -> r.id().equals(other)).findFirst().orElseThrow().revisions()).isEmpty();
    }

    // ------------------------------------------------------------ GAP-FE09-01 (R-09-05, TC-09-08, TC-09-09)

    void giveDose(Long scheduleId, int doseNo, List<Cattle> cattle) {
        List<CareDtos.VaccinationAnimal> animals = doses(scheduleId).stream()
            .filter(d -> d.getDoseNo() == doseNo && cattle.stream().anyMatch(c -> c.getId().equals(d.getCattle().getId())) && !"CANCELLED".equals(d.getStatus()))
            .map(d -> new CareDtos.VaccinationAnimal(d.getCattle().getId(), d.getId(), d.getVersion(), "VACCINATE", null, null)).toList();
        vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null, hoursAgo(1), "LOT-1", "2 ml", "SC", 21, "Manager", animals));
        reload();
    }

    CareDtos.VaccinationScheduleResult edit(Long scheduleId, CareDtos.EditVaccinationSchedule request) {
        CareDtos.VaccinationScheduleResult result = vaccination.editSchedule(farm.getId(), scheduleId, key(), request);
        reload();
        return result;
    }

    CareDtos.EditVaccinationSchedule change(Long scheduleId, Integer interval, Integer doseCount, Boolean removeBooster, CareDtos.ScheduleTarget target) {
        return new CareDtos.EditVaccinationSchedule(versionOf(VaccinationSchedule.class, scheduleId), null, null, null, interval, null, doseCount, removeBooster, target);
    }

    static CareDtos.ScheduleTarget cattleOnly(List<Cattle> cattle) {
        return new CareDtos.ScheduleTarget(List.of(), List.of(), List.of(), cattle.stream().map(Cattle::getId).toList(), List.of());
    }

    List<ScheduledDose> dosesOf(Long scheduleId, Cattle cow) {
        return doses(scheduleId).stream().filter(d -> d.getCattle().getId().equals(cow.getId())).toList();
    }

    @Test
    void tc0908_changingTheIntervalMovesOnlyTheDosesNotYetGiven() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);
        giveDose(created.id(), 1, herd);

        edit(created.id(), change(created.id(), 28, null, null, null));

        assertThat(doses(created.id())).filteredOn(d -> d.getDoseNo() == 1).extracting(ScheduledDose::getStatus, ScheduledDose::getDueDate)
            .containsOnly(org.assertj.core.groups.Tuple.tuple("DONE", TODAY));
        assertThat(doses(created.id())).filteredOn(d -> d.getDoseNo() == 2).extracting(ScheduledDose::getStatus, ScheduledDose::getDueDate)
            .containsOnly(org.assertj.core.groups.Tuple.tuple("PLANNED", TODAY.plusDays(28)));
    }

    @Test
    void tc0909_removingAnAnimalCancelsItsOpenDoseAndKeepsTheGivenOne() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);
        giveDose(created.id(), 1, herd);
        Cattle removed = herd.get(3);

        CareDtos.VaccinationScheduleResult result = edit(created.id(), change(created.id(), null, null, null, cattleOnly(herd.subList(0, 3))));

        assertThat(result.targetCount()).isEqualTo(3);
        assertThat(result.plannedDoseCount()).isEqualTo(3);
        assertThat(dosesOf(created.id(), removed)).extracting(ScheduledDose::getDoseNo, ScheduledDose::getStatus)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, "DONE"), org.assertj.core.groups.Tuple.tuple(2, "CANCELLED"));
        assertThat(em.find(VaccinationSchedule.class, created.id()).getTargetCriteria()).contains("\"cattleIds\"");
    }

    @Test
    void addingAnAnimalGivesItPlannedDosesAndReAddingItReopensOnlyTheMissingNumbers() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd.subList(0, 3));
        Cattle added = herd.get(3);

        CareDtos.VaccinationScheduleResult result = edit(created.id(), change(created.id(), null, null, null, cattleOnly(herd)));
        assertThat(result.targetCount()).isEqualTo(4);
        assertThat(dosesOf(created.id(), added)).extracting(ScheduledDose::getDoseNo, ScheduledDose::getStatus, ScheduledDose::getDueDate)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, "PLANNED", TODAY), org.assertj.core.groups.Tuple.tuple(2, "PLANNED", TODAY.plusDays(21)));

        giveDose(created.id(), 1, List.of(added));
        edit(created.id(), change(created.id(), null, null, null, cattleOnly(herd.subList(0, 3))));
        edit(created.id(), change(created.id(), null, null, null, cattleOnly(herd)));
        assertThat(dosesOf(created.id(), added)).filteredOn(d -> !"CANCELLED".equals(d.getStatus()))
            .extracting(ScheduledDose::getDoseNo, ScheduledDose::getStatus)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, "DONE"), org.assertj.core.groups.Tuple.tuple(2, "PLANNED"));
    }

    @Test
    void changingTheDoseCountAddsOrCancelsDosesButNeverBelowAGivenDose() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);

        CareDtos.VaccinationScheduleResult three = edit(created.id(), change(created.id(), null, 3, null, null));
        assertThat(three.plannedDoseCount()).isEqualTo(12);
        assertThat(doses(created.id())).filteredOn(d -> d.getDoseNo() == 3).extracting(ScheduledDose::getStatus, ScheduledDose::getDueDate)
            .containsOnly(org.assertj.core.groups.Tuple.tuple("PLANNED", TODAY.plusDays(42)));

        giveDose(created.id(), 1, herd);
        giveDose(created.id(), 2, herd.subList(0, 1));
        assertThatThrownBy(() -> vaccination.editSchedule(farm.getId(), created.id(), key(), change(created.id(), null, 1, null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05);
                assertThat(e.getParams()).containsEntry("reason", "dose_count_below_done");
            });

        edit(created.id(), change(created.id(), null, 2, null, null));
        assertThat(doses(created.id())).filteredOn(d -> d.getDoseNo() == 3).extracting(ScheduledDose::getStatus).containsOnly("CANCELLED");
        assertThat(em.find(VaccinationSchedule.class, created.id()).getDoseCount()).isEqualTo(2);
    }

    @Test
    void removingTheBoosterCancelsItsOpenDosesAndAStartedBoosterBlocksADoseCountChange() {
        CareDtos.VaccinationScheduleResult created = vaccination.createSchedule(farm.getId(), key(), new CareDtos.CreateVaccinationSchedule("THT 2026", vaccine.id(), TODAY, 1, 1, 6,
            List.of(herd.get(0).getId())));
        giveDose(created.id(), 1, herd.subList(0, 1));
        assertThat(dosesOf(created.id(), herd.get(0))).extracting(ScheduledDose::getDoseNo, ScheduledDose::getStatus)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, "DONE"), org.assertj.core.groups.Tuple.tuple(2, "PLANNED"));

        assertThatThrownBy(() -> vaccination.editSchedule(farm.getId(), created.id(), key(), change(created.id(), null, 2, null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("reason", "booster_started"));

        edit(created.id(), change(created.id(), null, null, true, null));
        assertThat(em.find(VaccinationSchedule.class, created.id()).getBoosterIntervalMonths()).isNull();
        assertThat(dosesOf(created.id(), herd.get(0))).extracting(ScheduledDose::getStatus).containsExactly("DONE", "CANCELLED");
    }

    @Test
    void q3_theVaccineCannotChangeOnceADoseWasGivenAndAnotherActiveNameIsRejected() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);
        schedule("THT 2026", 1, herd);
        CareDtos.CatalogueItem other = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "THT" + next(), "THT", "Tụ huyết trùng", null, "2 ml", "IM", 0, null, true));
        giveDose(created.id(), 1, herd.subList(0, 1));
        Integer version = versionOf(VaccinationSchedule.class, created.id());

        assertThatThrownBy(() -> vaccination.editSchedule(farm.getId(), created.id(), key(),
            new CareDtos.EditVaccinationSchedule(version, null, other.id(), null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("reason", "vaccine_change_after_done"));
        assertThatThrownBy(() -> vaccination.editSchedule(farm.getId(), created.id(), key(),
            new CareDtos.EditVaccinationSchedule(version, "tht 2026", null, null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("reason", "active_schedule_name_exists"));
    }

    @Test
    void theStoredTargetIsReturnedWithCodesForTheEditScreen() {
        Cattle left = herd.get(2);
        CareDtos.VaccinationScheduleResult created = vaccination.createSchedule(farm.getId(), key(), new CareDtos.CreateVaccinationSchedule("LMLM 2026", vaccine.id(), TODAY, 1, 1, null,
            List.of(), List.of(), List.of("FATTENING"), List.of(), List.of(left.getId())));
        assertThat(created.targetCount()).isEqualTo(3);
        reload();

        CareDtos.ScheduleTargetView target = vaccination.schedules(farm.getId()).get(0).target();
        assertThat(target.herdGroups()).containsExactly("FATTENING");
        assertThat(target.excludedCattleIds()).containsExactly(left.getId());
        assertThat(target.excludedCattleCodes()).containsExactly(left.getDisplayCode());
        assertThat(target.cattleIds()).isEmpty();
        assertThat(target.penCodes()).isEmpty();
    }

    // ------------------------------------------------------------ TC-09-17 (R-09-09, R-09-10)

    List<CareDtos.VaccinationAnimal> batchOf(List<ScheduledDose> doses) {
        return doses.stream().map(d -> new CareDtos.VaccinationAnimal(d.getCattle().getId(), d.getId(), d.getVersion(), "VACCINATE", null, null)).toList();
    }

    CareDtos.RecordVaccinations onFarm(String batchNo, List<CareDtos.VaccinationAnimal> animals) {
        return new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null, hoursAgo(1), batchNo, "2 ml", "SC", 21, "Manager", animals);
    }

    void exit(Cattle cow) {
        Cattle managed = em.find(Cattle.class, cow.getId());
        managed.setHerdStatus(vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.EXITED);
        managed.setExitDate(TODAY);
        reload();
    }

    long vaccinations() {
        return em.createQuery("select count(v) from Vaccination v where v.cattle.farm.id=:farm", Long.class).setParameter("farm", farm.getId()).getSingleResult();
    }

    @Test
    void tc0917_anAnimalWhoseDoseWasGivenMeanwhileIsSkippedAndTheOthersAreRecorded() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        List<ScheduledDose> loaded = doses(created.id());
        // Another Manager records the first animal while this batch is open (its dose version is now stale too).
        giveDose(created.id(), 1, herd.subList(0, 1));

        CareDtos.VaccinationBatchResult result = vaccination.record(farm.getId(), key(), onFarm("LOT-2", batchOf(loaded)));
        reload();

        assertThat(result.vaccinatedCount()).isEqualTo(3);
        assertThat(result.skipped()).containsExactly(new CareDtos.SkippedAnimal(herd.get(0).getId(), herd.get(0).getDisplayCode(), "MSG-FE09-09", 1));
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("DONE");
        assertThat(vaccinations()).isEqualTo(4);
    }

    @Test
    void anAnimalThatLeftTheHerdMeanwhileIsSkippedWithCom13() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        List<ScheduledDose> loaded = doses(created.id());
        Cattle gone = herd.get(3);
        exit(gone);

        CareDtos.VaccinationBatchResult result = vaccination.record(farm.getId(), key(), onFarm("LOT-2", batchOf(loaded)));
        reload();

        assertThat(result.vaccinatedCount()).isEqualTo(3);
        assertThat(result.skipped()).extracting(CareDtos.SkippedAnimal::cattleCode, CareDtos.SkippedAnimal::messageCode)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(gone.getDisplayCode(), MessageCodes.COM_13));
        assertThat(dosesOf(created.id(), gone)).extracting(ScheduledDose::getStatus).containsExactly("PLANNED");
    }

    @Test
    void aBatchWhereEveryAnimalIsSkippedSavesNothingAndReportsEachOne() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd.subList(0, 2));
        List<ScheduledDose> loaded = doses(created.id());
        giveDose(created.id(), 1, herd.subList(0, 1));
        exit(herd.get(1));
        long before = vaccinations();

        CareDtos.VaccinationBatchResult result = vaccination.record(farm.getId(), key(), onFarm("LOT-2", batchOf(loaded)));

        assertThat(result.vaccinatedCount()).isZero();
        assertThat(result.deferredCount()).isZero();
        assertThat(result.skipped()).extracting(CareDtos.SkippedAnimal::messageCode).containsExactlyInAnyOrder(MessageCodes.FE09_09, MessageCodes.COM_13);
        reload();
        assertThat(vaccinations()).isEqualTo(before);
    }

    @Test
    void r0909_aValidationErrorStillRejectsTheWholeBatch() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        List<ScheduledDose> loaded = doses(created.id());
        giveDose(created.id(), 1, herd.subList(0, 1));
        long before = vaccinations();

        assertThatThrownBy(() -> vaccination.record(farm.getId(), key(), onFarm(" ", batchOf(loaded))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "batchNo"));
        reload();
        assertThat(vaccinations()).isEqualTo(before);
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("DONE", "PLANNED");
    }

    @Test
    void aBatchWithOnlyDeferralsIsSavedAndAudited() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd.subList(0, 1));
        ScheduledDose dose = doses(created.id()).get(0);
        CareDtos.VaccinationBatchResult result = vaccination.record(farm.getId(), key(), onFarm("LOT-2",
            List.of(new CareDtos.VaccinationAnimal(dose.getCattle().getId(), dose.getId(), dose.getVersion(), "DEFER", "Bò sốt", null))));
        reload();
        assertThat(result.deferredCount()).isEqualTo(1);
        assertThat(em.find(ScheduledDose.class, dose.getId()).getStatus()).isEqualTo("DEFERRED");
    }
}
