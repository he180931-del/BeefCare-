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
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-18 catalogue and parameter rules (spec §3, §4, Q1–Q5 decided 09/11). */
@ServiceIntegrationTest
@Transactional
class CatalogueFe18Test extends DomainTestSupport {

    @Autowired HerdCatalogueCommandService herd;
    @Autowired CareCatalogueCommandService care;
    @Autowired FarmParameterCommandService parameters;

    private static void assertCode(Runnable call, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(code));
    }

    private CareDtos.VaccineCommand vaccine(String code, Integer booster, Integer withdrawal) {
        return new CareDtos.VaccineCommand(null, code, "Lở mồm long móng", "LMLM", null, null, null, withdrawal, booster, true);
    }

    @Test
    void q4UnusedBreedAndPurposeMayBeDeletedReferencedOnesOnlyStopped() {
        Farm f = farm();
        actAs(memberWithRole(f, FarmRole.OWNER));
        Breed unused = breed(f);
        Breed used = breed(f);
        ProductionPurpose purpose = purpose(f, PurposeType.FATTENING);
        cattle(f, used, purpose, Sex.MALE, LifeStage.ADULT);
        assertThat(herd.breeds(f.getId(), null, null)).filteredOn(b -> b.id().equals(used.getId())).singleElement()
            .satisfies(b -> assertThat(b.referencedCount()).isEqualTo(1));
        assertThat(herd.deleteBreed(f.getId(), unused.getId(), unused.getVersion())).isTrue();
        assertCode(() -> herd.deleteBreed(f.getId(), used.getId(), used.getVersion()), MessageCodes.FE18_04);
        assertCode(() -> herd.deletePurpose(f.getId(), purpose.getId(), purpose.getVersion()), MessageCodes.FE18_04);
        ProductionPurpose spare = purpose(f, PurposeType.UNDECIDED);
        assertThat(herd.deletePurpose(f.getId(), spare.getId(), spare.getVersion())).isTrue();
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
        assertThat(care.deleteUnusedMedicine(f.getId(), saved.id(), "m3-" + next(), saved.version())).isTrue();
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
}
