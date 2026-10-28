package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

/** Tenant-scoped read projection for the farm reminder screen; reading never changes reminder lifecycle. */
@Service
public class FarmReminderQueryService {
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
        FarmContext context=access.require(farmId,FarmAction.VIEW_CATTLE);FarmRole role=context.role();Instant now=clock.now();List<ReminderView> result=new ArrayList<>();
        for(Reminder reminder:reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farmId)){
            if("REM-01".equals(reminder.getRuleType())||"REM-13".equals(reminder.getRuleType()))continue;
            if(!isActive(reminder.getStatus())||!allowed(reminder.getRuleType(),role))continue;
            boolean highlighted=SetRules.HIGHLIGHT_AFTER_THREE_DAYS.contains(reminder.getRuleType())&&reminder.getDueTime().plus(3,ChronoUnit.DAYS).isBefore(now);
            String urgency=reminder.getDueTime().isBefore(now)?"OVERDUE":"UPCOMING";
            result.add(new ReminderView(reminder.getId(),reminder.getRuleType(),reminder.getSourceRecord(),reminder.getCattle()==null?null:reminder.getCattle().getId(),reminder.getDueTime(),reminder.getStatus(),urgency,highlighted));
        }
        // Feed reminders are projected from current stock/rations, so their open/resolve state cannot go stale.
        feedManagement.feedReminders(farmId).forEach(r->{
            boolean alreadyStored=result.stream().anyMatch(saved->{
                if(!saved.ruleType().equals(r.ruleType()))return false;
                String source=saved.sourceRecord();
                if("REM-10".equals(r.ruleType()))return source.equals("FEED_ITEM:"+r.sourceId());
                return source.startsWith("PEN_SESSION:PEN:"+r.penId()+":RATION:"+r.sourceId()+":DAY:");
            });
            if(!alreadyStored)result.add(new ReminderView(null,r.ruleType(),"FEED:"+r.sourceId(),null,r.dueTime(),r.status(),r.dueTime().isBefore(now)?"OVERDUE":"UPCOMING",false));
        });
        addWeighingDue(context.farm().getId(),context.farm().getTimeZone(),result,now);
        addFinishingWeight(context.farm().getId(),context.farm().getTimeZone(),role,result,now);
        return result.stream().sorted(java.util.Comparator.comparing(ReminderView::dueTime).thenComparing(ReminderView::ruleType)).toList();
    }

    private boolean isActive(String status){return "OPEN".equalsIgnoreCase(status)||"ACTIVE".equalsIgnoreCase(status);}
    private boolean allowed(String type,FarmRole role){
        if("REM-09".equals(type)||"REM-12".equals(type)||"REM-13".equals(type))return role==FarmRole.OWNER||role==FarmRole.MANAGER;
        if("REM-10".equals(type))return role==FarmRole.OWNER||role==FarmRole.MANAGER;
        if("REM-11".equals(type))return role==FarmRole.MANAGER||role==FarmRole.TECHNICIAN;
        return true;
    }
    private void addWeighingDue(Long farmId,String timezone,List<ReminderView> result,Instant now){
        ZoneId zone=zone(timezone);LocalDate today=now.atZone(zone).toLocalDate();Map<String,Object> params=parameters(farmId,today);Object intervalValue=params.get("WEIGHING_INTERVAL_DAYS");if(!(intervalValue instanceof Number n))return;int days=n.intValue();
        List<vn.edu.fpt.beefcare.domain.Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE order by c.id",vn.edu.fpt.beefcare.domain.Cattle.class).setParameter("farm",farmId).getResultList();
        for(var c:cattle){if(result.stream().anyMatch(saved->"REM-01".equals(saved.ruleType())&&Objects.equals(saved.cattleId(),c.getId())))continue;LocalDate latest=em.createQuery("select max(g.checkDate) from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null",LocalDate.class).setParameter("id",c.getId()).getSingleResult();if(latest==null)latest=em.createQuery("select min(e.entryDate) from HerdEntry e where e.cattle.id=:id and e.status=:valid",LocalDate.class).setParameter("id",c.getId()).setParameter("valid",vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus.VALID).getSingleResult();if(latest==null)continue;LocalDate due=latest.plusDays(days);if(!due.isAfter(today))result.add(new ReminderView(null,"REM-01","CATTLE:"+c.getId(),c.getId(),due.atStartOfDay(zone).toInstant(),"ACTIVE","OVERDUE",false));}
    }
    private void addFinishingWeight(Long farmId,String timezone,FarmRole role,List<ReminderView> result,Instant now){if(role!=FarmRole.OWNER&&role!=FarmRole.MANAGER)return;ZoneId zone=zone(timezone);LocalDate today=now.atZone(zone).toLocalDate();Object targetValue=parameters(farmId,today).get("TARGET_FINISHING_WEIGHT_KG");if(!(targetValue instanceof Number n))return;BigDecimal target=new BigDecimal(n.toString());List<vn.edu.fpt.beefcare.domain.Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE and c.purpose.purposeType=vn.edu.fpt.beefcare.domain.enumeration.PurposeType.FATTENING",vn.edu.fpt.beefcare.domain.Cattle.class).setParameter("farm",farmId).getResultList();for(var c:cattle){if(result.stream().anyMatch(saved->"REM-13".equals(saved.ruleType())&&Objects.equals(saved.cattleId(),c.getId())))continue;List<Object[]> latest=em.createQuery("select g.checkDate,g.weightKg from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null order by g.checkDate desc,g.id desc",Object[].class).setParameter("id",c.getId()).setMaxResults(1).getResultList();if(latest.isEmpty())continue;LocalDate date=(LocalDate)latest.get(0)[0];BigDecimal weight=(BigDecimal)latest.get(0)[1];if(weight.compareTo(target)>=0)result.add(new ReminderView(null,"REM-13","CATTLE:"+c.getId(),c.getId(),date.atStartOfDay(zone).toInstant(),"ACTIVE","DUE",false));}}
    private Map<String,Object> parameters(Long farmId,LocalDate date){List<vn.edu.fpt.beefcare.domain.FarmParameterVersion> rows=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",vn.edu.fpt.beefcare.domain.FarmParameterVersion.class).setParameter("farm",farmId).setParameter("date",date).setMaxResults(1).getResultList();if(rows.isEmpty())return Map.of();try{return json.readValue(rows.get(0).getParameterValues(),new TypeReference<>(){});}catch(Exception ignored){return Map.of();}}
    private ZoneId zone(String raw){try{return ZoneId.of(raw);}catch(Exception ignored){return clock.zone();}}
    public record ReminderView(Long id,String ruleType,String sourceRecord,Long cattleId,Instant dueTime,String lifecycleStatus,String urgency,boolean highlighted){}
    private static final class SetRules {private static final java.util.Set<String> HIGHLIGHT_AFTER_THREE_DAYS=java.util.Set.of("REM-09","REM-12");}
}
