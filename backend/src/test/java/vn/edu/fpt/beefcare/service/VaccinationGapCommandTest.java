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
            withdrawalDays, "Manager", List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null)))).vaccinationIds().get(0);
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
            "2 ml", "SC", null, "Trại cũ", List.of(new CareDtos.VaccinationAnimal(herd.get(1).getId(), null, null)))).vaccinationIds().get(0);
        reload();
        assertThatThrownBy(() -> vaccination.correct(farm.getId(), historical, key(), withdrawal(historical, 5)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "withdrawalDays"));
    }

    /** Found while testing in the browser (15/11/2026): FE-09 spec §3.3 makes the dose optional, but a vaccine without a reference dose was refused with MSG-COM-06. */
    @Test
    void aVaccinationWithoutADoseIsSavedWhenTheVaccineHasNoReferenceDose() {
        CareDtos.CatalogueItem noDose = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "ND" + next(), "Không liều", "Tụ huyết trùng", "Navetco", null, "SC", 21, 6, true));
        CareDtos.VaccinationAnimal animal = new CareDtos.VaccinationAnimal(herd.get(0).getId(), null, null);
        Long id = vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(noDose.id(), "ON_FARM", null, hoursAgo(1), "LOT-9", null, "SC", 21, "Manager", List.of(animal)))
            .vaccinationIds().get(0);
        reload();
        assertThat(em.find(vn.edu.fpt.beefcare.domain.Vaccination.class, id).getDose()).isNull();
        assertThatThrownBy(() -> vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(noDose.id(), "ON_FARM", null, hoursAgo(1), "LOT-9", "x".repeat(256), "SC", 21, "Manager", List.of(animal))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "dose"));
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
        Long other = recordOnFarm(herd.get(1), 7);
        reload();

        List<CareDtos.VaccinationHistoryRow> rows = reads.vaccinationHistory(farm.getId(), null, null, null, null, null, null);
        CareDtos.VaccinationHistoryRow row = rows.stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow();
        assertThat(row.route()).isEqualTo("SC");
        assertThat(row.withdrawalDays()).isEqualTo(30);
        assertThat(row.revisions()).extracting(CareDtos.VaccinationRevision::action).containsExactly("CORRECT");
        CareDtos.VaccinationRevision correction = row.revisions().get(0);
        assertThat(correction.reason()).isEqualTo("Sửa ngưng thịt");
        assertThat(correction.changedBy()).isEqualTo(manager.getFullName());
        assertThat(correction.changedAt()).isNotNull();
        assertThat(correction.before()).containsEntry("withdrawalDays", 21).containsEntry("route", "SC");
        assertThat(correction.after()).containsEntry("withdrawalDays", 30);
        assertThat(rows.stream().filter(r -> r.id().equals(other)).findFirst().orElseThrow().revisions()).isEmpty();
    }

    /** D53: xóa chỉ cần xác nhận (không lý do); bản ghi đã xóa không còn trong lịch sử tiêm nhưng dữ liệu gốc vẫn được lưu. */
    @Test
    void d53_aDeletedRecordLeavesTheHistoryButKeepsItsRevision() {
        Cattle cow = herd.get(0);
        Long id = recordOnFarm(cow, 21);
        reload();
        vaccination.voidRecord(farm.getId(), id, key(), new CareDtos.VoidRecord(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), null));
        reload();

        assertThat(reads.vaccinationHistory(farm.getId(), null, null, null, null, null, null)).extracting(CareDtos.VaccinationHistoryRow::id).doesNotContain(id);
        assertThat(reads.vaccinationHistory(farm.getId(), null, null, null, null, null, cow.getId())).isEmpty();
        assertThat(em.find(vn.edu.fpt.beefcare.domain.Vaccination.class, id).getStatus()).isEqualTo("VOIDED");
        assertThat(em.createQuery("select count(r) from RecordRevision r where r.sourceType = 'Vaccination' and r.sourceId = :id", Long.class)
            .setParameter("id", id).getSingleResult()).isEqualTo(1L);
    }

    /** D53: ghi chú khi sửa không bắt buộc; quá 500 ký tự vẫn bị từ chối. */
    @Test
    void d53_aCorrectionNoteIsOptionalButLimitedTo500Characters() {
        Long id = recordOnFarm(herd.get(0), 21);
        reload();
        Integer version = versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id);
        assertThatThrownBy(() -> vaccination.correct(farm.getId(), id, key(),
            new CareDtos.CorrectVaccination(version, null, null, null, null, null, null, null, "x".repeat(501), 30)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "reason"));
        vaccination.correct(farm.getId(), id, key(), new CareDtos.CorrectVaccination(version, null, null, null, null, null, null, null, "  ", 30));
        reload();
        assertThat(em.find(vn.edu.fpt.beefcare.domain.Vaccination.class, id).getWithdrawalDays()).isEqualTo(30);
    }

    // ------------------------------------------------------------ GAP-FE09-01 (R-09-05, TC-09-08, TC-09-09)

    void giveDose(Long scheduleId, int doseNo, List<Cattle> cattle) {
        List<CareDtos.VaccinationAnimal> animals = doses(scheduleId).stream()
            .filter(d -> d.getDoseNo() == doseNo && cattle.stream().anyMatch(c -> c.getId().equals(d.getCattle().getId())) && !"CANCELLED".equals(d.getStatus()))
            .map(d -> new CareDtos.VaccinationAnimal(d.getCattle().getId(), d.getId(), d.getVersion())).toList();
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

    /** TC-09-08: lịch chưa ai tiêm thì đổi khoảng cách dời mọi mũi chờ tiêm. */
    @Test
    void tc0908_changingTheIntervalBeforeAnyDoseMovesTheOpenDoses() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);

        edit(created.id(), change(created.id(), 28, null, null, null));

        assertThat(doses(created.id())).filteredOn(d -> d.getDoseNo() == 2).extracting(ScheduledDose::getStatus, ScheduledDose::getDueDate)
            .containsOnly(org.assertj.core.groups.Tuple.tuple("PLANNED", TODAY.plusDays(28)));
    }

    /** D46: đã có mũi tiêm thì khoảng cách giữa mũi và ngày bắt đầu bị khóa; mũi đã tiêm và mũi chờ tiêm không đổi. */
    @Test
    void d46_intervalAndStartDateAreLockedOnceADoseIsGiven() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);
        giveDose(created.id(), 1, herd);

        assertThatThrownBy(() -> edit(created.id(), change(created.id(), 28, null, null, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("reason", "interval_locked_after_done"));
        CareDtos.EditVaccinationSchedule newStart = new CareDtos.EditVaccinationSchedule(
            versionOf(VaccinationSchedule.class, created.id()), null, null, TODAY.plusDays(5), null, null, null, null, null);
        assertThatThrownBy(() -> edit(created.id(), newStart))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("reason", "start_date_locked_after_done"));
        assertThat(doses(created.id())).filteredOn(d -> d.getDoseNo() == 2).extracting(ScheduledDose::getDueDate)
            .containsOnly(TODAY.plusDays(21));
    }

    /** D46: lịch không còn mũi chờ tiêm là "đã hoàn thành" – không sửa được, kể cả đổi tên hay thêm bò. */
    @Test
    void d46_aCompletedScheduleIsLocked() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        giveDose(created.id(), 1, herd);

        assertThat(vaccination.schedules(farm.getId())).filteredOn(v -> v.id().equals(created.id()))
            .extracting(CareDtos.VaccinationScheduleView::completed).containsExactly(true);
        CareDtos.EditVaccinationSchedule rename = new CareDtos.EditVaccinationSchedule(
            versionOf(VaccinationSchedule.class, created.id()), "LMLM 2026 – đợt 2", null, null, null, null, null, null, null);
        assertThatThrownBy(() -> edit(created.id(), rename))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("reason", "schedule_completed"));
    }

    /** D46: bò thêm vào lịch đã bắt đầu (ngày bắt đầu đã qua) có mũi 1 hạn hôm nay, không bị quá hạn ngay khi thêm. */
    @Test
    void d46_cattleAddedToAStartedScheduleAreDueFromToday() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd.subList(0, 2));
        VaccinationSchedule stored = em.find(VaccinationSchedule.class, created.id());
        stored.setFirstDueDate(TODAY.minusDays(30));
        reload();

        edit(created.id(), change(created.id(), null, null, null, cattleOnly(herd.subList(0, 3))));

        assertThat(dosesOf(created.id(), herd.get(2))).extracting(ScheduledDose::getDoseNo, ScheduledDose::getDueDate)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, TODAY), org.assertj.core.groups.Tuple.tuple(2, TODAY.plusDays(21)));
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
        return doses.stream().map(d -> new CareDtos.VaccinationAnimal(d.getCattle().getId(), d.getId(), d.getVersion())).toList();
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

    /** D45: liều phải là số dương (kèm đơn vị tùy chọn); 0, số âm, chữ hay khoảng đều bị từ chối. */
    @Test
    void d45_doseMustBeAPositiveNumber() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        List<CareDtos.VaccinationAnimal> animals = batchOf(doses(created.id()));
        for (String dose : List.of("0", "0 ml", "-2 ml", "abc", "1-2 ml")) {
            CareDtos.RecordVaccinations request = new CareDtos.RecordVaccinations(
                vaccine.id(), "ON_FARM", null, hoursAgo(1), null, dose, "SC", 21, "Manager", animals);
            assertThatThrownBy(() -> vaccination.record(farm.getId(), key(), request))
                .as("liều %s", dose)
                .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "dose"));
        }
        assertThat(vaccinations()).isZero();
    }

    /** D45: đường tiêm "Khác" phải có mô tả; mô tả được lưu đúng như người dùng nhập. */
    @Test
    void d45_otherRouteNeedsADescriptionWhichIsStored() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        List<CareDtos.VaccinationAnimal> animals = batchOf(doses(created.id()));
        CareDtos.RecordVaccinations bareOther = new CareDtos.RecordVaccinations(
            vaccine.id(), "ON_FARM", null, hoursAgo(1), null, "2 ml", "OTHER", 21, "Manager", animals);
        assertThatThrownBy(() -> vaccination.record(farm.getId(), key(), bareOther))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "routeOther"));

        CareDtos.RecordVaccinations described = new CareDtos.RecordVaccinations(
            vaccine.id(), "ON_FARM", null, hoursAgo(1), null, "2,5 ml", "Tiêm tĩnh mạch", 21, "Manager", animals);
        vaccination.record(farm.getId(), key(), described);
        reload();

        assertThat(em.createQuery("select v.route from Vaccination v where v.cattle.farm.id = :farm", String.class)
            .setParameter("farm", farm.getId())
            .getResultList()).containsOnly("Tiêm tĩnh mạch");
    }

    /** D44: tiêm tại trại không cần số lô; bản ghi lưu số lô {@code null}. */
    @Test
    void d44_onFarmVaccinationWithoutBatchNumberIsRecorded() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        List<ScheduledDose> loaded = doses(created.id());

        CareDtos.VaccinationBatchResult result = vaccination.record(farm.getId(), key(), onFarm(null, batchOf(loaded)));
        reload();

        assertThat(result.vaccinatedCount()).isEqualTo(4);
        assertThat(em.createQuery("select v.batchNo from Vaccination v where v.cattle.farm.id = :farm", String.class)
            .setParameter("farm", farm.getId())
            .getResultList()).containsOnlyNulls();
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

        // D44: số lô không còn bắt buộc; dùng số lô quá 50 ký tự để tạo lỗi kiểm tra.
        assertThatThrownBy(() -> vaccination.record(farm.getId(), key(), onFarm("L".repeat(51), batchOf(loaded))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "batchNo"));
        reload();
        assertThat(vaccinations()).isEqualTo(before);
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("DONE", "PLANNED");
    }

    // ------------------------------------------------------------ Found while running against the real backend

    @Test
    void brD14_aVaccinationBeforeTheHerdEntryDateIsRejected() {
        Cattle cow = herd.get(0);
        var voucher = entryVoucher(farm, manager, partner(farm, manager, true, false), 0L, 0L, vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus.POSTED);
        var line = new vn.edu.fpt.beefcare.domain.HerdEntry();
        line.setFarm(farm); line.setVoucher(voucher); line.setLineNo(1); line.setCattle(cow);
        line.setSource(vn.edu.fpt.beefcare.domain.enumeration.EntrySource.EXTERNAL); line.setEntryDate(TODAY.minusDays(3));
        line.setInitialPen(pen(farm, "P" + next(), 10)); line.setStatus(vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus.VALID);
        line.setCreatedAt(clock.instant()); line.setUpdatedAt(clock.instant());
        save(line);
        reload();

        assertThatThrownBy(() -> vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null,
            clock.instant().minusSeconds(5 * 86400L), "LOT-1", "2 ml", "SC", 21, "Manager",
            List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null)))))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_15);
                assertThat(e.getParams()).containsEntry("date", TODAY.minusDays(3));
            });
        assertThat(vaccinations()).isZero();
        assertThat(recordOnFarm(cow, 21)).isNotNull();
    }

}
