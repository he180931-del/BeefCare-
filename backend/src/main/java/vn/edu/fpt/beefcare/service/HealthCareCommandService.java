package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Transactional FE-10 commands. Raw generated CRUD is not used by these workflows. */
@Service
public class HealthCareCommandService {
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
        if (!java.util.Set.of("MILD", "MODERATE", "SEVERE").contains(severity)) throw DomainException.required("severity");
        HealthCase healthCase;
        if (req.existingCaseId() == null) {
            healthCase = new HealthCase();
            healthCase.setCattle(cattle);
            healthCase.setOpenedDate(farmDate(observedAt, cattle));
            healthCase.setStatus("OPEN");
            healthCase.setSeverity(severity);
            healthCase.setSuspectedDiagnosis(trim(req.diagnosis()));
            healthCase.setIsSuspectedContagious(Boolean.TRUE.equals(req.suspectedContagious()));
            em.persist(healthCase);
            em.flush();
            healthCase.setCaseCode("HC-" + String.format("%06d", healthCase.getId()));
        } else {
            healthCase = caseForFarm(farmId, req.existingCaseId());
            VersionGuard.requireExpected(healthCase.getVersion(), req.expectedVersion());
            if (!healthCase.getCattle().getId().equals(cattle.getId()) || !java.util.Set.of("OPEN", "CHRONIC").contains(upper(healthCase.getStatus()))) {
                throw DomainException.conflict(MessageCodes.COM_05);
            }
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
        assignRecorderAndObserver(observation, ctx, req.observerId(), farmId);
        em.persist(observation);
        audit.log(ctx, "HEALTH_CASE_OPEN", "HealthCase", healthCase.getId(), Map.of("cattleId", cattle.getId(), "observationId", observation.getId() == null ? 0L : observation.getId()));
        em.flush();
        return new CareDtos.HealthCaseResult(healthCase.getId(), healthCase.getCaseCode(), healthCase.getStatus(), healthCase.getVersion(), cattle.getId(), observation.getId(), (String) cattleState.state(cattle).get("healthState"));
    }

    public CareDtos.HealthCaseResult followUp(Long farmId, Long caseId, String key, CareDtos.FollowUp request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_CASE_FOLLOWUP", key,
            Map.of("caseId", caseId, "request", request), CareDtos.HealthCaseResult.class, () -> followUpInCommand(farmId, caseId, request));
    }

    @Transactional
    CareDtos.HealthCaseResult followUpInCommand(Long farmId, Long caseId, CareDtos.FollowUp req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        cattleGuard.lockWritable(farmId, healthCase.getCattle().getId());
        VersionGuard.requireExpected(healthCase.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null) throw DomainException.required("followUp");
        if (!java.util.Set.of("OPEN", "CHRONIC").contains(upper(healthCase.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
        Instant observedAt = req.observedAt() == null ? clock.now() : req.observedAt();
        clock.assertNotFuture(observedAt);
        assertAfterHerdEntry(farmId, healthCase.getCattle(), observedAt);
        assertChronological(healthCase, observedAt);
        requireText(req.description(), "description", 1000);
        String progress = upper(req.progress());
        if (!java.util.Set.of("IMPROVED", "UNCHANGED", "WORSENED").contains(progress)) throw DomainException.required("progress");
        requireTemperature(req.temperatureC());
        HealthObservation observation = new HealthObservation();
        observation.setHealthCase(healthCase); observation.setObservedTime(observedAt); observation.setEntryTime(clock.now());
        observation.setSignsProgress(req.description().trim()); observation.setProgress(progress); observation.setTemperatureC(req.temperatureC()); observation.setSource("ON_FARM");
        assignRecorderAndObserver(observation, ctx, null, farmId);
        em.persist(observation);
        audit.log(ctx, "HEALTH_FOLLOWUP", "HealthCase", caseId, Map.of("observationId", observation.getId() == null ? 0L : observation.getId(), "progress", progress));
        em.flush();
        return new CareDtos.HealthCaseResult(healthCase.getId(), healthCase.getCaseCode(), healthCase.getStatus(), healthCase.getVersion(), healthCase.getCattle().getId(), observation.getId(), (String) cattleState.state(healthCase.getCattle()).get("healthState"));
    }

    public CareDtos.HealthCaseResult updateStatus(Long farmId, Long caseId, String key, CareDtos.CaseStatus request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_CASE_STATUS", key,
            Map.of("caseId", caseId, "request", request), CareDtos.HealthCaseResult.class, () -> statusInCommand(farmId, caseId, request));
    }

    public CareDtos.TreatmentResult recordTreatment(Long farmId, Long caseId, String key, CareDtos.TreatmentCommand request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_TREATMENT_RECORD", key,
            Map.of("caseId", caseId, "request", request), CareDtos.TreatmentResult.class,
            () -> treatmentInCommand(farmId, caseId, request));
    }

    public CareDtos.HealthCaseResult correctClosure(Long farmId, Long caseId, String key, CareDtos.CorrectClosure request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_CASE_CLOSURE_CORRECT", key,
            Map.of("caseId", caseId, "request", request), CareDtos.HealthCaseResult.class,
            () -> correctClosureInCommand(farmId, caseId, request));
    }

    @Transactional
    CareDtos.HealthCaseResult correctClosureInCommand(Long farmId, Long caseId, CareDtos.CorrectClosure req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        Cattle cattle = cattleGuard.lockCattle(farmId, healthCase.getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(healthCase.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req.reason(), "reason", 500);
        if (!"CLOSED".equals(upper(healthCase.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
        String nextOutcome = upper(req.outcome());
        if (!java.util.Set.of("RECOVERED", "DIED", "MISSING").contains(nextOutcome)) throw DomainException.required("outcome");
        LocalDate closingDate = req.closingDate() == null ? healthCase.getClosedDate() : req.closingDate();
        if (closingDate == null) throw DomainException.required("closingDate");
        clock.assertNotFuture(closingDate);
        assertCaseClosingDate(healthCase,closingDate);
        Map<String, Object> before = snapshot(healthCase);
        String previousOutcome = upper(healthCase.getOutcome());
        boolean wasLoss = java.util.Set.of("DIED", "MISSING").contains(previousOutcome);
        boolean isLoss = java.util.Set.of("DIED", "MISSING").contains(nextOutcome);
        if (wasLoss && (!isLoss || !previousOutcome.equals(nextOutcome))) {
            Long confirmedVoucher = em.createQuery("select count(v) from HerdExitVoucher v where v.sourceHealthCase.id=:case and v.status=:status", Long.class)
                .setParameter("case", caseId).setParameter("status", ExitVoucherStatus.CONFIRMED).getSingleResult();
            if (confirmedVoucher > 0) throw DomainException.conflict(MessageCodes.COM_05, "reason", "loss_voucher_already_confirmed");
        }
        if (wasLoss && (!isLoss || !previousOutcome.equals(nextOutcome))) {
            exits.cancelPendingLossVoucher(healthCase, ctx.user(), req.reason());
        }
        healthCase.setOutcome(nextOutcome); healthCase.setClosedDate(closingDate); healthCase.setClosedAt(clock.now());
        if (isLoss && (!wasLoss || !previousOutcome.equals(nextOutcome))) {
            exits.createPendingLossVoucher(healthCase, ctx.user(), closingDate, "DIED".equals(nextOutcome) ? LossKind.DIED : LossKind.MISSING);
        }
        em.flush();
        revisions.record(ctx, "HealthCase", caseId, RecordRevisionService.CORRECT, req.reason(), before, snapshot(healthCase));
        audit.log(ctx, "HEALTH_CASE_CORRECT", "HealthCase", caseId, snapshot(healthCase));
        return new CareDtos.HealthCaseResult(caseId, healthCase.getCaseCode(), healthCase.getStatus(), healthCase.getVersion(), cattle.getId(), null,
            (String) cattleState.state(cattle).get("healthState"));
    }

    @Transactional
    CareDtos.TreatmentResult treatmentInCommand(Long farmId, Long caseId, CareDtos.TreatmentCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        Cattle cattle = cattleGuard.lockWritable(farmId, healthCase.getCattle().getId());
        if (!java.util.Set.of("OPEN", "CHRONIC").contains(upper(healthCase.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
        if (req == null) throw DomainException.required("treatment");
        Instant time = req.treatmentTime() == null ? clock.now() : req.treatmentTime();
        clock.assertNotFuture(time);
        assertAfterHerdEntry(farmId, cattle, time);
        assertChronological(healthCase, time);
        requireText(req.dose(), "dose", 255);
        requireText(req.route(), "route", 255);
        requireText(req.performer(), "performer", 255);
        int courseDays = req.courseDays() == null ? 1 : req.courseDays();
        int withdrawalDays = req.withdrawalDays() == null ? 0 : req.withdrawalDays();
        if (courseDays < 1 || courseDays > 30) throw DomainException.invalid("courseDays");
        if (withdrawalDays < 0 || withdrawalDays > 365) throw DomainException.invalid("withdrawalDays");
        String name = trim(req.treatmentDetail());
        Medicine medicine = null;
        if (req.medicineId() != null) {
            medicine = em.createQuery("select m from Medicine m where m.id=:id and m.farm.id=:farm", Medicine.class)
                .setParameter("id", req.medicineId()).setParameter("farm", farmId).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "medicineId", req.medicineId()));
            if (!Boolean.TRUE.equals(medicine.getAvailable())) throw DomainException.conflict(MessageCodes.COM_05);
            if (name == null) name = medicine.getName();
        }
        requireText(name, "treatmentDetail", 255);
        ZoneId zone=farmZone(cattle);
        Instant from = time.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant();
        Instant until = time.atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
        Long dailyCount = em.createQuery("select count(t) from Treatment t where t.healthCase.id=:case and t.treatmentTime>=:from and t.treatmentTime<:until and upper(t.status)='VALID'", Long.class)
            .setParameter("case", caseId).setParameter("from", from).setParameter("until", until).getSingleResult();
        if (dailyCount > 0) throw DomainException.conflict(MessageCodes.COM_05);
        Treatment treatment = new Treatment();
        treatment.setHealthCase(healthCase); treatment.setMedicine(medicine); treatment.setTreatmentTime(time); treatment.setEntryTime(clock.now());
        treatment.setTreatmentDetail(name); treatment.setMedicineNameSnapshot(medicine == null ? name : medicine.getName());
        treatment.setDose(req.dose().trim()); treatment.setRoute(req.route().trim()); treatment.setCourseDays(courseDays);
        treatment.setWithdrawalDays(withdrawalDays); treatment.setWithdrawalPeriod(Integer.toString(withdrawalDays));
        treatment.setPerformer(req.performer().trim()); treatment.setVeterinaryAdvice(trim(req.veterinaryAdvice())); treatment.setResult("GIVEN");
        treatment.setWithdrawalEndDate(farmDate(time, cattle).plusDays(courseDays - 1L + withdrawalDays));
        em.persist(treatment);
        if ("CHRONIC".equals(upper(healthCase.getStatus()))) { healthCase.setStatus("OPEN"); healthCase.setChronicSince(null); }
        em.flush();
        audit.log(ctx, "HEALTH_TREATMENT", "Treatment", treatment.getId(), Map.of("caseId", caseId, "courseDays", courseDays, "withdrawalEndDate", treatment.getWithdrawalEndDate()));
        return new CareDtos.TreatmentResult(treatment.getId(), caseId, healthCase.getVersion(), healthCase.getStatus(), treatment.getWithdrawalEndDate(), courseDays, treatment.getMedicineNameSnapshot());
    }

    public CareDtos.RecordStatus voidObservation(Long farmId, Long observationId, String key, CareDtos.VoidRecord request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_OBSERVATION_VOID", key,
            Map.of("observationId", observationId, "request", request), CareDtos.RecordStatus.class,
            () -> voidObservationInCommand(farmId, observationId, request));
    }

    public CareDtos.RecordStatus correctObservation(Long farmId, Long observationId, String key, CareDtos.CorrectObservation request) {
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"HEALTH_OBSERVATION_CORRECT",key,
            Map.of("observationId",observationId,"request",request),CareDtos.RecordStatus.class,
            ()->correctObservationInCommand(farmId,observationId,request));
    }
    @Transactional
    CareDtos.RecordStatus correctObservationInCommand(Long farmId,Long observationId,CareDtos.CorrectObservation req) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        HealthObservation o=em.createQuery("select o from HealthObservation o where o.id=:id and o.healthCase.cattle.farm.id=:farm",HealthObservation.class)
            .setParameter("id",observationId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"observationId",observationId));
        Cattle cattle=cattleGuard.lockCattle(farmId,o.getHealthCase().getCattle().getId());cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(o.getVersion(),req==null?null:req.expectedVersion());requireText(req==null?null:req.reason(),"reason",500);
        if(!"VALID".equalsIgnoreCase(o.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        Map<String,Object> before=observationSnapshot(o);
        if(req.observedAt()!=null){clock.assertNotFuture(req.observedAt());assertAfterHerdEntry(farmId,cattle,req.observedAt());assertNoLaterCaseEntry(o.getHealthCase().getId(),observationId,req.observedAt(),null);o.setObservedTime(req.observedAt());}
        if(req.temperatureC()!=null){requireTemperature(req.temperatureC());o.setTemperatureC(req.temperatureC());}
        if(req.signs()!=null){requireText(req.signs(),"signs",1000);o.setSignsProgress(req.signs().trim());}
        if(req.progress()!=null){String p=req.progress().trim().toUpperCase(java.util.Locale.ROOT);if(!java.util.Set.of("IMPROVED","UNCHANGED","WORSENED").contains(p))throw DomainException.invalid("progress");o.setProgress(p);}
        o.setIsCorrected(Boolean.TRUE);em.flush();
        revisions.record(ctx,"HealthObservation",observationId,RecordRevisionService.CORRECT,req.reason(),before,observationSnapshot(o));
        audit.log(ctx,"HEALTH_OBSERVATION_CORRECT","HealthObservation",observationId,Map.of("caseId",o.getHealthCase().getId()));
        return new CareDtos.RecordStatus(observationId,o.getStatus(),o.getVersion(),(String)cattleState.state(cattle).get("healthState"));
    }

    public CareDtos.RecordStatus correctTreatment(Long farmId,Long treatmentId,String key,CareDtos.CorrectTreatment request){
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"HEALTH_TREATMENT_CORRECT",key,Map.of("treatmentId",treatmentId,"request",request),
            CareDtos.RecordStatus.class,()->correctTreatmentInCommand(farmId,treatmentId,request));
    }
    @Transactional
    CareDtos.RecordStatus correctTreatmentInCommand(Long farmId,Long treatmentId,CareDtos.CorrectTreatment req){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        Treatment t=em.createQuery("select t from Treatment t where t.id=:id and t.healthCase.cattle.farm.id=:farm",Treatment.class)
            .setParameter("id",treatmentId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"treatmentId",treatmentId));
        Cattle cattle=cattleGuard.lockCattle(farmId,t.getHealthCase().getCattle().getId());cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(t.getVersion(),req==null?null:req.expectedVersion());requireText(req==null?null:req.reason(),"reason",500);
        if(!"VALID".equalsIgnoreCase(t.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        Map<String,Object> before=treatmentSnapshot(t);
        if(req.medicineId()!=null){Medicine m=em.createQuery("select m from Medicine m where m.id=:id and m.farm.id=:farm",Medicine.class).setParameter("id",req.medicineId()).setParameter("farm",farmId)
            .getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"medicineId",req.medicineId()));if(!Boolean.TRUE.equals(m.getAvailable()))throw DomainException.conflict(MessageCodes.COM_05);t.setMedicine(m);t.setMedicineNameSnapshot(m.getName());}
        if(req.treatmentTime()!=null){clock.assertNotFuture(req.treatmentTime());assertAfterHerdEntry(farmId,cattle,req.treatmentTime());assertNoLaterCaseEntry(t.getHealthCase().getId(),null,req.treatmentTime(),treatmentId);t.setTreatmentTime(req.treatmentTime());}
        if(req.treatmentDetail()!=null){requireText(req.treatmentDetail(),"treatmentDetail",255);t.setTreatmentDetail(req.treatmentDetail().trim());if(req.medicineId()==null)t.setMedicineNameSnapshot(req.treatmentDetail().trim());}
        if(req.dose()!=null){requireText(req.dose(),"dose",255);t.setDose(req.dose().trim());}
        if(req.route()!=null){requireText(req.route(),"route",255);t.setRoute(req.route().trim());}
        if(req.courseDays()!=null){if(req.courseDays()<1||req.courseDays()>30)throw DomainException.invalid("courseDays");t.setCourseDays(req.courseDays());}
        if(req.withdrawalDays()!=null){if(req.withdrawalDays()<0||req.withdrawalDays()>365)throw DomainException.invalid("withdrawalDays");t.setWithdrawalDays(req.withdrawalDays());t.setWithdrawalPeriod(Integer.toString(req.withdrawalDays()));}
        if(req.performer()!=null){requireText(req.performer(),"performer",255);t.setPerformer(req.performer().trim());}
        if(req.veterinaryAdvice()!=null)t.setVeterinaryAdvice(req.veterinaryAdvice().trim());
        Instant from=t.getTreatmentTime().atZone(farmZone(cattle)).toLocalDate().atStartOfDay(farmZone(cattle)).toInstant();
        Instant until=t.getTreatmentTime().atZone(farmZone(cattle)).toLocalDate().plusDays(1).atStartOfDay(farmZone(cattle)).toInstant();
        Long otherSameDay=em.createQuery("select count(x) from Treatment x where x.healthCase.id=:case and x.id<>:id and x.status='VALID' and x.treatmentTime>=:from and x.treatmentTime<:until",Long.class)
            .setParameter("case",t.getHealthCase().getId()).setParameter("id",treatmentId).setParameter("from",from).setParameter("until",until).getSingleResult();
        if(otherSameDay>0)throw DomainException.conflict(MessageCodes.COM_05,"reason","treatment_already_recorded_that_day");
        t.setWithdrawalEndDate(farmDate(t.getTreatmentTime(),cattle).plusDays((t.getCourseDays()==null?1:t.getCourseDays())-1L+(t.getWithdrawalDays()==null?0:t.getWithdrawalDays())));
        t.setIsCorrected(Boolean.TRUE);em.flush();
        revisions.record(ctx,"Treatment",treatmentId,RecordRevisionService.CORRECT,req.reason(),before,treatmentSnapshot(t));
        audit.log(ctx,"HEALTH_TREATMENT_CORRECT","Treatment",treatmentId,Map.of("caseId",t.getHealthCase().getId()));
        return new CareDtos.RecordStatus(treatmentId,t.getStatus(),t.getVersion(),(String)cattleState.state(cattle).get("healthState"));
    }

    @Transactional
    CareDtos.RecordStatus voidObservationInCommand(Long farmId, Long observationId, CareDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthObservation observation = em.createQuery("select o from HealthObservation o where o.id=:id and o.healthCase.cattle.farm.id=:farm", HealthObservation.class)
            .setParameter("id", observationId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "observationId", observationId));
        Cattle cattle = cattleGuard.lockCattle(farmId, observation.getHealthCase().getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(observation.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req.reason(), "reason", 500);
        if (Boolean.TRUE.equals(observation.getOpening())) throw DomainException.conflict(MessageCodes.COM_05);
        if (!"VALID".equalsIgnoreCase(observation.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = observationSnapshot(observation);
        observation.setStatus("VOIDED"); observation.setStatusReason(req.reason().trim());
        em.flush();
        revisions.record(ctx, "HealthObservation", observationId, RecordRevisionService.VOID, req.reason(), before, observationSnapshot(observation));
        audit.log(ctx, "HEALTH_OBSERVATION_VOID", "HealthObservation", observationId, Map.of("caseId", observation.getHealthCase().getId()));
        return new CareDtos.RecordStatus(observationId, observation.getStatus(), observation.getVersion(), (String) cattleState.state(cattle).get("healthState"));
    }

    public CareDtos.RecordStatus voidTreatment(Long farmId, Long treatmentId, String key, CareDtos.VoidRecord request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "HEALTH_TREATMENT_VOID", key,
            Map.of("treatmentId", treatmentId, "request", request), CareDtos.RecordStatus.class,
            () -> voidTreatmentInCommand(farmId, treatmentId, request));
    }

    @Transactional
    CareDtos.RecordStatus voidTreatmentInCommand(Long farmId, Long treatmentId, CareDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Treatment treatment = em.createQuery("select t from Treatment t where t.id=:id and t.healthCase.cattle.farm.id=:farm", Treatment.class)
            .setParameter("id", treatmentId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "treatmentId", treatmentId));
        Cattle cattle = cattleGuard.lockCattle(farmId, treatment.getHealthCase().getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(treatment.getVersion(), req == null ? null : req.expectedVersion());
        requireText(req.reason(), "reason", 500);
        if (!"VALID".equalsIgnoreCase(treatment.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = treatmentSnapshot(treatment);
        treatment.setStatus("VOIDED"); treatment.setStatusReason(req.reason().trim());
        em.flush();
        revisions.record(ctx, "Treatment", treatmentId, RecordRevisionService.VOID, req.reason(), before, treatmentSnapshot(treatment));
        audit.log(ctx, "HEALTH_TREATMENT_VOID", "Treatment", treatmentId, Map.of("caseId", treatment.getHealthCase().getId()));
        return new CareDtos.RecordStatus(treatmentId, treatment.getStatus(), treatment.getVersion(), (String) cattleState.state(cattle).get("healthState"));
    }

    @Transactional
    CareDtos.HealthCaseResult statusInCommand(Long farmId, Long caseId, CareDtos.CaseStatus req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        HealthCase healthCase = caseForFarm(farmId, caseId);
        cattleGuard.lockWritable(farmId, healthCase.getCattle().getId());
        VersionGuard.requireExpected(healthCase.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null) throw DomainException.required("status");
        if (!java.util.Set.of("OPEN", "CHRONIC").contains(upper(healthCase.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
        String action = upper(req.action());
        Map<String, Object> before = snapshot(healthCase);
        if ("CHRONIC".equals(action) && "OPEN".equals(upper(healthCase.getStatus()))) {
            healthCase.setStatus("CHRONIC"); healthCase.setChronicSince(clock.today());
        } else if ("REOPEN".equals(action) && "CHRONIC".equals(upper(healthCase.getStatus()))) {
            healthCase.setStatus("OPEN"); healthCase.setChronicSince(null);
        } else if ("CLOSE".equals(action)) {
            String outcome = upper(req.outcome());
            if (!java.util.Set.of("RECOVERED", "DIED", "MISSING").contains(outcome)) throw DomainException.required("outcome");
            LocalDate closingDate = req.closingDate() == null ? today(healthCase.getCattle()) : req.closingDate();
            clock.assertNotFuture(closingDate);
        assertCaseClosingDate(healthCase,closingDate);
            healthCase.setStatus("CLOSED"); healthCase.setOutcome(outcome); healthCase.setClosedDate(closingDate); healthCase.setClosedAt(clock.now());
            if ("DIED".equals(outcome) || "MISSING".equals(outcome)) {
                exits.createPendingLossVoucher(healthCase, ctx.user(), closingDate, "DIED".equals(outcome) ? LossKind.DIED : LossKind.MISSING);
            }
        } else throw DomainException.invalid("action");
        em.flush();
        audit.log(ctx, "HEALTH_CASE_STATUS", "HealthCase", caseId, snapshot(healthCase));
        return new CareDtos.HealthCaseResult(healthCase.getId(), healthCase.getCaseCode(), healthCase.getStatus(), healthCase.getVersion(), healthCase.getCattle().getId(), null, (String) cattleState.state(healthCase.getCattle()).get("healthState"));
    }

    private HealthCase caseForFarm(Long farmId, Long caseId) {
        return em.createQuery("select h from HealthCase h where h.id=:id and h.cattle.farm.id=:farm", HealthCase.class)
            .setParameter("id", caseId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "healthCaseId", caseId));
    }
    private void assignRecorderAndObserver(HealthObservation observation, FarmContext ctx, Long observerId, Long farmId) {
        observation.setRecorder(ctx.user());
        if (observerId == null) { observation.setObserver(ctx.user()); return; }
        var member = em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user and upper(m.status)='ACTIVE'", vn.edu.fpt.beefcare.domain.FarmMembership.class)
            .setParameter("farm", farmId).setParameter("user", observerId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.invalid("observerId"));
        if (!"TECHNICIAN".equalsIgnoreCase(member.getRole())) throw DomainException.invalid("observerId");
        observation.setObserver(em.find(AppUser.class, observerId));
    }
    private void assertAfterHerdEntry(Long farmId, Cattle cattle, Instant eventTime) {
        LocalDate entryDate = em.createQuery("select e.entryDate from HerdEntry e where e.cattle.id=:cattle and e.voucher.farm.id=:farm and upper(e.status)='POSTED' order by e.id", LocalDate.class)
            .setParameter("cattle", cattle.getId()).setParameter("farm", farmId).setMaxResults(1).getResultStream().findFirst().orElse(null);
        if (entryDate != null && farmDate(eventTime, cattle).isBefore(entryDate)) throw DomainException.unprocessable(MessageCodes.COM_15, "entryDate", entryDate);
    }
    private void assertChronological(HealthCase healthCase, Instant time) {
        Instant observation = em.createQuery("select max(o.observedTime) from HealthObservation o where o.healthCase.id=:id and upper(o.status)='VALID'", Instant.class)
            .setParameter("id", healthCase.getId()).getSingleResult();
        Instant treatment = em.createQuery("select max(t.treatmentTime) from Treatment t where t.healthCase.id=:id and upper(t.status)='VALID'", Instant.class)
            .setParameter("id", healthCase.getId()).getSingleResult();
        Instant latest = observation == null ? treatment : treatment == null || observation.isAfter(treatment) ? observation : treatment;
        if (latest != null && time.isBefore(latest)) throw DomainException.unprocessable(MessageCodes.COM_07, "reason", "event_before_existing_case_entry");
    }
    private void assertCaseClosingDate(HealthCase healthCase,LocalDate closingDate){
        if(closingDate.isBefore(healthCase.getOpenedDate()))throw DomainException.unprocessable(MessageCodes.COM_07,"reason","closure_before_case_opened");
        Instant latestObservation=em.createQuery("select max(o.observedTime) from HealthObservation o where o.healthCase.id=:id and upper(o.status)='VALID'",Instant.class).setParameter("id",healthCase.getId()).getSingleResult();
        Instant latestTreatment=em.createQuery("select max(t.treatmentTime) from Treatment t where t.healthCase.id=:id and upper(t.status)='VALID'",Instant.class).setParameter("id",healthCase.getId()).getSingleResult();
        Instant latest=latestObservation==null?latestTreatment:latestTreatment==null||latestObservation.isAfter(latestTreatment)?latestObservation:latestTreatment;
        if(latest!=null&&closingDate.isBefore(farmDate(latest,healthCase.getCattle())))throw DomainException.unprocessable(MessageCodes.COM_07,"reason","closure_before_existing_case_entry");
    }
    private void assertNoLaterCaseEntry(Long caseId,Long excludedObservation,Instant time,Long excludedTreatment) {
        String observationQuery = "select count(o) from HealthObservation o where o.healthCase.id=:case and o.status='VALID' and o.observedTime>:time" +
            (excludedObservation==null?"":" and o.id<>:excluded");
        var oq=em.createQuery(observationQuery,Long.class).setParameter("case",caseId).setParameter("time",time);
        if(excludedObservation!=null)oq.setParameter("excluded",excludedObservation);
        String treatmentQuery = "select count(t) from Treatment t where t.healthCase.id=:case and t.status='VALID' and t.treatmentTime>:time" +
            (excludedTreatment==null?"":" and t.id<>:excluded");
        var tq=em.createQuery(treatmentQuery,Long.class).setParameter("case",caseId).setParameter("time",time);
        if(excludedTreatment!=null)tq.setParameter("excluded",excludedTreatment);
        if(oq.getSingleResult()>0||tq.getSingleResult()>0)throw DomainException.conflict(MessageCodes.COM_05,"reason","later_case_record_depends_on_timeline");
    }
    private Map<String, Object> snapshot(HealthCase c) {
        Map<String, Object> m = new LinkedHashMap<>(); m.put("status", c.getStatus()); m.put("outcome", c.getOutcome()); m.put("closedDate", c.getClosedDate()); m.put("chronicSince", c.getChronicSince()); return m;
    }
    private Map<String, Object> observationSnapshot(HealthObservation o) { Map<String, Object> m=new LinkedHashMap<>(); m.put("status",o.getStatus());m.put("observedAt",o.getObservedTime());m.put("signs",o.getSignsProgress());m.put("progress",o.getProgress());m.put("temperatureC",o.getTemperatureC());return m; }
    private Map<String, Object> treatmentSnapshot(Treatment t) { Map<String, Object> m=new LinkedHashMap<>();m.put("status",t.getStatus());m.put("treatmentTime",t.getTreatmentTime());m.put("dose",t.getDose());m.put("route",t.getRoute());m.put("withdrawalEndDate",t.getWithdrawalEndDate());return m; }
    private void requireTemperature(BigDecimal t) { if (t != null && (t.compareTo(new BigDecimal("34.0")) < 0 || t.compareTo(new BigDecimal("42.5")) > 0)) throw DomainException.invalid("temperatureC"); }
    private void requireText(String text, String field, int max) { if (text == null || text.isBlank()) throw DomainException.required(field); if (text.trim().length() > max) throw DomainException.invalid(field); }
    private String trim(String text) { return text == null || text.isBlank() ? null : text.trim(); }
    private String upper(String text) { return text == null ? "" : text.trim().toUpperCase(java.util.Locale.ROOT); }
    private LocalDate today(Cattle cattle) { return clock.now().atZone(farmZone(cattle)).toLocalDate(); }
    private LocalDate farmDate(Instant time, Cattle cattle) { return time.atZone(farmZone(cattle)).toLocalDate(); }
    private ZoneId farmZone(Cattle cattle) { try { return ZoneId.of(cattle.getFarm().getTimeZone()); } catch (Exception ignored) { return clock.zone(); } }
}
