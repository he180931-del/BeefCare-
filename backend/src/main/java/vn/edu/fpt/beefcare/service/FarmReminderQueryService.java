package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.ZoneId;
import java.math.BigDecimal;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.ReminderRepository;

/**
 * Tenant-scoped read projection for the farm reminder screen (SCR-44); reading never changes reminder lifecycle (GBR-63).
 * Groups follow SCR-44: OVERDUE (due date passed), TODAY, UPCOMING (within 7 days, or inside the opened window of REM-05/REM-06).
 */
@Service
public class FarmReminderQueryService {
    static final int UPCOMING_DAYS=7;
    private final FarmAccessService access;
    private final ReminderRepository reminders;
    private final FeedManagementService feedManagement;
    private final FarmClock clock;
    private final EntityManager em;
    private final ObjectMapper json;

    public FarmReminderQueryService(FarmAccessService access,ReminderRepository reminders,FeedManagementService feedManagement,FarmClock clock,EntityManager em,ObjectMapper json){
        this.access=access;this.reminders=reminders;this.feedManagement=feedManagement;this.clock=clock;this.em=em;this.json=json;
    }

    @Transactional(readOnly=true)
    public List<ReminderView> mine(Long farmId){
        FarmContext context=access.require(farmId,FarmAction.VIEW_CATTLE);FarmRole role=context.role();Instant now=clock.now();
        ZoneId zone=zone(context.farm().getTimeZone());LocalDate today=now.atZone(zone).toLocalDate();List<ReminderView> result=new ArrayList<>();
        for(Reminder reminder:reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farmId)){
            if(!isActive(reminder.getStatus())||!allowed(reminder.getRuleType(),role))continue;
            Snapshot basis=snapshot(reminder.getParameterSnapshot());String urgency=urgency(reminder.getRuleType(),reminder.getDueTime(),basis,zone,today);if(urgency==null)continue;
            boolean highlighted=SetRules.HIGHLIGHT_AFTER_THREE_DAYS.contains(reminder.getRuleType())&&reminder.getDueTime().plus(3,ChronoUnit.DAYS).isBefore(now);
            String label="REM-05".equals(reminder.getRuleType())?("PREGNANCY_EPISODE".equals(reminder.getSourceType())?"CONFIRMED":"TENTATIVE"):null;
            result.add(new ReminderView(reminder.getId(),reminder.getRuleType(),reminder.getSourceRecord(),reminder.getCattle()==null?null:reminder.getCattle().getId(),reminder.getDueTime(),
                windowEnd(reminder.getRuleType(),reminder.getDueTime(),basis),reminder.getStatus(),urgency,highlighted,label,basis.versionNo()));
        }
        // Feed reminders are projected from current stock/rations, so their open/resolve state cannot go stale.
        feedManagement.feedReminders(farmId).forEach(r->{
            if(!allowed(r.ruleType(),role))return;
            boolean alreadyStored=result.stream().anyMatch(saved->{
                if(!saved.ruleType().equals(r.ruleType()))return false;
                String source=saved.sourceRecord();
                if("REM-10".equals(r.ruleType()))return source.equals("FEED_ITEM:"+r.sourceId());
                return source.startsWith("PEN_SESSION:PEN:"+r.penId()+":RATION:"+r.sourceId()+":DAY:");
            });
            String urgency=urgency(r.ruleType(),r.dueTime(),Snapshot.NONE,zone,today);
            if(!alreadyStored&&urgency!=null)result.add(new ReminderView(null,r.ruleType(),"FEED:"+r.sourceId(),null,r.dueTime(),null,r.status(),urgency,false,null,null));
        });
        // Live fallbacks between JOB-01 runs: only for cattle that have no stored reminder of the rule yet.
        addWeighingDue(farmId,zone,today,result);
        addFinishingWeight(farmId,zone,today,role,result);
        return result.stream().sorted(java.util.Comparator.comparing(ReminderView::dueTime).thenComparing(ReminderView::ruleType)).toList();
    }

    /** OVERDUE / TODAY / UPCOMING, or null when the reminder is not yet shown on SCR-44. */
    static String urgency(String rule,Instant due,Snapshot basis,ZoneId zone,LocalDate today){
        LocalDate date=due.atZone(zone).toLocalDate();
        if(date.isBefore(today))return "OVERDUE";
        if(date.isEqual(today))return "TODAY";
        Integer lead="REM-05".equals(rule)?basis.value("CALVING_LEAD_DAYS"):"REM-06".equals(rule)?basis.value("VACCINATION_LEAD_DAYS"):null;
        int days=Math.max(UPCOMING_DAYS,lead==null?0:lead); // REM-05 opens CALVING_LEAD_DAYS before the expected date (Table III-3)
        return date.isAfter(today.plusDays(days))?null:"UPCOMING";
    }
    /** REM-02 is a window: estrus + start hours to estrus + end hours; the reminder stores the start. */
    private Instant windowEnd(String rule,Instant due,Snapshot basis){
        if(!"REM-02".equals(rule))return null;Integer start=basis.value("BREEDING_WINDOW_START_HOURS"),end=basis.value("BREEDING_WINDOW_END_HOURS");
        return start==null||end==null?null:due.plus(end-start,ChronoUnit.HOURS);
    }
    private boolean isActive(String status){return "OPEN".equalsIgnoreCase(status)||"ACTIVE".equalsIgnoreCase(status);}
    private boolean allowed(String type,FarmRole role){
        if("REM-09".equals(type)||"REM-12".equals(type)||"REM-13".equals(type))return role==FarmRole.OWNER||role==FarmRole.MANAGER;
        if("REM-10".equals(type))return role==FarmRole.OWNER||role==FarmRole.MANAGER;
        if("REM-11".equals(type))return role==FarmRole.MANAGER||role==FarmRole.TECHNICIAN;
        return true;
    }
    private void addWeighingDue(Long farmId,ZoneId zone,LocalDate today,List<ReminderView> result){
        Map<String,Object> params=parameters(farmId,today);Object intervalValue=params.get("WEIGHING_INTERVAL_DAYS");if(!(intervalValue instanceof Number n))return;int days=n.intValue();
        List<vn.edu.fpt.beefcare.domain.Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE order by c.id",vn.edu.fpt.beefcare.domain.Cattle.class).setParameter("farm",farmId).getResultList();
        for(var c:cattle){if(hasStored(farmId,"REM-01",c.getId()))continue;LocalDate latest=em.createQuery("select max(g.checkDate) from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null",LocalDate.class).setParameter("id",c.getId()).getSingleResult();if(latest==null)latest=em.createQuery("select min(e.entryDate) from HerdEntry e where e.cattle.id=:id and e.status=:valid",LocalDate.class).setParameter("id",c.getId()).setParameter("valid",vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus.VALID).getSingleResult();if(latest==null)continue;Instant due=latest.plusDays(days).atStartOfDay(zone).toInstant();String urgency=urgency("REM-01",due,Snapshot.NONE,zone,today);if(urgency!=null)result.add(new ReminderView(null,"REM-01","CATTLE:"+c.getId(),c.getId(),due,null,"ACTIVE",urgency,false,null,null));}
    }
    private void addFinishingWeight(Long farmId,ZoneId zone,LocalDate today,FarmRole role,List<ReminderView> result){if(role!=FarmRole.OWNER&&role!=FarmRole.MANAGER)return;Object targetValue=parameters(farmId,today).get("TARGET_FINISHING_WEIGHT_KG");if(!(targetValue instanceof Number n))return;BigDecimal target=new BigDecimal(n.toString());List<vn.edu.fpt.beefcare.domain.Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE and c.purpose.purposeType=vn.edu.fpt.beefcare.domain.enumeration.PurposeType.FATTENING",vn.edu.fpt.beefcare.domain.Cattle.class).setParameter("farm",farmId).getResultList();for(var c:cattle){if(hasStored(farmId,"REM-13",c.getId()))continue;List<Object[]> latest=em.createQuery("select g.checkDate,g.weightKg from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null order by g.checkDate desc,g.id desc",Object[].class).setParameter("id",c.getId()).setMaxResults(1).getResultList();if(latest.isEmpty())continue;LocalDate date=(LocalDate)latest.get(0)[0];BigDecimal weight=(BigDecimal)latest.get(0)[1];if(weight.compareTo(target)>=0){Instant due=date.atStartOfDay(zone).toInstant();result.add(new ReminderView(null,"REM-13","CATTLE:"+c.getId(),c.getId(),due,null,"ACTIVE",urgency("REM-13",due,Snapshot.NONE,zone,today),false,null,null));}}}
    /** A stored reminder of any status means JOB-01 has evaluated the rule for this cattle; the live fallback must not resurrect it. */
    private boolean hasStored(Long farmId,String rule,Long cattleId){return em.createQuery("select count(r) from Reminder r where r.farm.id=:farm and r.ruleType=:rule and r.cattle.id=:c and r.status in ('ACTIVE','OPEN')",Long.class).setParameter("farm",farmId).setParameter("rule",rule).setParameter("c",cattleId).getSingleResult()>0;}
    private Map<String,Object> parameters(Long farmId,LocalDate date){List<vn.edu.fpt.beefcare.domain.FarmParameterVersion> rows=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",vn.edu.fpt.beefcare.domain.FarmParameterVersion.class).setParameter("farm",farmId).setParameter("date",date).setMaxResults(1).getResultList();if(rows.isEmpty())return Map.of();try{return json.readValue(rows.get(0).getParameterValues(),new TypeReference<>(){});}catch(Exception ignored){return Map.of();}}
    /** The parameter version stored with the reminder by JOB-01 ({"id","versionNo","values"}); SCR-44 "Basis". */
    private Snapshot snapshot(String raw){if(raw==null||raw.isBlank())return Snapshot.NONE;try{Map<String,Object> s=json.readValue(raw,new TypeReference<>(){});Object values=s.get("values");Object no=s.get("versionNo");return new Snapshot(no instanceof Number n?n.intValue():null,values instanceof Map<?,?> m?(Map<?,?>)m:Map.of());}catch(Exception ignored){return Snapshot.NONE;}}
    private ZoneId zone(String raw){try{return ZoneId.of(raw);}catch(Exception ignored){return clock.zone();}}
    /**
     * @param windowEnd end of the REM-02 breeding window; null for other rules
     * @param basisLabel REM-05 only: TENTATIVE (from a breeding) or CONFIRMED (pregnancy episode)
     * @param parameterVersion farm parameter version used, when the reminder depends on one
     */
    public record ReminderView(Long id,String ruleType,String sourceRecord,Long cattleId,Instant dueTime,Instant windowEnd,String lifecycleStatus,String urgency,boolean highlighted,String basisLabel,Integer parameterVersion){}
    record Snapshot(Integer versionNo,Map<?,?> values){
        static final Snapshot NONE=new Snapshot(null,Map.of());
        Integer value(String key){return values.get(key) instanceof Number n?n.intValue():null;}
    }
    private static final class SetRules {private static final java.util.Set<String> HIGHLIGHT_AFTER_THREE_DAYS=java.util.Set.of("REM-09","REM-12");}
}
