package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.CattleProfile;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.Criterion;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.Outcome;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.ReceptionCheck;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class ReceptionCriteriaServiceTest extends DomainTestSupport {

    @Autowired
    ReceptionCriteriaService criteria;

    private Outcome outcome(ReceptionCheck check, Criterion c) {
        return check.results().stream().filter(r -> r.criterion() == c).findFirst().orElseThrow().outcome();
    }

    private CattleProfile profile(PurposeType type, LifeStage stage, Sex sex, int ageMonths, String weight) {
        return new CattleProfile(
            type,
            stage,
            sex,
            TODAY.minusMonths(ageMonths),
            BirthDateAccuracy.EXACT,
            weight == null ? null : new BigDecimal(weight)
        );
    }

    @Test
    void penWithoutCriteriaAcceptsAnythingAllNotApplicable() {
        Farm farm = farm();
        Pen pen = pen(farm, "A1", 5);
        ReceptionCheck check = criteria.check(pen, profile(PurposeType.SIRE, LifeStage.ADULT, Sex.MALE, 40, "500"), TODAY);
        assertThat(check.allMet()).isTrue();
        assertThat(check.criteriaVersionId()).isNull();
        assertThat(check.results()).hasSize(5).allMatch(r -> r.outcome() == Outcome.NOT_APPLICABLE);
    }

    @Test
    void everyCriterionIsMetNotMetOrNotApplicable() {
        Farm farm = farm();
        AppUser by = user();
        Pen pen = pen(farm, "A1", 5);
        criteria(pen, 1, EnumSet.of(PurposeType.BREEDING, PurposeType.FATTENING), EnumSet.of(LifeStage.ADULT), Sex.FEMALE, 12, new BigDecimal("250"), by);

        ReceptionCheck ok = criteria.check(pen, profile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, 30, "300"), TODAY);
        assertThat(ok.allMet()).isTrue();
        assertThat(ok.results()).allMatch(r -> r.outcome() == Outcome.MET);
        assertThat(ok.criteriaVersionNo()).isEqualTo(1);

        ReceptionCheck bad = criteria.check(pen, profile(PurposeType.SIRE, LifeStage.YOUNG_STOCK, Sex.MALE, 6, "100"), TODAY);
        assertThat(bad.allMet()).isFalse();
        assertThat(bad.unmet()).extracting(r -> r.criterion()).containsExactlyInAnyOrder(
            Criterion.PURPOSE_TYPE,
            Criterion.LIFE_STAGE,
            Criterion.SEX,
            Criterion.MIN_AGE_MONTHS,
            Criterion.MIN_WEIGHT_KG
        );

        // unknown birth date and unknown weight: age / weight criteria are not applicable, not failures
        CattleProfile unknown = new CattleProfile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, null, BirthDateAccuracy.UNKNOWN, null);
        ReceptionCheck na = criteria.check(pen, unknown, TODAY);
        assertThat(outcome(na, Criterion.MIN_AGE_MONTHS)).isEqualTo(Outcome.NOT_APPLICABLE);
        assertThat(outcome(na, Criterion.MIN_WEIGHT_KG)).isEqualTo(Outcome.NOT_APPLICABLE);
        assertThat(na.allMet()).isTrue();
    }

    @Test
    void minimumThresholdsAreInclusive() {
        Farm farm = farm();
        Pen pen = pen(farm, "A1", 5);
        criteria(pen, 1, null, null, null, 12, new BigDecimal("250.00"), user());
        ReceptionCheck exact = criteria.check(pen, profile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, 12, "250"), TODAY);
        assertThat(exact.allMet()).isTrue();
        ReceptionCheck below = criteria.check(pen, profile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, 11, "249.99"), TODAY);
        assertThat(below.unmet()).extracting(r -> r.criterion()).containsExactlyInAnyOrder(Criterion.MIN_AGE_MONTHS, Criterion.MIN_WEIGHT_KG);
    }

    @Test
    void theCurrentVersionIsTheHighestVersionNumber() {
        Farm farm = farm();
        AppUser by = user();
        Pen pen = pen(farm, "A1", 5);
        criteria(pen, 1, EnumSet.of(PurposeType.FATTENING), null, null, null, null, by);
        criteria(pen, 2, EnumSet.of(PurposeType.BREEDING), null, null, null, null, by);
        ReceptionCheck check = criteria.check(pen, profile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, 30, null), TODAY);
        assertThat(check.criteriaVersionNo()).isEqualTo(2);
        assertThat(check.allMet()).isTrue();
        assertThat(criteria.currentVersion(pen.getId())).get().extracting(v -> v.getVersionNo()).isEqualTo(2);
    }

    @Test
    void notMetCriterionRequiresAWarningReason() {
        Farm farm = farm();
        Pen pen = pen(farm, "A1", 5);
        criteria(pen, 1, EnumSet.of(PurposeType.FATTENING), null, null, null, null, user());
        ReceptionCheck check = criteria.check(pen, profile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, 30, null), TODAY);
        assertThatThrownBy(() -> criteria.requireWarningReason(check, "  ", "BC-000007"))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_06);
                assertThat(e.getParams()).containsEntry("cattle_code", "BC-000007").containsEntry("pen_code", "A1");
                assertThat(e.getParams().get("criteria").toString()).contains("PURPOSE_TYPE");
            });
        assertThat(criteria.requireWarningReason(check, "  temporary housing ", "BC-000007")).isEqualTo("temporary housing");
        assertThatThrownBy(() -> criteria.requireWarningReason(check, "x".repeat(501), "BC-000007")).isInstanceOf(DomainException.class);
    }

    @Test
    void metCheckNeedsNoReason() {
        Farm farm = farm();
        Pen pen = pen(farm, "A1", 5);
        ReceptionCheck check = criteria.check(pen, profile(PurposeType.BREEDING, LifeStage.ADULT, Sex.FEMALE, 30, null), TODAY);
        assertThat(criteria.requireWarningReason(check, null, "BC-1")).isNull();
    }

    @Test
    void checkOfAnExistingCattleUsesItsLatestNonExcludedWeight() {
        Farm farm = farm();
        Breed breed = breed(farm);
        ProductionPurpose purpose = purpose(farm, PurposeType.FATTENING);
        Pen pen = pen(farm, "A1", 5);
        criteria(pen, 1, null, null, null, null, new BigDecimal("300"), user());
        Cattle cattle = cattle(farm, breed, purpose, Sex.MALE, LifeStage.ADULT);
        assertThat(criteria.latestWeightKg(cattle.getId())).isEmpty();
        assertThat(outcome(criteria.check(pen, cattle, TODAY), Criterion.MIN_WEIGHT_KG)).isEqualTo(Outcome.NOT_APPLICABLE);

        weight(cattle, TODAY.minusDays(30), "310");
        weight(cattle, TODAY.minusDays(2), "280");
        var excluded = weight(cattle, TODAY.minusDays(1), "400");
        excluded.setStatus("EXCLUDED");
        em.flush();

        assertThat(criteria.latestWeightKg(cattle.getId()).orElseThrow()).isEqualByComparingTo("280");
        assertThat(outcome(criteria.check(pen, cattle, TODAY), Criterion.MIN_WEIGHT_KG)).isEqualTo(Outcome.NOT_MET);
        assertThat(Set.of(criteria.check(pen, cattle, TODAY).results().get(0).criterion())).containsExactly(Criterion.PURPOSE_TYPE);
    }
}
