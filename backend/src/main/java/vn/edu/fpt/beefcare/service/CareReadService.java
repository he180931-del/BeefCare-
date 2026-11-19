package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Farm-scoped read models for SCR-35/36/37. */
@Service
public class CareReadService {
    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final FarmClock clock;
    private final CattleStateService state;

    public CareReadService(FarmAccessService access, FarmClock clock, CattleStateService state) {
        this.access=access; this.clock=clock; this.state=state;
    }

    @Transactional(readOnly=true)
    public List<CareDtos.HealthCaseRow> healthCases(Long farmId,String tab,String search,String severity,Long penId,LocalDate from,LocalDate to) {
        access.require(farmId,FarmAction.VIEW_HEALTH);
        LocalDate today=clock.today();
        String selected=tab==null||tab.isBlank()?"OPEN":tab.trim().toUpperCase(Locale.ROOT);
        if(!List.of("OPEN","CHRONIC","CLOSED","ALL").contains(selected))throw DomainException.invalid("tab");
        LocalDate start=from==null?today.minusDays(29):from;LocalDate end=to==null?today:to;
        if(start.isAfter(end))throw DomainException.invalid("period");
        List<HealthCase> rows=em.createQuery("select h from HealthCase h join fetch h.cattle c left join fetch c.breed left join fetch c.purpose where c.farm.id=:farm order by h.openedDate desc,h.id desc",HealthCase.class)
            .setParameter("farm",farmId).getResultList();
        Map<Long,PenAssignment> penByCattle=currentPens(farmId,today);
        String query=search==null?"":search.trim().toLowerCase(Locale.ROOT);
        List<CareDtos.HealthCaseRow> result=new ArrayList<>();
        for(HealthCase h:rows){
            String status=upper(h.getStatus());
            if(!"ALL".equals(selected)&&!selected.equals(status))continue;
            if(!"OPEN".equals(selected)&&(h.getOpenedDate().isBefore(start)||h.getOpenedDate().isAfter(end)))continue;
            if(severity!=null&&!severity.isBlank()&&!upper(severity).equals(upper(h.getSeverity())))continue;
            Cattle c=h.getCattle();PenAssignment pa=penByCattle.get(c.getId());
            if(penId!=null&&(pa==null||!penId.equals(pa.getPen().getId())))continue;
            if(!query.isEmpty()&&!contains(c.getDisplayCode(),query)&&!contains(c.getEarTagNumber(),query)&&!contains(h.getCaseCode(),query))continue;
            String signs=em.createQuery("select o.signsProgress from HealthObservation o where o.healthCase.id=:id and upper(o.status)='VALID' order by o.opening desc,o.observedTime desc,o.id desc",String.class)
                .setParameter("id",h.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
            Long count=em.createQuery("select count(t) from Treatment t where t.healthCase.id=:id and upper(t.status)='VALID'",Long.class).setParameter("id",h.getId()).getSingleResult();
            result.add(new CareDtos.HealthCaseRow(h.getId(),h.getCaseCode(),c.getId(),c.getDisplayCode(),c.getBreed()==null?null:c.getBreed().getName(),
                c.getSex()==null?null:c.getSex().name(),pa==null?null:pa.getPen().getId(),pa==null?null:pa.getPen().getCode(),pa==null?null:pa.getPen().getName(),
                h.getSuspectedDiagnosis(),h.getSuspectedDiagnosis()==null?signs:null,h.getIsSuspectedContagious(),h.getSeverity(),h.getOpenedDate(),h.getStatus(),h.getChronicSince(),h.getOutcome(),count,h.getVersion()));
        }
        return result;
    }

    @Transactional(readOnly=true)
    public CareDtos.HealthProfile healthProfile(Long farmId,Long cattleId) {
        access.require(farmId,FarmAction.VIEW_HEALTH);
        Cattle cattle=cattle(farmId,cattleId);
        List<HealthCase> cases=em.createQuery("select h from HealthCase h where h.cattle.id=:id order by h.openedDate desc,h.id desc",HealthCase.class).setParameter("id",cattleId).getResultList();
        List<CareDtos.HealthCaseCard> active=new ArrayList<>(),previous=new ArrayList<>();List<CareDtos.HealthTimelineRow> timeline=new ArrayList<>();
        for(HealthCase h:cases){
            String signs=em.createQuery("select o.signsProgress from HealthObservation o where o.healthCase.id=:id and o.opening=true order by o.id",String.class).setParameter("id",h.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
            Long treatments=em.createQuery("select count(t) from Treatment t where t.healthCase.id=:id and upper(t.status)='VALID'",Long.class).setParameter("id",h.getId()).getSingleResult();
            CareDtos.HealthCaseCard card=new CareDtos.HealthCaseCard(h.getId(),h.getCaseCode(),h.getStatus(),h.getSeverity(),h.getSuspectedDiagnosis(),signs,h.getOpenedDate(),h.getChronicSince(),h.getOutcome(),treatments,h.getVersion());
            if(List.of("OPEN","CHRONIC").contains(upper(h.getStatus())))active.add(card);else previous.add(card);
            List<HealthObservation> observations=em.createQuery("select o from HealthObservation o left join fetch o.recorder where o.healthCase.id=:id order by o.observedTime,o.id",HealthObservation.class).setParameter("id",h.getId()).getResultList();
            for(HealthObservation o:observations){String type=Boolean.TRUE.equals(o.getOpening())?"OPENED":"FOLLOW_UP";
                timeline.add(new CareDtos.HealthTimelineRow(o.getId(),type,o.getObservedTime(),o.getSignsProgress(),o.getRecorder()==null?null:o.getRecorder().getFullName(),o.getStatus(),o.getIsCorrected(),o.getVaccination()==null?null:o.getVaccination().getId(),o.getVersion()));}
            List<Treatment> treatmentsRows=em.createQuery("select t from Treatment t left join fetch t.medicine where t.healthCase.id=:id order by t.treatmentTime,t.id",Treatment.class).setParameter("id",h.getId()).getResultList();
            for(Treatment t:treatmentsRows){String detail=(t.getMedicineNameSnapshot()==null?t.getTreatmentDetail():t.getMedicineNameSnapshot())+" · "+t.getDose()+" · "+t.getRoute()+" · withdrawal until "+(t.getWithdrawalEndDate()==null?"—":t.getWithdrawalEndDate());
                timeline.add(new CareDtos.HealthTimelineRow(t.getId(),"TREATMENT",t.getTreatmentTime(),detail,t.getPerformer(),t.getStatus(),t.getIsCorrected(),null,t.getVersion()));}
        }
        timeline.sort(Comparator.comparing(CareDtos.HealthTimelineRow::occurredAt,Comparator.nullsLast(Comparator.naturalOrder())));
        Map<String,Object> derived=state.state(cattle);
        return new CareDtos.HealthProfile(cattleId,(String)derived.get("healthState"),(LocalDate)derived.get("withdrawalEndDate"),(Boolean)derived.get("suspectedContagious"),active,previous,timeline);
    }

    @Transactional(readOnly=true)
    public List<CareDtos.VaccinationHistoryRow> vaccinationHistory(Long farmId,String search,Long vaccineId,String source,LocalDate from,LocalDate to,Long cattleId) {
        access.require(farmId,FarmAction.VIEW_HEALTH);
        LocalDate today=clock.today();LocalDate start=from==null?today.minusMonths(3):from;LocalDate end=to==null?today:to;
        if(start.isAfter(end))throw DomainException.invalid("period");
        String src=source==null||source.isBlank()?null:upper(source);if(src!=null&&!List.of("ON_FARM","HISTORICAL").contains(src))throw DomainException.invalid("source");
        List<Vaccination> vaccinations=em.createQuery("select v from Vaccination v join fetch v.cattle c join fetch c.breed left join fetch v.vaccine where c.farm.id=:farm and v.vaccinationDate between :from and :to order by v.administeredAt desc,v.vaccinationDate desc,v.id desc",Vaccination.class)
            .setParameter("farm",farmId).setParameter("from",start).setParameter("to",end).getResultList();
        Map<Long,PenAssignment> pens=currentPens(farmId,today);String query=search==null?"":search.trim().toLowerCase(Locale.ROOT);
        List<CareDtos.VaccinationHistoryRow> result=new ArrayList<>();
        for(Vaccination v:vaccinations){Cattle c=v.getCattle();if(cattleId!=null&&!cattleId.equals(c.getId()))continue;if(vaccineId!=null&&!vaccineId.equals(v.getVaccine().getId()))continue;if(src!=null&&!src.equals(upper(v.getSource())))continue;
            String name=v.getVaccineNameSnapshot()==null?v.getVaccine().getName():v.getVaccineNameSnapshot();if(!query.isEmpty()&&!contains(c.getDisplayCode(),query)&&!contains(c.getEarTagNumber(),query))continue;
            PenAssignment pa=pens.get(c.getId());HealthObservation reaction=em.createQuery("select o from HealthObservation o where o.vaccination.id=:id and upper(o.status)='VALID' order by o.observedTime desc",HealthObservation.class).setParameter("id",v.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
            HealthCase hc=reaction==null?null:reaction.getHealthCase();
            result.add(new CareDtos.VaccinationHistoryRow(v.getId(),v.getAdministeredAt(),v.getVaccinationDate(),c.getId(),c.getDisplayCode(),pa==null?null:pa.getPen().getId(),pa==null?null:pa.getPen().getCode(),pa==null?null:pa.getPen().getName(),v.getVaccine().getId(),name,v.getDose(),v.getBatchNo(),v.getSource(),v.getVaccinator(),v.getWithdrawalEndDate(),hc==null?null:hc.getId(),hc==null?null:hc.getCaseCode(),v.getStatus(),v.getCorrected(),v.getVersion()));
        }
        return result;
    }

    private Cattle cattle(Long farmId,Long id){return em.createQuery("select c from Cattle c left join fetch c.breed left join fetch c.purpose where c.id=:id and c.farm.id=:farm",Cattle.class).setParameter("id",id).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"cattleId",id));}
    private Map<Long,PenAssignment> currentPens(Long farmId,LocalDate date){Map<Long,PenAssignment> result=new HashMap<>();em.createQuery("select p from PenAssignment p join fetch p.pen where p.farm.id=:farm and p.fromDate<=:date and (p.toDate is null or p.toDate>=:date) order by p.fromDate desc",PenAssignment.class).setParameter("farm",farmId).setParameter("date",date).getResultList().forEach(p->result.putIfAbsent(p.getCattle().getId(),p));return result;}
    private boolean contains(String value,String search){return value!=null&&value.toLowerCase(Locale.ROOT).contains(search);}
    private String upper(String s){return s==null?"":s.trim().toUpperCase(Locale.ROOT);}
}
