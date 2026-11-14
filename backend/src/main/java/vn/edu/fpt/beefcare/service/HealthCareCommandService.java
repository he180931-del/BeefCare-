package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * Transactional FE-10 commands (spec FE-10 §7 A3–A8). Manager only (R-10-14), replayable through Idempotency-Key.
 * Raw generated CRUD is not used by these workflows.
 */
@Service
public class HealthCareCommandService {
    static final Set<String> SEVERITIES = Set.of("MILD", "MODERATE", "SEVERE");
    static final Set<String> PROGRESS = Set.of("IMPROVED", "UNCHANGED", "WORSENED");
    static final Set<String> OUTCOMES = Set.of("RECOVERED", "DIED", "MISSING");
    /** Popup Ghi điều trị #4: Tiêm bắp / Tiêm dưới da / Tĩnh mạch / Uống / Bôi / Khác. */
    static final Set<String> ROUTES = Set.of("INTRAMUSCULAR", "SUBCUTANEOUS", "INTRAVENOUS", "ORAL", "TOPICAL", "OTHER");
    private static final Map<String, String> ROUTE_ALIASES = Map.of("IM", "INTRAMUSCULAR", "SC", "SUBCUTANEOUS", "SQ", "SUBCUTANEOUS", "IV", "INTRAVENOUS", "PO", "ORAL");
    private static final BigDecimal MIN_TEMPERATURE = new BigDecimal("35.0");
    private static final BigDecimal MAX_TEMPERATURE = new BigDecimal("43.0");
    private static final Set<String> WRITABLE = Set.of("OPEN", "CHRONIC");

    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final CattleGuardService cattleGuard;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;
    private final RecordRevisionService revisions;
    private final FarmClock clock;
    private final CattleStateService cattleState;
    private final HerdExitVoucherService exits;

    public HealthCareCommandService(FarmAccessService access, CattleGuardService cattleGuard, IdempotencyCommandService idempotency,
                                   AuditService audit, RecordRevisionService revisions, FarmClock clock,
                                   CattleStateService cattleState, HerdExitVoucherService exits) {
        this.access = access; this.cattleGuard = cattleGuard; this.idempotency = idempotency;
        this.audit = audit; this.revisions = revisions; this.clock = clock; this.cattleState = cattleState; this.exits = exits;
    }

    // ------------------------------------------------------------------ A3 open / add an observation

    public CareDtos.HealthCaseResult open(Long farmId, String key, CareDtos.OpenHealthCase request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_CASE_OPEN", key, request,
            CareDtos.HealthCaseResult.class, () -> openInCommand(farmId, request));
    }

    @Transactional
    CareDtos.HealthCaseResult openInCommand(Long farmId, CareDtos.OpenHealthCase req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        if (req == null || req.cattleId() == null) throw DomainException.required("cattleId");
        Cattle cattle = cattleGuard.lockWritable(farmId, req.cattleId());
        Instant observedAt = req.observedAt() == null ? clock.now() : req.observedAt();
        clock.assertNotFuture(observedAt);
        assertAfterHerdEntry(farmId, cattle, observedAt);
        requireText(req.signs(), "signs", 1000);
        requireTemperature(req.temperatureC());
        String severity = upper(req.severity());
        if (!SEVERITIES.contains(severity)) throw DomainException.required("severity");
        String diagnosis = optionalText(req.diagnosis(), "diagnosis", 100);
        Vaccination vaccination = req.vaccinationId() == null ? null : vaccinationOf(farmId, cattle, req.vaccinationId());
        HealthCase healthCase;
        if (req.existingCaseId() == null) {
            healthCase = new HealthCase();
            healthCase.setCattle(cattle);
            healthCase.setOpenedDate(farmDate(observedAt, cattle));
            healthCase.setStatus("OPEN");
            healthCase.setSeverity(severity);
            healthCase.setSuspectedDiagnosis(diagnosis);
            healthCase.setIsSuspectedContagious(Boolean.TRUE.equals(req.suspectedContagious()));
            healthCase.setReactionVaccination(vaccination);
            em.persist(healthCase);
            em.flush();
            healthCase.setCaseCode("HC-" + String.format("%06d", healthCase.getId()));
        } else {
            // R-10-01: an observation added to an OPEN / CHRONIC case of the same cattle; a CLOSED case → MSG-COM-05.
            healthCase = caseForFarm(farmId, req.existingCaseId());
            VersionGuard.requireExpected(healthCase.getVersion(), req.expectedVersion());
            if (!healthCase.getCattle().getId().equals(cattle.getId()) || !WRITABLE.contains(upper(healthCase.getStatus()))) {
                throw DomainException.conflict(MessageCodes.COM_05);
            }
            assertNotBeforeLatest(healthCase, observedAt, null, null);
            healthCase.setSeverity(severity);
            if (req.diagnosis() != null) healthCase.setSuspectedDiagnosis(diagnosis);
            if (req.suspectedContagious() != null) healthCase.setIsSuspectedContagious(req.suspectedContagious());
        }
        HealthObservation observation = new HealthObservation();
        observation.setHealthCase(healthCase);
        observation.setObservedTime(observedAt);
        observation.setEntryTime(clock.now());
        observation.setSignsProgress(req.signs().trim());
        observation.setTemperatureC(req.temperatureC());
        observation.setProgress("UNCHANGED");
        observation.setOpening(req.existingCaseId() == null);
        observation.setSource("ON_FARM");
        observation.setVaccination(vaccination);
        observation.setRecorder(ctx.user());
        observation.setObserver(req.observerId() == null ? ctx.user() : activeMember(farmId, req.observerId(), "observerId"));
        em.persist(observation);
        em.flush();
        audit.log(ctx, "HEALTH_CASE_OPEN", "HealthCase", healthCase.getId(), Map.of("cattleId", cattle.getId(), "observationId", observation.getId(), "added", req.existingCaseId() != null));
        return result(healthCase, cattle, observation.getId(), null);
    }

    // ------------------------------------------------------------------ A4 follow-up

    public CareDtos.HealthCaseResult followUp(Long farmId, Long caseId, String key, CareDtos.FollowUp request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_CASE_FOLLOWUP", key,
            Map.of("caseId", caseId, "request", request), CareDtos.HealthCaseResult.class, () -> followUpInCommand(farmId, caseId, request));
    }

    @Transactional
    CareDtos.HealthCaseResult followUpInCommand(Long farmId, Long caseId, CareDtos.FollowUp req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        Cattle cattle = cattleGuard.lockWritable(farmId, healthCase.getCattle().getId());
        VersionGuard.requireExpected(healthCase.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null) throw DomainException.required("followUp");
        assertWritable(healthCase);
        Instant observedAt = req.observedAt() == null ? clock.now() : req.observedAt();
        clock.assertNotFuture(observedAt);
        assertAfterHerdEntry(farmId, cattle, observedAt);
        assertNotBeforeLatest(healthCase, observedAt, null, null);
        requireText(req.description(), "description", 1000);
        String progress = upper(req.progress());
        if (!PROGRESS.contains(progress)) throw DomainException.required("progress");
        requireTemperature(req.temperatureC());
        HealthObservation observation = followUp(healthCase, observedAt, req.description(), progress, req.temperatureC(), ctx,
            req.observerId() == null ? ctx.user() : activeMember(farmId, req.observerId(), "observerId"));
        audit.log(ctx, "HEALTH_FOLLOWUP", "HealthCase", caseId, Map.of("observationId", observation.getId(), "progress", progress));
        return result(healthCase, cattle, observation.getId(), null);
    }

    // ------------------------------------------------------------------ A5 status / closure

    public CareDtos.HealthCaseResult updateStatus(Long farmId, Long caseId, String key, CareDtos.CaseStatus request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_CASE_STATUS", key,
            Map.of("caseId", caseId, "request", request), CareDtos.HealthCaseResult.class, () -> statusInCommand(farmId, caseId, request));
    }

    @Transactional
    CareDtos.HealthCaseResult statusInCommand(Long farmId, Long caseId, CareDtos.CaseStatus req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        Cattle cattle = cattleGuard.lockWritable(farmId, healthCase.getCattle().getId());
        VersionGuard.requireExpected(healthCase.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null) throw DomainException.required("status");
        assertWritable(healthCase);
        String action = upper(req.action());
        String status = upper(healthCase.getStatus());
        String latestProgress = optionalText(req.latestProgress(), "latestProgress", 1000);
        // D30: the popup has its own progress radio; a follow-up written from this command needs it, never a default.
        String progress = req.progress() == null || req.progress().isBlank() ? null : upper(req.progress());
        if (progress != null && !PROGRESS.contains(progress)) throw DomainException.invalid("progress");
        if (latestProgress != null && progress == null) throw DomainException.required("progress");
        if (req.suspectedDiagnosis() != null) healthCase.setSuspectedDiagnosis(optionalText(req.suspectedDiagnosis(), "suspectedDiagnosis", 100));
        if (req.suspectedContagious() != null) healthCase.setIsSuspectedContagious(req.suspectedContagious());
        Map<String, Object> before = snapshot(healthCase);
        // Popups work at minute precision: a follow-up written "now" with seconds would make a record saved right after
        // with the default "now" of the same minute look earlier than it (MSG-FE10-07).
        Instant now = clock.now().truncatedTo(java.time.temporal.ChronoUnit.MINUTES);
        Long pendingVoucherId = null;
        Long observationId = null;
        switch (action) {
            case "KEEP" -> {
                // Q1: the latest progress is required when the status is kept; it is the only thing this command writes.
                if (latestProgress == null) throw DomainException.required("latestProgress");
                observationId = followUp(healthCase, now, latestProgress, progress, null, ctx, ctx.user()).getId();
            }
            case "TO_CHRONIC" -> {
                if (!"OPEN".equals(status)) throw DomainException.invalid("action");
                if (latestProgress != null) observationId = followUp(healthCase, now, latestProgress, progress, null, ctx, ctx.user()).getId();
                healthCase.setStatus("CHRONIC"); healthCase.setChronicSince(farmDate(now, cattle));
            }
            case "TO_OPEN" -> {
                if (!"CHRONIC".equals(status)) throw DomainException.invalid("action");
                if (latestProgress != null) observationId = followUp(healthCase, now, latestProgress, progress, null, ctx, ctx.user()).getId();
                healthCase.setStatus("OPEN"); healthCase.setChronicSince(null);
            }
            case "CLOSE" -> {
                String outcome = upper(req.outcome());
                if (!OUTCOMES.contains(outcome)) throw DomainException.required("outcome");
                Instant closedAt = req.closedAt() == null ? now : req.closedAt();
                clock.assertNotFuture(closedAt);
                // BR-D33: the closure is not before the latest record of the case (the opening observation included).
                assertNotBeforeLatest(healthCase, closedAt, null, null);
                if (latestProgress != null) observationId = followUp(healthCase, closedAt, latestProgress, progress, null, ctx, ctx.user()).getId();
                LocalDate closedDate = farmDate(closedAt, cattle);
                AppUser confirmedBy = req.confirmedById() == null ? ctx.user() : activeMember(farmId, req.confirmedById(), "confirmedById");
                if ("DIED".equals(outcome) || "MISSING".equals(outcome)) {
                    // R-10-07: the PENDING loss voucher, the Owner notice and REM-12 are created in this transaction (before the
                    // case changes, so a refused voucher leaves nothing half-written even if the row had been flushed).
                    HerdExitVoucher voucher = exits.createPendingLossVoucher(healthCase, ctx.user(), closedDate, "DIED".equals(outcome) ? LossKind.DIED : LossKind.MISSING);
                    pendingVoucherId = voucher.getId();
                }
                healthCase.setStatus("CLOSED"); healthCase.setOutcome(outcome); healthCase.setClosedDate(closedDate); healthCase.setClosedAt(closedAt);
                healthCase.setClosedBy(confirmedBy);
            }
            default -> throw DomainException.invalid("action");
        }
        em.flush();
        Map<String, Object> after = snapshot(healthCase);
        after.put("action", action); after.put("before", before);
        audit.log(ctx, "HEALTH_CASE_STATUS", "HealthCase", caseId, after);
        return result(healthCase, cattle, observationId, pendingVoucherId);
    }

    // ------------------------------------------------------------------ A6 treatment

    public CareDtos.TreatmentResult recordTreatment(Long farmId, Long caseId, String key, CareDtos.TreatmentCommand request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_TREATMENT_RECORD", key,
            Map.of("caseId", caseId, "request", request), CareDtos.TreatmentResult.class,
            () -> treatmentInCommand(farmId, caseId, request));
    }

    @Transactional
    CareDtos.TreatmentResult treatmentInCommand(Long farmId, Long caseId, CareDtos.TreatmentCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        Cattle cattle = cattleGuard.lockWritable(farmId, healthCase.getCattle().getId());
        if (req == null) throw DomainException.required("treatment");
        VersionGuard.requireExpected(healthCase.getVersion(), req.expectedVersion());
        assertWritable(healthCase);
        Instant time = req.administeredAt() == null ? clock.now() : req.administeredAt();
        clock.assertNotFuture(time);
        assertAfterHerdEntry(farmId, cattle, time);
        assertNotBeforeLatest(healthCase, time, null, null);
        if (req.medicineId() == null) throw DomainException.required("medicineId");
        Medicine medicine = activeMedicine(farmId, req.medicineId());
        requireText(req.dose(), "dose", 50);
        String route = route(req.route(), true);
        int courseDays = req.courseDays() == null ? 1 : req.courseDays();
        int withdrawalDays = req.withdrawalDays() == null ? (medicine.getWithdrawalDays() == null ? 0 : medicine.getWithdrawalDays()) : req.withdrawalDays();
        if (courseDays < 1 || courseDays > 30) throw DomainException.invalid("courseDays");
        if (withdrawalDays < 0 || withdrawalDays > 365) throw DomainException.invalid("withdrawalDays");
        String performer = performer(farmId, req.performerId(), req.performerName());
        String advice = optionalText(req.veterinaryAdvice(), "veterinaryAdvice", 500);
        Treatment treatment = new Treatment();
        treatment.setHealthCase(healthCase); treatment.setMedicine(medicine); treatment.setTreatmentTime(time); treatment.setEntryTime(clock.now());
        treatment.setTreatmentDetail(medicine.getName()); treatment.setMedicineNameSnapshot(medicine.getName());
        treatment.setDose(req.dose().trim()); treatment.setRoute(route); treatment.setCourseDays(courseDays);
        treatment.setWithdrawalDays(withdrawalDays); treatment.setWithdrawalPeriod(Integer.toString(withdrawalDays));
        treatment.setPerformer(performer); treatment.setVeterinaryAdvice(advice); treatment.setResult("GIVEN");
        treatment.setWithdrawalEndDate(withdrawalEnd(time, cattle, courseDays, withdrawalDays));
        em.persist(treatment);
        // R-10-06 / R-10-09: a treatment reopens a CHRONIC case in the same transaction.
        boolean returnedToOpen = "CHRONIC".equals(upper(healthCase.getStatus()));
        if (returnedToOpen) { healthCase.setStatus("OPEN"); healthCase.setChronicSince(null); }
        em.flush();
        audit.log(ctx, "HEALTH_TREATMENT", "Treatment", treatment.getId(), Map.of("caseId", caseId, "courseDays", courseDays, "withdrawalEndDate", treatment.getWithdrawalEndDate()));
        Map<String, Object> state = cattleState.state(cattle);
        return new CareDtos.TreatmentResult(treatment.getId(), caseId, healthCase.getVersion(), healthCase.getStatus(), treatment.getWithdrawalEndDate(),
            (LocalDate) state.get("withdrawalEndDate"), (String) state.get("healthState"), courseDays, treatment.getMedicineNameSnapshot(), returnedToOpen);
    }

    // ------------------------------------------------------------------ A8 observation correction / void

    public CareDtos.RecordStatus correctObservation(Long farmId, Long observationId, String key, CareDtos.CorrectObservation request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_OBSERVATION_CORRECT", key,
            Map.of("observationId", observationId, "request", request), CareDtos.RecordStatus.class,
            () -> correctObservationInCommand(farmId, observationId, request));
    }

    @Transactional
    CareDtos.RecordStatus correctObservationInCommand(Long farmId, Long observationId, CareDtos.CorrectObservation req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthObservation o = observationForFarm(farmId, observationId);
        HealthCase healthCase = o.getHealthCase();
        Cattle cattle = lockForCorrection(farmId, healthCase);
        VersionGuard.requireExpected(o.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req == null ? null : req.reason(), "reason", 500);
        if (!"VALID".equalsIgnoreCase(o.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = observationSnapshot(o);
        LocalDate withdrawalBefore = withdrawalOf(cattle);
        if (req.observedAt() != null) {
            clock.assertNotFuture(req.observedAt());
            assertAfterHerdEntry(farmId, cattle, req.observedAt());
            assertKeepsOrder(healthCase, o.getObservedTime(), req.observedAt(), observationId, null);
            o.setObservedTime(req.observedAt());
            if (Boolean.TRUE.equals(o.getOpening())) healthCase.setOpenedDate(farmDate(req.observedAt(), cattle));
        }
        if (req.temperatureC() != null) { requireTemperature(req.temperatureC()); o.setTemperatureC(req.temperatureC()); }
        if (req.signs() != null) { requireText(req.signs(), "signs", 1000); o.setSignsProgress(req.signs().trim()); }
        if (req.progress() != null) { String p = upper(req.progress()); if (!PROGRESS.contains(p)) throw DomainException.invalid("progress"); o.setProgress(p); }
        if (req.observerId() != null) o.setObserver(activeMember(farmId, req.observerId(), "observerId"));
        o.setIsCorrected(Boolean.TRUE);
        em.flush();
        revisions.record(ctx, "HealthObservation", observationId, RecordRevisionService.CORRECT, req.reason(), before, observationSnapshot(o));
        audit.log(ctx, "HEALTH_OBSERVATION_CORRECT", "HealthObservation", observationId, Map.of("caseId", healthCase.getId()));
        return recordStatus(observationId, o.getStatus(), o.getVersion(), healthCase, cattle, withdrawalBefore);
    }

    public CareDtos.RecordStatus voidObservation(Long farmId, Long observationId, String key, CareDtos.VoidRecord request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_OBSERVATION_VOID", key,
            Map.of("observationId", observationId, "request", request), CareDtos.RecordStatus.class,
            () -> voidObservationInCommand(farmId, observationId, request));
    }

    @Transactional
    CareDtos.RecordStatus voidObservationInCommand(Long farmId, Long observationId, CareDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthObservation observation = observationForFarm(farmId, observationId);
        HealthCase healthCase = observation.getHealthCase();
        Cattle cattle = lockForCorrection(farmId, healthCase);
        VersionGuard.requireExpected(observation.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req == null ? null : req.reason(), "reason", 500);
        // R-10-11: the opening observation is corrected, never voided; a wrongly opened case is closed with a reason.
        if (Boolean.TRUE.equals(observation.getOpening())) throw DomainException.conflict(MessageCodes.FE10_13);
        if (!"VALID".equalsIgnoreCase(observation.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = observationSnapshot(observation);
        LocalDate withdrawalBefore = withdrawalOf(cattle);
        observation.setStatus("VOIDED"); observation.setStatusReason(req.reason().trim());
        em.flush();
        revisions.record(ctx, "HealthObservation", observationId, RecordRevisionService.VOID, req.reason(), before, observationSnapshot(observation));
        audit.log(ctx, "HEALTH_OBSERVATION_VOID", "HealthObservation", observationId, Map.of("caseId", healthCase.getId()));
        return recordStatus(observationId, observation.getStatus(), observation.getVersion(), healthCase, cattle, withdrawalBefore);
    }

    // ------------------------------------------------------------------ A7 treatment correction / void

    public CareDtos.RecordStatus correctTreatment(Long farmId, Long treatmentId, String key, CareDtos.CorrectTreatment request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_TREATMENT_CORRECT", key, Map.of("treatmentId", treatmentId, "request", request),
            CareDtos.RecordStatus.class, () -> correctTreatmentInCommand(farmId, treatmentId, request));
    }

    @Transactional
    CareDtos.RecordStatus correctTreatmentInCommand(Long farmId, Long treatmentId, CareDtos.CorrectTreatment req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Treatment t = treatmentForFarm(farmId, treatmentId);
        HealthCase healthCase = t.getHealthCase();
        Cattle cattle = lockForCorrection(farmId, healthCase);
        VersionGuard.requireExpected(t.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req == null ? null : req.reason(), "reason", 500);
        if (!"VALID".equalsIgnoreCase(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = treatmentSnapshot(t);
        LocalDate withdrawalBefore = withdrawalOf(cattle);
        if (req.medicineId() != null) {
            Medicine m = activeMedicine(farmId, req.medicineId());
            t.setMedicine(m); t.setMedicineNameSnapshot(m.getName()); t.setTreatmentDetail(m.getName());
        }
        if (req.administeredAt() != null) {
            clock.assertNotFuture(req.administeredAt());
            assertAfterHerdEntry(farmId, cattle, req.administeredAt());
            assertKeepsOrder(healthCase, t.getTreatmentTime(), req.administeredAt(), null, treatmentId);
            t.setTreatmentTime(req.administeredAt());
        }
        if (req.dose() != null) { requireText(req.dose(), "dose", 50); t.setDose(req.dose().trim()); }
        if (req.route() != null) t.setRoute(route(req.route(), true));
        if (req.courseDays() != null) { if (req.courseDays() < 1 || req.courseDays() > 30) throw DomainException.invalid("courseDays"); t.setCourseDays(req.courseDays()); }
        if (req.withdrawalDays() != null) {
            if (req.withdrawalDays() < 0 || req.withdrawalDays() > 365) throw DomainException.invalid("withdrawalDays");
            t.setWithdrawalDays(req.withdrawalDays()); t.setWithdrawalPeriod(Integer.toString(req.withdrawalDays()));
        }
        if (req.performerId() != null || req.performerName() != null) t.setPerformer(performer(farmId, req.performerId(), req.performerName()));
        if (req.veterinaryAdvice() != null) t.setVeterinaryAdvice(optionalText(req.veterinaryAdvice(), "veterinaryAdvice", 500));
        t.setWithdrawalEndDate(withdrawalEnd(t.getTreatmentTime(), cattle, t.getCourseDays() == null ? 1 : t.getCourseDays(), t.getWithdrawalDays() == null ? 0 : t.getWithdrawalDays()));
        t.setIsCorrected(Boolean.TRUE);
        em.flush();
        revisions.record(ctx, "Treatment", treatmentId, RecordRevisionService.CORRECT, req.reason(), before, treatmentSnapshot(t));
        audit.log(ctx, "HEALTH_TREATMENT_CORRECT", "Treatment", treatmentId, Map.of("caseId", healthCase.getId()));
        return recordStatus(treatmentId, t.getStatus(), t.getVersion(), healthCase, cattle, withdrawalBefore);
    }

    public CareDtos.RecordStatus voidTreatment(Long farmId, Long treatmentId, String key, CareDtos.VoidRecord request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_TREATMENT_VOID", key,
            Map.of("treatmentId", treatmentId, "request", request), CareDtos.RecordStatus.class,
            () -> voidTreatmentInCommand(farmId, treatmentId, request));
    }

    @Transactional
    CareDtos.RecordStatus voidTreatmentInCommand(Long farmId, Long treatmentId, CareDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Treatment treatment = treatmentForFarm(farmId, treatmentId);
        HealthCase healthCase = treatment.getHealthCase();
        Cattle cattle = lockForCorrection(farmId, healthCase);
        VersionGuard.requireExpected(treatment.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req == null ? null : req.reason(), "reason", 500);
        if (!"VALID".equalsIgnoreCase(treatment.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = treatmentSnapshot(treatment);
        LocalDate withdrawalBefore = withdrawalOf(cattle);
        treatment.setStatus("VOIDED"); treatment.setStatusReason(req.reason().trim());
        em.flush();
        revisions.record(ctx, "Treatment", treatmentId, RecordRevisionService.VOID, req.reason(), before, treatmentSnapshot(treatment));
        audit.log(ctx, "HEALTH_TREATMENT_VOID", "Treatment", treatmentId, Map.of("caseId", healthCase.getId()));
        return recordStatus(treatmentId, treatment.getStatus(), treatment.getVersion(), healthCase, cattle, withdrawalBefore);
    }

    // ------------------------------------------------------------------ shared rules

    private HealthObservation followUp(HealthCase healthCase, Instant observedAt, String description, String progress, BigDecimal temperature, FarmContext ctx, AppUser observer) {
        HealthObservation observation = new HealthObservation();
        observation.setHealthCase(healthCase); observation.setObservedTime(observedAt); observation.setEntryTime(clock.now());
        observation.setSignsProgress(description.trim()); observation.setProgress(progress); observation.setTemperatureC(temperature); observation.setSource("ON_FARM");
        observation.setRecorder(ctx.user()); observation.setObserver(observer);
        em.persist(observation);
        em.flush();
        return observation;
    }

    private void assertWritable(HealthCase healthCase) {
        if (!WRITABLE.contains(upper(healthCase.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
    }

    /** Corrections and voids: the cattle may be exit-pending (GBR-26) but not EXITED / VOIDED; a CLOSED_BY_EXIT case is frozen (R-10-13). */
    private Cattle lockForCorrection(Long farmId, HealthCase healthCase) {
        Cattle cattle = cattleGuard.lockCattle(farmId, healthCase.getCattle().getId());
        cattleGuard.assertActive(cattle);
        if ("CLOSED_BY_EXIT".equals(upper(healthCase.getOutcome()))) throw DomainException.conflict(MessageCodes.COM_05, "reason", "case_closed_by_exit");
        return cattle;
    }

    private HealthCase caseForFarm(Long farmId, Long caseId) {
        return em.createQuery("select h from HealthCase h where h.id=:id and h.cattle.farm.id=:farm", HealthCase.class)
            .setParameter("id", caseId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "healthCaseId", caseId));
    }
    private HealthObservation observationForFarm(Long farmId, Long observationId) {
        return em.createQuery("select o from HealthObservation o where o.id=:id and o.healthCase.cattle.farm.id=:farm", HealthObservation.class)
            .setParameter("id", observationId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "observationId", observationId));
    }
    private Treatment treatmentForFarm(Long farmId, Long treatmentId) {
        return em.createQuery("select t from Treatment t where t.id=:id and t.healthCase.cattle.farm.id=:farm", Treatment.class)
            .setParameter("id", treatmentId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "treatmentId", treatmentId));
    }
    /** An ACTIVE medicine of the farm; a withdrawn one → MSG-FE18-08 (UC-FE10-04 E2). */
    private Medicine activeMedicine(Long farmId, Long medicineId) {
        Medicine medicine = em.createQuery("select m from Medicine m where m.id=:id and m.farm.id=:farm", Medicine.class)
            .setParameter("id", medicineId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "medicineId", medicineId));
        if (!Boolean.TRUE.equals(medicine.getAvailable())) throw DomainException.unprocessable(MessageCodes.FE18_08, "field", "medicineId");
        return medicine;
    }
    /** Observer / confirmer / performer: any ACTIVE member of the farm (popup "Thành viên ACTIVE"). */
    private AppUser activeMember(Long farmId, Long userId, String field) {
        FarmMembership member = em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user and upper(m.status)='ACTIVE'", FarmMembership.class)
            .setParameter("farm", farmId).setParameter("user", userId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.invalid(field));
        return member.getUser();
    }
    /** GBR-47: the vaccination a reaction case is opened for must belong to the same cattle. */
    private Vaccination vaccinationOf(Long farmId, Cattle cattle, Long vaccinationId) {
        return em.createQuery("select v from Vaccination v where v.id=:id and v.cattle.id=:cattle and v.cattle.farm.id=:farm", Vaccination.class)
            .setParameter("id", vaccinationId).setParameter("cattle", cattle.getId()).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.invalid("vaccinationId"));
    }
    /** Performer: a member (name snapshotted) or an external name ≤ 100 (veterinarian); optional. */
    private String performer(Long farmId, Long performerId, String performerName) {
        if (performerId != null) return activeMember(farmId, performerId, "performerId").getFullName();
        return optionalText(performerName, "performerName", 100);
    }
    static String route(String raw, boolean required) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        value = ROUTE_ALIASES.getOrDefault(value, value);
        if (value.isEmpty()) { if (required) throw DomainException.required("route"); return null; }
        if (!ROUTES.contains(value)) throw DomainException.invalid("route");
        return value;
    }

    /** BR-D14: a posted herd-entry line is VALID (EntryLineStatus); there is no POSTED line status. MSG-COM-15 {date}. */
    private void assertAfterHerdEntry(Long farmId, Cattle cattle, Instant eventTime) {
        LocalDate entryDate = em.createQuery("select e.entryDate from HerdEntry e where e.cattle.id=:cattle and e.voucher.farm.id=:farm and e.status=:valid order by e.id", LocalDate.class)
            .setParameter("cattle", cattle.getId()).setParameter("farm", farmId).setParameter("valid", EntryLineStatus.VALID)
            .setMaxResults(1).getResultStream().findFirst().orElse(null);
        if (entryDate != null && farmDate(eventTime, cattle).isBefore(entryDate)) throw DomainException.unprocessable(MessageCodes.COM_15, "date", entryDate);
    }

    /** R-10-05: a new record (or the closure) is not earlier than the latest VALID record of the case → MSG-FE10-07 {date}. */
    private void assertNotBeforeLatest(HealthCase healthCase, Instant time, Long excludedObservation, Long excludedTreatment) {
        Instant latest = latestRecordTime(healthCase.getId(), excludedObservation, excludedTreatment);
        if (latest != null && time.isBefore(latest)) throw DomainException.unprocessable(MessageCodes.FE10_07, "date", latest, "field", "observedAt");
    }

    /**
     * R-10-10: a corrected time keeps the record between its neighbours in the case (the previous VALID record and the
     * next one, by the time it had before the correction) → MSG-FE10-07 {date} naming the neighbour it would cross.
     */
    private void assertKeepsOrder(HealthCase healthCase, Instant oldTime, Instant newTime, Long excludedObservation, Long excludedTreatment) {
        Instant previous = neighbour(healthCase.getId(), oldTime, true, excludedObservation, excludedTreatment);
        Instant next = neighbour(healthCase.getId(), oldTime, false, excludedObservation, excludedTreatment);
        if (previous != null && newTime.isBefore(previous)) throw DomainException.unprocessable(MessageCodes.FE10_07, "date", previous, "field", "observedAt");
        if (next != null && newTime.isAfter(next)) throw DomainException.unprocessable(MessageCodes.FE10_07, "date", next, "field", "observedAt");
    }

    private Instant latestRecordTime(Long caseId, Long excludedObservation, Long excludedTreatment) {
        return pick(recordTime("max", "o.observedTime", "HealthObservation o", "o", caseId, null, null, excludedObservation),
            recordTime("max", "t.treatmentTime", "Treatment t", "t", caseId, null, null, excludedTreatment), true);
    }

    private Instant neighbour(Long caseId, Instant time, boolean before, Long excludedObservation, Long excludedTreatment) {
        String agg = before ? "max" : "min", cmp = before ? "<=" : ">";
        return pick(recordTime(agg, "o.observedTime", "HealthObservation o", "o", caseId, cmp, time, excludedObservation),
            recordTime(agg, "t.treatmentTime", "Treatment t", "t", caseId, cmp, time, excludedTreatment), before);
    }

    /** {@code agg(timeField)} of the VALID records of the case, optionally on one side of {@code time} and without one record (no null parameters: PostgreSQL cannot type them). */
    private Instant recordTime(String agg, String timeField, String from, String alias, Long caseId, String cmp, Instant time, Long excludedId) {
        StringBuilder jpql = new StringBuilder("select ").append(agg).append('(').append(timeField).append(") from ").append(from)
            .append(" where ").append(alias).append(".healthCase.id=:id and upper(").append(alias).append(".status)='VALID'");
        if (cmp != null) jpql.append(" and ").append(timeField).append(cmp).append(":t");
        if (excludedId != null) jpql.append(" and ").append(alias).append(".id<>:ex");
        var query = em.createQuery(jpql.toString(), Instant.class).setParameter("id", caseId);
        if (cmp != null) query.setParameter("t", time);
        if (excludedId != null) query.setParameter("ex", excludedId);
        return query.getSingleResult();
    }
    private static Instant pick(Instant a, Instant b, boolean latest) {
        if (a == null) return b;
        if (b == null) return a;
        return latest == a.isAfter(b) ? a : b;
    }

    private CareDtos.HealthCaseResult result(HealthCase c, Cattle cattle, Long observationId, Long pendingVoucherId) {
        Map<String, Object> state = cattleState.state(cattle);
        return new CareDtos.HealthCaseResult(c.getId(), c.getCaseCode(), c.getStatus(), c.getVersion(), cattle.getId(), cattle.getDisplayCode(), observationId,
            (String) state.get("healthState"), (LocalDate) state.get("withdrawalEndDate"), c.getOutcome(), c.getChronicSince(), c.getClosedAt(), pendingVoucherId);
    }
    private CareDtos.RecordStatus recordStatus(Long id, String status, Integer version, HealthCase healthCase, Cattle cattle, LocalDate withdrawalBefore) {
        Map<String, Object> state = cattleState.state(cattle);
        return new CareDtos.RecordStatus(id, status, version, (String) state.get("healthState"), healthCase.getId(), healthCase.getStatus(),
            withdrawalBefore, (LocalDate) state.get("withdrawalEndDate"));
    }
    private LocalDate withdrawalOf(Cattle cattle) { return (LocalDate) cattleState.state(cattle).get("withdrawalEndDate"); }
    /** GBR-46: last administration day (first day + course − 1) + withdrawal days, in the farm's calendar. */
    private LocalDate withdrawalEnd(Instant firstDose, Cattle cattle, int courseDays, int withdrawalDays) {
        return farmDate(firstDose, cattle).plusDays(courseDays - 1L + withdrawalDays);
    }

    private Map<String, Object> snapshot(HealthCase c) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("status", c.getStatus()); m.put("outcome", c.getOutcome()); m.put("closedDate", c.getClosedDate());
        m.put("closedAt", c.getClosedAt()); m.put("chronicSince", c.getChronicSince()); m.put("suspectedDiagnosis", c.getSuspectedDiagnosis()); m.put("suspectedContagious", c.getIsSuspectedContagious()); return m;
    }
    private Map<String, Object> observationSnapshot(HealthObservation o) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("status", o.getStatus()); m.put("observedAt", o.getObservedTime()); m.put("signs", o.getSignsProgress());
        m.put("progress", o.getProgress()); m.put("temperatureC", o.getTemperatureC()); m.put("observer", o.getObserver() == null ? null : o.getObserver().getFullName()); return m;
    }
    private Map<String, Object> treatmentSnapshot(Treatment t) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("status", t.getStatus()); m.put("administeredAt", t.getTreatmentTime()); m.put("medicineId", t.getMedicine() == null ? null : t.getMedicine().getId());
        m.put("medicineName", t.getMedicineNameSnapshot()); m.put("dose", t.getDose()); m.put("route", t.getRoute()); m.put("courseDays", t.getCourseDays()); m.put("withdrawalDays", t.getWithdrawalDays());
        m.put("withdrawalEndDate", t.getWithdrawalEndDate()); m.put("performer", t.getPerformer()); m.put("veterinaryAdvice", t.getVeterinaryAdvice()); return m;
    }
    /** R-10-04: 35.0–43.0 °C → MSG-FE10-06 (field temperatureC). */
    private void requireTemperature(BigDecimal t) {
        if (t != null && (t.compareTo(MIN_TEMPERATURE) < 0 || t.compareTo(MAX_TEMPERATURE) > 0)) throw DomainException.unprocessable(MessageCodes.FE10_06, "field", "temperatureC");
    }
    private void requireText(String text, String field, int max) { if (text == null || text.isBlank()) throw DomainException.required(field); if (text.trim().length() > max) throw DomainException.invalid(field); }
    /** Optional text: blank → null; longer than {@code max} → MSG-COM-10. */
    private String optionalText(String text, String field, int max) { if (text == null || text.isBlank()) return null; if (text.trim().length() > max) throw DomainException.invalid(field); return text.trim(); }
    private String upper(String text) { return text == null ? "" : text.trim().toUpperCase(Locale.ROOT); }
    private LocalDate farmDate(Instant time, Cattle cattle) { return time.atZone(farmZone(cattle)).toLocalDate(); }
    private ZoneId farmZone(Cattle cattle) { try { return ZoneId.of(cattle.getFarm().getTimeZone()); } catch (Exception ignored) { return clock.zone(); } }
}
