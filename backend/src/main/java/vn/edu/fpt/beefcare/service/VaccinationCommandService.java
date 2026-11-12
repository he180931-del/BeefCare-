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
    private final CattleStateService cattleState;

    public VaccinationCommandService(FarmAccessService access, CattleGuardService cattleGuard, IdempotencyCommandService idempotency, AuditService audit, FarmClock clock, RecordRevisionService revisions, CattleStateService cattleState) {
        this.access = access; this.cattleGuard = cattleGuard; this.idempotency = idempotency; this.audit = audit; this.clock = clock; this.revisions = revisions; this.cattleState = cattleState;
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
                    s.getFirstDueDate(),s.getDoseCount(),s.getIntervalDays(),s.getBoosterIntervalMonths(),s.getStatus(),s.getVersion(),doses,s.getStopReason(),
                    targetView(farmId,s.getTargetCriteria()));
            }).toList();
    }

    public CareDtos.VaccinationScheduleResult editSchedule(Long farmId, Long scheduleId, String key, CareDtos.EditVaccinationSchedule request) {
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"VACCINATION_SCHEDULE_EDIT",key,Map.of("scheduleId",scheduleId,"request",request),
            CareDtos.VaccinationScheduleResult.class,()->editScheduleInCommand(farmId,scheduleId,request));
    }

    @Transactional
    CareDtos.VaccinationScheduleResult editScheduleInCommand(Long farmId,Long scheduleId,CareDtos.EditVaccinationSchedule req) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        if(req==null)throw DomainException.required("schedule");
        VaccinationSchedule s=em.createQuery("select s from VaccinationSchedule s where s.id=:id and s.farm.id=:farm",VaccinationSchedule.class)
            .setParameter("id",scheduleId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"scheduleId",scheduleId));
        VersionGuard.requireExpected(s.getVersion(),req.expectedVersion());
        if(!"ACTIVE".equalsIgnoreCase(s.getStatus()))throw DomainException.conflict(MessageCodes.COM_05);
        List<ScheduledDose> all=em.createQuery("select d from ScheduledDose d where d.schedule.id=:id order by d.cattle.id,d.doseNo,d.id",ScheduledDose.class).setParameter("id",scheduleId).getResultList();
        boolean anyDone=all.stream().anyMatch(d->"DONE".equalsIgnoreCase(d.getStatus()));
        Map<String,Object> changes=new java.util.LinkedHashMap<>();
        if(req.name()!=null){String n=trim(req.name());if(n==null||n.length()>100)throw DomainException.invalid("name");
            if(!n.equalsIgnoreCase(s.getScheduleName())&&em.createQuery("select count(x) from VaccinationSchedule x where x.farm.id=:farm and x.id<>:id and upper(x.status)='ACTIVE' and lower(x.scheduleName)=lower(:name)",Long.class)
                .setParameter("farm",farmId).setParameter("id",scheduleId).setParameter("name",n).getSingleResult()>0)throw DomainException.conflict(MessageCodes.COM_05,"reason","active_schedule_name_exists");
            s.setScheduleName(n);changes.put("name",n);}
        if(req.vaccineId()!=null&&!req.vaccineId().equals(s.getVaccine().getId())){
            // FE-09 Q3: a schedule with given doses keeps its vaccine; stop it and create a new one instead.
            if(anyDone)throw DomainException.conflict(MessageCodes.COM_05,"reason","vaccine_change_after_done");
            Vaccine v=em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm",Vaccine.class).setParameter("id",req.vaccineId()).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"vaccineId",req.vaccineId()));
            if(!Boolean.TRUE.equals(v.getAvailable()))throw DomainException.conflict(MessageCodes.COM_05,"reason","vaccine_inactive");s.setVaccine(v);changes.put("vaccineId",v.getId());}
        boolean redate=false;
        if(req.intervalDays()!=null&&!req.intervalDays().equals(s.getIntervalDays())){if(req.intervalDays()<1||req.intervalDays()>365)throw DomainException.invalid("intervalDays");s.setIntervalDays(req.intervalDays());redate=true;changes.put("intervalDays",req.intervalDays());}
        if(req.firstDueDate()!=null&&!req.firstDueDate().equals(s.getFirstDueDate())){if(req.firstDueDate().isBefore(clock.today()))throw DomainException.invalid("firstDueDate");s.setFirstDueDate(req.firstDueDate());redate=true;changes.put("firstDueDate",req.firstDueDate());}
        int oldCount=s.getDoseCount();
        if(Boolean.TRUE.equals(req.removeBooster())){
            if(req.boosterIntervalMonths()!=null)throw DomainException.invalid("boosterIntervalMonths");
            s.setBoosterIntervalMonths(null);changes.put("removeBooster",true);
            for(ScheduledDose d:all)if(d.getDoseNo()>oldCount&&isOpen(d))d.setStatus("CANCELLED");
        }else if(req.boosterIntervalMonths()!=null){if(req.boosterIntervalMonths()<1||req.boosterIntervalMonths()>60)throw DomainException.invalid("boosterIntervalMonths");s.setBoosterIntervalMonths(req.boosterIntervalMonths());changes.put("boosterIntervalMonths",req.boosterIntervalMonths());}
        int count=oldCount;
        if(req.doseCount()!=null&&req.doseCount()!=oldCount){
            count=req.doseCount();if(count<1||count>10)throw DomainException.invalid("doseCount");
            // A booster series already started is numbered after the last dose; renumbering it would mix boosters and doses.
            if(all.stream().anyMatch(d->d.getDoseNo()>oldCount))throw DomainException.conflict(MessageCodes.COM_05,"reason","booster_started");
            final int newCount=count;
            // R-09-05: a given dose never changes, so the count cannot drop below a dose already given.
            if(all.stream().anyMatch(d->d.getDoseNo()>newCount&&"DONE".equalsIgnoreCase(d.getStatus())))throw DomainException.conflict(MessageCodes.COM_05,"reason","dose_count_below_done");
            for(ScheduledDose d:all)if(d.getDoseNo()>newCount&&isOpen(d))d.setStatus("CANCELLED");
            s.setDoseCount(count);changes.put("doseCount",count);
        }
        java.util.LinkedHashSet<Long> current=new java.util.LinkedHashSet<>();for(ScheduledDose d:all)if(!"CANCELLED".equalsIgnoreCase(d.getStatus()))current.add(d.getCattle().getId());
        java.util.LinkedHashSet<Long> targets=new java.util.LinkedHashSet<>(current);
        if(req.target()!=null){
            List<Long> chosen=resolveTargets(farmId,clock.today(),req.target());
            if(chosen.isEmpty())throw DomainException.invalid("targetCattle");
            targets=new java.util.LinkedHashSet<>(chosen);
            // R-09-05 / TC-09-09: a removed animal loses its open doses; its given doses stay DONE.
            for(ScheduledDose d:all)if(!targets.contains(d.getCattle().getId())&&isOpen(d))d.setStatus("CANCELLED");
            s.setTargetCriteria(JsonSupport.toJson(req.target()));s.setTargetGroup(targetDescription(req.target()));
            List<Long> added=chosen.stream().filter(id->!current.contains(id)).toList();List<Long> removed=current.stream().filter(id->!chosen.contains(id)).toList();
            changes.put("addedCattle",added);changes.put("removedCattle",removed);
        }
        // Every target animal has one open or given dose per number (BR-D17): new animals and new numbers get PLANNED doses.
        int created=0;
        for(Long cattleId:targets){
            Cattle cattle=null;
            for(int doseNo=1;doseNo<=count;doseNo++){
                final int no=doseNo;
                boolean exists=all.stream().anyMatch(d->d.getCattle().getId().equals(cattleId)&&d.getDoseNo()==no&&!"CANCELLED".equalsIgnoreCase(d.getStatus()));
                if(exists)continue;
                if(cattle==null)cattle=cattleGuard.lockWritable(farmId,cattleId);
                ScheduledDose dose=new ScheduledDose();dose.setSchedule(s);dose.setCattle(cattle);dose.setDoseNo(doseNo);
                dose.setDueDate(s.getFirstDueDate().plusDays((long)(doseNo-1)*s.getIntervalDays()));dose.setStatus("PLANNED");em.persist(dose);created++;
            }
        }
        // TC-09-08: a new start date or interval moves every dose not yet given (boosters keep their own date).
        if(redate)for(ScheduledDose d:all)if(isOpen(d)&&d.getDoseNo()<=count)d.setDueDate(s.getFirstDueDate().plusDays((long)(d.getDoseNo()-1)*s.getIntervalDays()));
        em.flush();
        // MSG-FE09-01 counts the animals now targeted (a removed animal keeps its given doses but is no longer a target).
        int targetCount=targets.size();
        Long remaining=em.createQuery("select count(d) from ScheduledDose d where d.schedule.id=:id and d.status in ('PLANNED','DEFERRED')",Long.class).setParameter("id",scheduleId).getSingleResult();
        changes.put("createdDoses",created);changes.put("version",s.getVersion());
        audit.log(ctx,"VACCINATION_SCHEDULE_EDIT","VaccinationSchedule",scheduleId,changes);
        return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),targetCount,remaining.intValue());
    }

    private boolean isOpen(ScheduledDose d){return "PLANNED".equalsIgnoreCase(d.getStatus())||"DEFERRED".equalsIgnoreCase(d.getStatus());}

    public CareDtos.VaccinationScheduleResult stopSchedule(Long farmId,Long scheduleId,String key,Integer expectedVersion,String reason){
        Map<String,Object> fingerprint=new java.util.HashMap<>();fingerprint.put("scheduleId",scheduleId);fingerprint.put("expectedVersion",expectedVersion);fingerprint.put("reason",reason);
        return idempotency.execute(farmId,FarmAction.MANAGE_HEALTH,"VACCINATION_SCHEDULE_STOP",key,fingerprint,
            CareDtos.VaccinationScheduleResult.class,()->stopScheduleInCommand(farmId,scheduleId,expectedVersion,reason));
    }
    @Transactional
    CareDtos.VaccinationScheduleResult stopScheduleInCommand(Long farmId,Long scheduleId,Integer expectedVersion,String reason){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_HEALTH);
        VaccinationSchedule s=em.createQuery("select s from VaccinationSchedule s where s.id=:id and s.farm.id=:farm",VaccinationSchedule.class).setParameter("id",scheduleId).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"scheduleId",scheduleId));
        VersionGuard.requireExpected(s.getVersion(),expectedVersion);if("STOPPED".equalsIgnoreCase(s.getStatus()))return new CareDtos.VaccinationScheduleResult(s.getId(),s.getScheduleName(),s.getStatus(),s.getVersion(),0,0);
        // R-09-06 / SCR-32 #11: a stop always records its reason (≤ 500, Q1).
        String why=trim(reason);if(why==null)throw DomainException.required("reason");if(why.length()>500)throw DomainException.invalid("reason");
        s.setStatus("STOPPED");s.setStopReason(why);List<ScheduledDose> ds=em.createQuery("select d from ScheduledDose d where d.schedule.id=:id and d.status in ('PLANNED','DEFERRED')",ScheduledDose.class).setParameter("id",scheduleId).getResultList();for(ScheduledDose d:ds)d.setStatus("CANCELLED");em.flush();
        Long targets=em.createQuery("select count(distinct d.cattle.id) from ScheduledDose d where d.schedule.id=:id",Long.class).setParameter("id",scheduleId).getSingleResult();audit.log(ctx,"VACCINATION_SCHEDULE_STOP","VaccinationSchedule",scheduleId,Map.of("cancelledDoses",ds.size(),"reason",why));
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
        CareDtos.ScheduleTarget target = new CareDtos.ScheduleTarget(req.penIds(), req.herdGroups(), req.lifeStages(), req.cattleIds(), req.excludedCattleIds());
        List<Long> cattleIds = resolveTargets(farmId, start, target);
        if (cattleIds.isEmpty()) throw DomainException.invalid("targetCattle");
        List<Cattle> targets = new ArrayList<>();
        for (Long cattleId : cattleIds) targets.add(cattleGuard.lockWritable(farmId, cattleId));
        VaccinationSchedule schedule = new VaccinationSchedule();
        schedule.setScheduleName(name); schedule.setVaccine(vaccine); schedule.setFirstDueDate(start); schedule.setDoseCount(count);
        schedule.setIntervalDays(interval); schedule.setBoosterIntervalMonths(req.boosterIntervalMonths()); schedule.setTargetGroup(targetDescription(target)); schedule.setTargetCriteria(JsonSupport.toJson(target));
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

    private List<Long> resolveTargets(Long farmId, LocalDate start, CareDtos.ScheduleTarget request) {
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

    /** GAP-FE09-01: the stored target with pen / cattle display codes; null for schedules saved before the target was kept. */
    @SuppressWarnings("unchecked")
    private CareDtos.ScheduleTargetView targetView(Long farmId, String json) {
        if (json == null || json.isBlank()) return null;
        Map<String, Object> raw = JsonSupport.fromJson(json, Map.class);
        List<Long> penIds = ids(raw.get("penIds")), cattleIds = ids(raw.get("cattleIds")), excluded = ids(raw.get("excludedCattleIds"));
        return new CareDtos.ScheduleTargetView(penIds, codes("select p.id, p.code from Pen p where p.farm.id=:farm and p.id in :ids", farmId, penIds),
            strings(raw.get("herdGroups")), strings(raw.get("lifeStages")),
            cattleIds, codes("select c.id, c.displayCode from Cattle c where c.farm.id=:farm and c.id in :ids", farmId, cattleIds),
            excluded, codes("select c.id, c.displayCode from Cattle c where c.farm.id=:farm and c.id in :ids", farmId, excluded));
    }
    private List<Long> ids(Object value) {
        return value instanceof List<?> list ? list.stream().filter(java.util.Objects::nonNull).map(v -> ((Number) v).longValue()).toList() : List.of();
    }
    private List<String> strings(Object value) {
        return value instanceof List<?> list ? list.stream().filter(java.util.Objects::nonNull).map(Object::toString).toList() : List.of();
    }
    /** Codes in the order of the ids; an id no longer in the farm is left out. */
    private List<String> codes(String query, Long farmId, List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        Map<Long, String> byId = new java.util.HashMap<>();
        em.createQuery(query, Object[].class).setParameter("farm", farmId).setParameter("ids", ids).getResultList().forEach(r -> byId.put((Long) r[0], (String) r[1]));
        return ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
    }

    private List<String> normalizeFilters(List<String> values, java.util.Set<String> allowed, String field) {
        if (values == null) return List.of();
        List<String> result = values.stream().filter(java.util.Objects::nonNull).map(this::upper).distinct().toList();
        if (result.stream().anyMatch(v -> !allowed.contains(v))) throw DomainException.invalid(field);
        return result;
    }

    private String targetDescription(CareDtos.ScheduleTarget request) {
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
            // GAP-FE09-04 / TC-09-27: the withdrawal period can be corrected (0-365); the end date is always recalculated.
            if (req.withdrawalDays() != null) {
                if (req.withdrawalDays() < 0 || req.withdrawalDays() > 365) throw DomainException.invalid("withdrawalDays");
                record.setWithdrawalDays(req.withdrawalDays());
            }
            int days = record.getWithdrawalDays() == null ? 0 : record.getWithdrawalDays();
            record.setWithdrawalEndDate(days > 0 ? record.getVaccinationDate().plusDays(days) : null);
        } else {
            // R-09-08: a HISTORICAL record never carries a withdrawal period.
            if (req.withdrawalDays() != null && req.withdrawalDays() != 0) throw DomainException.invalid("withdrawalDays");
            if (req.vaccinationDate() != null) { clock.assertNotFuture(req.vaccinationDate()); record.setVaccinationDate(req.vaccinationDate()); }
        }
        record.setCorrected(Boolean.TRUE); em.flush();
        revisions.record(ctx, "Vaccination", vaccinationId, RecordRevisionService.CORRECT, req.reason(), before, vaccinationSnapshot(record));
        audit.log(ctx, "VACCINATION_CORRECT", "Vaccination", vaccinationId, Map.of("cattleId", cattle.getId()));
        return result(record, cattle);
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
        return result(record, cattle);
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
        List<CareDtos.SkippedAnimal> skipped = new ArrayList<>();
        java.util.Set<Long> skippedIds = new java.util.HashSet<>();
        for (Long id : ids) {
            Cattle cattle = cattleGuard.lockCattle(farmId, id);
            // R-09-10 / TC-09-17: an animal that left the herd meanwhile is skipped (MSG-COM-13); the batch goes on.
            if (cattle.getHerdStatus() == HerdStatus.EXITED) { skipped.add(new CareDtos.SkippedAnimal(id, cattle.getDisplayCode(), MessageCodes.COM_13, null)); skippedIds.add(id); continue; }
            cattleGuard.assertWritable(cattle);
            cattleById.put(id, cattle);
        }
        int vaccinated = 0; int deferred = 0; List<Long> vaccinationIds = new ArrayList<>();
        for (CareDtos.VaccinationAnimal item : animals) {
            if (skippedIds.contains(item.cattleId())) continue;
            Cattle cattle = cattleById.get(item.cattleId());
            String decision = upper(item.decision());
            if (decision.equals("DEFER")) {
                if (item.scheduledDoseId() == null) throw DomainException.required("scheduledDoseId");
                ScheduledDose scheduled = doseForFarm(farmId, item.scheduledDoseId());
                if (!scheduled.getCattle().getId().equals(cattle.getId())) throw DomainException.invalid("scheduledDoseId");
                if (alreadyGiven(scheduled, cattle, skipped)) continue;
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
                if (alreadyGiven(scheduled, cattle, skipped)) continue;
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
        // A batch with only deferrals or skipped animals creates no vaccination: the audit row then points at the first animal.
        audit.log(ctx, "VACCINATION_RECORD_BATCH", vaccinationIds.isEmpty() ? "Cattle" : "Vaccination", vaccinationIds.isEmpty() ? ids.get(0) : vaccinationIds.get(0),
            Map.of("vaccinatedCount", vaccinated, "deferredCount", deferred, "source", source, "skippedCount", skipped.size()));
        return new CareDtos.VaccinationBatchResult(vaccinated, deferred, List.copyOf(vaccinationIds), List.copyOf(skipped));
    }

    /** R-09-10 / TC-09-17: a dose already given (by another batch meanwhile) skips this animal with MSG-FE09-09. */
    private boolean alreadyGiven(ScheduledDose scheduled, Cattle cattle, List<CareDtos.SkippedAnimal> skipped) {
        if (!"DONE".equalsIgnoreCase(scheduled.getStatus())) return false;
        skipped.add(new CareDtos.SkippedAnimal(cattle.getId(), cattle.getDisplayCode(), MessageCodes.FE09_09, scheduled.getDoseNo()));
        return true;
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
        em.flush(); // the answer carries the new version, so the next action on this dose is not refused as stale
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
        Map<String, Object> snapshot = new java.util.LinkedHashMap<>();
        snapshot.put("status", record.getStatus()); snapshot.put("vaccineId", record.getVaccine().getId());
        snapshot.put("vaccineName", record.getVaccineNameSnapshot() == null ? "" : record.getVaccineNameSnapshot());
        snapshot.put("vaccinationDate", record.getVaccinationDate()); snapshot.put("administeredAt", record.getAdministeredAt());
        snapshot.put("batchNo", record.getBatchNo() == null ? "" : record.getBatchNo()); snapshot.put("dose", record.getDose());
        snapshot.put("route", record.getRoute() == null ? "" : record.getRoute()); snapshot.put("vaccinator", record.getVaccinator());
        // TC-09-27: the revision keeps the withdrawal period as well as its end date.
        snapshot.put("withdrawalDays", record.getWithdrawalDays());
        snapshot.put("withdrawalEndDate", record.getWithdrawalEndDate() == null ? "" : record.getWithdrawalEndDate());
        return snapshot;
    }
    private CareDtos.VaccinationResult result(Vaccination record, Cattle cattle) {
        em.flush();
        Object cattleWithdrawal = cattleState.state(cattle).get("withdrawalEndDate");
        return new CareDtos.VaccinationResult(record.getId(), record.getStatus(), record.getVersion(), record.getWithdrawalEndDate(), record.getCorrected(),
            record.getWithdrawalDays(), cattleWithdrawal instanceof LocalDate date ? date : null);
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
        // BR-D14: a posted herd-entry line is VALID (EntryLineStatus); there is no POSTED line status.
        LocalDate entry=em.createQuery("select e.entryDate from HerdEntry e where e.cattle.id=:cattle and e.voucher.farm.id=:farm and e.status=:valid order by e.id",LocalDate.class)
            .setParameter("cattle",cattle.getId()).setParameter("farm",farmId).setParameter("valid",vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus.VALID)
            .setMaxResults(1).getResultStream().findFirst().orElse(null);
        if(entry!=null&&date.isBefore(entry))throw DomainException.unprocessable(MessageCodes.COM_15,"entryDate",entry);
    }
}
