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

    /**
     * FE-10 A1 (SCR-36): one page of the farm's cases. {@code tab} OPEN (default; ignores the period) / CHRONIC /
     * CLOSED / ALL; the period (default last 30 days) is the opening date; {@code counts} are per tab with the same
     * search / severity / pen / period filters; {@code sort} openedAt (default, desc) or caseCode.
     */
    @Transactional(readOnly=true)
    public CareDtos.HealthCasePage healthCases(Long farmId,String tab,String search,String severity,Long penId,LocalDate from,LocalDate to,
                                               Integer page,Integer size,String sort,String dir) {
        access.require(farmId,FarmAction.VIEW_HEALTH);
        LocalDate today=clock.today();
        String selected=tab==null||tab.isBlank()?"OPEN":tab.trim().toUpperCase(Locale.ROOT);
        if(!List.of("OPEN","CHRONIC","CLOSED","ALL").contains(selected))throw DomainException.invalid("tab");
        LocalDate start=from==null?today.minusDays(29):from;LocalDate end=to==null?today:to;
        if(start.isAfter(end))throw DomainException.invalid("period");
        int pageNo=page==null||page<0?0:page;int pageSize=size==null||size<1?20:Math.min(size,200);
        String sortKey=sort==null||sort.isBlank()?"openedAt":sort.trim();
        if(!List.of("openedAt","caseCode").contains(sortKey))throw DomainException.invalid("sort");
        boolean asc="asc".equalsIgnoreCase(dir);
        List<HealthCase> rows=em.createQuery("select h from HealthCase h join fetch h.cattle c left join fetch c.breed where c.farm.id=:farm",HealthCase.class)
            .setParameter("farm",farmId).getResultList();
        Map<Long,PenAssignment> penByCattle=currentPens(farmId,today);
        Map<Long,Object[]> opening=openingByCase(farmId);
        Map<Long,Long> treatmentCounts=new HashMap<>();
        em.createQuery("select t.healthCase.id,count(t) from Treatment t where t.healthCase.cattle.farm.id=:farm and upper(t.status)='VALID' group by t.healthCase.id",Object[].class)
            .setParameter("farm",farmId).getResultList().forEach(r->treatmentCounts.put((Long)r[0],(Long)r[1]));
        String query=search==null?"":search.trim().toLowerCase(Locale.ROOT);
        List<HealthCase> filtered=new ArrayList<>();
        for(HealthCase h:rows){
            if(severity!=null&&!severity.isBlank()&&!upper(severity).equals(upper(h.getSeverity())))continue;
            Cattle c=h.getCattle();PenAssignment pa=penByCattle.get(c.getId());
            if(penId!=null&&(pa==null||!penId.equals(pa.getPen().getId())))continue;
            if(!query.isEmpty()&&!contains(c.getDisplayCode(),query)&&!contains(c.getEarTagNumber(),query)&&!contains(h.getCaseCode(),query))continue;
            filtered.add(h);
        }
        java.util.function.Predicate<HealthCase> inPeriod=h->!h.getOpenedDate().isBefore(start)&&!h.getOpenedDate().isAfter(end);
        Map<String,Long> counts=new java.util.LinkedHashMap<>();
        counts.put("open",filtered.stream().filter(h->"OPEN".equals(upper(h.getStatus()))).count());
        counts.put("chronic",filtered.stream().filter(h->"CHRONIC".equals(upper(h.getStatus()))&&inPeriod.test(h)).count());
        counts.put("closed",filtered.stream().filter(h->"CLOSED".equals(upper(h.getStatus()))&&inPeriod.test(h)).count());
        counts.put("all",filtered.stream().filter(inPeriod).count());
        List<HealthCase> selectedRows=filtered.stream()
            .filter(h->"ALL".equals(selected)||selected.equals(upper(h.getStatus())))
            .filter(h->"OPEN".equals(selected)||inPeriod.test(h)).toList();
        Comparator<HealthCase> order="caseCode".equals(sortKey)
            ?Comparator.comparing(HealthCase::getCaseCode,Comparator.nullsLast(Comparator.naturalOrder()))
            :Comparator.comparing((HealthCase h)->openedAt(h,opening)).thenComparing(HealthCase::getId);
        if(!asc)order=order.reversed();
        List<HealthCase> sorted=new ArrayList<>(selectedRows);sorted.sort(order);
        List<CareDtos.HealthCaseRow> items=new ArrayList<>();
        for(HealthCase h:sorted.stream().skip((long)pageNo*pageSize).limit(pageSize).toList()){
            Cattle c=h.getCattle();PenAssignment pa=penByCattle.get(c.getId());Object[] open=opening.get(h.getId());
            String signs=open==null?null:(String)open[1];
            items.add(new CareDtos.HealthCaseRow(h.getId(),h.getCaseCode(),c.getId(),c.getDisplayCode(),c.getBreed()==null?null:c.getBreed().getName(),
                c.getSex()==null?null:c.getSex().name(),pa==null?null:pa.getPen().getId(),pa==null?null:pa.getPen().getCode(),pa==null?null:pa.getPen().getName(),
                h.getSuspectedDiagnosis(),signs,h.getIsSuspectedContagious(),h.getSeverity(),h.getOpenedDate(),openedAt(h,opening),dayN(h,today),
                h.getStatus(),h.getChronicSince(),h.getOutcome(),h.getClosedDate(),treatmentCounts.getOrDefault(h.getId(),0L),h.getVersion()));
        }
        return new CareDtos.HealthCasePage(items,sorted.size(),pageNo,pageSize,counts);
    }

    /** FE-10 A2 (SCR-37): health state, withdrawal, each OPEN / CHRONIC case with its own timeline, previous cases and a pending loss voucher. */
    @Transactional(readOnly=true)
    public CareDtos.HealthProfile healthProfile(Long farmId,Long cattleId) {
        access.require(farmId,FarmAction.VIEW_HEALTH);
        Cattle cattle=cattle(farmId,cattleId);
        LocalDate today=clock.today();
        List<HealthCase> cases=em.createQuery("select h from HealthCase h left join fetch h.closedBy where h.cattle.id=:id order by h.openedDate desc,h.id desc",HealthCase.class).setParameter("id",cattleId).getResultList();
        List<CareDtos.HealthCaseView> open=new ArrayList<>();List<CareDtos.PreviousHealthCase> previous=new ArrayList<>();
        for(HealthCase h:cases){
            List<HealthObservation> observations=em.createQuery("select o from HealthObservation o left join fetch o.recorder left join fetch o.observer left join fetch o.vaccination where o.healthCase.id=:id order by o.observedTime,o.id",HealthObservation.class).setParameter("id",h.getId()).getResultList();
            HealthObservation openingRow=observations.stream().filter(o->Boolean.TRUE.equals(o.getOpening())).findFirst().orElse(observations.isEmpty()?null:observations.get(0));
            String signs=openingRow==null?null:openingRow.getSignsProgress();
            if(!List.of("OPEN","CHRONIC").contains(upper(h.getStatus()))){
                previous.add(new CareDtos.PreviousHealthCase(h.getId(),h.getCaseCode(),signs,h.getSuspectedDiagnosis(),h.getSeverity(),h.getOpenedDate(),h.getOutcome(),h.getClosedDate(),
                    h.getClosedDate()==null?null:String.format("%04d-%02d",h.getClosedDate().getYear(),h.getClosedDate().getMonthValue()),h.getClosedBy()==null?null:h.getClosedBy().getFullName()));
                continue;
            }
            List<CareDtos.HealthTimelineRow> timeline=new ArrayList<>();
            for(HealthObservation o:observations){
                timeline.add(new CareDtos.HealthTimelineRow(o.getId(),h.getId(),Boolean.TRUE.equals(o.getOpening())?"OPENING":"FOLLOW_UP",o.getObservedTime(),
                    o.getRecorder()==null?null:o.getRecorder().getFullName(),o.getObserver()==null?null:o.getObserver().getFullName(),o.getObserver()==null?null:o.getObserver().getId(),
                    o.getStatus(),o.getIsCorrected(),o.getVersion(),o.getTemperatureC(),o.getProgress(),o.getSignsProgress(),o.getVaccination()==null?null:o.getVaccination().getId(),
                    null,null,null,null,null,null,null,null,null));
            }
            List<Treatment> treatments=em.createQuery("select t from Treatment t left join fetch t.medicine where t.healthCase.id=:id order by t.treatmentTime,t.id",Treatment.class).setParameter("id",h.getId()).getResultList();
            long validTreatments=0;Instant latest=null;
            for(Treatment t:treatments){
                if("VALID".equalsIgnoreCase(t.getStatus()))validTreatments++;
                timeline.add(new CareDtos.HealthTimelineRow(t.getId(),h.getId(),"TREATMENT",t.getTreatmentTime(),null,null,null,t.getStatus(),t.getIsCorrected(),t.getVersion(),
                    null,null,null,null,t.getMedicine()==null?null:t.getMedicine().getId(),t.getMedicineNameSnapshot()==null?t.getTreatmentDetail():t.getMedicineNameSnapshot(),
                    t.getDose(),t.getRoute(),t.getCourseDays(),t.getWithdrawalDays(),t.getWithdrawalEndDate(),t.getPerformer(),t.getVeterinaryAdvice()));
            }
            timeline.sort(Comparator.comparing(CareDtos.HealthTimelineRow::occurredAt,Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(CareDtos.HealthTimelineRow::id));
            for(CareDtos.HealthTimelineRow r:timeline)if("VALID".equalsIgnoreCase(r.status())&&r.occurredAt()!=null&&(latest==null||r.occurredAt().isAfter(latest)))latest=r.occurredAt();
            Long linked=h.getReactionVaccination()!=null?h.getReactionVaccination().getId():openingRow==null||openingRow.getVaccination()==null?null:openingRow.getVaccination().getId();
            open.add(new CareDtos.HealthCaseView(h.getId(),h.getCaseCode(),h.getStatus(),h.getSeverity(),h.getSuspectedDiagnosis(),h.getIsSuspectedContagious(),signs,
                h.getOpenedDate(),openingRow==null?null:openingRow.getObservedTime(),dayN(h,today),h.getChronicSince(),validTreatments,linked,latest,timeline,h.getVersion()));
        }
        CareDtos.PendingHealthExit pendingExit=em.createQuery("select v from HerdExitVoucher v join fetch v.sourceHealthCase where v.sourceHealthCase.cattle.id=:id and v.status=:pending order by v.id desc",vn.edu.fpt.beefcare.domain.HerdExitVoucher.class)
            .setParameter("id",cattleId).setParameter("pending",vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus.PENDING).setMaxResults(1).getResultStream().findFirst()
            .map(v->new CareDtos.PendingHealthExit(v.getId(),v.getCode(),v.getLossKind()==null?null:v.getLossKind().name(),v.getExitDate(),v.getSourceHealthCase().getId(),v.getSourceHealthCase().getCaseCode())).orElse(null);
        Map<String,Object> derived=state.state(cattle);
        return new CareDtos.HealthProfile(cattleId,cattle.getDisplayCode(),(String)derived.get("healthState"),(LocalDate)derived.get("withdrawalEndDate"),(Boolean)derived.get("suspectedContagious"),pendingExit,open,previous);
    }

    /** Opening observation per case: [observedTime, signs]. */
    private Map<Long,Object[]> openingByCase(Long farmId){
        Map<Long,Object[]> result=new HashMap<>();
        em.createQuery("select o.healthCase.id,o.observedTime,o.signsProgress,o.id from HealthObservation o where o.healthCase.cattle.farm.id=:farm and o.opening=true order by o.id",Object[].class)
            .setParameter("farm",farmId).getResultList().forEach(r->result.putIfAbsent((Long)r[0],new Object[]{r[1],r[2]}));
        return result;
    }
    private Instant openedAt(HealthCase h,Map<Long,Object[]> opening){
        Object[] o=opening.get(h.getId());
        return o!=null&&o[0]!=null?(Instant)o[0]:h.getOpenedDate().atStartOfDay(clock.zone()).toInstant();
    }
    /** SCR-36 #11 "OPEN · ngày n": day 1 is the opening day; null once the case is closed. */
    private Integer dayN(HealthCase h,LocalDate today){
        return "CLOSED".equals(upper(h.getStatus()))?null:(int)java.time.temporal.ChronoUnit.DAYS.between(h.getOpenedDate(),today)+1;
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
        List<Vaccination> selected=new ArrayList<>();
        for(Vaccination v:vaccinations){Cattle c=v.getCattle();if(cattleId!=null&&!cattleId.equals(c.getId()))continue;if(vaccineId!=null&&!vaccineId.equals(v.getVaccine().getId()))continue;if(src!=null&&!src.equals(upper(v.getSource())))continue;
            if(!query.isEmpty()&&!contains(c.getDisplayCode(),query)&&!contains(c.getEarTagNumber(),query))continue;selected.add(v);}
        Map<Long,List<CareDtos.VaccinationRevision>> revisions=vaccinationRevisions(farmId,selected.stream().map(Vaccination::getId).toList());
        List<CareDtos.VaccinationHistoryRow> result=new ArrayList<>();
        for(Vaccination v:selected){Cattle c=v.getCattle();
            String name=v.getVaccineNameSnapshot()==null?v.getVaccine().getName():v.getVaccineNameSnapshot();
            PenAssignment pa=pens.get(c.getId());HealthObservation reaction=em.createQuery("select o from HealthObservation o where o.vaccination.id=:id and upper(o.status)='VALID' order by o.observedTime desc",HealthObservation.class).setParameter("id",v.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
            HealthCase hc=reaction==null?null:reaction.getHealthCase();
            result.add(new CareDtos.VaccinationHistoryRow(v.getId(),v.getAdministeredAt(),v.getVaccinationDate(),c.getId(),c.getDisplayCode(),pa==null?null:pa.getPen().getId(),pa==null?null:pa.getPen().getCode(),pa==null?null:pa.getPen().getName(),v.getVaccine().getId(),name,v.getDose(),v.getBatchNo(),v.getSource(),v.getVaccinator(),v.getWithdrawalEndDate(),hc==null?null:hc.getId(),hc==null?null:hc.getCaseCode(),v.getStatus(),v.getCorrected(),v.getVersion(),
                v.getRoute(),"ON_FARM".equalsIgnoreCase(v.getSource())?v.getWithdrawalDays():null,revisions.getOrDefault(v.getId(),List.of())));
        }
        return result;
    }

    /** GAP-FE09-03: revisions of the listed records in one query (no per-row lookup), oldest first. */
    @SuppressWarnings("unchecked")
    private Map<Long,List<CareDtos.VaccinationRevision>> vaccinationRevisions(Long farmId,List<Long> ids){
        Map<Long,List<CareDtos.VaccinationRevision>> result=new HashMap<>();if(ids.isEmpty())return result;
        em.createQuery("select r from RecordRevision r left join fetch r.actor where r.farm.id=:farm and r.sourceType='Vaccination' and r.sourceId in :ids order by r.changedAt,r.id",vn.edu.fpt.beefcare.domain.RecordRevision.class)
            .setParameter("farm",farmId).setParameter("ids",ids).getResultList()
            .forEach(r->result.computeIfAbsent(r.getSourceId(),k->new ArrayList<>()).add(new CareDtos.VaccinationRevision(r.getId(),r.getChangedAt(),
                r.getActor()==null?null:r.getActor().getFullName(),r.getAction(),r.getReason(),
                r.getBeforeSnapshot()==null?null:JsonSupport.fromJson(r.getBeforeSnapshot(),Map.class),r.getAfterSnapshot()==null?null:JsonSupport.fromJson(r.getAfterSnapshot(),Map.class))));
        return result;
    }

    private Cattle cattle(Long farmId,Long id){return em.createQuery("select c from Cattle c left join fetch c.breed left join fetch c.purpose where c.id=:id and c.farm.id=:farm",Cattle.class).setParameter("id",id).setParameter("farm",farmId).getResultStream().findFirst().orElseThrow(()->DomainException.notFound(MessageCodes.COM_08,"cattleId",id));}
    private Map<Long,PenAssignment> currentPens(Long farmId,LocalDate date){Map<Long,PenAssignment> result=new HashMap<>();em.createQuery("select p from PenAssignment p join fetch p.pen where p.farm.id=:farm and p.fromDate<=:date and (p.toDate is null or p.toDate>=:date) order by p.fromDate desc",PenAssignment.class).setParameter("farm",farmId).setParameter("date",date).getResultList().forEach(p->result.putIfAbsent(p.getCattle().getId(),p));return result;}
    private boolean contains(String value,String search){return value!=null&&value.toLowerCase(Locale.ROOT).contains(search);}
    private String upper(String s){return s==null?"":s.trim().toUpperCase(Locale.ROOT);}
}
