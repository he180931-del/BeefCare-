package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.RecordRevisionService;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Business commands for vaccination schedules and dose deferrals (UC-FE09-02/06, GBR-41/43). */
@Service
public class VaccinationCommandService {
    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final CattleGuardService cattleGuard;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;
    private final FarmClock clock;
    private final RecordRevisionService revisions;

    public VaccinationCommandService(FarmAccessService access, CattleGuardService cattleGuard, IdempotencyCommandService idempotency, AuditService audit, FarmClock clock, RecordRevisionService revisions) {
        this.access = access; this.cattleGuard = cattleGuard; this.idempotency = idempotency; this.audit = audit; this.clock = clock; this.revisions = revisions;
    }

    public CareDtos.VaccinationScheduleResult createSchedule(Long farmId, String key, CareDtos.CreateVaccinationSchedule request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_SCHEDULE_CREATE", key, request,
            CareDtos.VaccinationScheduleResult.class, () -> createScheduleInCommand(farmId, request));
    }

    @Transactional(readOnly = true)
    public List<CareDtos.VaccinationScheduleView> schedules(Long farmId) {
        access.require(farmId, FarmAction.VIEW_HEALTH);
        return em.createQuery("select s from VaccinationSchedule s where s.farm.id=:farm order by s.id desc", VaccinationSchedule.class)
            .setParameter("farm", farmId).getResultList().stream().map(s -> {
                List<CareDtos.ScheduledDoseView> doses = em.createQuery("select d from ScheduledDose d where d.schedule.id=:id order by d.dueDate,d.cattle.displayCode,d.doseNo", ScheduledDose.class)
                    .setParameter("id", s.getId()).getResultList().stream().map(d -> new CareDtos.ScheduledDoseView(d.getId(),d.getCattle().getId(),d.getCattle().getDisplayCode(),
                        d.getDoseNo(),d.getDueDate(),d.getNewExpectedDate(),d.getStatus(),d.getDeferralReason(),d.getVersion())).toList();
                return new CareDtos.VaccinationScheduleView(s.getId(),s.getScheduleName(),s.getTargetGroup(),s.getVaccine().getId(),s.getVaccine().getName(),
                    s.getFirstDueDate(),s.getDoseCount(),s.getIntervalDays(),s.getBoosterIntervalMonths(),s.getStatus(),s.getVersion(),doses);
            }).toList();
    }

    public CareDtos.VaccinationScheduleResult editSchedule(Long farmId, Long scheduleId, String key, CareDtos.EditVaccinationSchedule request) {
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"VACCINATION_SCHEDULE_EDIT",key,Map.of("scheduleId",scheduleId,"request",request),
            CareDtos.VaccinationScheduleResult.class,()->editScheduleInCommand(farmId,scheduleId,request));
    }

    @Transactional
    CareDtos.VaccinationScheduleResult editScheduleInCommand(Long farmId,Long scheduleId,CareDtos.EditVaccinationSchedule req) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        VaccinationSchedule s=em.createQuery("select s from VaccinationSchedule s where s.id=:id and s.farm.id=:farm",VaccinationSchedule.class)
            .setParameter("id",scheduleId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"scheduleId",scheduleId));
        VersionGuard.requireExpected(s.getVersion(),req==null?null:req.expectedVersion());
        if(!"ACTIVE".equalsIgnoreCase(s.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        if(req.name()!=null){String n=trim(req.name());if(n==null||n.length()>100)throw DomainException.invalid("name");s.setScheduleName(n);}
        if(req.vaccineId()!=null){Vaccine v=em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm",Vaccine.class).setParameter("id",req.vaccineId()).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"vaccineId",req.vaccineId()));if(!Boolean.TRUE.equals(v.getAvailable()))throw DomainException.conflict(MessageCodes.COM_05,"reason","vaccine_inactive");s.setVaccine(v);}
        if(req.intervalDays()!=null){if(req.intervalDays()<1||req.intervalDays()>365)throw DomainException.invalid("intervalDays");s.setIntervalDays(req.intervalDays());}
        if(req.boosterIntervalMonths()!=null){if(req.boosterIntervalMonths()<1||req.boosterIntervalMonths()>60)throw DomainException.invalid("boosterIntervalMonths");s.setBoosterIntervalMonths(req.boosterIntervalMonths());}
        if(req.firstDueDate()!=null){if(req.firstDueDate().isBefore(clock.today()))throw DomainException.invalid("firstDueDate");List<ScheduledDose> ds=em.createQuery("select d from ScheduledDose d where d.schedule.id=:id and d.status in ('PLANNED','DEFERRED')",ScheduledDose.class).setParameter("id",scheduleId).getResultList();for(ScheduledDose d:ds)d.setDueDate(req.firstDueDate().plusDays((long)(d.getDoseNo()-1)*s.getIntervalDays()));s.setFirstDueDate(req.firstDueDate());}
        em.flush();
        Long targets=em.createQuery("select count(distinct d.cattle.id) from ScheduledDose d where d.schedule.id=:id",Long.class).setParameter("id",scheduleId).getSingleResult();
        Long remaining=em.createQuery("select count(d) from ScheduledDose d where d.schedule.id=:id and d.status in ('PLANNED','DEFERRED')",Long.class).setParameter("id",scheduleId).getSingleResult();
        audit.log(ctx,"VACCINATION_SCHEDULE_EDIT","VaccinationSchedule",scheduleId,Map.of("version",s.getVersion()));
        return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),targets.intValue(),remaining.intValue());
    }

    public CareDtos.VaccinationScheduleResult stopSchedule(Long farmId,Long scheduleId,String key,Integer expectedVersion){
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"VACCINATION_SCHEDULE_STOP",key,Map.of("scheduleId",scheduleId,"expectedVersion",expectedVersion),
            CareDtos.VaccinationScheduleResult.class,()->stopScheduleInCommand(farmId,scheduleId,expectedVersion));
    }
    @Transactional
    CareDtos.VaccinationScheduleResult stopScheduleInCommand(Long farmId,Long scheduleId,Integer expectedVersion){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        VaccinationSchedule s=em.createQuery("select s from VaccinationSchedule s where s.id=:id and s.farm.id=:farm",VaccinationSchedule.class).setParameter("id",scheduleId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"scheduleId",scheduleId));
        VersionGuard.requireExpected(s.getVersion(),expectedVersion);if("STOPPED".equalsIgnoreCase(s.getStatus()))return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),0,0);
        s.setStatus("STOPPED");List<ScheduledDose> ds=em.createQuery("select d from ScheduledDose d where d.schedule.id=:id and d.status in ('PLANNED','DEFERRED')",ScheduledDose.class).setParameter("id",scheduleId).getResultList();for(ScheduledDose d:ds)d.setStatus("CANCELLED");em.flush();
        Long targets=em.createQuery("select count(distinct d.cattle.id) from ScheduledDose d where d.schedule.id=:id",Long.class).setParameter("id",scheduleId).getSingleResult();audit.log(ctx,"VACCINATION_SCHEDULE_STOP","VaccinationSchedule",scheduleId,Map.of("cancelledDoses",ds.size()));
        return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),targets.intValue(),0);
    }

    @Transactional
    CareDtos.VaccinationScheduleResult createScheduleInCommand(Long farmId, CareDtos.CreateVaccinationSchedule req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        if (req == null) throw DomainException.required("schedule");
        String name = trim(req.name());
        if (name == null || name.length() > 100) throw DomainException.required("name");
        if (req.vaccineId() == null) throw DomainException.required("vaccineId");
        Vaccine vaccine = em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
            .setParameter("id", req.vaccineId()).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", req.vaccineId()));
        if (!Boolean.TRUE.equals(vaccine.getAvailable())) throw DomainException.conflict(MessageCodes.COM_05, "reason", "vaccine_inactive");
        Integer count = req.doseCount(); Integer interval = req.intervalDays();
        if (count == null || count < 1 || count > 10) throw DomainException.invalid("doseCount");
        if (interval == null || interval < 1 || interval > 365) throw DomainException.invalid("intervalDays");
        if (req.boosterIntervalMonths() != null && (req.boosterIntervalMonths() < 1 || req.boosterIntervalMonths() > 60)) throw DomainException.invalid("boosterIntervalMonths");
        LocalDate start = req.firstDueDate() == null ? clock.today() : req.firstDueDate();
        if (start.isBefore(clock.today())) throw DomainException.invalid("firstDueDate");
        if (em.createQuery("select count(s) from VaccinationSchedule s where s.farm.id=:farm and upper(s.status)='ACTIVE' and lower(s.scheduleName)=lower(:name)", Long.class)
            .setParameter("farm", farmId).setParameter("name", name).getSingleResult() > 0) throw DomainException.conflict(MessageCodes.COM_05, "reason", "active_schedule_name_exists");
        List<Long> cattleIds = resolveTargets(farmId, start, req);
        if (cattleIds.isEmpty()) throw DomainException.invalid("targetCattle");
        List<Cattle> targets = new ArrayList<>();
        for (Long cattleId : cattleIds) targets.add(cattleGuard.lockWritable(farmId, cattleId));
        VaccinationSchedule schedule = new VaccinationSchedule();
        schedule.setScheduleName(name); schedule.setVaccine(vaccine); schedule.setFirstDueDate(start); schedule.setDoseCount(count);
        schedule.setIntervalDays(interval); schedule.setBoosterIntervalMonths(req.boosterIntervalMonths()); schedule.setTargetGroup(targetDescription(req));
        schedule.setStatus("ACTIVE"); schedule.setFarm(ctx.farm()); em.persist(schedule); em.flush();
        int planned = 0;
        for (Cattle cattle : targets) {
            for (int doseNo = 1; doseNo <= count; doseNo++) {
                ScheduledDose dose = new ScheduledDose(); dose.setSchedule(schedule); dose.setCattle(cattle); dose.setDoseNo(doseNo);
                dose.setDueDate(start.plusDays((long) (doseNo - 1) * interval)); dose.setStatus("PLANNED"); em.persist(dose); planned++;
            }
        }
        audit.log(ctx, "VACCINATION_SCHEDULE_CREATE", "VaccinationSchedule", schedule.getId(), Map.of("name", name, "vaccineId", vaccine.getId(), "targetCount", targets.size(), "plannedDoseCount", planned));
        return new CareDtos.VaccinationScheduleResult(schedule.getId(), name, schedule.getStatus(), schedule.getVersion(), targets.size(), planned);
    }

    private List<Long> resolveTargets(Long farmId, LocalDate start, CareDtos.CreateVaccinationSchedule request) {
        List<Long> selectedIds = request.cattleIds() == null ? List.of() : request.cattleIds().stream().filter(java.util.Objects::nonNull).distinct().toList();
        List<Long> penIds = request.penIds() == null ? List.of() : request.penIds().stream().filter(java.util.Objects::nonNull).distinct().toList();
        List<String> groups = normalizeFilters(request.herdGroups(), java.util.Set.of("CALVES","FATTENING","BREEDING_BULLS","BREEDING_FEMALES","YOUNG_STOCK","OTHER"), "herdGroups");
        List<String> stages = normalizeFilters(request.lifeStages(), java.util.Arrays.stream(LifeStage.values()).map(Enum::name).collect(java.util.stream.Collectors.toSet()), "lifeStages");
        List<Long> excluded = request.excludedCattleIds() == null ? List.of() : request.excludedCattleIds().stream().filter(java.util.Objects::nonNull).distinct().toList();
        boolean hasSelector = !penIds.isEmpty() || !groups.isEmpty() || !stages.isEmpty();
        java.util.LinkedHashSet<Long> matches = new java.util.LinkedHashSet<>();
        if (hasSelector) {
            List<Cattle> active = em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=:status", Cattle.class)
                .setParameter("farm", farmId).setParameter("status", HerdStatus.ACTIVE).getResultList();
            Map<Long, Long> penByCattle = new java.util.HashMap<>();
            em.createQuery("select p from PenAssignment p where p.farm.id=:farm and p.fromDate<=:day and (p.toDate is null or p.toDate>=:day)", PenAssignment.class)
                .setParameter("farm", farmId).setParameter("day", start).getResultList().forEach(p -> penByCattle.put(p.getCattle().getId(), p.getPen().getId()));
            for (Cattle c : active) {
                if (!penIds.isEmpty() && !penIds.contains(penByCattle.get(c.getId()))) continue;
                if (!groups.isEmpty() && !groups.contains(herdGroup(c))) continue;
                if (!stages.isEmpty() && (c.getLifeStage() == null || !stages.contains(c.getLifeStage().name()))) continue;
                matches.add(c.getId());
            }
        }
        matches.addAll(selectedIds);
        matches.removeAll(excluded);
        for (Long id : matches) cattleGuard.lockWritable(farmId, id); // validates same-farm and ACTIVE before any schedule is persisted
        for (Long id : excluded) {
            Long belongs = em.createQuery("select count(c) from Cattle c where c.id=:id and c.farm.id=:farm", Long.class).setParameter("id", id).setParameter("farm", farmId).getSingleResult();
            if (belongs == 0) throw DomainException.notFound(MessageCodes.COM_08, "cattleId", id);
        }
        return matches.stream().sorted().toList();
    }

    private List<String> normalizeFilters(List<String> values, java.util.Set<String> allowed, String field) {
        if (values == null) return List.of();
        List<String> result = values.stream().filter(java.util.Objects::nonNull).map(this::upper).distinct().toList();
        if (result.stream().anyMatch(v -> !allowed.contains(v))) throw DomainException.invalid(field);
        return result;
    }

    private String targetDescription(CareDtos.CreateVaccinationSchedule request) {
        List<String> parts=new ArrayList<>();
        if(request.penIds()!=null&&!request.penIds().isEmpty())parts.add("PENS");
        if(request.herdGroups()!=null&&!request.herdGroups().isEmpty())parts.add("HERD_GROUPS");
        if(request.lifeStages()!=null&&!request.lifeStages().isEmpty())parts.add("LIFE_STAGES");
        if(request.cattleIds()!=null&&!request.cattleIds().isEmpty())parts.add("INDIVIDUALS");
        if(request.excludedCattleIds()!=null&&!request.excludedCattleIds().isEmpty())parts.add("EXCLUSIONS");
        return parts.isEmpty()?"EXPLICIT":String.join("+",parts);
    }

    private String herdGroup(Cattle c) {
        if(c.getLifeStage()==LifeStage.UNWEANED_CALF||c.getLifeStage()==LifeStage.WEANED_CALF)return "CALVES";
        PurposeType purpose=c.getPurpose()==null?null:c.getPurpose().getPurposeType();
        if(purpose==PurposeType.FATTENING)return "FATTENING";
        if(purpose==PurposeType.SIRE)return "BREEDING_BULLS";
        if(purpose==PurposeType.BREEDING&&c.getSex()==Sex.FEMALE&&c.getLifeStage()==LifeStage.ADULT)return "BREEDING_FEMALES";
        if(c.getLifeStage()==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";
        return "OTHER";
    }

    public CareDtos.DoseResult deferDose(Long farmId, Long doseId, String key, CareDtos.DeferDose request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_DOSE_DEFER", key,
            Map.of("doseId", doseId, "request", request), CareDtos.DoseResult.class, () -> deferDoseInCommand(farmId, doseId, request));
    }

    public CareDtos.VaccinationBatchResult record(Long farmId, String key, CareDtos.RecordVaccinations request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_RECORD_BATCH", key, request,
            CareDtos.VaccinationBatchResult.class, () -> recordInCommand(farmId, request));
    }

    public CareDtos.VaccinationResult correct(Long farmId, Long vaccinationId, String key, CareDtos.CorrectVaccination request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_CORRECT", key,
            Map.of("vaccinationId", vaccinationId, "request", request), CareDtos.VaccinationResult.class,
            () -> correctInCommand(farmId, vaccinationId, request));
    }

    @Transactional
    CareDtos.VaccinationResult correctInCommand(Long farmId, Long vaccinationId, CareDtos.CorrectVaccination req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Vaccination record = vaccinationForFarm(farmId, vaccinationId);
        Cattle cattle = cattleGuard.lockCattle(farmId, record.getCattle().getId()); cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(record.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null || !"VALID".equalsIgnoreCase(record.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        if (req.reason() == null || req.reason().isBlank()) throw DomainException.required("reason");
        if (req.reason().trim().length() > 500) throw DomainException.invalid("reason");
        Map<String, Object> before = vaccinationSnapshot(record);
        if (req.vaccineId() != null) {
            Vaccine vaccine = em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
                .setParameter("id", req.vaccineId()).setParameter("farm", farmId).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", req.vaccineId()));
            if (!Boolean.TRUE.equals(vaccine.getAvailable())) throw DomainException.conflict(MessageCodes.COM_05, "reason", "vaccine_inactive");
            record.setVaccine(vaccine); record.setVaccineNameSnapshot(vaccine.getName());
        }
        if (req.dose() != null) record.setDose(requireMax(req.dose(), "dose", 255));
        if (req.route() != null) record.setRoute(requireMax(req.route(), "route", 255));
        if (req.vaccinator() != null) record.setVaccinator(requireMax(req.vaccinator(), "vaccinator", 255));
        if (record.getSource() != null && "ON_FARM".equalsIgnoreCase(record.getSource())) {
            if (req.batchNo() != null) record.setBatchNo(requireMax(req.batchNo(), "batchNo", 50));
            if (req.administeredAt() != null) {
                clock.assertNotFuture(req.administeredAt()); record.setAdministeredAt(req.administeredAt());
                record.setVaccinationDate(farmDate(req.administeredAt(), ctx.farm().getTimeZone()));
            }
            if (record.getWithdrawalDays() != null && record.getWithdrawalDays() > 0) record.setWithdrawalEndDate(record.getVaccinationDate().plusDays(record.getWithdrawalDays()));
        } else if (req.vaccinationDate() != null) {
            clock.assertNotFuture(req.vaccinationDate()); record.setVaccinationDate(req.vaccinationDate());
        }
        record.setCorrected(Boolean.TRUE); em.flush();
        revisions.record(ctx, "Vaccination", vaccinationId, RecordRevisionService.CORRECT, req.reason(), before, vaccinationSnapshot(record));
        audit.log(ctx, "VACCINATION_CORRECT", "Vaccination", vaccinationId, Map.of("cattleId", cattle.getId()));
        return new CareDtos.VaccinationResult(record.getId(), record.getStatus(), record.getVersion(), record.getWithdrawalEndDate(), record.getCorrected());
    }

    public CareDtos.VaccinationResult voidRecord(Long farmId, Long vaccinationId, String key, CareDtos.VoidRecord request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_HEALTH, "VACCINATION_VOID", key,
            Map.of("vaccinationId", vaccinationId, "request", request), CareDtos.VaccinationResult.class,
            () -> voidInCommand(farmId, vaccinationId, request));
    }

    @Transactional
    CareDtos.VaccinationResult voidInCommand(Long farmId, Long vaccinationId, CareDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        Vaccination record = vaccinationForFarm(farmId, vaccinationId);
        Cattle cattle = cattleGuard.lockCattle(farmId, record.getCattle().getId()); cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(record.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null || req.reason() == null || req.reason().isBlank()) throw DomainException.required("reason");
        if (req.reason().trim().length() > 500) throw DomainException.invalid("reason");
        if (!"VALID".equalsIgnoreCase(record.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = vaccinationSnapshot(record);
        record.setStatus("VOIDED"); record.setStatusReason(req.reason().trim());
        ScheduledDose dose = record.getScheduledDose();
        if (dose != null) {
            if ("ACTIVE".equalsIgnoreCase(dose.getSchedule().getStatus())) {
                dose.setStatus(dose.getNewExpectedDate() != null || trim(dose.getDeferralReason()) != null ? "DEFERRED" : "PLANNED");
            } else dose.setStatus("CANCELLED");
            dose.setVaccination(null); record.setScheduledDose(null);
        }
        em.flush();
        revisions.record(ctx, "Vaccination", vaccinationId, RecordRevisionService.VOID, req.reason(), before, vaccinationSnapshot(record));
        audit.log(ctx, "VACCINATION_VOID", "Vaccination", vaccinationId, Map.of("cattleId", cattle.getId()));
        return new CareDtos.VaccinationResult(record.getId(), record.getStatus(), record.getVersion(), record.getWithdrawalEndDate(), record.getCorrected());
    }

    @Transactional
    CareDtos.VaccinationBatchResult recordInCommand(Long farmId, CareDtos.RecordVaccinations req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        if (req == null || req.vaccineId() == null) throw DomainException.required("vaccineId");
        Vaccine vaccine = em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class)
            .setParameter("id", req.vaccineId()).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", req.vaccineId()));
        if (!Boolean.TRUE.equals(vaccine.getAvailable())) throw DomainException.conflict(MessageCodes.COM_05, "reason", "vaccine_inactive");
        String source = upper(req.source());
        if (!java.util.Set.of("ON_FARM", "HISTORICAL").contains(source)) throw DomainException.invalid("source");
        List<CareDtos.VaccinationAnimal> animals = req.animals() == null ? List.of() : req.animals();
        if (animals.isEmpty()) throw DomainException.required("animals");
        if (animals.stream().anyMatch(java.util.Objects::isNull)) throw DomainException.invalid("animals");
        if (source.equals("ON_FARM")) {
            if (req.batchNo() == null || req.batchNo().isBlank()) throw DomainException.required("batchNo");
            if (req.batchNo().trim().length() > 50) throw DomainException.invalid("batchNo");
        }
        Instant administeredAt = req.administeredAt();
        if (source.equals("ON_FARM")) {
            if (administeredAt == null) administeredAt = clock.now();
            clock.assertNotFuture(administeredAt);
        }
        LocalDate date = source.equals("ON_FARM") ? farmDate(administeredAt, ctx.farm().getTimeZone()) : req.vaccinationDate();
        if (date == null) throw DomainException.required("vaccinationDate");
        clock.assertNotFuture(date);
        int withdrawalDays = source.equals("HISTORICAL") ? 0 : req.withdrawalDays() == null ? parseDays(vaccine.getWithdrawalInfo()) : req.withdrawalDays();
        if (withdrawalDays < 0 || withdrawalDays > 365) throw DomainException.invalid("withdrawalDays");
        String doseText = trim(req.dose()) == null ? vaccine.getDose() : req.dose().trim();
        String route = trim(req.route()) == null ? vaccine.getRoute() : req.route().trim();
        String vaccinator = trim(req.vaccinator()) == null ? ctx.user().getFullName() : req.vaccinator().trim();
        if (doseText == null || doseText.isBlank() || doseText.length() > 255) throw DomainException.required("dose");
        if (route == null || route.isBlank() || route.length() > 255) throw DomainException.required("route");
        if (vaccinator == null || vaccinator.isBlank() || vaccinator.length() > 255) throw DomainException.required("vaccinator");
        List<Long> ids = animals.stream().map(CareDtos.VaccinationAnimal::cattleId).distinct().sorted().toList();
        if (ids.size() != animals.size() || ids.stream().anyMatch(java.util.Objects::isNull)) throw DomainException.invalid("animals");
        var cattleById = new java.util.LinkedHashMap<Long, Cattle>();
        for (Long id : ids) cattleById.put(id, cattleGuard.lockWritable(farmId, id));
        int vaccinated = 0; int deferred = 0; List<Long> vaccinationIds = new ArrayList<>();
        for (CareDtos.VaccinationAnimal item : animals) {
            Cattle cattle = cattleById.get(item.cattleId());
            String decision = upper(item.decision());
            if (decision.equals("DEFER")) {
                if (item.scheduledDoseId() == null) throw DomainException.required("scheduledDoseId");
                ScheduledDose scheduled = doseForFarm(farmId, item.scheduledDoseId());
                if (!scheduled.getCattle().getId().equals(cattle.getId())) throw DomainException.invalid("scheduledDoseId");
                VersionGuard.requireExpected(scheduled.getVersion(), item.expectedDoseVersion());
                if (!java.util.Set.of("PLANNED", "DEFERRED").contains(upper(scheduled.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
                if (item.deferralReason() == null || item.deferralReason().isBlank()) throw DomainException.required("deferralReason");
                if (item.newExpectedDate() != null && item.newExpectedDate().isBefore(clock.today())) throw DomainException.invalid("newExpectedDate");
                scheduled.setStatus("DEFERRED"); scheduled.setDeferralReason(item.deferralReason().trim()); scheduled.setNewExpectedDate(item.newExpectedDate()); scheduled.setDeferredBy(ctx.user());
                deferred++; continue;
            }
            if (!decision.equals("VACCINATE")) throw DomainException.invalid("decision");
            assertAfterHerdEntry(farmId,cattle,date);
            ScheduledDose scheduled = item.scheduledDoseId() == null || source.equals("HISTORICAL") ? null : doseForFarm(farmId, item.scheduledDoseId());
            if (scheduled != null) {
                if (!scheduled.getCattle().getId().equals(cattle.getId()) || !scheduled.getSchedule().getVaccine().getId().equals(vaccine.getId())) throw DomainException.invalid("scheduledDoseId");
                VersionGuard.requireExpected(scheduled.getVersion(), item.expectedDoseVersion());
                if (!java.util.Set.of("PLANNED", "DEFERRED").contains(upper(scheduled.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
            }
            Vaccination record = new Vaccination(); record.setCattle(cattle); record.setVaccine(vaccine); record.setSource(source);
            record.setVaccinationDate(date); record.setAdministeredAt(administeredAt); record.setEntryTime(clock.now());
            record.setDose(doseText); record.setRoute(route); record.setBatchNo(source.equals("ON_FARM") ? req.batchNo().trim() : trim(req.batchNo()));
            record.setVaccinator(vaccinator); record.setVaccineNameSnapshot(vaccine.getName());
            if (source.equals("ON_FARM")) record.setWithdrawalDays(withdrawalDays);
            if (source.equals("ON_FARM") && withdrawalDays > 0) record.setWithdrawalEndDate(date.plusDays(withdrawalDays));
            if (scheduled != null) { scheduled.setStatus("DONE"); scheduled.setVaccination(record); record.setScheduledDose(scheduled); }
            em.persist(record); em.flush();
            if (scheduled != null) planBooster(scheduled, date);
            vaccinationIds.add(record.getId()); vaccinated++;
        }
        audit.log(ctx, "VACCINATION_RECORD_BATCH", "Vaccination", vaccinationIds.isEmpty() ? null : vaccinationIds.get(0),
            Map.of("vaccinatedCount", vaccinated, "deferredCount", deferred, "source", source));
        return new CareDtos.VaccinationBatchResult(vaccinated, deferred, List.copyOf(vaccinationIds));
    }

    @Transactional
    CareDtos.DoseResult deferDoseInCommand(Long farmId, Long doseId, CareDtos.DeferDose req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_HEALTH);
        ScheduledDose dose = em.createQuery("select d from ScheduledDose d where d.id=:id and d.schedule.farm.id=:farm", ScheduledDose.class)
            .setParameter("id", doseId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "doseId", doseId));
        cattleGuard.lockWritable(farmId, dose.getCattle().getId());
        VersionGuard.requireExpected(dose.getVersion(), req == null ? null : req.expectedVersion());
        if (!java.util.Set.of("PLANNED", "DEFERRED").contains(upper(dose.getStatus()))) throw DomainException.conflict(MessageCodes.COM_05);
        if (req.reason() == null || req.reason().isBlank()) throw DomainException.required("reason");
        if (req.reason().trim().length() > 500) throw DomainException.invalid("reason");
        if (req.newExpectedDate() != null && req.newExpectedDate().isBefore(clock.today())) throw DomainException.invalid("newExpectedDate");
        dose.setStatus("DEFERRED"); dose.setDeferralReason(req.reason().trim()); dose.setNewExpectedDate(req.newExpectedDate());
        dose.setDeferralNote(trim(req.note())); dose.setDeferredBy(ctx.user());
        audit.log(ctx, "VACCINATION_DOSE_DEFER", "ScheduledDose", doseId, Map.of("newExpectedDate", req.newExpectedDate() == null ? "" : req.newExpectedDate(), "reason", req.reason().trim()));
        return new CareDtos.DoseResult(dose.getId(), dose.getStatus(), dose.getVersion(), dose.getDeferralReason(), dose.getNewExpectedDate());
    }

    private ScheduledDose doseForFarm(Long farmId, Long doseId) {
        return em.createQuery("select d from ScheduledDose d where d.id=:id and d.schedule.farm.id=:farm", ScheduledDose.class)
            .setParameter("id", doseId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "doseId", doseId));
    }
    private Vaccination vaccinationForFarm(Long farmId, Long vaccinationId) {
        return em.createQuery("select v from Vaccination v where v.id=:id and v.cattle.farm.id=:farm", Vaccination.class)
            .setParameter("id", vaccinationId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccinationId", vaccinationId));
    }
    private Map<String, Object> vaccinationSnapshot(Vaccination record) {
        return Map.of("status", record.getStatus(), "vaccineId", record.getVaccine().getId(), "vaccineName", record.getVaccineNameSnapshot() == null ? "" : record.getVaccineNameSnapshot(),
            "vaccinationDate", record.getVaccinationDate(), "batchNo", record.getBatchNo() == null ? "" : record.getBatchNo(),
            "dose", record.getDose(), "route", record.getRoute() == null ? "" : record.getRoute(), "vaccinator", record.getVaccinator(),
            "withdrawalEndDate", record.getWithdrawalEndDate() == null ? "" : record.getWithdrawalEndDate());
    }
    private void planBooster(ScheduledDose completed, LocalDate administeredDate) {
        VaccinationSchedule schedule = completed.getSchedule();
        Integer interval = schedule.getBoosterIntervalMonths();
        if (!"ACTIVE".equalsIgnoreCase(schedule.getStatus()) || interval == null || interval < 1 || completed.getDoseNo() < schedule.getDoseCount()) return;
        int nextNo = completed.getDoseNo() + 1;
        Long existing = em.createQuery("select count(d) from ScheduledDose d where d.schedule.id=:schedule and d.cattle.id=:cattle and d.doseNo=:no and upper(d.status) in ('PLANNED','DEFERRED')", Long.class)
            .setParameter("schedule", schedule.getId()).setParameter("cattle", completed.getCattle().getId()).setParameter("no", nextNo).getSingleResult();
        if (existing > 0) return;
        ScheduledDose booster = new ScheduledDose(); booster.setSchedule(schedule); booster.setCattle(completed.getCattle()); booster.setDoseNo(nextNo);
        booster.setDueDate(administeredDate.plusMonths(interval)); booster.setStatus("PLANNED"); em.persist(booster);
    }
    private int parseDays(String value) {
        if (value == null || value.isBlank()) return 0;
        try { return Integer.parseInt(value.trim()); } catch (NumberFormatException ex) { throw DomainException.invalid("withdrawalDays"); }
    }
    private LocalDate farmDate(java.time.Instant time, String zone) {
        try { return time.atZone(java.time.ZoneId.of(zone)).toLocalDate(); }
        catch (Exception ignored) { return clock.toFarmDate(time); }
    }

    private String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String requireMax(String value, String field, int max) {
        if (value == null || value.isBlank()) throw DomainException.required(field);
        if (value.trim().length() > max) throw DomainException.invalid(field);
        return value.trim();
    }
    private String upper(String value) { return value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT); }
    private void assertAfterHerdEntry(Long farmId,Cattle cattle,LocalDate date){
        LocalDate entry=em.createQuery("select e.entryDate from HerdEntry e where e.cattle.id=:cattle and e.voucher.farm.id=:farm and upper(e.status)='POSTED' order by e.id",LocalDate.class)
            .setParameter("cattle",cattle.getId()).setParameter("farm",farmId).setMaxResults(1).getResultStream().findFirst().orElse(null);
        if(entry!=null&&date.isBefore(entry))throw DomainException.unprocessable(MessageCodes.COM_15,"entryDate",entry);
    }
}
