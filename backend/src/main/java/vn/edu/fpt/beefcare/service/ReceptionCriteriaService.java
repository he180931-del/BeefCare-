package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.GrowthRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;

/**
 * Advisory reception criteria of a pen (GBR-21): per criterion Met / Not met / Not applicable against the CURRENT
 * criteria version. Criteria never block; a not-met criterion needs a warning reason that is stored with the placement.
 */
@Service
public class ReceptionCriteriaService {

    public enum Criterion {
        PURPOSE_TYPE,
        LIFE_STAGE,
        SEX,
        MIN_AGE_MONTHS,
        MIN_WEIGHT_KG,
    }

    public enum Outcome {
        MET,
        NOT_MET,
        NOT_APPLICABLE,
    }

    public record CriterionResult(Criterion criterion, Outcome outcome, String expected, String actual) {}

    /** The attributes of a cattle (or of a voucher line before the cattle exists) that the criteria look at. */
    public record CattleProfile(
        PurposeType purposeType,
        LifeStage lifeStage,
        Sex sex,
        LocalDate birthDate,
        BirthDateAccuracy birthDateAccuracy,
        BigDecimal latestWeightKg
    ) {}

    public record ReceptionCheck(Long penId, String penCode, Long criteriaVersionId, Integer criteriaVersionNo, List<CriterionResult> results) {
        public boolean allMet() {
            return results.stream().noneMatch(r -> r.outcome() == Outcome.NOT_MET);
        }

        public List<CriterionResult> unmet() {
            return results.stream().filter(r -> r.outcome() == Outcome.NOT_MET).toList();
        }

        /** e.g. "PURPOSE_TYPE (SIRE, expected BREEDING/FATTENING), MIN_WEIGHT_KG (200, expected >= 250)" */
        public String unmetSummary() {
            return unmet()
                .stream()
                .map(r -> r.criterion() + " (" + r.actual() + ", expected " + r.expected() + ")")
                .collect(Collectors.joining(", "));
        }
    }

    private final PenCriteriaVersionRepository versionRepository;
    private final GrowthRepository growthRepository;

    public ReceptionCriteriaService(PenCriteriaVersionRepository versionRepository, GrowthRepository growthRepository) {
        this.versionRepository = versionRepository;
        this.growthRepository = growthRepository;
    }

    @Transactional(readOnly = true)
    public Optional<PenCriteriaVersion> currentVersion(Long penId) {
        return versionRepository.findFirstByPenIdOrderByVersionNoDesc(penId);
    }

    /** Latest weight that is not EXCLUDED (growth records; entry / exit weights are not growth records, GBR-92). */
    @Transactional(readOnly = true)
    public Optional<BigDecimal> latestWeightKg(Long cattleId) {
        return growthRepository
            .findFirstByCattleIdAndStatusNotOrderByCheckDateDescEntryTimeDesc(cattleId, "EXCLUDED")
            .map(Growth::getWeightKg);
    }

    @Transactional(readOnly = true)
    public ReceptionCheck check(Pen pen, Cattle cattle, LocalDate asOf) {
        CattleProfile profile = new CattleProfile(
            cattle.getPurpose() == null ? null : cattle.getPurpose().getPurposeType(),
            cattle.getLifeStage(),
            cattle.getSex(),
            cattle.getBirthDate(),
            cattle.getBirthDateAccuracy(),
            latestWeightKg(cattle.getId()).orElse(null)
        );
        return check(pen, profile, asOf);
    }

    @Transactional(readOnly = true)
    public ReceptionCheck check(Pen pen, CattleProfile profile, LocalDate asOf) {
        PenCriteriaVersion v = currentVersion(pen.getId()).orElse(null);
        List<CriterionResult> results = new ArrayList<>();
        results.add(
            v != null && v.getPurposeTypes() != null && !v.getPurposeTypes().isEmpty()
                ? membership(Criterion.PURPOSE_TYPE, v.getPurposeTypes().stream().sorted().toList(), profile.purposeType())
                : na(Criterion.PURPOSE_TYPE)
        );
        results.add(
            v != null && v.getLifeStages() != null && !v.getLifeStages().isEmpty()
                ? membership(Criterion.LIFE_STAGE, v.getLifeStages().stream().sorted().toList(), profile.lifeStage())
                : na(Criterion.LIFE_STAGE)
        );
        if (v == null || v.getSex() == null) {
            results.add(na(Criterion.SEX));
        } else if (profile.sex() == null) {
            results.add(new CriterionResult(Criterion.SEX, Outcome.NOT_APPLICABLE, v.getSex().name(), null));
        } else {
            results.add(
                new CriterionResult(
                    Criterion.SEX,
                    v.getSex() == profile.sex() ? Outcome.MET : Outcome.NOT_MET,
                    v.getSex().name(),
                    profile.sex().name()
                )
            );
        }
        if (v == null || v.getMinAgeMonths() == null) {
            results.add(na(Criterion.MIN_AGE_MONTHS));
        } else if (profile.birthDate() == null || profile.birthDateAccuracy() == BirthDateAccuracy.UNKNOWN) {
            results.add(new CriterionResult(Criterion.MIN_AGE_MONTHS, Outcome.NOT_APPLICABLE, ">= " + v.getMinAgeMonths(), null));
        } else {
            long months = ChronoUnit.MONTHS.between(profile.birthDate(), asOf);
            results.add(
                new CriterionResult(
                    Criterion.MIN_AGE_MONTHS,
                    months >= v.getMinAgeMonths() ? Outcome.MET : Outcome.NOT_MET,
                    ">= " + v.getMinAgeMonths(),
                    String.valueOf(months)
                )
            );
        }
        if (v == null || v.getMinWeightKg() == null) {
            results.add(na(Criterion.MIN_WEIGHT_KG));
        } else if (profile.latestWeightKg() == null) {
            results.add(new CriterionResult(Criterion.MIN_WEIGHT_KG, Outcome.NOT_APPLICABLE, ">= " + v.getMinWeightKg().stripTrailingZeros().toPlainString(), null));
        } else {
            results.add(
                new CriterionResult(
                    Criterion.MIN_WEIGHT_KG,
                    profile.latestWeightKg().compareTo(v.getMinWeightKg()) >= 0 ? Outcome.MET : Outcome.NOT_MET,
                    ">= " + v.getMinWeightKg().stripTrailingZeros().toPlainString(),
                    profile.latestWeightKg().stripTrailingZeros().toPlainString()
                )
            );
        }
        return new ReceptionCheck(pen.getId(), pen.getCode(), v == null ? null : v.getId(), v == null ? null : v.getVersionNo(), List.copyOf(results));
    }

    /**
     * MSG-FE04-06: when a criterion is not met the user may continue only with a reason (max 500 characters).
     *
     * @return the trimmed reason to store, or null when all criteria are met (a reason given anyway is kept)
     */
    public String requireWarningReason(ReceptionCheck check, String warningReason, String cattleCode) {
        String reason = warningReason == null || warningReason.isBlank() ? null : warningReason.trim();
        if (reason != null && reason.length() > 500) {
            throw DomainException.invalid("warningReason");
        }
        if (!check.allMet() && reason == null) {
            throw DomainException.unprocessable(
                MessageCodes.FE04_06,
                "cattle_code",
                cattleCode,
                "pen_code",
                check.penCode(),
                "criteria",
                check.unmetSummary()
            );
        }
        return reason;
    }

    private static CriterionResult na(Criterion criterion) {
        return new CriterionResult(criterion, Outcome.NOT_APPLICABLE, null, null);
    }

    private static <E extends Enum<E>> CriterionResult membership(Criterion criterion, List<E> accepted, E actual) {
        String expected = accepted.stream().map(Enum::name).collect(Collectors.joining("/"));
        if (actual == null) {
            return new CriterionResult(criterion, Outcome.NOT_APPLICABLE, expected, null);
        }
        return new CriterionResult(criterion, accepted.contains(actual) ? Outcome.MET : Outcome.NOT_MET, expected, actual.name());
    }
}
