package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.BreedWrite;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.PurposeWrite;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-18 catalogue and parameter rules (spec §3 / §4, D37 / D42). */
@ServiceIntegrationTest
@Transactional
class CatalogueFe18Test extends DomainTestSupport {

    @Autowired HerdCatalogueCommandService herd;
    @Autowired CareCatalogueCommandService care;
    @Autowired FarmParameterCommandService parameters;
    @Autowired VaccinationCommandService vaccination;

    private static void assertCode(Runnable call, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(code));
    }

    private CareDtos.VaccineCommand vaccine(String code, Integer booster, Integer withdrawal) {
        return new CareDtos.VaccineCommand(null, code, "Lở mồm long móng", "LMLM", null, null, null, withdrawal, booster, true);
    }

    @Test
    void d42UnusedAndReferencedItemsAreStoppedAndReactivatedWithTheSameId() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.OWNER));
        Breed unused = breed(f);
        Breed used = breed(f);
        ProductionPurpose purpose = purpose(f, PurposeType.FATTENING);
        cattle(f, used, purpose, Sex.MALE, LifeStage.ADULT);
        assertThat(herd.breeds(f.getId(), null, null)).filteredOn(b -> b.id().equals(used.getId())).singleElement()
            .satisfies(b -> assertThat(b.referencedCount()).isEqualTo(1));
        for (Breed breed : java.util.List.of(unused, used)) {
            var stopped = herd.saveBreed(f.getId(), breed.getId(), new BreedWrite(breed.getCode(), breed.getName(), null, null, false, breed.getVersion()));
            assertThat(stopped.available()).isFalse();
            var restored = herd.saveBreed(f.getId(), breed.getId(), new BreedWrite(breed.getCode(), breed.getName(), null, null, true, stopped.version()));
            assertThat(restored.id()).isEqualTo(breed.getId());
            assertThat(restored.available()).isTrue();
        }
        var stopped = herd.savePurpose(f.getId(), purpose.getId(), new PurposeWrite(purpose.getCode(), purpose.getName(), purpose.getPurposeType(), null, false, purpose.getVersion()));
        var restored = herd.savePurpose(f.getId(), purpose.getId(), new PurposeWrite(purpose.getCode(), purpose.getName(), purpose.getPurposeType(), null, true, stopped.version()));
        assertThat(restored.id()).isEqualTo(purpose.getId());
        em.flush(); em.clear();
        assertThat(em.find(Breed.class, unused.getId()).getAvailable()).isTrue();
        assertThat(em.find(Breed.class, used.getId()).getAvailable()).isTrue();
        assertThat(em.find(ProductionPurpose.class, purpose.getId()).getAvailable()).isTrue();
    }

    @Test
    void q1TechnicianViewsEveryTabButCannotWrite() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.TECHNICIAN));
        assertThat(care.vaccines(f.getId())).isNotNull();
        assertThat(care.medicines(f.getId())).isNotNull();
        assertThat(parameters.list(f.getId())).isNotNull();
        // TC-18-01: writes stay Owner / Manager only.
        assertThatThrownBy(() -> care.saveVaccine(f.getId(), null, "k-" + next(), vaccine("VX-A", null, 0))).isInstanceOf(DomainException.class);
    }

    @Test
    void tc1802To04And13VaccineCodeAndRangesFollowTheSpec() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.MANAGER));
        assertCode(() -> care.saveVaccine(f.getId(), null, "k1-" + next(), vaccine("vx-lmlm", null, 0)), MessageCodes.COM_10);
        assertCode(() -> care.saveVaccine(f.getId(), null, "k2-" + next(), vaccine("A", null, 0)), MessageCodes.COM_10);
        assertCode(() -> care.saveVaccine(f.getId(), null, "k3-" + next(), vaccine("VX-LMLM", 731, 0)), MessageCodes.COM_10);
        assertCode(() -> care.saveVaccine(f.getId(), null, "k4-" + next(), vaccine("VX-LMLM", null, 366)), MessageCodes.COM_10);
        // §3.2: booster 0–730 accepted, withdrawal defaults to 0, missing dose / route = "complete from label".
        CareDtos.CatalogueItem saved = care.saveVaccine(f.getId(), null, "k5-" + next(), vaccine("VX-LMLM", 365, null));
        assertThat(saved.withdrawalDays()).isZero();
        assertThat(saved.completeFromLabel()).isTrue();
        assertThat(saved.referencedCount()).isZero();
        assertCode(() -> care.saveVaccine(f.getId(), null, "k6-" + next(), vaccine("VX-LMLM", null, 0)), MessageCodes.FE18_02);
        // TC-18-10: never used -> deleted.
        assertThat(care.deleteUnusedVaccine(f.getId(), saved.id(), "k7-" + next(), saved.version())).isTrue();
    }

    @Test
    void tc1814MedicineNeedsWithdrawalButNotDoseOrRoute() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.MANAGER));
        assertCode(() -> care.saveMedicine(f.getId(), null, "m1-" + next(), new CareDtos.MedicineCommand(null, "TH-OXY", "Oxytetracycline", null, null, null, null, true)), MessageCodes.COM_06);
        CareDtos.CatalogueItem saved = care.saveMedicine(f.getId(), null, "m2-" + next(), new CareDtos.MedicineCommand(null, "TH-OXY", "Oxytetracycline", null, null, null, 28, true));
        assertThat(saved.dose()).isNull();
        assertThat(saved.withdrawalDays()).isEqualTo(28);
        var stopped = care.saveMedicine(f.getId(), saved.id(), "m3-" + next(), new CareDtos.MedicineCommand(saved.version(), saved.code(), saved.name(), null, null, null, 28, false));
        var restored = care.saveMedicine(f.getId(), saved.id(), "m4-" + next(), new CareDtos.MedicineCommand(stopped.version(), saved.code(), saved.name(), null, null, null, 28, true));
        em.flush(); em.clear();
        assertThat(restored.id()).isEqualTo(saved.id());
        assertThat(em.find(vn.edu.fpt.beefcare.domain.Medicine.class, saved.id()).getAvailable()).isTrue();
    }

    @Test
    void tc1818To26ParameterVersionsReportRangesConflictsAndAuthor() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.MANAGER));
        // TC-18-18 / 19 / 20: MSG-FE18-06 with the parameter and its range.
        assertCode(() -> parameters.create(f.getId(), "p1-" + next(), new CareDtos.ParameterVersionCommand(Map.of("WEANING_AGE_MONTHS", 13), null, TODAY, "Thú y")), MessageCodes.FE18_06);
        assertCode(() -> parameters.create(f.getId(), "p2-" + next(), new CareDtos.ParameterVersionCommand(Map.of("WEANING_AGE_MONTHS", 12, "YOUNG_STOCK_AGE_MONTHS", 12), null, TODAY, "Thú y")), MessageCodes.FE18_06);
        assertCode(() -> parameters.create(f.getId(), "p3-" + next(), new CareDtos.ParameterVersionCommand(Map.of("BREEDING_WINDOW_START_HOURS", 12, "BREEDING_WINDOW_END_HOURS", 10), null, TODAY, "Thú y")), MessageCodes.FE18_06);
        int base = parameters.list(f.getId()).stream().mapToInt(CareDtos.ParameterVersionResult::versionNo).max().orElse(0);
        CareDtos.ParameterVersionResult saved = parameters.create(f.getId(), "p4-" + next(), new CareDtos.ParameterVersionCommand(
            Map.of("WEIGHING_INTERVAL_DAYS", 45, "TARGET_FINISHING_WEIGHT_KG", 450.5), null, TODAY, "Khuyến cáo thú y", base));
        assertThat(saved.versionNo()).isEqualTo(base + 1);
        assertThat(saved.sourceNote()).isEqualTo("Khuyến cáo thú y");
        assertThat(saved.savedBy()).isNotBlank();
        assertThat(saved.scheduled()).isFalse();
        assertThat(parameters.effective(f.getId(), TODAY)).containsEntry("TARGET_FINISHING_WEIGHT_KG", 450.5);
        // TC-18-26: a second editor who loaded the same base version gets MSG-COM-05.
        assertCode(() -> parameters.create(f.getId(), "p5-" + next(), new CareDtos.ParameterVersionCommand(Map.of("WEIGHING_INTERVAL_DAYS", 60), null, TODAY, "Người sau", base)), MessageCodes.COM_05);
        // TC-18-24: a later effective date is scheduled.
        assertThat(parameters.create(f.getId(), "p6-" + next(), new CareDtos.ParameterVersionCommand(Map.of(), null, TODAY.plusDays(20), "Từ tháng sau", base + 1)).scheduled()).isTrue();
    }

    @Test
    void partialVersionInheritsValuesEffectiveOnItsOwnDate() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.MANAGER));
        var future = TODAY.plusDays(20);
        var current = parameters.create(f.getId(), "current-" + next(), new CareDtos.ParameterVersionCommand(
            Map.of("WEIGHING_INTERVAL_DAYS", 30), 283, TODAY, "Hiện tại"));
        var scheduled = parameters.create(f.getId(), "scheduled-" + next(), new CareDtos.ParameterVersionCommand(
            Map.of("WEIGHING_INTERVAL_DAYS", 60), 300, future, "Sau 20 ngày", current.versionNo()));
        var immediate = parameters.create(f.getId(), "immediate-" + next(), new CareDtos.ParameterVersionCommand(
            Map.of("TARGET_FINISHING_WEIGHT_KG", 450), null, TODAY, "Chỉnh cân đích", scheduled.versionNo()));

        assertThat(immediate.parameters()).containsEntry("WEIGHING_INTERVAL_DAYS", 30);
        assertThat(immediate.gestationLengthDays()).isEqualTo(283);
        assertThat(parameters.effective(f.getId(), TODAY)).containsEntry("TARGET_FINISHING_WEIGHT_KG", 450);
        assertThat(parameters.effective(f.getId(), future)).containsEntry("WEIGHING_INTERVAL_DAYS", 60).containsEntry("GESTATION_LENGTH_DAYS", 300);
    }

    @Test
    void vaccineKeptOnlyInACorrectionStillCannotBeDeletedOrHaveItsCodeChanged() {
        Farm f = farm(); actAs(memberWithRole(f, FarmRole.OWNER));
        var old = care.saveVaccine(f.getId(), null, "old-" + next(), vaccine("VX-OLD", null, 0));
        var replacement = care.saveVaccine(f.getId(), null, "new-" + next(), vaccine("VX-NEW", null, 0));
        var cow = cattle(f, breed(f), purpose(f, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        Long recordId = vaccination.record(f.getId(), "record-" + next(), new CareDtos.RecordVaccinations(old.id(), "HISTORICAL", TODAY.minusDays(1), null, null,
            "2 ml", "SC", null, "Trại cũ", java.util.List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        vaccination.correct(f.getId(), recordId, "correct-" + next(), new CareDtos.CorrectVaccination(
            versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, recordId), replacement.id(), null, null, null, null, null, null, "Chọn nhầm vắc-xin"));
        em.flush(); em.clear();
        var historical = care.vaccines(f.getId()).stream().filter(v -> v.id().equals(old.id())).findFirst().orElseThrow();
        assertThat(historical.recordCount()).isEqualTo(1);
        assertCode(() -> care.deleteUnusedVaccine(f.getId(), old.id(), "delete-" + next(), historical.version()), MessageCodes.FE18_04);
        assertCode(() -> care.saveVaccine(f.getId(), old.id(), "rename-code-" + next(),
            new CareDtos.VaccineCommand(historical.version(), "VX-OTHER", old.name(), old.diseasePrevented(), null, null, null, 0, null, true)), MessageCodes.COM_10);
    }

    @Test
    void changingTheScheduleVaccineRetainsItsOldCatalogueReferenceWithoutDoubleCounting() {
        Farm f = farm(); actAs(memberWithRole(f, FarmRole.OWNER));
        var old = care.saveVaccine(f.getId(), null, "old-" + next(), vaccine("VX-OLD", null, 0));
        var replacement = care.saveVaccine(f.getId(), null, "new-" + next(), vaccine("VX-NEW", null, 0));
        var cow = cattle(f, breed(f), purpose(f, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        var schedule = vaccination.createSchedule(f.getId(), "schedule-" + next(), new CareDtos.CreateVaccinationSchedule("Lịch thử", old.id(), TODAY, 1, 21, null, java.util.List.of(cow.getId())));
        var changed = vaccination.editSchedule(f.getId(), schedule.id(), "edit-" + next(), new CareDtos.EditVaccinationSchedule(schedule.version(), null, replacement.id(), null, null, null));
        vaccination.stopSchedule(f.getId(), schedule.id(), "stop-" + next(), changed.version(), "Ngưng lịch thử");
        em.flush(); em.clear();
        assertThat(care.vaccines(f.getId())).allSatisfy(v -> assertThat(v.scheduleCount()).isEqualTo(1));
        assertCode(() -> care.deleteUnusedVaccine(f.getId(), old.id(), "delete-" + next(), old.version()), MessageCodes.FE18_04);
        assertCode(() -> care.deleteUnusedVaccine(f.getId(), replacement.id(), "delete-" + next(), replacement.version()), MessageCodes.FE18_04);
    }

    @Test
    void renamingAndStoppingAVaccinePreservesTheRecordedSnapshotAndAllowsCorrectingTheSameReference() {
        Farm f = farm(); actAs(memberWithRole(f, FarmRole.OWNER));
        var vaccine = care.saveVaccine(f.getId(), null, "vaccine-" + next(), vaccine("VX-OLD", null, 21));
        var cow = cattle(f, breed(f), purpose(f, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        Long id = vaccination.record(f.getId(), "record-" + next(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null, clock.instant().minusSeconds(3600), "LOT-1",
            "2 ml", "SC", 21, "Thú y", java.util.List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        care.saveVaccine(f.getId(), vaccine.id(), "stop-" + next(), new CareDtos.VaccineCommand(vaccine.version(), vaccine.code(), "Tên mới", vaccine.diseasePrevented(), null, "3 ml", "SC", 7, null, false));
        vaccination.correct(f.getId(), id, "correct-" + next(), new CareDtos.CorrectVaccination(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), vaccine.id(), null, null, null, "2.5 ml", null, null, "Sửa liều đã ghi"));
        em.flush(); em.clear();
        var stored = em.find(vn.edu.fpt.beefcare.domain.Vaccination.class, id);
        assertThat(stored.getVaccineNameSnapshot()).isEqualTo(vaccine.name());
        assertThat(stored.getWithdrawalDays()).isEqualTo(21);
        assertThat(stored.getDose()).isEqualTo("2.5 ml");
        assertThat(stored.getVaccine().getAvailable()).isFalse();
        assertCode(() -> vaccination.createSchedule(f.getId(), "new-schedule-" + next(), new CareDtos.CreateVaccinationSchedule("Chọn mới", vaccine.id(), TODAY, 1, 21, null, java.util.List.of(cow.getId()))), MessageCodes.FE18_08);
    }

    @Test
    void aDraftEntryDeclarationKeepsItsCatalogueReferencesBeforeCattleExist() {
        Farm f = farm(); var owner = memberWithRole(f, FarmRole.OWNER); actAs(owner);
        var vaccine = care.saveVaccine(f.getId(), null, "vaccine-" + next(), vaccine("VX-DRAFT", null, 0));
        var breed = breed(f); var purpose = purpose(f, PurposeType.FATTENING);
        var voucher = entryVoucher(f, owner, partner(f, owner, true, false), 0, 0, vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus.DRAFT);
        var line = new vn.edu.fpt.beefcare.domain.HerdEntry();
        line.setFarm(f); line.setVoucher(voucher); line.setLineNo(1); line.setInitialPen(pen(f, "DRAFT", 10));
        line.setSource(vn.edu.fpt.beefcare.domain.enumeration.EntrySource.EXTERNAL); line.setEntryDate(TODAY);
        line.setCreatedAt(clock.instant()); line.setUpdatedAt(clock.instant());
        line.setDraftData(JsonSupport.toJson(Map.of("breedId", breed.getId(), "purposeId", purpose.getId(), "vaccination", Map.of("items", java.util.List.of(Map.of("vaccineId", vaccine.id()))))));
        save(line); em.clear();
        assertThat(herd.breeds(f.getId(), null, null)).singleElement().satisfies(v -> { assertThat(v.activeCattle()).isZero(); assertThat(v.referenced()).isTrue(); });
        assertThat(herd.purposes(f.getId(), null, null)).singleElement().satisfies(v -> { assertThat(v.activeCattle()).isZero(); assertThat(v.referenced()).isTrue(); });
        assertThat(care.vaccines(f.getId())).singleElement().satisfies(v -> assertThat(v.referencedCount()).isEqualTo(1));
        assertCode(() -> care.deleteUnusedVaccine(f.getId(), vaccine.id(), "delete-" + next(), vaccine.version()), MessageCodes.FE18_04);
    }
}
