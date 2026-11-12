package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-08 backend gaps (spec FE-08 §7): revisions (GAP-FE08-01), finishing target (GAP-FE08-02), herd active count (GAP-FE08-03). */
@ServiceIntegrationTest
@Transactional
class GrowthGapTest extends DomainTestSupport {

    @Autowired
    GrowthAssessmentService growth;

    @Autowired
    GrowthOverviewService overview;

    Farm farm;
    Cattle steer;

    @BeforeEach
    void farmWithAFatteningSteer() {
        farm = farm();
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        steer = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
    }

    void reload() {
        em.flush();
        em.clear();
    }

    // ------------------------------------------------------------ GAP-FE08-01 (TC-08-13, BR-D15)

    @Test
    void tc0813_theHistoryKeepsTheValueBeforeACorrectionAndAnExclusion() {
        Growth first = weight(steer, TODAY.minusDays(20), "340");
        Growth second = weight(steer, TODAY.minusDays(5), "352");
        reload();

        GrowthDtos.Record corrected = growth.correct(farm.getId(), steer.getId(), first.getId(), new GrowthDtos.Correction("CORRECT",
            new GrowthDtos.Measurement(TODAY.minusDays(20).atTime(8, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(), null, "SCALE", new BigDecimal("342"), null, null, null, null, true),
            "Đọc nhầm số trên cân", first.getVersion()));
        assertThat(corrected.weightKg()).isEqualByComparingTo("342");
        assertThat(corrected.revisions()).singleElement().satisfies(r -> {
            assertThat(r.action()).isEqualTo("CORRECT");
            assertThat(((Number) r.before().get("weightKg")).doubleValue()).isEqualTo(340.0);
            assertThat(((Number) r.after().get("weightKg")).doubleValue()).isEqualTo(342.0);
        });
        growth.correct(farm.getId(), steer.getId(), second.getId(), new GrowthDtos.Correction("EXCLUDE", null, "Bò đứng lệch cân", second.getVersion()));
        reload();

        GrowthDtos.Summary summary = growth.history(farm.getId(), steer.getId(), 90);
        GrowthDtos.Record row = summary.records().stream().filter(r -> r.id().equals(first.getId())).findFirst().orElseThrow();
        assertThat(row.status()).isEqualTo("VALID");
        assertThat(row.corrected()).isTrue();
        assertThat(row.revisions()).singleElement().satisfies(r -> {
            assertThat(r.reason()).isEqualTo("Đọc nhầm số trên cân");
            assertThat(r.changedBy()).isNotBlank();
            assertThat(r.changedAt()).isNotNull();
            assertThat(r.before()).doesNotContainKey("revisions");
        });
        assertThat(summary.records().stream().filter(r -> r.id().equals(second.getId())).findFirst().orElseThrow().revisions())
            .extracting(GrowthDtos.Revision::action).containsExactly("EXCLUDE");
    }

    @Test
    void theHerdListDoesNotLoadRevisions() {
        weight(steer, TODAY.minusDays(5), "352");
        reload();
        assertThat(growth.summary(em.find(Cattle.class, steer.getId()), 90).records()).allSatisfy(r -> assertThat(r.revisions()).isNull());
    }

    // ------------------------------------------------------------ GAP-FE08-02 (GBR-107, TC-08-17, TC-08-18)

    @Test
    void tc0817_aFatteningAnimalGetsTheTargetTheMissingKgAndTheProjectedDays() {
        weight(steer, TODAY.minusDays(60), "340");
        weight(steer, TODAY, "400");
        reload();

        GrowthDtos.Summary summary = growth.history(farm.getId(), steer.getId(), 90);
        assertThat(summary.finishingStatus()).isEqualTo("PROJECTED");
        assertThat(summary.targetKg()).isEqualByComparingTo("450");
        assertThat(summary.missingKg()).isEqualByComparingTo("50");
        assertThat(summary.adg60()).isEqualByComparingTo("1.000");
        assertThat(summary.finishingDays()).isEqualTo(50);
        assertThat(summary.projectedFinishingDate()).isEqualTo(TODAY.plusDays(50));
    }

    @Test
    void tc0818_aWeightAboveTheTargetIsReachedWithNothingMissing() {
        weight(steer, TODAY.minusDays(3), "455");
        reload();

        GrowthDtos.Summary summary = growth.history(farm.getId(), steer.getId(), 90);
        assertThat(summary.finishingStatus()).isEqualTo("TARGET_REACHED");
        assertThat(summary.targetKg()).isEqualByComparingTo("450");
        assertThat(summary.missingKg()).isEqualByComparingTo("0");
        assertThat(summary.projectedFinishingDate()).isNull();
    }

    @Test
    void noTargetForANonFatteningAnimalOrWhenTheFarmRemovedTheTarget() {
        Cattle cow = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        weight(cow, TODAY, "400");
        weight(steer, TODAY.minusDays(3), "300");
        reload();
        GrowthDtos.Summary breeding = growth.history(farm.getId(), cow.getId(), 90);
        assertThat(breeding.finishingStatus()).isEqualTo("NOT_APPLICABLE");
        assertThat(breeding.targetKg()).isNull();
        assertThat(breeding.missingKg()).isNull();

        GrowthDtos.Summary oneWeight = growth.history(farm.getId(), steer.getId(), 90);
        assertThat(oneWeight.finishingStatus()).isEqualTo("INSUFFICIENT_WEIGHTS");
        assertThat(oneWeight.missingKg()).isEqualByComparingTo("150");

        FarmParameterVersion parameters = new FarmParameterVersion();
        parameters.setFarm(farm); parameters.setVersionNo(1); parameters.setGestationLengthDays(283); parameters.setEffectiveFrom(TODAY);
        parameters.setChangedBy(user()); parameters.setCreatedAt(clock.instant()); parameters.setSourceNote("Bỏ cân mục tiêu");
        parameters.setParameterValues(JsonSupport.toJson(Map.of("WEIGHING_INTERVAL_DAYS", 30)));
        save(parameters);
        reload();
        GrowthDtos.Summary removed = growth.history(farm.getId(), steer.getId(), 90);
        assertThat(removed.targetKg()).isNull();
        assertThat(removed.finishingStatus()).isEqualTo("NOT_APPLICABLE");
    }

    // ------------------------------------------------------------ GAP-FE08-03

    @Test
    void activeCountIsTheWholeFarmWhateverTheFilters() {
        cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        Cattle gone = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        gone.setHerdStatus(vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.EXITED);
        reload();

        GrowthOverviewService.Page all = overview.list(farm.getId(), null, null, null, null, 90, 0, 50, null);
        assertThat(all.activeCount()).isEqualTo(2);
        GrowthOverviewService.Page filtered = overview.list(farm.getId(), "no-such-code", null, "FATTENING", null, 90, 0, 50, null);
        assertThat(filtered.total()).isZero();
        assertThat(filtered.activeCount()).isEqualTo(2);
    }
}
