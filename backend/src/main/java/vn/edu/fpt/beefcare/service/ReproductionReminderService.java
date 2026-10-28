package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;

/** Maintains reproductive reminders in the same transaction as the event that creates or resolves them. */
@Service
public class ReproductionReminderService {
    @PersistenceContext private EntityManager em;
    private final FarmClock clock;
    private final ObjectMapper json;
    public ReproductionReminderService(FarmClock clock,ObjectMapper json){this.clock=clock;this.json=json;}

    @Transactional(propagation=Propagation.MANDATORY)
    public void estrusRecorded(Cattle cow,ReproductionEvent event){
        resolve(cow,"REM-07","ESTRUS_OR_BREEDING");
        if(openPregnancy(cow.getId())==null)cancel(cow,"REM-05","NEWER_ESTRUS");
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void breedingRecorded(Cattle cow,ReproductionEvent event){
        supersede(cow,"REM-03","NEWER_BREEDING");
        resolve(cow,"REM-07","BREEDING_RECORDED"); // Table III-3: REM-07 is resolved by an estrus or a breeding
        Integer checkDays=parameter(cow,"PREGNANCY_CHECK_DAYS");
        if(checkDays!=null)create(cow,"REM-03","REPRODUCTION_EVENT:"+event.getId(),clock.toFarmDate(event.getEventTime()).plusDays(checkDays));
        if(event.getTentativeExpectedCalvingDate()!=null){
            supersede(cow,"REM-05","NEWER_BREEDING");
            calvingReminder(cow,"REPRODUCTION_EVENT:"+event.getId(),event.getTentativeExpectedCalvingDate());
        }
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void pregnancyCheckRecorded(Cattle cow,ReproductionEvent event,PregnancyEpisode episode){
        resolve(cow,"REM-03","PREGNANCY_CHECK");
        resolve(cow,"REM-04","PREGNANCY_CHECK");
        if("INCONCLUSIVE".equalsIgnoreCase(event.getResult())){
            Integer recheckDays=parameter(cow,"PREGNANCY_RECHECK_DAYS");
            if(recheckDays!=null)create(cow,"REM-04","REPRODUCTION_EVENT:"+event.getId(),clock.toFarmDate(event.getEventTime()).plusDays(recheckDays));
        }else if("PREGNANT".equalsIgnoreCase(event.getResult())&&episode!=null){
            supersede(cow,"REM-05","CONFIRMED_PREGNANCY"); // the tentative date is replaced by the confirmed episode
            calvingReminder(cow,"PREGNANCY_EPISODE:"+episode.getId(),episode.getExpectedCalvingDate());
        }else if("NOT_PREGNANT".equalsIgnoreCase(event.getResult())){
            cancel(cow,"REM-05","NOT_PREGNANT");
        }
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void pregnancyLost(PregnancyEpisode episode){
        cancel(episode.getCattle(),"REM-05","PREGNANCY_LOST");
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void calvingRecorded(Cattle cow,Long calvingId,Instant birthTime){
        resolve(cow,"REM-03","CALVING_RECORDED");resolve(cow,"REM-04","CALVING_RECORDED");resolve(cow,"REM-05","CALVING_RECORDED");
        Integer readiness=parameter(cow,"POST_CALVING_DAYS");
        if(readiness!=null)create(cow,"REM-07","CALVING_EVENT:"+calvingId,clock.toFarmDate(birthTime).plusDays(readiness));
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void calvingCorrected(Cattle cow,Long calvingId,Instant birthTime){
        cancelSource(cow,"CALVING_EVENT:"+calvingId,"CALVING_CORRECTED");
        Integer readiness=parameter(cow,"POST_CALVING_DAYS");
        if(readiness!=null)create(cow,"REM-07","CALVING_EVENT:"+calvingId,clock.toFarmDate(birthTime).plusDays(readiness));
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void pregnancyLossVoided(PregnancyEpisode episode){
        calvingReminder(episode.getCattle(),"PREGNANCY_EPISODE:"+episode.getId(),episode.getExpectedCalvingDate());
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void calvingVoided(Cattle cow,Long calvingId,PregnancyEpisode episode){
        cancelSource(cow,"CALVING_EVENT:"+calvingId,"CALVING_VOIDED");
        if(episode!=null){
            if("OPEN".equalsIgnoreCase(episode.getStatus()))calvingReminder(cow,"PREGNANCY_EPISODE:"+episode.getId(),episode.getExpectedCalvingDate());
            else if("LOST".equalsIgnoreCase(episode.getStatus()))pregnancyLost(episode);
        }
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void eventVoided(Cattle cow,ReproductionEvent event){
        cancelSource(cow,"REPRODUCTION_EVENT:"+event.getId(),"REPRODUCTION_EVENT_VOIDED");
        if("BREEDING".equalsIgnoreCase(event.getType()))cancel(cow,"REM-05","BREEDING_VOIDED");
        if("PREGNANCY_CHECK".equalsIgnoreCase(event.getType()))cancel(cow,"REM-05","PREGNANCY_CHECK_VOIDED");
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void eventCorrected(Cattle cow,ReproductionEvent event,PregnancyEpisode episode){
        cancelSource(cow,"REPRODUCTION_EVENT:"+event.getId(),"REPRODUCTION_EVENT_CORRECTED");
        if("BREEDING".equalsIgnoreCase(event.getType()))breedingRecorded(cow,event);
        else if("PREGNANCY_CHECK".equalsIgnoreCase(event.getType()))pregnancyCheckRecorded(cow,event,episode);
    }

    private PregnancyEpisode openPregnancy(Long cattleId){
        return em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:id and upper(p.status)='OPEN' order by p.id desc",PregnancyEpisode.class)
            .setParameter("id",cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }
    /** REM-05 is due on the expected calving date; the lead parameter only opens its window and must exist (GBR-63). */
    private void calvingReminder(Cattle cow,String source,LocalDate expected){
        if(parameter(cow,"CALVING_LEAD_DAYS")!=null)create(cow,"REM-05",source,expected);
    }
    /** The rule key is unique per farm, rule and source: a cancelled or resolved row for the same source is reopened, never duplicated. */
    private void create(Cattle cow,String rule,String source,LocalDate date){
        if(date==null)return;
        Instant due=date.atStartOfDay(zone(cow)).toInstant();
        String key=cow.getFarm().getId()+":"+rule+":"+source.substring(0,source.indexOf(':'))+":"+source;
        Reminder existing=em.createQuery("select r from Reminder r where r.ruleKey=:key",Reminder.class).setParameter("key",key).getResultStream().findFirst().orElse(null);
        if(existing!=null){if(!"OPEN".equalsIgnoreCase(existing.getStatus())&&!"ACTIVE".equalsIgnoreCase(existing.getStatus()))existing.setStatus("ACTIVE");existing.setDueTime(due);return;}
        Reminder reminder=new Reminder();reminder.setFarm(cow.getFarm());reminder.setCattle(cow);reminder.setRuleType(rule);reminder.setSourceRecord(source);
        reminder.setDueTime(due);reminder.setStatus("ACTIVE");em.persist(reminder);
    }
    private void resolve(Cattle cow,String rule,String why){transition(cow,rule,null,"RESOLVED",why);}
    private void cancel(Cattle cow,String rule,String why){transition(cow,rule,null,"CANCELLED",why);}
    private void supersede(Cattle cow,String rule,String why){transition(cow,rule,null,"SUPERSEDED",why);}
    private void cancelSource(Cattle cow,String source,String why){transition(cow,null,source,"CANCELLED",why);}
    private void transition(Cattle cow,String rule,String source,String status,String why){
        String jpql="select r from Reminder r where r.cattle.id=:c and r.status in ('OPEN','ACTIVE')"+(rule==null?"":" and r.ruleType=:rule")+(source==null?"":" and r.sourceRecord=:source");
        var q=em.createQuery(jpql,Reminder.class).setParameter("c",cow.getId());
        if(rule!=null)q.setParameter("rule",rule);if(source!=null)q.setParameter("source",source);
        for(Reminder r:q.getResultList())r.setStatus(status);
    }
    private Integer parameter(Cattle cow,String key){
        List<FarmParameterVersion> found=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class)
            .setParameter("farm",cow.getFarm().getId()).setParameter("date",clock.now().atZone(zone(cow)).toLocalDate()).setMaxResults(1).getResultList();
        if(found.isEmpty())return null;
        try{Object value=json.readValue(found.get(0).getParameterValues(),new TypeReference<Map<String,Object>>(){}).get(key);return value instanceof Number n?n.intValue():null;}
        catch(Exception ignored){return null;}
    }
    private ZoneId zone(Cattle cow){try{return ZoneId.of(cow.getFarm().getTimeZone());}catch(Exception ignored){return clock.zone();}}
}
