package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;

/** JOB-01 reconciliation. It creates only advisory records; it never performs cattle/clinical actions. */
@Service
class ReminderReconciliationService {
    private static final Set<String> RULES = Set.of("REM-01","REM-02","REM-03","REM-04","REM-05","REM-06","REM-07","REM-08","REM-09","REM-10","REM-11","REM-12","REM-13");
    private final EntityManager em;
    private final ReminderRepository reminders;
    private final PenAssignmentRepository assignments;
    private final ReceptionCriteriaService reception;
    private final FarmClock clock;
    private final ObjectMapper json;

    ReminderReconciliationService(EntityManager em,ReminderRepository reminders,
        PenAssignmentRepository assignments,ReceptionCriteriaService reception,FarmClock clock,ObjectMapper json){
        this.em=em;this.reminders=reminders;this.assignments=assignments;this.reception=reception;this.clock=clock;this.json=json;
    }

    @Transactional(readOnly=true)
    public List<Long> farmIds(){return em.createQuery("select f.id from Farm f order by f.id",Long.class).getResultList();}

    @Transactional
    public void reconcileFarm(Long farmId){
        Farm farm=em.find(Farm.class,farmId);if(farm==null)return;ZoneId zone=zone(farm.getTimeZone());Instant now=clock.now();LocalDate today=now.atZone(zone).toLocalDate();
        List<Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=:active order by c.id",Cattle.class).setParameter("farm",farmId).setParameter("active",HerdStatus.ACTIVE).getResultList();
        Map<String,Desired> desired=new LinkedHashMap<>();Set<String> completed=new HashSet<>(),superseded=new HashSet<>();
        ParameterSnapshot params=parameters(farmId,today);
        weighing(cattle,params,zone,desired);
        reproduction(farmId,cattle,params,zone,now,desired,completed,superseded);
        preserveEntryPregnancyReminders(farmId,zone,desired,completed);
        pregnancyAndDoseRules(farmId,cattle,params,zone,desired,completed);
        stageAndPenSuggestions(farmId,cattle,params,zone,today,desired,completed);
        draftCalves(farmId,zone,desired,completed);
        feedRules(farmId,zone,desired);
        deathVouchers(farmId,zone,desired,completed);
        finishing(farmId,params,zone,desired);
        for(Desired candidate:desired.values())upsert(farm,candidate);
        for(Reminder current:reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farmId)){
            if(!RULES.contains(current.getRuleType())||!active(current.getStatus()))continue;
            String key=current.getRuleKey();if(desired.containsKey(key))continue;
            current.setStatus(completed.contains(key)||resolvedBySource(current,zone,today)?"RESOLVED":superseded.contains(key)?"SUPERSEDED":"CANCELLED");
        }
    }

    private void weighing(List<Cattle> cattle,ParameterSnapshot params,ZoneId zone,Map<String,Desired> desired){
        Integer interval=integer(params.values().get("WEIGHING_INTERVAL_DAYS"));if(interval==null)return;
        for(Cattle c:cattle){List<Object[]> latest=em.createQuery("select g.id,g.checkDate from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null order by g.checkDate desc,g.id desc",Object[].class).setParameter("id",c.getId()).setMaxResults(1).getResultList();String source;LocalDate base;
            if(latest.isEmpty()){List<Object[]> entry=em.createQuery("select e.id,e.entryDate from HerdEntry e where e.cattle.id=:id and e.status=:valid order by e.entryDate,e.id",Object[].class).setParameter("id",c.getId()).setParameter("valid",EntryLineStatus.VALID).setMaxResults(1).getResultList();if(entry.isEmpty())continue;source="ENTRY:"+entry.get(0)[0];base=(LocalDate)entry.get(0)[1];}
            else{source="WEIGHT:"+latest.get(0)[0];base=(LocalDate)latest.get(0)[1];}
            String src="CATTLE:"+c.getId()+":"+source+":P"+params.id();put(desired,params.farmId(),"REM-01","CATTLE",src,c,base.plusDays(interval).atStartOfDay(zone).toInstant(),params.json());
        }
    }

    private void reproduction(Long farm,List<Cattle> cattle,ParameterSnapshot params,ZoneId zone,Instant now,Map<String,Desired> desired,Set<String> completed,Set<String> superseded){
        List<ReproductionEvent> events=em.createQuery("select e from ReproductionEvent e where e.cattle.farm.id=:farm and upper(e.status) in ('VALID','CORRECTED')",ReproductionEvent.class).setParameter("farm",farm).getResultList();
        for(ReproductionEvent e:events){Cattle c=e.getCattle();if(c.getHerdStatus()!=HerdStatus.ACTIVE)continue;String type=e.getType().toUpperCase(Locale.ROOT);String source="REPRODUCTION_EVENT:"+e.getId();
            if("ESTRUS".equals(type)&&c.getSex()==Sex.FEMALE){Integer start=integer(params.values().get("BREEDING_WINDOW_START_HOURS")),end=integer(params.values().get("BREEDING_WINDOW_END_HOURS"));if(start==null||end==null)continue;Instant from=e.getEventTime().plus(start,ChronoUnit.HOURS),until=e.getEventTime().plus(end,ChronoUnit.HOURS);boolean pregnant=em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id=:c and upper(p.status)='OPEN'",Long.class).setParameter("c",c.getId()).getSingleResult()>0;boolean bred=em.createQuery("select count(x) from ReproductionEvent x where x.cattle.id=:c and upper(x.type)='BREEDING' and upper(x.status) in ('VALID','CORRECTED') and x.eventTime>=:time",Long.class).setParameter("c",c.getId()).setParameter("time",e.getEventTime()).getSingleResult()>0;boolean newer=em.createQuery("select count(x) from ReproductionEvent x where x.cattle.id=:c and upper(x.type)='ESTRUS' and upper(x.status) in ('VALID','CORRECTED') and x.eventTime>:time",Long.class).setParameter("c",c.getId()).setParameter("time",e.getEventTime()).getSingleResult()>0;String key=key(farm,"REM-02","REPRODUCTION_EVENT",source);if(bred)completed.add(key);else if(newer)superseded.add(key);else if(!pregnant&&!now.isAfter(until))put(desired,farm,"REM-02","REPRODUCTION_EVENT",source,c,from,params.json());}
            if("BREEDING".equals(type)){Integer checkDays=integer(params.values().get("PREGNANCY_CHECK_DAYS"));if(checkDays==null)continue;boolean checked=hasLaterCheck(c.getId(),e.getEventTime());boolean newer=em.createQuery("select count(x) from ReproductionEvent x where x.cattle.id=:c and upper(x.type)='BREEDING' and upper(x.status) in ('VALID','CORRECTED') and x.eventTime>:time",Long.class).setParameter("c",c.getId()).setParameter("time",e.getEventTime()).getSingleResult()>0;String key=key(farm,"REM-03","REPRODUCTION_EVENT",source);if(checked)completed.add(key);else if(newer)superseded.add(key);else put(desired,farm,"REM-03","REPRODUCTION_EVENT",source,c,e.getEventTime().plus(checkDays,ChronoUnit.DAYS),params.json());}
            if("PREGNANCY_CHECK".equals(type)&&"INCONCLUSIVE".equalsIgnoreCase(e.getResult())){Integer recheckDays=integer(params.values().get("PREGNANCY_RECHECK_DAYS"));if(recheckDays==null)continue;boolean checked=hasLaterCheck(c.getId(),e.getEventTime());String key=key(farm,"REM-04","REPRODUCTION_EVENT",source);if(checked)completed.add(key);else put(desired,farm,"REM-04","REPRODUCTION_EVENT",source,c,e.getEventTime().plus(recheckDays,ChronoUnit.DAYS),params.json());}
        }
        List<CalvingEvent> calvings=em.createQuery("select c from CalvingEvent c where c.dam.farm.id=:farm and upper(c.status) in ('VALID','CORRECTED')",CalvingEvent.class).setParameter("farm",farm).getResultList();
        for(CalvingEvent calving:calvings){Cattle dam=calving.getDam();if(dam.getSex()!=Sex.FEMALE||dam.getHerdStatus()!=HerdStatus.ACTIVE)continue;String source="CALVING:"+calving.getId();boolean bred=events.stream().anyMatch(e->e.getCattle().getId().equals(dam.getId())&&Set.of("ESTRUS","BREEDING").contains(e.getType().toUpperCase(Locale.ROOT))&&e.getEventTime().isAfter(calving.getBirthTime()));String key=key(farm,"REM-07","CALVING",source);if(bred)completed.add(key);else put(desired,farm,"REM-07","CALVING",source,dam,calving.getBirthTime().plus(45,ChronoUnit.DAYS),null);}
        // A newer estrus supersedes older windows; expired windows are cancelled by the stale pass.
    }

    private void pregnancyAndDoseRules(Long farm,List<Cattle> cattle,ParameterSnapshot params,ZoneId zone,Map<String,Desired> desired,Set<String> completed){
        List<PregnancyEpisode> episodes=em.createQuery("select p from PregnancyEpisode p where p.cattle.farm.id=:farm",PregnancyEpisode.class).setParameter("farm",farm).getResultList();
        for(PregnancyEpisode p:episodes){String source="PREGNANCY_EPISODE:"+p.getId();String key=key(farm,"REM-05","PREGNANCY_EPISODE",source);if("CALVED".equalsIgnoreCase(p.getStatus())){completed.add(key);continue;}if(!"OPEN".equalsIgnoreCase(p.getStatus()))continue;if(p.getExpectedCalvingDate()==null)continue;Integer lead=integer(params.values().get("CALVING_LEAD_DAYS"));if(lead==null)continue;Instant due=p.getExpectedCalvingDate().minusDays(lead).atStartOfDay(zone).toInstant();put(desired,farm,"REM-05","PREGNANCY_EPISODE",source,p.getCattle(),due,params.json());}
        List<ScheduledDose> doses=em.createQuery("select d from ScheduledDose d where d.cattle.farm.id=:farm",ScheduledDose.class).setParameter("farm",farm).getResultList();
        for(ScheduledDose d:doses){String src="SCHEDULED_DOSE:"+d.getId();String key=key(farm,"REM-06","SCHEDULED_DOSE",src);String state=Objects.toString(d.getStatus(),"").toUpperCase(Locale.ROOT);LocalDate date="DEFERRED".equals(state)&&d.getNewExpectedDate()!=null?d.getNewExpectedDate():d.getDueDate();if(d.getCattle().getHerdStatus()!=HerdStatus.ACTIVE||!"ACTIVE".equalsIgnoreCase(d.getSchedule().getStatus())||Set.of("CANCELLED","DONE","COMPLETED").contains(state))continue;if(d.getVaccination()!=null&&"VALID".equalsIgnoreCase(d.getVaccination().getStatus())){completed.add(key);continue;}Integer lead=integer(params.values().get("VACCINATION_LEAD_DAYS"));if(lead!=null&&Set.of("PLANNED","DEFERRED").contains(state))put(desired,farm,"REM-06","SCHEDULED_DOSE",src,d.getCattle(),date.minusDays(lead).atStartOfDay(zone).toInstant(),params.json());}
    }

    private void stageAndPenSuggestions(Long farm,List<Cattle> cattle,ParameterSnapshot params,ZoneId zone,LocalDate today,Map<String,Desired> desired,Set<String> completed){
        for(Cattle c:cattle){LocalDate birth=c.getBirthDate();if(birth!=null&&c.getBirthDateAccuracy()!=BirthDateAccuracy.UNKNOWN){LocalDate stageDate=null;String reason=null;String ageKey=null;
                if(c.getLifeStage()==LifeStage.UNWEANED_CALF){ageKey="WEANING_AGE_MONTHS";reason="STAGE:WEANED_CALF";}
                else if(c.getLifeStage()==LifeStage.WEANED_CALF){ageKey="YOUNG_STOCK_AGE_MONTHS";reason="STAGE:YOUNG_STOCK";}
                else if(c.getLifeStage()==LifeStage.YOUNG_STOCK){ageKey="ADULT_AGE_MONTHS";reason="STAGE:ADULT";}
                Integer months=ageKey==null?null:integer(params.values().get(ageKey));
                if(reason!=null&&months!=null){stageDate=birth.plusMonths(months);put(desired,farm,"REM-08","CATTLE",reason+":"+c.getId()+":P"+params.id(),c,stageDate.atStartOfDay(zone).toInstant(),params.json());}
            }
            if(c.getSex()==Sex.FEMALE&&c.getLifeStage()!=LifeStage.ADULT){Instant firstCalving=em.createQuery("select min(v.birthTime) from CalvingEvent v where v.dam.id=:id and upper(v.status) in ('VALID','CORRECTED')",Instant.class).setParameter("id",c.getId()).getSingleResult();if(firstCalving!=null)put(desired,farm,"REM-08","CATTLE","STAGE:ADULT_AFTER_FIRST_CALVING:"+c.getId(),c,firstCalving,null);}
            PenAssignment current=assignments.findFirstByCattleIdAndToDateIsNull(c.getId()).orElse(null);if(current!=null){ReceptionCriteriaService.ReceptionCheck check=reception.check(current.getPen(),c,today);if(!check.allMet()){String source="PEN_CRITERIA:"+current.getPen().getId()+":"+current.getId();put(desired,farm,"REM-08","CATTLE",source+":"+c.getId(),c,clock.now(),"{\"penCriteriaVersionId\":"+Objects.toString(check.criteriaVersionId(),"null")+"}");}}
        }
        for(Reminder old:reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farm))if("REM-08".equals(old.getRuleType())&&active(old.getStatus())&&old.getCattle()!=null&&cattle.stream().anyMatch(c->c.getId().equals(old.getCattle().getId()))&&!desired.containsKey(old.getRuleKey()))completed.add(old.getRuleKey());
    }

    private void draftCalves(Long farm,ZoneId zone,Map<String,Desired> desired,Set<String> completed){
        List<CalfOutcome> calves=em.createQuery("select o from CalfOutcome o where o.calving.dam.farm.id=:farm",CalfOutcome.class).setParameter("farm",farm).getResultList();
        for(CalfOutcome calf:calves){String source="CALF_OUTCOME:"+calf.getId();String key=key(farm,"REM-09","CALF_OUTCOME",source);if(!"PENDING_CONFIRMATION".equalsIgnoreCase(calf.getRegistrationState())){completed.add(key);continue;}put(desired,farm,"REM-09","CALF_OUTCOME",source,calf.getCalving().getDam(),clock.now(),null);}
    }

    private void feedRules(Long farm,ZoneId zone,Map<String,Desired> desired){
        List<FeedItem> feeds=em.createQuery("select f from FeedItem f where f.farm.id=:farm and f.available=true and f.minimumStockKg is not null",FeedItem.class).setParameter("farm",farm).getResultList();
        for(FeedItem feed:feeds)if(feed.getOnHandKg().compareTo(feed.getMinimumStockKg())<=0){String source="FEED_ITEM:"+feed.getId();put(desired,farm,"REM-10","FEED_ITEM",source,null,clock.now(),null);}
        List<Pen> pens=em.createQuery("select p from Pen p where p.farm.id=:farm and p.status=:active order by p.id",Pen.class).setParameter("farm",farm).setParameter("active",ActiveStatus.ACTIVE).getResultList();LocalDate today=clock.now().atZone(zone).toLocalDate();
        for(Pen pen:pens){if(assignments.countAssignedAt(pen.getId(),today)==0)continue;List<FeedRationVersion> rations=em.createQuery("select r from FeedRationPen rp join rp.rationVersion r where rp.pen.id=:pen and r.farm.id=:farm and r.effectiveFrom<=:day and (r.effectiveTo is null or r.effectiveTo>=:day) order by r.effectiveFrom desc,r.versionNo desc",FeedRationVersion.class).setParameter("pen",pen.getId()).setParameter("farm",farm).setParameter("day",today).setMaxResults(1).getResultList();if(rations.isEmpty())continue;FeedRationVersion ration=rations.get(0);String[] times=ration.getSessionTimes().split(",");
            for(int i=0;i<Math.min(times.length,ration.getSessionsPerDay());i++){Instant due=today.atTime(java.time.LocalTime.parse(times[i])).plusHours(2).atZone(zone).toInstant();if(due.isAfter(clock.now()))continue;if(em.createQuery("select count(f) from FeedingRecord f where f.farm.id=:farm and f.pen.id=:pen and f.feedingDate=:day and f.sessionNo=:no and f.status='VALID'",Long.class).setParameter("farm",farm).setParameter("pen",pen.getId()).setParameter("day",today).setParameter("no",i+1).getSingleResult()>0)continue;String source="PEN:"+pen.getId()+":RATION:"+ration.getId()+":DAY:"+today+":SESSION:"+(i+1);put(desired,farm,"REM-11","PEN_SESSION",source,null,due,null);}
        }
    }

    private void deathVouchers(Long farm,ZoneId zone,Map<String,Desired> desired,Set<String> completed){
        List<HerdExitVoucher> vouchers=em.createQuery("select v from HerdExitVoucher v where v.farm.id=:farm and v.exitType=:type",HerdExitVoucher.class).setParameter("farm",farm).setParameter("type",ExitType.DEATH).getResultList();
        for(HerdExitVoucher v:vouchers){String source="HerdExitVoucher:"+v.getId();String key=key(farm,"REM-12","HerdExitVoucher",source);String status=v.getStatus().name();if("PENDING".equals(status)){Cattle animal=em.createQuery("select e.cattle from HerdExit e where e.voucher.id=:id order by e.id",Cattle.class).setParameter("id",v.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);put(desired,farm,"REM-12","HerdExitVoucher",source,animal,v.getCreatedAt()==null?clock.now():v.getCreatedAt(),null);}else if("CONFIRMED".equals(status)||"DISMISSED".equals(status))completed.add(key);}
    }

    private void finishing(Long farm,ParameterSnapshot params,ZoneId zone,Map<String,Desired> desired){
        BigDecimal target=decimal(params.values().get("TARGET_FINISHING_WEIGHT_KG"));if(target==null)return;
        List<Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=:active and c.purpose.purposeType=:purpose",Cattle.class).setParameter("farm",farm).setParameter("active",HerdStatus.ACTIVE).setParameter("purpose",PurposeType.FATTENING).getResultList();
        for(Cattle c:cattle){List<Growth> weights=em.createQuery("select g from Growth g where g.cattle.id=:c and g.status in ('VALID','CORRECTED') and g.weightKg is not null order by g.checkDate desc,g.id desc",Growth.class).setParameter("c",c.getId()).setMaxResults(1).getResultList();if(weights.isEmpty())continue;Growth latest=weights.get(0);if(latest.getWeightKg().compareTo(target)>=0){String source="GROWTH:"+latest.getId()+":PARAM:"+params.id();put(desired,farm,"REM-13","CATTLE",source,c,latest.getCheckDate().atStartOfDay(zone).toInstant(),params.json());}}
    }

    private boolean hasLaterCheck(Long cattle,Instant time){return em.createQuery("select count(e) from ReproductionEvent e where e.cattle.id=:c and upper(e.type)='PREGNANCY_CHECK' and upper(e.status) in ('VALID','CORRECTED') and e.eventTime>:time",Long.class).setParameter("c",cattle).setParameter("time",time).getSingleResult()>0;}
    private boolean resolvedBySource(Reminder reminder,ZoneId zone,LocalDate today){
        if("REM-10".equals(reminder.getRuleType())&&reminder.getSourceId()!=null&&reminder.getSourceId().startsWith("FEED_ITEM:")){try{Long id=Long.valueOf(reminder.getSourceId().substring("FEED_ITEM:".length()));FeedItem feed=em.find(FeedItem.class,id);return feed!=null&&Boolean.TRUE.equals(feed.getAvailable())&&feed.getMinimumStockKg()!=null&&feed.getOnHandKg().compareTo(feed.getMinimumStockKg())>0;}catch(NumberFormatException ignored){return false;}}
        if("REM-11".equals(reminder.getRuleType())&&reminder.getSourceId()!=null){String[] parts=reminder.getSourceId().split(":");if(parts.length==8)try{Long pen=Long.valueOf(parts[1]);LocalDate day=LocalDate.parse(parts[5]);int session=Integer.parseInt(parts[7]);return !em.createQuery("select count(f) from FeedingRecord f where f.pen.id=:pen and f.feedingDate=:day and f.sessionNo=:no and f.status='VALID'",Long.class).setParameter("pen",pen).setParameter("day",day).setParameter("no",session).getSingleResult().equals(0L);}catch(RuntimeException ignored){return false;}}
        return false;
    }
    private void preserveEntryPregnancyReminders(Long farm,ZoneId zone,Map<String,Desired> desired,Set<String> completed){
        for(Reminder reminder:reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farm)){
            if(!"REM-03".equals(reminder.getRuleType())||!"HERD_ENTRY".equalsIgnoreCase(reminder.getSourceType())||!active(reminder.getStatus()))continue;
            String raw=reminder.getSourceId();int separator=raw==null?-1:raw.lastIndexOf(':');if(separator<0)continue;Long entryId;try{entryId=Long.valueOf(raw.substring(separator+1));}catch(NumberFormatException ignored){continue;}
            HerdEntry entry=em.find(HerdEntry.class,entryId);if(entry==null||entry.getCattle()==null||entry.getStatus()!=EntryLineStatus.VALID||entry.getCattle().getHerdStatus()!=HerdStatus.ACTIVE)continue;
            String source=reminder.getSourceId();String key=key(farm,"REM-03",reminder.getSourceType(),source);
            if(hasLaterCheck(entry.getCattle().getId(),entry.getEntryDate().atStartOfDay(zone).toInstant())){completed.add(key);continue;}
            put(desired,farm,"REM-03",reminder.getSourceType(),source,entry.getCattle(),entry.getEntryDate().plusDays(7).atStartOfDay(zone).toInstant(),reminder.getParameterSnapshot());
        }
    }
    private void put(Map<String,Desired> desired,Long farm,String rule,String sourceType,String sourceId,Cattle cattle,Instant due,String snapshot){String stable=key(farm,rule,sourceType,sourceId);desired.put(stable,new Desired(stable,rule,sourceType,sourceId,cattle,due,snapshot));}
    private String key(Long farm,String rule,String sourceType,String sourceId){return farm+":"+rule+":"+sourceType+":"+sourceId;}
    private void upsert(Farm farm,Desired d){Reminder row=reminders.findByRuleKey(d.key()).orElse(null);if(row!=null){if(active(row.getStatus())){row.setDueTime(d.due());row.setParameterSnapshot(d.snapshot());}return;}row=new Reminder();row.setFarm(farm);row.setCattle(d.cattle());row.setRuleType(d.rule());row.setSourceType(d.sourceType());row.setSourceId(d.sourceId());row.setSourceRecord((d.sourceType()+":"+d.sourceId()).substring(0,Math.min(255,(d.sourceType()+":"+d.sourceId()).length())));row.setRuleKey(d.key());row.setDueTime(d.due());row.setStatus("ACTIVE");row.setParameterSnapshot(d.snapshot());reminders.save(row);}
    private ParameterSnapshot parameters(Long farm,LocalDate date){List<FarmParameterVersion> rows=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class).setParameter("farm",farm).setParameter("date",date).setMaxResults(1).getResultList();if(rows.isEmpty())return new ParameterSnapshot(farm,null,Map.of(),null);FarmParameterVersion v=rows.get(0);try{return new ParameterSnapshot(farm,v.getId(),json.readValue(v.getParameterValues(),new TypeReference<>(){}),"{\"id\":"+v.getId()+",\"versionNo\":"+v.getVersionNo()+",\"values\":"+v.getParameterValues()+"}");}catch(Exception ex){return new ParameterSnapshot(farm,v.getId(),Map.of(),null);}}
    private boolean active(String status){return "ACTIVE".equalsIgnoreCase(status)||"OPEN".equalsIgnoreCase(status);}
    private ZoneId zone(String value){try{return ZoneId.of(value);}catch(Exception ignored){return clock.zone();}}
    private Integer integer(Object value){return value instanceof Number n?n.intValue():null;}
    private int or(Map<String,Object> values,String key,int fallback){Integer value=integer(values.get(key));return value==null?fallback:value;}
    private BigDecimal decimal(Object value){return value instanceof Number n?new BigDecimal(n.toString()):null;}
    private record ParameterSnapshot(Long farmId,Long id,Map<String,Object> values,String json){}
    private record Desired(String key,String rule,String sourceType,String sourceId,Cattle cattle,Instant due,String snapshot){}
}

@Component
class ReminderReconciliationJob {
    private final ReminderReconciliationService service;
    ReminderReconciliationJob(ReminderReconciliationService service){this.service=service;}
    @Scheduled(cron="${beefcare.jobs.reminder-reconcile-cron:0 */15 * * * *}")
    public void reconcile(){for(Long farmId:service.farmIds())service.reconcileFarm(farmId);}
}
