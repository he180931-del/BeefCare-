package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.CattleProfile;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.ReceptionCheck;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Validation and normalisation of one voucher line ("Voucher Cattle Line", GBR-30 / GBR-92 / BR-D08 ...).
 * The same rules serve the draft save (minimal: shape, ranges and farm-scoped references), the pre-save checks,
 * posting and the Excel import (full: required values, active catalogue values, uniqueness, pen criteria).
 */
@Component
public class EntryLineValidator {

    public enum Severity {
        ERROR,
        WARNING,
    }

    public record Issue(Integer lineNo, Severity severity, String code, String field, Map<String, Object> params, HttpStatus status) {
        public DomainException toException() {
            return new DomainException(code, params, status == null ? HttpStatus.UNPROCESSABLE_ENTITY : status);
        }
    }

    /** Voucher context of a line. voucherDate is the entry date of a PURCHASE; farm-born lines enter on their birth date. */
    public record Header(Long farmId, EntryType type, LocalDate voucherDate, PricingBasis pricing) {}

    public record Resolved(
        int lineNo,
        EntryLineRequest data,
        Breed breed,
        ProductionPurpose purpose,
        Pen pen,
        Sex sex,
        LocalDate birthDate,
        BirthDateAccuracy accuracy,
        LifeStage lifeStage,
        String earTag,
        BigDecimal weight,
        WeightBasis basis,
        Long unitPrice,
        long lineAmount,
        LocalDate quarantineUntil,
        ReceptionCheck check,
        String warningReason,
        CalfOutcome calf,
        Cattle dam,
        LocalDate entryDate
    ) {}

    public record Result(Resolved resolved, List<Issue> issues) {
        public boolean hasErrors() {
            return issues.stream().anyMatch(i -> i.severity() == Severity.ERROR);
        }

        public Issue firstError() {
            return issues.stream().filter(i -> i.severity() == Severity.ERROR).findFirst().orElse(null);
        }

        public List<Issue> errors() {
            return issues.stream().filter(i -> i.severity() == Severity.ERROR).toList();
        }

        public List<Issue> warnings() {
            return issues.stream().filter(i -> i.severity() == Severity.WARNING).toList();
        }
    }

    private final EntryCatalogLookup catalog;
    private final CattleRepository cattleRepository;
    private final ReceptionCriteriaService receptionCriteria;
    private final CattleGuardService guard;
    private final FarmClock clock;

    public EntryLineValidator(
        EntryCatalogLookup catalog,
        CattleRepository cattleRepository,
        ReceptionCriteriaService receptionCriteria,
        CattleGuardService guard,
        FarmClock clock
    ) {
        this.catalog = catalog;
        this.cattleRepository = cattleRepository;
        this.receptionCriteria = receptionCriteria;
        this.guard = guard;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ helpers shared with other services

    /** Life stage proposed from the age at entry with the farm's stage ages 6 / 12 / 24 months (GBR-25); null when unknown. */
    public static LifeStage proposeLifeStage(LocalDate birthDate, LocalDate entryDate) {
        Integer age = ageMonths(birthDate, entryDate);
        if (age == null) {
            return null;
        }
        if (age < 6) {
            return LifeStage.UNWEANED_CALF;
        }
        if (age < 12) {
            return LifeStage.WEANED_CALF;
        }
        return age < 24 ? LifeStage.YOUNG_STOCK : LifeStage.ADULT;
    }

    public static Integer ageMonths(LocalDate birthDate, LocalDate entryDate) {
        if (birthDate == null || entryDate == null) {
            return null;
        }
        return (int) Math.max(0, ChronoUnit.MONTHS.between(birthDate, entryDate));
    }

    static String clean(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    // ------------------------------------------------------------------ validation

    /**
     * @param tagsSeen lower-case ear tags of the earlier lines of the same voucher (mutated; full mode only)
     * @param full     true for posting / checks / import, false for the minimal draft save
     */
    public Result validate(Header h, int lineNo, EntryLineRequest raw, Set<String> tagsSeen, boolean full) {
        return validate(h, lineNo, raw, tagsSeen, full, true);
    }

    /** @param placement false for corrections of a posted entry: the ear tag, receiving pen and its criteria are not rechecked */
    public Result validate(Header h, int lineNo, EntryLineRequest raw, Set<String> tagsSeen, boolean full, boolean placement) {
        EntryLineRequest r = raw == null ? new EntryLineRequest(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null) : raw;
        return h.type() == EntryType.FARM_BORN ? validateFarmBorn(h, lineNo, r, tagsSeen, full) : validatePurchase(h, lineNo, r, tagsSeen, full, placement);
    }

    private Result validatePurchase(Header h, int lineNo, EntryLineRequest r, Set<String> tagsSeen, boolean full, boolean placement) {
        List<Issue> issues = new ArrayList<>();
        Long farmId = h.farmId();
        LocalDate entryDate = h.voucherDate();
        String tag = clean(r.earTagNumber());
        String label = tag != null ? tag : "#" + lineNo;

        checkTag(issues, lineNo, farmId, tag, tagsSeen, full && placement);

        Breed breed = null;
        if (r.breedId() == null) {
            if (full) {
                issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "breed", "field", "breed"));
            }
        } else {
            breed = catalog.breed(farmId, r.breedId()).orElse(null);
            if (breed == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "breed", "field", "breed"));
            } else if (full && placement && !Boolean.TRUE.equals(breed.getAvailable())) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE18_08, "breed", "field", "breed"));
            }
        }

        Sex sex = r.sex();
        if (sex == null && full) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "sex", "field", "sex"));
        }

        ProductionPurpose purpose = null;
        if (r.purposeId() == null) {
            if (full) {
                issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "purposeId", "field", "productionPurpose"));
            }
        } else {
            purpose = catalog.purpose(farmId, r.purposeId()).orElse(null);
            if (purpose == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "purposeId", "field", "productionPurpose"));
            } else if (full && placement && !Boolean.TRUE.equals(purpose.getAvailable())) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE18_08, "purposeId", "field", "productionPurpose"));
            }
        }
        if (full && purpose != null && sex != null && purposeSexConflict(purpose.getPurposeType(), sex)) {
            issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE05_12, "purposeId"));
        }

        // birth date / age (GBR-23, SCR-24: either a date or an age in months)
        LocalDate birthDate = null;
        BirthDateAccuracy accuracy;
        Integer ageMonthsInput = null;
        LocalDate birthInput = null;
        if (r.birthDate() != null && r.birthDateAccuracy() != BirthDateAccuracy.UNKNOWN) {
            accuracy = r.birthDateAccuracy() == null ? BirthDateAccuracy.EXACT : r.birthDateAccuracy();
            birthDate = accuracy == BirthDateAccuracy.ESTIMATED ? r.birthDate().withDayOfMonth(1) : r.birthDate();
            birthInput = r.birthDate();
            if (birthDate.isBefore(LocalDate.of(1900, 1, 1))) {
                issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "birthDate", "field", "birthDate"));
            }
        } else if (r.ageMonths() != null && r.birthDateAccuracy() != BirthDateAccuracy.UNKNOWN) {
            if (r.ageMonths() < 1 || r.ageMonths() > 240) {
                issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "ageMonths", "field", "ageMonths"));
            } else if (entryDate != null) {
                birthDate = entryDate.minusMonths(r.ageMonths()).withDayOfMonth(1);
            }
            accuracy = BirthDateAccuracy.ESTIMATED;
            ageMonthsInput = r.ageMonths();
        } else {
            accuracy = BirthDateAccuracy.UNKNOWN;
            if (full) {
                issues.add(warning(lineNo, HerdEntryCodes.CHK_BIRTH_UNKNOWN, "birthDate"));
            }
        }
        if (full && birthDate != null && entryDate != null && (birthDate.isAfter(entryDate) || birthDate.isAfter(clock.today()))) {
            issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_03, "birthDate"));
        }

        LifeStage lifeStage = r.lifeStage();
        if (lifeStage == null && full) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "lifeStage", "field", "lifeStage"));
        }

        // weight (GBR-92)
        BigDecimal weight = r.entryWeightKg();
        WeightBasis basis = r.weightBasis();
        if (weight != null && (weight.compareTo(BigDecimal.ONE) < 0 || weight.compareTo(new BigDecimal("1500")) > 0)) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "entryWeightKg", "field", "entryWeightKg"));
        }
        if (weight == null && h.pricing() == PricingBasis.PER_KG && full) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "entryWeightKg", "field", "entryWeightKg"));
        }
        if (weight != null && basis == null) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "weightBasis", "field", "weightBasis"));
        }
        if (weight != null && basis == WeightBasis.ESTIMATED && full) {
            issues.add(warning(lineNo, HerdEntryCodes.CHK_ESTIMATED_WEIGHT, "entryWeightKg"));
        }

        Pen pen = null;
        if (r.penId() == null) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "penId", "field", "receivingPen"));
        } else {
            pen = catalog.pen(farmId, r.penId()).orElse(null);
            if (pen == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "penId", "field", "receivingPen"));
            } else if (full && placement && pen.getStatus() != ActiveStatus.ACTIVE) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_05, "penId", "pen_code", pen.getCode(), "count", 1, "free", 0));
            }
        }

        Long price = r.unitPrice();
        if (price != null && price < 0) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "unitPrice", "field", "unitPrice"));
        }
        if (price == null && full) {
            issues.add(warning(lineNo, HerdEntryCodes.CHK_NO_PRICE, "unitPrice"));
        }

        if (r.quarantineUntil() != null && entryDate != null && r.quarantineUntil().isBefore(entryDate)) {
            issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_15, "quarantineUntil", "date", entryDate));
        }

        EntryLineRequest.VaccinationDeclaration vacc = normaliseVaccination(issues, lineNo, farmId, r.vaccination(), entryDate, full, placement);
        EntryLineRequest.DiseaseDeclaration disease = normaliseDisease(issues, lineNo, r.disease(), full);
        EntryLineRequest.ReproductionDeclaration repro = normaliseReproduction(issues, lineNo, r.reproduction(), sex, full);

        // reception check against the pen's current criteria (GBR-21)
        ReceptionCheck check = null;
        String warningReason = clean(r.warningReason());
        if (warningReason != null && warningReason.length() > 500) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "warningReason", "field", "warningReason"));
        }
        if (full && placement && pen != null && purpose != null && entryDate != null) {
            check = receptionCriteria.check(pen, new CattleProfile(purpose.getPurposeType(), lifeStage, sex, birthDate, accuracy, weight), entryDate);
            if (!check.allMet()) {
                if (warningReason == null) {
                    issues.add(
                        error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_06, "warningReason", "cattle_code", label, "pen_code", check.penCode(), "criteria", check.unmetSummary())
                    );
                } else {
                    issues.add(warning(lineNo, HerdEntryCodes.CHK_CRITERIA_REASON, "warningReason", "pen_code", check.penCode(), "criteria", check.unmetSummary()));
                }
            }
        }

        EntryLineRequest data = new EntryLineRequest(
            tag,
            clean(r.name()),
            clean(r.photoUrl()),
            clean(r.colourMarkings()),
            r.breedId(),
            sex,
            birthInput,
            accuracy,
            ageMonthsInput,
            lifeStage,
            r.purposeId(),
            weight,
            basis,
            r.penId(),
            price,
            r.quarantineUntil(),
            warningReason,
            vacc,
            disease,
            repro,
            null
        );
        long amount = MoneyCalculator.lineAmount(h.pricing(), price, weight);
        Resolved resolved = new Resolved(lineNo, data, breed, purpose, pen, sex, birthDate, accuracy, lifeStage, tag, weight, basis, price, amount, r.quarantineUntil(), check, warningReason, null, null, entryDate);
        return new Result(resolved, issues);
    }

    private Result validateFarmBorn(Header h, int lineNo, EntryLineRequest r, Set<String> tagsSeen, boolean full) {
        List<Issue> issues = new ArrayList<>();
        Long farmId = h.farmId();
        String tag = clean(r.earTagNumber());
        checkTag(issues, lineNo, farmId, tag, tagsSeen, full);

        CalfOutcome calf = null;
        Cattle dam = null;
        if (r.calfOutcomeId() == null) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "calfOutcomeId", "field", "calf"));
        } else {
            calf = catalog.calf(farmId, r.calfOutcomeId()).orElse(null);
            if (calf == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "calfOutcomeId", "field", "calf"));
            } else if (!"LIVE".equalsIgnoreCase(calf.getOutcome())) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_04, "calfOutcomeId"));
            } else if ("REGISTERED".equalsIgnoreCase(calf.getRegistrationState())) {
                issues.add(
                    error(lineNo, HttpStatus.CONFLICT, MessageCodes.FE06_02, "calfOutcomeId", "cattle_code", calf.getRegisteredCattle() == null ? null : calf.getRegisteredCattle().getDisplayCode())
                );
            } else if (!"PENDING_CONFIRMATION".equalsIgnoreCase(calf.getRegistrationState())) {
                issues.add(error(lineNo, HttpStatus.CONFLICT, MessageCodes.COM_05, "calfOutcomeId"));
            } else {
                dam = calf.getCalving().getDam();
                try {
                    guard.assertActive(dam);
                } catch (DomainException e) {
                    issues.add(new Issue(lineNo, Severity.ERROR, e.getCode(), "dam", e.getParams(), e.getStatus()));
                }
            }
        }

        Sex sex = null;
        LocalDate birth = null;
        BigDecimal weight = null;
        Breed breed = dam == null ? null : dam.getBreed();
        if (calf != null && dam != null) {
            try {
                sex = calf.getSex() == null ? null : Sex.valueOf(calf.getSex().trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                sex = null;
            }
            if (sex == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_10, "sex", "field", "sex"));
            }
            birth = clock.toFarmDate(calf.getCalving().getBirthTime());
            weight = calf.getBirthWeight();
        }

        ProductionPurpose purpose = null;
        if (r.purposeId() != null) {
            purpose = catalog.purpose(farmId, r.purposeId()).orElse(null);
            if (purpose == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "purposeId", "field", "productionPurpose"));
            }
        } else if (calf != null) {
            purpose = catalog.defaultUndecidedPurpose(farmId).orElse(null);
            if (purpose == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "purposeId", "field", "productionPurpose"));
            }
        }
        if (purpose != null && full && !Boolean.TRUE.equals(purpose.getAvailable())) {
            issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE18_08, "purposeId", "field", "productionPurpose"));
        }
        if (full && purpose != null && sex != null && purposeSexConflict(purpose.getPurposeType(), sex)) {
            issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE05_12, "purposeId"));
        }

        Pen pen = null;
        Long penId = r.penId() != null ? r.penId() : (calf != null && calf.getProposedPen() != null ? calf.getProposedPen().getId() : null);
        if (penId == null) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "penId", "field", "receivingPen"));
        } else {
            pen = catalog.pen(farmId, penId).orElse(null);
            if (pen == null) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "penId", "field", "receivingPen"));
            } else if (full && pen.getStatus() != ActiveStatus.ACTIVE) {
                issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_05, "penId", "pen_code", pen.getCode(), "count", 1, "free", 0));
            }
        }

        ReceptionCheck check = null;
        String warningReason = clean(r.warningReason());
        if (warningReason != null && warningReason.length() > 500) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "warningReason", "field", "warningReason"));
        }
        String label = tag != null ? tag : (calf != null && calf.getTagCode() != null ? calf.getTagCode() : "#" + lineNo);
        if (full && pen != null && purpose != null && birth != null) {
            check = receptionCriteria.check(pen, new CattleProfile(purpose.getPurposeType(), LifeStage.UNWEANED_CALF, sex, birth, BirthDateAccuracy.EXACT, weight), birth);
            if (!check.allMet()) {
                if (warningReason == null) {
                    issues.add(
                        error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_06, "warningReason", "cattle_code", label, "pen_code", check.penCode(), "criteria", check.unmetSummary())
                    );
                } else {
                    issues.add(warning(lineNo, HerdEntryCodes.CHK_CRITERIA_REASON, "warningReason", "pen_code", check.penCode(), "criteria", check.unmetSummary()));
                }
            }
        }
        EntryLineRequest data = new EntryLineRequest(
            tag,
            clean(r.name()),
            clean(r.photoUrl()),
            clean(r.colourMarkings()),
            breed == null ? null : breed.getId(),
            sex,
            birth,
            BirthDateAccuracy.EXACT,
            null,
            LifeStage.UNWEANED_CALF,
            purpose == null ? r.purposeId() : purpose.getId(),
            weight,
            weight == null ? null : WeightBasis.MEASURED,
            pen == null ? r.penId() : pen.getId(),
            null,
            null,
            warningReason,
            null,
            null,
            null,
            r.calfOutcomeId()
        );
        Resolved resolved = new Resolved(lineNo, data, breed, purpose, pen, sex, birth, BirthDateAccuracy.EXACT, LifeStage.UNWEANED_CALF, tag, weight, weight == null ? null : WeightBasis.MEASURED, null, 0L, null, check, warningReason, calf, dam, birth);
        return new Result(resolved, issues);
    }

    // ------------------------------------------------------------------ pieces

    private void checkTag(List<Issue> issues, int lineNo, Long farmId, String tag, Set<String> tagsSeen, boolean full) {
        if (tag == null) {
            return;
        }
        if (tag.length() > 30) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "earTagNumber", "field", "earTagNumber"));
            return;
        }
        if (!full) {
            return;
        }
        boolean usedByCattle = cattleRepository.existsByFarmIdAndEarTagNumberIgnoreCaseAndHerdStatus(farmId, tag, HerdStatus.ACTIVE);
        boolean usedInVoucher = !tagsSeen.add(tag.toLowerCase(Locale.ROOT));
        if (usedByCattle || usedInVoucher) {
            issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE05_02, "earTagNumber", "ear_tag", tag));
        }
    }

    static boolean purposeSexConflict(PurposeType type, Sex sex) {
        return (type == PurposeType.SIRE && sex == Sex.FEMALE) || (type == PurposeType.BREEDING && sex == Sex.MALE);
    }

    private EntryLineRequest.VaccinationDeclaration normaliseVaccination(
        List<Issue> issues,
        int lineNo,
        Long farmId,
        EntryLineRequest.VaccinationDeclaration in,
        LocalDate entryDate,
        boolean full,
        boolean placement
    ) {
        DeclarationStatus status = in == null || in.status() == null ? DeclarationStatus.UNKNOWN : in.status();
        if (status != DeclarationStatus.KNOWN) {
            return new EntryLineRequest.VaccinationDeclaration(status, null, null);
        }
        List<EntryLineRequest.VaccinationItem> items = new ArrayList<>();
        if (in.items() == null || in.items().isEmpty()) {
            if (full) {
                issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "vaccination.items", "field", "vaccination"));
            }
        } else {
            for (EntryLineRequest.VaccinationItem item : in.items()) {
                String name = clean(item.vaccineName());
                if (item.vaccineId() == null && name == null) {
                    issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "vaccination.items", "field", "vaccine"));
                    continue;
                }
                if (item.vaccineId() != null) {
                    var vaccine = catalog.vaccine(farmId, item.vaccineId());
                    if (vaccine.isEmpty()) {
                        issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_08, "vaccination.items", "field", "vaccine"));
                        continue;
                    }
                    if (full && placement && !Boolean.TRUE.equals(vaccine.get().getAvailable())) {
                        issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE18_08, "vaccination.items", "field", "vaccine"));
                    }
                    if (name == null) {
                        name = vaccine.get().getName();
                    }
                }
                if (item.date() != null && ((entryDate != null && item.date().isAfter(entryDate)) || item.date().isAfter(clock.today()))) {
                    issues.add(error(lineNo, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_07, "vaccination.items"));
                }
                items.add(new EntryLineRequest.VaccinationItem(item.vaccineId(), name, item.date(), clean(item.informationSource())));
            }
        }
        return new EntryLineRequest.VaccinationDeclaration(status, clean(in.informationSource()), items);
    }

    private EntryLineRequest.DiseaseDeclaration normaliseDisease(List<Issue> issues, int lineNo, EntryLineRequest.DiseaseDeclaration in, boolean full) {
        DeclarationStatus status = in == null || in.status() == null ? DeclarationStatus.UNKNOWN : in.status();
        if (status != DeclarationStatus.KNOWN) {
            return new EntryLineRequest.DiseaseDeclaration(status, null);
        }
        String description = clean(in.description());
        if (description == null && full) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "disease.description", "field", "disease"));
        }
        return new EntryLineRequest.DiseaseDeclaration(status, description);
    }

    private EntryLineRequest.ReproductionDeclaration normaliseReproduction(
        List<Issue> issues,
        int lineNo,
        EntryLineRequest.ReproductionDeclaration in,
        Sex sex,
        boolean full
    ) {
        DeclarationStatus status = in == null || in.status() == null ? DeclarationStatus.UNKNOWN : in.status();
        if (status != DeclarationStatus.UNKNOWN && sex == Sex.MALE) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "reproduction", "field", "reproduction"));
        }
        if (status != DeclarationStatus.KNOWN) {
            return new EntryLineRequest.ReproductionDeclaration(status, null, null, null, null);
        }
        Integer calvings = in.earlierCalvings() == null ? 0 : in.earlierCalvings();
        if (calvings < 0 || calvings > 15) {
            issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "reproduction.earlierCalvings", "field", "earlierCalvings"));
        }
        YesNoUnknown pregnant = in.pregnantAtEntry() == null ? YesNoUnknown.UNKNOWN : in.pregnantAtEntry();
        Integer months = pregnant == YesNoUnknown.YES ? in.estMonthsPregnant() : null;
        if (pregnant == YesNoUnknown.YES) {
            if (months == null) {
                if (full) {
                    issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_06, "reproduction.estMonthsPregnant", "field", "estMonthsPregnant"));
                }
            } else if (months < 1 || months > 9) {
                issues.add(error(lineNo, HttpStatus.BAD_REQUEST, MessageCodes.COM_10, "reproduction.estMonthsPregnant", "field", "estMonthsPregnant"));
            }
        }
        return new EntryLineRequest.ReproductionDeclaration(status, calvings, pregnant, months, clean(in.description()));
    }

    static Issue error(int lineNo, HttpStatus status, String code, String field, Object... kv) {
        return new Issue(lineNo, Severity.ERROR, code, field, DomainException.params(kv), status);
    }

    static Issue warning(int lineNo, String code, String field, Object... kv) {
        return new Issue(lineNo, Severity.WARNING, code, field, DomainException.params(kv), null);
    }
}
