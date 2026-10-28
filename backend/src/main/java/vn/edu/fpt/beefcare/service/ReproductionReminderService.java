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
        cancel(cow,"REM-07","BREEDING_RECORDED");
        LocalDate due=clock.toFarmDate(event.getEventTime()).plusDays(parameter(cow,"PREGNANCY_CHECK_DAYS",28));
        create(cow,"REM-03","REPRODUCTION_EVENT:"+event.getId(),due);
        if(event.getTentativeExpectedCalvingDate()!=null){
            cancel(cow,"REM-05","NEWER_BREEDING");
            create(cow,"REM-05","REPRODUCTION_EVENT:"+event.getId(),event.getTentativeExpectedCalvingDate().minusDays(parameter(cow,"CALVING_LEAD_DAYS",30)));
        }
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void pregnancyCheckRecorded(Cattle cow,ReproductionEvent event,PregnancyEpisode episode){
        resolve(cow,"REM-03","PREGNANCY_CHECK");
        resolve(cow,"REM-04","PREGNANCY_CHECK");
        if("INCONCLUSIVE".equalsIgnoreCase(event.getResult())){
            create(cow,"REM-04","REPRODUCTION_EVENT:"+event.getId(),clock.toFarmDate(event.getEventTime()).plusDays(parameter(cow,"PREGNANCY_RECHECK_DAYS",14)));
        }else if("PREGNANT".equalsIgnoreCase(event.getResult())&&episode!=null){
            cancel(cow,"REM-05","CONFIRMED_PREGNANCY");
            if(episode.getExpectedCalvingDate()!=null)
                create(cow,"REM-05","PREGNANCY_EPISODE:"+episode.getId(),episode.getExpectedCalvingDate().minusDays(parameter(cow,"CALVING_LEAD_DAYS",30)));
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
        LocalDate ready=clock.toFarmDate(birthTime).plusDays(parameter(cow,"POST_CALVING_DAYS",45));
        create(cow,"REM-07","CALVING_EVENT:"+calvingId,ready);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void calvingCorrected(Cattle cow,Long calvingId,Instant birthTime){
        cancelSource(cow,"CALVING_EVENT:"+calvingId,"CALVING_CORRECTED");
        create(cow,"REM-07","CALVING_EVENT:"+calvingId,clock.toFarmDate(birthTime).plusDays(parameter(cow,"POST_CALVING_DAYS",45)));
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void pregnancyLossVoided(PregnancyEpisode episode){
        if(episode.getExpectedCalvingDate()!=null)
            create(episode.getCattle(),"REM-05","PREGNANCY_EPISODE:"+episode.getId(),episode.getExpectedCalvingDate().minusDays(parameter(episode.getCattle(),"CALVING_LEAD_DAYS",30)));
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void calvingVoided(Cattle cow,Long calvingId,PregnancyEpisode episode){
        cancelSource(cow,"CALVING_EVENT:"+calvingId,"CALVING_VOIDED");
        if(episode!=null){
            if("OPEN".equalsIgnoreCase(episode.getStatus())&&episode.getExpectedCalvingDate()!=null)
                create(cow,"REM-05","PREGNANCY_EPISODE:"+episode.getId(),episode.getExpectedCalvingDate().minusDays(parameter(cow,"CALVING_LEAD_DAYS",30)));
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
    private void create(Cattle cow,String rule,String source,LocalDate date){
        if(date==null)return;
        Long exists=em.createQuery("select count(r) from Reminder r where r.cattle.id=:c and r.ruleType=:rule and r.sourceRecord=:source and r.status in ('OPEN','ACTIVE')",Long.class)
            .setParameter("c",cow.getId()).setParameter("rule",rule).setParameter("source",source).getSingleResult();
        if(exists>0)return;
        Reminder reminder=new Reminder();reminder.setFarm(cow.getFarm());reminder.setCattle(cow);reminder.setRuleType(rule);reminder.setSourceRecord(source);
        reminder.setDueTime(date.atStartOfDay(zone(cow)).toInstant());reminder.setStatus("OPEN");em.persist(reminder);
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
    private int parameter(Cattle cow,String key,int fallback){
        List<FarmParameterVersion> found=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class)
            .setParameter("farm",cow.getFarm().getId()).setParameter("date",clock.now().atZone(zone(cow)).toLocalDate()).setMaxResults(1).getResultList();
        if(found.isEmpty())return fallback;
        try{Object value=json.readValue(found.get(0).getParameterValues(),new TypeReference<Map<String,Object>>(){}).get(key);return value instanceof Number n?n.intValue():fallback;}
        catch(Exception ignored){return fallback;}
    }
    private ZoneId zone(Cattle cow){try{return ZoneId.of(cow.getFarm().getTimeZone());}catch(Exception ignored){return clock.zone();}}
}
