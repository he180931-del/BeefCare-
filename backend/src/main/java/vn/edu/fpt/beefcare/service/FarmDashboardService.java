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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardView;

/** Farm dashboard indicators are read-time projections from current domain records (GBR-65). */
@Service
public class FarmDashboardService {
    private final EntityManager em;
    private final FarmAccessService access;
    private final FarmClock clock;
    private final ObjectMapper json;

    public FarmDashboardService(EntityManager em,FarmAccessService access,FarmClock clock,ObjectMapper json){
        this.em=em;this.access=access;this.clock=clock;this.json=json;
    }

    @Transactional(readOnly=true)
    public DashboardView dashboard(Long farmId,DashboardRequest request){
        FarmContext context=access.require(farmId,FarmAction.VIEW_REPORTS);
        LocalDate today=clock.today();
        LocalDate from=request==null||request.from()==null?today.minusDays(29):request.from();
        LocalDate to=request==null||request.to()==null?today:request.to();
        validatePeriod(from,to);
        List<Cattle> allActive=em.createQuery("select c from Cattle c left join fetch c.breed left join fetch c.purpose where c.farm.id=:farm and c.herdStatus=:status order by c.id",Cattle.class)
            .setParameter("farm",farmId).setParameter("status",HerdStatus.ACTIVE).getResultList();
        Map<Long,PenAssignment> currentAssignments=currentAssignments(allActive);
        List<Cattle> cattle=allActive.stream().filter(c->matchesFilters(c,request,currentAssignments)).toList();
        Map<String,Object> indicators=new LinkedHashMap<>();List<Map<String,Object>> attention=new ArrayList<>();

        Map<String,Long> breedCounts=new TreeMap<>();Map<String,Long> groups=new LinkedHashMap<>();
        for(String group:List.of("BREEDING_FEMALES","YOUNG_STOCK","FATTENING","CALVES","BREEDING_BULLS","OTHER"))groups.put(group,0L);
        long monitoring=0,underTreatment=0,withdrawal=0,pregnant=0,overdue=0;
        Map<String,Object> params=parameters(farmId,today);
        Map<Long,DashboardCattleState> states=dashboardStates(farmId,cattle,today,params,clock.zone());
        DashboardWeights weights=latestWeights(cattle);
        Map<Long,BigDecimal> latestWeights=new HashMap<>();
        for(Cattle animal:cattle){
            breedCounts.merge(animal.getBreed()==null?"Unknown":animal.getBreed().getName(),1L,Long::sum);
            String group=herdGroup(animal);groups.merge(group,1L,Long::sum);
            DashboardCattleState state=states.get(animal.getId());String health=state.healthState();
            if("MONITORING".equals(health)||"UNDER_TREATMENT".equals(health))monitoring++;
            if("UNDER_TREATMENT".equals(health))underTreatment++;
            if(state.withdrawalEndDate()!=null)withdrawal++;
            if("PREGNANT".equals(state.reproductiveStatus())&&"BREEDING_FEMALES".equals(group))pregnant++;
            WeightSnapshot snapshot=weights.latest().get(animal.getId());
            LocalDate latestDate=snapshot==null?null:snapshot.date();
            if(latestDate==null)latestDate=weights.entryDates().get(animal.getId());
            if(latestDate!=null){
                if(snapshot!=null&&snapshot.weight()!=null)latestWeights.put(animal.getId(),snapshot.weight());
                Integer interval=number(params,"WEIGHING_INTERVAL_DAYS");
                if(interval!=null && latestDate.plusDays(interval).isBefore(today))overdue++;
            }
        }
        indicators.put("M01",Map.of("count",cattle.size(),"byBreed",breedCounts));
        indicators.put("M02",Map.of("attentionCount",monitoring,"underTreatment",underTreatment,"activeWithdrawal",withdrawal));
        indicators.put("M05",Map.of("byHerdGroup",groups,"pregnantBreedingFemales",pregnant));
        if(params.containsKey("WEIGHING_INTERVAL_DAYS"))indicators.put("M07",Map.of("overdueCount",overdue));
        indicators.put("M08",penOccupancy(farmId,today));
        Map<String,Object> growth=averageDailyGain(cattle,from,to);
        indicators.put("M06",growth);
        Map<String,Object> calvings=expectedCalvings(cattle,states,today);
        indicators.put("M04",calvings);
        Map<String,Object> vaccination=vaccinationDue(farmId,today);
        indicators.put("M03",vaccination);
        Map<String,Object> draftCalves=draftCalves(farmId,today);
        Map<String,Object> pendingExits=pendingExits(farmId,today);
        Map<String,Object> reproductive=reproductionAtGlance(farmId,today,cattle,states,params,clock.zone());
        indicators.put("M09",reproductive);
        List<Map<String,Object>> needs=needsAttention(farmId,today,vaccination);
        indicators.put("A01",Map.of("count",needs.size(),"items",needs));attention.addAll(needs);
        Map<String,Object> finishing=finishingReached(cattle,latestWeights,currentAssignments,params);
        indicators.put("A04",finishing);
        attention.addAll((List<Map<String,Object>>) finishing.get("cattle"));
        attention.addAll((List<Map<String,Object>>) draftCalves.get("items"));
        attention.addAll((List<Map<String,Object>>) pendingExits.get("items"));
        indicators.put("A02",draftCalves);indicators.put("A03",pendingExits);
        return new DashboardView(context.farm().getName(),allActive.size(),context.farm().getServiceStatus(),clock.now(),Map.copyOf(indicators),List.copyOf(attention));
    }

    private Map<Long,PenAssignment> currentAssignments(List<Cattle> cattle){
        if(cattle.isEmpty())return Map.of();Set<Long> ids=cattle.stream().map(Cattle::getId).collect(java.util.stream.Collectors.toSet());Map<Long,PenAssignment> result=new HashMap<>();
        for(PenAssignment assignment:em.createQuery("select a from PenAssignment a join fetch a.pen where a.cattle.id in :ids and a.toDate is null order by a.cattle.id,a.id",PenAssignment.class).setParameter("ids",ids).getResultList())result.putIfAbsent(assignment.getCattle().getId(),assignment);
        return result;
    }

    private Map<Long,DashboardCattleState> dashboardStates(Long farmId,List<Cattle> cattle,LocalDate today,Map<String,Object> params,ZoneId farmZone){
        if(cattle.isEmpty())return Map.of();Set<Long> ids=cattle.stream().map(Cattle::getId).collect(java.util.stream.Collectors.toSet());
        Map<Long,Long> openCases=new HashMap<>(),treatedCases=new HashMap<>();
        for(Object[] row:em.createQuery("select h.cattle.id,count(h) from HealthCase h where h.cattle.id in :ids and upper(h.status) in ('OPEN','CHRONIC') group by h.cattle.id",Object[].class).setParameter("ids",ids).getResultList())openCases.put((Long)row[0],(Long)row[1]);
        for(Object[] row:em.createQuery("select h.cattle.id,count(distinct h.id) from HealthCase h join Treatment t on t.healthCase.id=h.id where h.cattle.id in :ids and upper(h.status)='OPEN' and (t.status is null or upper(t.status)='VALID') group by h.cattle.id",Object[].class).setParameter("ids",ids).getResultList())treatedCases.put((Long)row[0],(Long)row[1]);
        Map<Long,LocalDate> withdrawalByCattle=new HashMap<>();
        for(Object[] row:em.createQuery("select t.healthCase.cattle.id,max(t.withdrawalEndDate) from Treatment t where t.healthCase.cattle.id in :ids and (t.status is null or upper(t.status)='VALID') group by t.healthCase.cattle.id",Object[].class).setParameter("ids",ids).getResultList())if(row[1]!=null)withdrawalByCattle.put((Long)row[0],(LocalDate)row[1]);
        for(Object[] row:em.createQuery("select v.cattle.id,max(v.withdrawalEndDate) from Vaccination v where v.cattle.id in :ids and (v.source is null or upper(v.source)<>'HISTORICAL') and upper(v.status)='VALID' group by v.cattle.id",Object[].class).setParameter("ids",ids).getResultList())if(row[1]!=null)withdrawalByCattle.merge((Long)row[0],(LocalDate)row[1],(a,b)->a.isAfter(b)?a:b);

        Map<Long,PregnancyEpisode> openPregnancies=new HashMap<>();
        for(PregnancyEpisode episode:em.createQuery("select p from PregnancyEpisode p where p.cattle.id in :ids and upper(p.status)='OPEN' order by p.cattle.id,p.id desc",PregnancyEpisode.class).setParameter("ids",ids).getResultList())openPregnancies.putIfAbsent(episode.getCattle().getId(),episode);
        Map<Long,ReproductionEvent> latestEvents=new HashMap<>();
        for(ReproductionEvent event:em.createQuery("select e from ReproductionEvent e left join fetch e.linkedEvent where e.cattle.id in :ids and upper(e.status)='VALID' order by e.cattle.id,e.eventTime desc,e.id desc",ReproductionEvent.class).setParameter("ids",ids).getResultList())latestEvents.putIfAbsent(event.getCattle().getId(),event);
        Map<Long,CalvingEvent> latestCalvings=new HashMap<>();
        for(CalvingEvent event:em.createQuery("select c from CalvingEvent c where c.dam.id in :ids and upper(c.status)='VALID' order by c.dam.id,c.birthTime desc,c.id desc",CalvingEvent.class).setParameter("ids",ids).getResultList())latestCalvings.putIfAbsent(event.getDam().getId(),event);
        Map<Long,Instant> latestLosses=new HashMap<>();
        for(PregnancyUpdate update:em.createQuery("select u from PregnancyUpdate u where u.episode.cattle.id in :ids and upper(u.status)='VALID' and upper(u.type)='LOSS' order by u.episode.cattle.id,u.occurredTime desc,u.id desc",PregnancyUpdate.class).setParameter("ids",ids).getResultList())latestLosses.putIfAbsent(update.getEpisode().getCattle().getId(),update.getOccurredTime());

        int postpartum=effectiveInt(params,45,"POST_CALVING_DAYS","postpartumIntervalDays","postpartum_interval_days");Map<Long,DashboardCattleState> result=new HashMap<>();
        for(Cattle animal:cattle){long valid=openCases.getOrDefault(animal.getId(),0L),treated=treatedCases.getOrDefault(animal.getId(),0L);String health=treated>0?"UNDER_TREATMENT":valid>0?"MONITORING":"HEALTHY";LocalDate withdrawal=withdrawalByCattle.get(animal.getId());if(withdrawal!=null&&withdrawal.isBefore(today))withdrawal=null;
            PregnancyEpisode pregnancy=openPregnancies.get(animal.getId());ReproductionEvent latestEvent=latestEvents.get(animal.getId());CalvingEvent latestCalving=latestCalvings.get(animal.getId());Instant latestLoss=latestLosses.get(animal.getId());
            LocalDate expected=pregnancy==null?expectedCalvingDate(latestEvent,latestCalving,latestLoss):pregnancy.getExpectedCalvingDate();
            String reproductive=reproductiveStatus(animal,pregnancy,latestEvent,latestCalving,latestLoss,today,postpartum,farmZone);
            result.put(animal.getId(),new DashboardCattleState(health,withdrawal,reproductive,expected));
        }
        return result;
    }

    private LocalDate expectedCalvingDate(ReproductionEvent latest,CalvingEvent calving,Instant loss){
        if(latest==null)return null;ReproductionEvent source="BREEDING".equalsIgnoreCase(latest.getType())?latest:"PREGNANCY_CHECK".equalsIgnoreCase(latest.getType())&&"INCONCLUSIVE".equalsIgnoreCase(latest.getResult())&&latest.getLinkedEvent()!=null&&"BREEDING".equalsIgnoreCase(latest.getLinkedEvent().getType())?latest.getLinkedEvent():null;
        if(source==null)return null;Instant eventTime=latest.getEventTime(),calvingAt=calving==null?null:calving.getBirthTime();boolean superseded=(calvingAt!=null&&!eventTime.isAfter(calvingAt))||(loss!=null&&!eventTime.isAfter(loss));return superseded?null:source.getTentativeExpectedCalvingDate();
    }

    private String reproductiveStatus(Cattle cattle,PregnancyEpisode pregnancy,ReproductionEvent event,CalvingEvent calving,Instant loss,LocalDate today,int postpartum,ZoneId farmZone){
        if(pregnancy!=null)return "PREGNANT";
        if(cattle.getSex()==null||!"FEMALE".equalsIgnoreCase(cattle.getSex().name()))return "NOT_APPLICABLE";
        if(cattle.getLifeStage()==null||!(cattle.getLifeStage()==LifeStage.YOUNG_STOCK||cattle.getLifeStage()==LifeStage.ADULT))return "NOT_APPLICABLE";
        PurposeType purpose=cattle.getPurpose()==null?null:cattle.getPurpose().getPurposeType();if(purpose!=PurposeType.BREEDING&&purpose!=PurposeType.UNDECIDED)return "NOT_APPLICABLE";
        Instant eventAt=event==null?null:event.getEventTime(),calvingAt=calving==null?null:calving.getBirthTime();Instant last=latest(eventAt,calvingAt,loss);if(last==null)return "AWAITING_BREEDING";
        if(loss!=null&&last.equals(loss))return "AWAITING_BREEDING";
        if(calvingAt!=null&&last.equals(calvingAt))return !calvingAt.isBefore(today.minusDays(postpartum).atStartOfDay(farmZone).toInstant())?"POST_CALVING":"AWAITING_BREEDING";
        if(event!=null&&last.equals(eventAt)){String type=Objects.toString(event.getType(),"").toUpperCase(Locale.ROOT);if("ESTRUS".equals(type)&&!eventAt.isBefore(clock.now().minusSeconds(86_400)))return "IN_ESTRUS";if("BREEDING".equals(type))return "BRED";if("PREGNANCY_CHECK".equals(type)&&"INCONCLUSIVE".equalsIgnoreCase(event.getResult()))return "BRED";}
        return "AWAITING_BREEDING";
    }

    private Instant latest(Instant... values){Instant result=null;for(Instant value:values)if(value!=null&&(result==null||value.isAfter(result)))result=value;return result;}

    private int effectiveInt(Map<String,Object> values,int fallback,String... keys){for(String key:keys){Object value=values.get(key);if(value instanceof Number n)return n.intValue();}return fallback;}

    private DashboardWeights latestWeights(List<Cattle> cattle){
        if(cattle.isEmpty())return new DashboardWeights(Map.of(),Map.of());Set<Long> ids=cattle.stream().map(Cattle::getId).collect(java.util.stream.Collectors.toSet());Map<Long,WeightSnapshot> latest=new HashMap<>();
        for(Growth growth:em.createQuery("select g from Growth g where g.cattle.id in :ids and g.status in ('VALID','CORRECTED') and g.weightKg is not null order by g.cattle.id,g.checkDate desc,g.id desc",Growth.class).setParameter("ids",ids).getResultList())latest.putIfAbsent(growth.getCattle().getId(),new WeightSnapshot(growth.getCheckDate(),growth.getWeightKg()));
        Map<Long,LocalDate> entries=new HashMap<>();for(Object[] row:em.createQuery("select e.cattle.id,min(e.entryDate) from HerdEntry e where e.cattle.id in :ids and e.status<>:draft and e.status<>:voided group by e.cattle.id",Object[].class).setParameter("ids",ids).setParameter("draft",EntryLineStatus.DRAFT).setParameter("voided",EntryLineStatus.VOID).getResultList())entries.put((Long)row[0],(LocalDate)row[1]);
        return new DashboardWeights(latest,entries);
    }

    private record DashboardCattleState(String healthState,LocalDate withdrawalEndDate,String reproductiveStatus,LocalDate expectedCalvingDate){}
    private record WeightSnapshot(LocalDate date,BigDecimal weight){}
    private record DashboardWeights(Map<Long,WeightSnapshot> latest,Map<Long,LocalDate> entryDates){}

    private Map<String,Object> expectedCalvings(List<Cattle> cattle,Map<Long,DashboardCattleState> states,LocalDate today){
        long within30=0,within7=0;for(Cattle animal:cattle){LocalDate date=states.get(animal.getId()).expectedCalvingDate();if(date!=null&&!date.isBefore(today)&&!date.isAfter(today.plusDays(30))){within30++;if(!date.isAfter(today.plusDays(7)))within7++;}}
        return Map.of("within30Days",within30,"within7Days",within7);
    }

    private Map<String,Object> vaccinationDue(Long farmId,LocalDate today){
        List<ScheduledDose> doses=em.createQuery("select d from ScheduledDose d join fetch d.cattle join fetch d.schedule where d.cattle.farm.id=:farm and d.cattle.herdStatus=:active and d.schedule.status='ACTIVE' and d.status in ('PLANNED','DEFERRED') order by d.dueDate,d.id",ScheduledDose.class)
            .setParameter("farm",farmId).setParameter("active",HerdStatus.ACTIVE).getResultList();
        long due=0,overdue=0;List<Map<String,Object>> rows=new ArrayList<>();
        for(ScheduledDose dose:doses){LocalDate date=dose.getStatus().equals("DEFERRED")&&dose.getNewExpectedDate()!=null?dose.getNewExpectedDate():dose.getDueDate();if(!date.isAfter(today.plusDays(7))){due++;if(date.isBefore(today))overdue++;Map<String,Object> row=new LinkedHashMap<>();row.put("doseId",dose.getId());row.put("cattleId",dose.getCattle().getId());row.put("cattleCode",dose.getCattle().getDisplayCode());row.put("scheduleId",dose.getSchedule().getId());row.put("doseNo",dose.getDoseNo());row.put("dueDate",date);row.put("status",date.isBefore(today)?"OVERDUE":"DUE");rows.add(row);}}
        return Map.of("dueWithin7Days",due,"overdue",overdue,"doses",rows);
    }

    private Map<String,Object> draftCalves(Long farmId,LocalDate today){List<CalfOutcome> calves=em.createQuery("select c from CalfOutcome c join fetch c.calving calving join fetch calving.dam where calving.dam.farm.id=:farm and c.registrationState='PENDING_CONFIRMATION' and upper(calving.status) in ('VALID','CORRECTED') and upper(c.status)<>'VOIDED' order by calving.birthTime",CalfOutcome.class).setParameter("farm",farmId).getResultList();List<Map<String,Object>> rows=new ArrayList<>();for(CalfOutcome calf:calves){Map<String,Object> row=new LinkedHashMap<>();row.put("calfOutcomeId",calf.getId());row.put("damId",calf.getCalving().getDam().getId());row.put("damCode",calf.getCalving().getDam().getDisplayCode());row.put("birthTime",calf.getCalving().getBirthTime());row.put("highlighted",calf.getCalving().getBirthTime().plus(3,ChronoUnit.DAYS).isBefore(clock.now()));rows.add(row);}return Map.of("count",rows.size(),"items",rows);}

    private Map<String,Object> pendingExits(Long farmId,LocalDate today){List<HerdExitVoucher> vouchers=em.createQuery("select v from HerdExitVoucher v where v.farm.id=:farm and v.exitType=:type and v.status=:status order by v.exitDate",HerdExitVoucher.class).setParameter("farm",farmId).setParameter("type",ExitType.DEATH).setParameter("status",ExitVoucherStatus.PENDING).getResultList();List<Map<String,Object>> rows=vouchers.stream().map(v->{Map<String,Object> row=new LinkedHashMap<>();row.put("voucherId",v.getId());row.put("code",v.getCode());row.put("exitDate",v.getExitDate());row.put("highlighted",v.getCreatedAt()!=null&&v.getCreatedAt().plus(3,ChronoUnit.DAYS).isBefore(clock.now()));return row;}).toList();return Map.of("count",rows.size(),"items",rows);}

    private Map<String,Object> reproductionAtGlance(Long farmId,LocalDate today,List<Cattle> cattle,Map<Long,DashboardCattleState> states,Map<String,Object> params,ZoneId zone){
        List<CalvingEvent> events=em.createQuery("select c from CalvingEvent c where c.dam.farm.id=:farm and c.birthTime<:until and upper(c.status) in ('VALID','CORRECTED') order by c.dam.id,c.birthTime",CalvingEvent.class).setParameter("farm",farmId).setParameter("until",today.plusDays(1).atStartOfDay(zone).toInstant()).getResultList();
        Map<Long,List<LocalDate>> byDam=new HashMap<>();events.forEach(c->byDam.computeIfAbsent(c.getDam().getId(),k->new ArrayList<>()).add(c.getBirthTime().atZone(zone).toLocalDate()));List<BigDecimal> intervals=new ArrayList<>();byDam.values().forEach(ds->{for(int i=1;i<ds.size();i++)if(!ds.get(i).isBefore(today.minusYears(1)))intervals.add(BigDecimal.valueOf(ChronoUnit.DAYS.between(ds.get(i-1),ds.get(i))));});
        List<ReproductionEvent> checks=em.createQuery("select e from ReproductionEvent e left join fetch e.linkedEvent where e.cattle.farm.id=:farm and e.type='PREGNANCY_CHECK' and upper(e.status) in ('VALID','CORRECTED') and e.eventTime>=:from and e.eventTime<:until",ReproductionEvent.class).setParameter("farm",farmId).setParameter("from",today.minusYears(1).atStartOfDay(zone).toInstant()).setParameter("until",today.plusDays(1).atStartOfDay(zone).toInstant()).getResultList();long decided=checks.stream().filter(e->e.getLinkedEvent()!=null&&Set.of("PREGNANT","NOT_PREGNANT").contains(Objects.toString(e.getResult(),"").toUpperCase(Locale.ROOT))).count();long pregnant=checks.stream().filter(e->e.getLinkedEvent()!=null&&"PREGNANT".equalsIgnoreCase(e.getResult())).count();BigDecimal rate=decided==0?null:BigDecimal.valueOf(pregnant).divide(BigDecimal.valueOf(decided),4,java.math.RoundingMode.HALF_UP);
        List<Map<String,Object>> overdue=new ArrayList<>();int postpartum=Optional.ofNullable(number(params,"POST_CALVING_DAYS")).orElse(45),cycle=Optional.ofNullable(number(params,"ESTRUS_CYCLE_DAYS")).orElse(21);for(Cattle c:cattle){if(!"BREEDING_FEMALES".equals(herdGroup(c)))continue;List<LocalDate> dates=byDam.get(c.getId());if(dates==null||dates.isEmpty()||"PREGNANT".equals(states.get(c.getId()).reproductiveStatus()))continue;LocalDate last=dates.get(dates.size()-1);long days=ChronoUnit.DAYS.between(last,today);if(days>postpartum+3L*cycle)overdue.add(Map.of("cattleId",c.getId(),"displayCode",c.getDisplayCode(),"daysSinceCalving",days));}
        return Map.of("averageCalvingInterval",indicator(average(intervals),intervals.size()),"overallConceptionRate",indicator(rate,decided),"overdueFemales",overdue,"overdueCount",overdue.size());
    }

    private Map<String,Object> indicator(BigDecimal value,long n){Map<String,Object> result=new LinkedHashMap<>();result.put("value",n<3?null:value);result.put("n",n);result.put("status",n<3?"INSUFFICIENT_DATA":"AVAILABLE");return result;}
    private BigDecimal average(List<BigDecimal> values){return values.isEmpty()?null:values.stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(values.size()),3,java.math.RoundingMode.HALF_UP);}

    private List<Map<String,Object>> needsAttention(Long farmId,LocalDate today,Map<String,Object> vaccination){
        List<Map<String,Object>> result=new ArrayList<>();Object raw=vaccination.get("doses");if(raw instanceof List<?> doses)for(Object item:doses)if(item instanceof Map<?,?> dose&&"OVERDUE".equals(dose.get("status"))){Map<String,Object> row=new LinkedHashMap<>();dose.forEach((k,v)->row.put(String.valueOf(k),v));row.put("type","OVERDUE_VACCINATION");result.add(row);}
        ZoneId zone=clock.zone();List<ReproductionEvent> estrus=em.createQuery("select e from ReproductionEvent e join fetch e.cattle where e.cattle.farm.id=:farm and e.type='ESTRUS' and upper(e.status) in ('VALID','CORRECTED') and e.eventTime>=:from and e.eventTime<:to",ReproductionEvent.class).setParameter("farm",farmId).setParameter("from",today.atStartOfDay(zone).toInstant().minus(12,ChronoUnit.HOURS)).setParameter("to",today.plusDays(1).atStartOfDay(zone).toInstant()).getResultList();for(ReproductionEvent e:estrus){Instant from=e.getEventTime().plus(8,ChronoUnit.HOURS),to=e.getEventTime().plus(12,ChronoUnit.HOURS);if(!clock.now().isBefore(from)&&!clock.now().isAfter(to))result.add(Map.of("type","BREEDING_WINDOW","sourceId",e.getId(),"cattleId",e.getCattle().getId(),"displayCode",e.getCattle().getDisplayCode(),"dueAt",to));}
        List<ReproductionEvent> breedings=em.createQuery("select e from ReproductionEvent e join fetch e.cattle where e.cattle.farm.id=:farm and e.type='BREEDING' and upper(e.status) in ('VALID','CORRECTED') and e.eventTime<=:cutoff",ReproductionEvent.class).setParameter("farm",farmId).setParameter("cutoff",today.atStartOfDay(zone).toInstant().minus(28,ChronoUnit.DAYS)).getResultList();Set<Long> breedingIds=breedings.stream().map(ReproductionEvent::getId).collect(java.util.stream.Collectors.toSet());Set<Long> checkedBreedingIds=breedingIds.isEmpty()?Set.of():new HashSet<>(em.createQuery("select distinct e.linkedEvent.id from ReproductionEvent e where e.linkedEvent.id in :ids and e.type='PREGNANCY_CHECK' and upper(e.status) in ('VALID','CORRECTED')",Long.class).setParameter("ids",breedingIds).getResultList());for(ReproductionEvent b:breedings)if(!checkedBreedingIds.contains(b.getId()))result.add(Map.of("type","PREGNANCY_CHECK_DUE","sourceId",b.getId(),"cattleId",b.getCattle().getId(),"displayCode",b.getCattle().getDisplayCode()));
        List<PregnancyEpisode> episodes=em.createQuery("select p from PregnancyEpisode p join fetch p.cattle where p.cattle.farm.id=:farm and upper(p.status)='OPEN' and p.expectedCalvingDate between :from and :to",PregnancyEpisode.class).setParameter("farm",farmId).setParameter("from",today).setParameter("to",today.plusDays(7)).getResultList();for(PregnancyEpisode p:episodes)result.add(Map.of("type","CALVING_WITHIN_7_DAYS","sourceId",p.getId(),"cattleId",p.getCattle().getId(),"displayCode",p.getCattle().getDisplayCode(),"expectedDate",p.getExpectedCalvingDate()));
        List<HealthCase> cases=em.createQuery("select h from HealthCase h join fetch h.cattle where h.cattle.farm.id=:farm and h.openedDate=:today",HealthCase.class).setParameter("farm",farmId).setParameter("today",today).getResultList();for(HealthCase h:cases)result.add(Map.of("type","CASE_OPENED_TODAY","sourceId",h.getId(),"cattleId",h.getCattle().getId(),"displayCode",h.getCattle().getDisplayCode()));return List.copyOf(result);
    }

    private Map<String,Object> averageDailyGain(List<Cattle> cattle,LocalDate from,LocalDate to){
        Map<Long,BigDecimal> byPen=new TreeMap<>();Map<Long,Integer> penCounts=new HashMap<>();Map<String,BigDecimal> byGroup=new TreeMap<>();Map<String,Integer> groupCounts=new HashMap<>();List<BigDecimal> all=new ArrayList<>();
        if(cattle.isEmpty()){Map<String,Object> empty=new LinkedHashMap<>();empty.put("sampleCount",0);empty.put("averageKgPerDay",null);empty.put("byHerdGroup",Map.of());empty.put("byPen",Map.of());return empty;}Set<Long> ids=cattle.stream().map(Cattle::getId).collect(java.util.stream.Collectors.toSet());Map<Long,List<Growth>> weightsByCattle=new HashMap<>();
        for(Growth growth:em.createQuery("select g from Growth g where g.cattle.id in :ids and g.status in ('VALID','CORRECTED') and g.weightKg is not null and g.checkDate between :from and :to order by g.cattle.id,g.checkDate,g.id",Growth.class).setParameter("ids",ids).setParameter("from",from).setParameter("to",to).getResultList())weightsByCattle.computeIfAbsent(growth.getCattle().getId(),ignored->new ArrayList<>()).add(growth);
        Map<Long,List<PenAssignment>> assignmentByCattle=new HashMap<>();for(PenAssignment assignment:em.createQuery("select a from PenAssignment a join fetch a.pen where a.cattle.id in :ids and a.fromDate<=:to and (a.toDate is null or a.toDate>=:from) order by a.cattle.id,a.fromDate desc",PenAssignment.class).setParameter("ids",ids).setParameter("from",from).setParameter("to",to).getResultList())assignmentByCattle.computeIfAbsent(assignment.getCattle().getId(),ignored->new ArrayList<>()).add(assignment);
        for(Cattle animal:cattle){List<Growth> weights=weightsByCattle.getOrDefault(animal.getId(),List.of());if(weights.size()<2)continue;Growth first=weights.get(0),last=weights.get(weights.size()-1);long days=ChronoUnit.DAYS.between(first.getCheckDate(),last.getCheckDate());if(days<14)continue;
            BigDecimal adg=last.getWeightKg().subtract(first.getWeightKg()).divide(BigDecimal.valueOf(days),3,java.math.RoundingMode.HALF_UP);all.add(adg);
            PenAssignment assignment=assignmentByCattle.getOrDefault(animal.getId(),List.of()).stream().filter(a->!a.getFromDate().isAfter(last.getCheckDate())&&(a.getToDate()==null||!a.getToDate().isBefore(last.getCheckDate()))).findFirst().orElse(null);Long penId=assignment==null?null:assignment.getPen().getId();if(penId!=null){byPen.merge(penId,adg,BigDecimal::add);penCounts.merge(penId,1,Integer::sum);}String group=herdGroup(animal);byGroup.merge(group,adg,BigDecimal::add);groupCounts.merge(group,1,Integer::sum);
        }
        Map<String,Object> grouped=new LinkedHashMap<>();byGroup.forEach((key,total)->grouped.put(key,Map.of("averageKgPerDay",total.divide(BigDecimal.valueOf(groupCounts.get(key)),3,java.math.RoundingMode.HALF_UP),"sampleCount",groupCounts.get(key))));
        // Keep the aggregate denominator truthful; individual cattle counts are returned alongside averages.
        Map<Long,Object> penRows=new LinkedHashMap<>();byPen.forEach((key,total)->penRows.put(key,Map.of("averageKgPerDay",total.divide(BigDecimal.valueOf(penCounts.get(key)),3,java.math.RoundingMode.HALF_UP),"sampleCount",penCounts.get(key))));
        BigDecimal average=all.isEmpty()?null:all.stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(all.size()),3,java.math.RoundingMode.HALF_UP);
        Map<String,Object> result=new LinkedHashMap<>();result.put("sampleCount",all.size());result.put("averageKgPerDay",average);result.put("byHerdGroup",grouped);result.put("byPen",penRows);return result;
    }

    private Map<String,Object> penOccupancy(Long farmId,LocalDate today){List<Pen> pens=em.createQuery("select p from Pen p where p.farm.id=:farm and p.status=:active order by p.code",Pen.class).setParameter("farm",farmId).setParameter("active",ActiveStatus.ACTIVE).getResultList();if(pens.isEmpty())return Map.of("totalHead",0,"totalCapacity",0,"byPen",List.of());Set<Long> ids=pens.stream().map(Pen::getId).collect(java.util.stream.Collectors.toSet());Map<Long,Long> counts=new HashMap<>();for(Object[] row:em.createQuery("select a.pen.id,count(a) from PenAssignment a where a.pen.id in :ids and a.fromDate<=:today and (a.toDate is null or a.toDate>=:today) group by a.pen.id",Object[].class).setParameter("ids",ids).setParameter("today",today).getResultList())counts.put((Long)row[0],(Long)row[1]);List<Map<String,Object>> rows=new ArrayList<>();long totalHead=0,totalCapacity=0;for(Pen pen:pens){long head=counts.getOrDefault(pen.getId(),0L);totalHead+=head;totalCapacity+=pen.getCapacity();rows.add(Map.of("penId",pen.getId(),"code",pen.getCode(),"head",head,"capacity",pen.getCapacity()));}return Map.of("totalHead",totalHead,"totalCapacity",totalCapacity,"byPen",rows);}

    private Map<String,Object> finishingReached(List<Cattle> cattle,Map<Long,BigDecimal> latest,Map<Long,PenAssignment> currentAssignments,Map<String,Object> params){Object targetValue=params.get("TARGET_FINISHING_WEIGHT_KG");if(!(targetValue instanceof Number))return Map.of("enabled",false,"cattle",List.of());BigDecimal target=new BigDecimal(targetValue.toString());List<Map<String,Object>> reached=new ArrayList<>();for(Cattle c:cattle)if(c.getPurpose()!=null&&c.getPurpose().getPurposeType()==PurposeType.FATTENING){BigDecimal weight=latest.get(c.getId());if(weight!=null&&weight.compareTo(target)>=0){PenAssignment assignment=currentAssignments.get(c.getId());Map<String,Object> row=new LinkedHashMap<>();row.put("cattleId",c.getId());row.put("displayCode",c.getDisplayCode());row.put("pen",assignment==null?null:assignment.getPen().getCode());row.put("latestWeightKg",weight);row.put("targetKg",target);reached.add(row);}}return Map.of("enabled",true,"targetKg",target,"cattle",reached);}

    private String herdGroup(Cattle c){if(c.getLifeStage()==LifeStage.UNWEANED_CALF||c.getLifeStage()==LifeStage.WEANED_CALF)return "CALVES";PurposeType p=c.getPurpose()==null?null:c.getPurpose().getPurposeType();if(p==PurposeType.FATTENING)return "FATTENING";if(p==PurposeType.SIRE)return "BREEDING_BULLS";if(p==PurposeType.BREEDING&&c.getSex()!=null&&"FEMALE".equals(c.getSex().name())&&c.getLifeStage()==LifeStage.ADULT)return "BREEDING_FEMALES";if(c.getLifeStage()==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";return "OTHER";}
    private boolean matchesFilters(Cattle c,DashboardRequest request,Map<Long,PenAssignment> currentAssignments){if(request==null)return true;if(request.lifeStage()!=null&&!request.lifeStage().isBlank()&&!c.getLifeStage().name().equalsIgnoreCase(request.lifeStage()))return false;if(request.herdGroup()!=null&&!request.herdGroup().isBlank()&&!herdGroup(c).equalsIgnoreCase(request.herdGroup()))return false;if(request.penId()!=null){PenAssignment assignment=currentAssignments.get(c.getId());return assignment!=null&&request.penId().equals(assignment.getPen().getId());}return true;}
    private Map<String,Object> parameters(Long farmId,LocalDate date){List<FarmParameterVersion> versions=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class).setParameter("farm",farmId).setParameter("date",date).setMaxResults(1).getResultList();if(versions.isEmpty())return Map.of();try{return json.readValue(versions.get(0).getParameterValues(),new TypeReference<>(){});}catch(Exception ignored){return Map.of();}}
    private Integer number(Map<String,Object> values,String key){Object value=values.get(key);if(!(value instanceof Number))return null;return new BigDecimal(value.toString()).intValue();}
    private void validatePeriod(LocalDate from,LocalDate to){if(from.isAfter(to))throw DomainException.invalid("period");if(from.plusMonths(24).isBefore(to))throw DomainException.unprocessable(MessageCodes.COM_10,"field","period","maximumMonths",24);}
}
