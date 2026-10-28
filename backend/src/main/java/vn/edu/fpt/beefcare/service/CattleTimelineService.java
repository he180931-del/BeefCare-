package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;

/** FE-16: a projection of committed source records, never a separate editable event store. */
@Service
public class CattleTimelineService {
    public record Event(String category,String type,Long sourceId,Instant occurredAt,Instant recordedAt,String recorder,
        String status,boolean corrected,Map<String,Object> values,Map<String,Object> correction) {}
    private final EntityManager em;private final FarmAccessService access;
    public CattleTimelineService(EntityManager em,FarmAccessService access){this.em=em;this.access=access;}
    @Transactional(readOnly=true)
    public List<Event> timeline(Long farmId,Long cattleId,String category,boolean showCorrections){
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_CATTLE);Cattle cattle=em.find(Cattle.class,cattleId);
        if(cattle==null||!farmId.equals(cattle.getFarm().getId()))throw DomainException.notFound(MessageCodes.COM_08);
        ZoneId zone=ZoneId.of(cattle.getFarm().getTimeZone());List<Event> events=new ArrayList<>();
        for(HerdEntry e:rows("select e from HerdEntry e where e.cattle.id=:c",HerdEntry.class,cattleId)){
            Map<String,Object> details=values("source",e.getSource(),"weight",e.getEntryWeightKg(),"basis",e.getWeightBasis());
            if(ctx.role()!=FarmRole.TECHNICIAN){details.put("voucherId",e.getVoucher().getId());details.put("voucherCode",e.getVoucher().getCode());}
            events.add(event("ENTRY_EXIT","HERD_ENTRY",ctx.role()==FarmRole.TECHNICIAN?null:e.getId(),at(e.getEntryDate(),zone),e.getCreatedAt(),e.getVoucher().getCreatedBy().getFullName(),e.getStatus().name(),e.isCorrected(),details));
        }
        for(HerdExit e:rows("select e from HerdExit e where e.cattle.id=:c",HerdExit.class,cattleId)){
            Map<String,Object> details=values("exitType",e.getVoucher().getExitType(),"date",e.getVoucher().getExitDate());
            if(ctx.role()!=FarmRole.TECHNICIAN){details.put("voucherId",e.getVoucher().getId());details.put("voucherCode",e.getVoucher().getCode());}
            if(ctx.role()!=FarmRole.TECHNICIAN||"CONFIRMED".equals(e.getStatus().name()))events.add(event("ENTRY_EXIT","HERD_EXIT",ctx.role()==FarmRole.TECHNICIAN?null:e.getId(),at(e.getVoucher().getExitDate(),zone),null,null,e.getStatus().name(),false,details));
        }
        for(PenAssignment p:rows("select p from PenAssignment p where p.cattle.id=:c",PenAssignment.class,cattleId))events.add(event("PEN","PEN_ASSIGNMENT",p.getId(),at(p.getFromDate(),zone),p.getRecordedAt(),p.getMovedBy()==null?null:p.getMovedBy().getFullName(),"VALID",false,values("penId",p.getPen().getId(),"penCode",p.getPen().getCode(),"toDate",p.getToDate(),"reason",p.getReason())));
        for(CattleQrTag t:rows("select t from CattleQrTag t where t.cattle.id=:c",CattleQrTag.class,cattleId))events.add(event("IDENTIFICATION_QR","QR_ISSUED",t.getId(),t.getIssuedAt(),t.getIssuedAt(),t.getIssuedBy().getFullName(),t.getStatus().name(),false,values("tagCode",t.getTagCode(),"reason",t.getReplacementReason())));
        for(CattleProfileChange p:rows("select p from CattleProfileChange p where p.cattle.id=:c",CattleProfileChange.class,cattleId))events.add(event("PURPOSE_STAGE","PROFILE_CHANGE",p.getId(),at(p.getEffectiveDate(),zone),p.getChangedAt(),p.getChangedBy().getFullName(),"VALID",false,values("fieldGroup",p.getFieldGroup(),"oldValue",p.getOldValue(),"newValue",p.getNewValue(),"reason",p.getReason())));
        for(Growth g:rows("select g from Growth g where g.cattle.id=:c",Growth.class,cattleId))events.add(event("GROWTH","GROWTH_ASSESSMENT",g.getId(),g.getObservedAt()==null?at(g.getCheckDate(),zone):g.getObservedAt(),g.getEntryTime(),g.getMeasuredBy()==null?null:g.getMeasuredBy().getFullName(),g.getStatus(),g.isCorrected(),values("weightKg",g.getWeightKg(),"bcs",g.getBcsScore(),"basis",g.getWeightType(),"method",g.getMethod(),"reason",g.getCorrectionReason())));
        for(Vaccination v:rows("select v from Vaccination v where v.cattle.id=:c",Vaccination.class,cattleId))events.add(event("VACCINATION","VACCINATION_RECORD",v.getId(),v.getAdministeredAt()==null?at(v.getVaccinationDate(),zone):v.getAdministeredAt(),v.getEntryTime(),v.getVaccinator(),v.getStatus(),Boolean.TRUE.equals(v.getCorrected()),values("vaccine",v.getVaccineNameSnapshot()==null&&v.getVaccine()!=null?v.getVaccine().getName():v.getVaccineNameSnapshot(),"batchNo",v.getBatchNo(),"dose",v.getDose(),"source",v.getSource(),"withdrawalEndDate",v.getWithdrawalEndDate())));
        for(HealthObservation o:rows("select o from HealthObservation o where o.healthCase.cattle.id=:c",HealthObservation.class,cattleId))events.add(event("HEALTH","HEALTH_OBSERVATION",o.getId(),o.getObservedTime(),o.getEntryTime(),null,o.getStatus(),Boolean.TRUE.equals(o.getIsCorrected()),values("healthCaseId",o.getHealthCase().getId(),"signs",o.getSignsProgress(),"source",o.getSource(),"reason",o.getStatusReason())));
        for(Treatment t:rows("select t from Treatment t where t.healthCase.cattle.id=:c",Treatment.class,cattleId))events.add(event("HEALTH","TREATMENT",t.getId(),t.getTreatmentTime(),t.getEntryTime(),null,t.getStatus(),Boolean.TRUE.equals(t.getIsCorrected()),values("healthCaseId",t.getHealthCase().getId(),"medicine",t.getMedicineNameSnapshot()==null&&t.getMedicine()!=null?t.getMedicine().getName():t.getMedicineNameSnapshot(),"dose",t.getDose(),"route",t.getRoute(),"courseDays",t.getCourseDays(),"withdrawalEndDate",t.getWithdrawalEndDate(),"reason",t.getStatusReason())));
        for(ReproductionEvent r:rows("select r from ReproductionEvent r where r.cattle.id=:c",ReproductionEvent.class,cattleId))events.add(event("REPRODUCTION",r.getType(),r.getId(),r.getEventTime(),r.getRecordedAt(),r.getRecordedBy()==null?null:r.getRecordedBy().getFullName(),r.getStatus(),Boolean.TRUE.equals(r.getCorrected()),values("method",r.getMethod(),"result",r.getResult(),"source",r.getSource(),"description",r.getDescription(),"reason",r.getStatusReason())));
        for(PregnancyUpdate p:rows("select p from PregnancyUpdate p where p.episode.cattle.id=:c",PregnancyUpdate.class,cattleId))events.add(event("REPRODUCTION","PREGNANCY_UPDATE",p.getId(),p.getOccurredTime(),p.getRecordedAt(),p.getRecordedBy()==null?null:p.getRecordedBy().getFullName(),p.getStatus(),Boolean.TRUE.equals(p.getCorrected()),values("type",p.getType(),"details",p.getDetails(),"episodeId",p.getEpisode().getId())));
        for(CalvingEvent c:rows("select c from CalvingEvent c where c.dam.id=:c",CalvingEvent.class,cattleId))events.add(event("REPRODUCTION","CALVING_EVENT",c.getId(),c.getBirthTime(),c.getRecordedAt(),c.getRecordedBy()==null?null:c.getRecordedBy().getFullName(),c.getStatus(),Boolean.TRUE.equals(c.getCorrected()),values("course",c.getCourse(),"damCondition",c.getDamCondition(),"retainedPlacenta",c.getRetainedPlacenta())));
        List<Event> selected=events.stream().filter(e->category==null||category.isBlank()||"ALL".equals(category)||category.equals(e.category()))
            .filter(e->showCorrections||!Set.of("VOIDED","VOID","EXCLUDED").contains(Objects.toString(e.status(),"VALID"))).toList();
        if(showCorrections){List<Event> withRevisions=new ArrayList<>(selected);
            for(Event e:selected){if(e.sourceId()==null)continue;
                for(RecordRevision revision:em.createQuery("select r from RecordRevision r where r.farm.id=:f and r.sourceId=:id and r.sourceType=:type order by r.changedAt",RecordRevision.class).setParameter("f",farmId).setParameter("id",e.sourceId()).setParameter("type",revisionType(e)).getResultList())
                    withRevisions.add(new Event(e.category(),"REVISION",revision.getId(),e.occurredAt(),revision.getChangedAt(),revision.getActor().getFullName(),revision.getAction(),true,values("original",JsonSupport.fromJson(revision.getBeforeSnapshot(),Object.class)),values("reason",revision.getReason(),"sourceType",e.type(),"sourceId",e.sourceId())));
            }selected=withRevisions;
        }
        return selected.stream().sorted(Comparator.comparing(Event::occurredAt,Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(Event::recordedAt,Comparator.nullsLast(Comparator.reverseOrder()))).toList();
    }
    private <T> List<T> rows(String jpql,Class<T> type,Long cattle){return em.createQuery(jpql,type).setParameter("c",cattle).getResultList();}
    private String revisionType(Event e) {
        if("REPRODUCTION".equals(e.category())&&!Set.of("PREGNANCY_UPDATE","CALVING_EVENT").contains(e.type()))return "ReproductionEvent";
        return switch(e.type()) {
            case "HERD_ENTRY" -> "HerdEntry";
            case "HERD_EXIT" -> "HerdExit";
            case "VACCINATION_RECORD" -> "Vaccination";
            case "HEALTH_OBSERVATION" -> "HealthObservation";
            case "TREATMENT" -> "Treatment";
            case "PREGNANCY_UPDATE" -> "PregnancyUpdate";
            case "CALVING_EVENT" -> "CalvingEvent";
            default -> e.type();
        };
    }
    private Event event(String category,String type,Long id,Instant occurred,Instant recorded,String recorder,String status,boolean corrected,Map<String,Object> values){return new Event(category,type,id,occurred,recorded,recorder,status,corrected,values,null);}
    private Instant at(LocalDate date,ZoneId zone){return date==null?null:date.atStartOfDay(zone).toInstant();}
    private Map<String,Object> values(Object... pairs){Map<String,Object> map=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)map.put(pairs[i].toString(),pairs[i+1]);return map;}
}
