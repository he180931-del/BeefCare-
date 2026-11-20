package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportChart;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportChartBar;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportMetricChart;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportMetricChartBar;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportSection;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportTotalRow;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportView;

/** Read-only implementation of the seven FE-15 reports, calculated from tenant-scoped source tables. */
@Service
public class FarmReportService {
    private final EntityManager em;private final FarmAccessService access;private final FarmClock clock;
    public FarmReportService(EntityManager em,FarmAccessService access,FarmClock clock){this.em=em;this.access=access;this.clock=clock;}

    @Transactional(readOnly=true)
    public ReportView report(Long farmId,ReportRequest request){
        access.require(farmId,FarmAction.VIEW_REPORTS);validate(request);
        List<Map<String,Object>> rows=new ArrayList<>();Map<String,Object> summary=new LinkedHashMap<>();List<String> unavailable=new ArrayList<>();List<ReportChartBar> chartBars=null;
        List<ReportSection> sections=new ArrayList<>();List<ReportMetricChart> charts=new ArrayList<>();
        switch(request.reportType()){
            case "RPT-01" -> herd(farmId,request,rows,summary,sections,charts);
            case "RPT-02" -> growth(farmId,request,rows,summary,unavailable,sections,charts);
            case "RPT-03" -> vaccination(farmId,request,rows,summary,unavailable,sections,charts);
            case "RPT-04" -> health(farmId,request,rows,summary,unavailable,sections,charts);
            case "RPT-05" -> chartBars=reproduction(farmId,request,rows,summary,unavailable,sections,charts);
            case "RPT-06" -> movements(farmId,request,rows,summary,sections,charts);
            case "RPT-07" -> fattening(farmId,request,rows,summary,unavailable,sections,charts);
            default -> throw DomainException.invalid("reportType");
        }
        ReportTotalRow totalRow="RPT-07".equals(request.reportType())?fatteningTotalRow(summary,rows):null;
        ReportChart chart=chartBars==null?null:new ReportChart("Tỷ lệ thụ thai theo tháng","Lần phối có kết quả khám thai; tỷ lệ chỉ hiện khi n ≥ 3",List.copyOf(chartBars));
        return new ReportView(request.reportType(),request.from(),request.to(),clock.now(),Collections.unmodifiableMap(new LinkedHashMap<>(summary)),List.copyOf(rows),totalRow,chart,List.copyOf(unavailable),List.copyOf(sections),List.copyOf(charts));
    }

    private void herd(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<ReportSection> sections,List<ReportMetricChart> charts){
        LocalDate end=r.to();List<Cattle> animals=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus<>:voided",Cattle.class).setParameter("farm",farm).setParameter("voided",HerdStatus.VOIDED).getResultList();
        Map<String,Long> groups=new TreeMap<>(),pens=new TreeMap<>(),breeds=new TreeMap<>(),purposes=new TreeMap<>(),stages=new TreeMap<>();long head=0;
        for(Cattle c:animals){LocalDate entry=firstEntry(c.getId());LocalDate exit=c.getExitDate();if(entry==null||entry.isAfter(end)||exit!=null&&!exit.isAfter(end)||!matches(c,r,end))continue;head++;groups.merge(groupAt(c,end),1L,Long::sum);breeds.merge(c.getBreed().getName(),1L,Long::sum);purposes.merge(purposeNameAt(c,end),1L,Long::sum);stages.merge(lifeStageAt(c,end),1L,Long::sum);pens.merge(Objects.toString(penAt(c.getId(),end),"Chưa phân chuồng"),1L,Long::sum);}
        rows.addAll(dimensions("herdGroup",groups));rows.addAll(dimensions("pen",pens));rows.addAll(dimensions("breed",breeds));rows.addAll(dimensions("purpose",purposes));rows.addAll(dimensions("lifeStage",stages));
        List<HerdEntry> entryRows=em.createQuery("select e from HerdEntry e where e.farm.id=:farm and e.status=:valid and e.entryDate between :from and :to",HerdEntry.class).setParameter("farm",farm).setParameter("valid",EntryLineStatus.VALID).setParameter("from",r.from()).setParameter("to",end).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getEntryDate())).toList();
        List<HerdExit> exitRows=em.createQuery("select e from HerdExit e where e.farm.id=:farm and e.status=:valid and e.voucher.status=:confirmed and e.voucher.exitDate between :from and :to",HerdExit.class).setParameter("farm",farm).setParameter("valid",ExitLineStatus.CONFIRMED).setParameter("confirmed",ExitVoucherStatus.CONFIRMED).setParameter("from",r.from()).setParameter("to",end).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getVoucher().getExitDate())).toList();
        Map<String,Long> entriesBySource=groupEnum(entryRows.stream().map(e->Objects.toString(e.getSource(),"UNKNOWN")).toList());
        Map<String,Long> exitsByType=groupEnum(exitRows.stream().map(e->Objects.toString(e.getVoucher().getExitType(),"UNKNOWN")).toList());
        rows.addAll(dimensions("entrySource",entriesBySource));rows.addAll(dimensions("exitType",exitsByType));
        summary.put("headAtEnd",head);summary.put("entriesInPeriod",entryRows.size());summary.put("exitsInPeriod",exitRows.size());summary.put("entriesBySource",entriesBySource);summary.put("exitsByType",exitsByType);
        ReportSection groupSection=countSection("herdGroup","Đàn cuối kỳ theo nhóm đàn","Nhóm đàn",groups,"con");
        sections.add(groupSection);sections.add(countSection("pen","Đàn cuối kỳ theo chuồng","Chuồng",pens,"con"));sections.add(countSection("breed","Đàn cuối kỳ theo giống","Giống",breeds,"con"));sections.add(countSection("purpose","Đàn cuối kỳ theo mục đích","Mục đích",purposes,"con"));sections.add(countSection("lifeStage","Đàn cuối kỳ theo giai đoạn","Giai đoạn",stages,"con"));
        sections.add(countSection("entrySource","Nhập đàn theo nguồn","Nguồn nhập",entriesBySource,"lượt"));sections.add(countSection("exitType","Xuất đàn theo loại","Loại xuất",exitsByType,"lượt"));
        charts.add(countChart("Số con cuối kỳ theo nhóm đàn","Mỗi con chỉ xuất hiện trong một nhóm đàn tại ngày cuối kỳ.","con",groupSection.rows(),"count"));
    }

    private void growth(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<String> unavailable,List<ReportSection> sections,List<ReportMetricChart> charts){
        List<Growth> source=em.createQuery("select g from Growth g join fetch g.cattle c join fetch c.breed left join fetch c.purpose where c.farm.id=:farm and upper(g.status)='VALID' and g.checkDate between :from and :to order by c.id,g.checkDate,g.id",Growth.class).setParameter("farm",farm).setParameter("from",r.from()).setParameter("to",r.to()).getResultList();
        Map<GrowthScopeKey,GrowthScope> scopes=growthScopes(farm,r,source);
        List<Growth> selected=source.stream().filter(g->matchesGrowth(g.getCattle(),r,growthScope(g,scopes))).toList();List<Growth> events=selected.stream().filter(g->g.getWeightKg()!=null).toList();long missingWeight=selected.size()-events.size();
        Map<String,List<Growth>> composite=new TreeMap<>(),byPen=growthBuckets(events,"pen",scopes),byGroup=growthBuckets(events,"group",scopes),byStage=growthBuckets(events,"stage",scopes);
        for(Growth g:events){GrowthScope scope=growthScope(g,scopes);String key=scope.herdGroup()+"|"+Objects.toString(scope.penCode(),"Chưa phân chuồng")+"|"+scope.lifeStage();composite.computeIfAbsent(key,k->new ArrayList<>()).add(g);}
        for(var e:composite.entrySet()){Map<String,Object> values=growthRow(e.getKey(),e.getValue());values.remove("label");rows.add(values);}
        long estimated=events.stream().filter(g->"ESTIMATED".equalsIgnoreCase(g.getWeightType())).count();BigDecimal totalWeight=averageWeight(events);List<BigDecimal> adgs=growthAdgs(events);
        summary.put("validWeighings",events.size());summary.put("recordsWithoutWeight",missingWeight);summary.put("averageGroupWeightKg",totalWeight);summary.put("estimatedWeightCount",estimated);summary.put("averageADGKgPerDay",average(adgs));if(missingWeight>0)unavailable.add(missingWeight+" VALID growth records do not contain a weight and are excluded from weighing counts and ADG.");
        ReportSection penSection=growthSection("growthByPen","Tăng trưởng theo chuồng","Chuồng",byPen,events);
        sections.add(penSection);sections.add(growthSection("growthByHerdGroup","Tăng trưởng theo nhóm đàn","Nhóm đàn",byGroup,events));sections.add(growthSection("growthByLifeStage","Tăng trưởng theo giai đoạn","Giai đoạn",byStage,events));
        charts.add(countChart("Lượt cân VALID theo chuồng","Chỉ tính các bản ghi cân VALID có trọng lượng.","lượt cân",penSection.rows(),"validWeighings"));
    }

    private void vaccination(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<String> unavailable,List<ReportSection> sections,List<ReportMetricChart> charts){
        List<ScheduledDose> doses=em.createQuery("select d from ScheduledDose d where d.cattle.farm.id=:farm and d.dueDate between :from and :to",ScheduledDose.class).setParameter("farm",farm).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(d->matches(d.getCattle(),r,d.getDueDate())).toList();
        Map<String,long[]> bySchedule=new TreeMap<>();for(ScheduledDose d:doses){String name=d.getSchedule().getScheduleName();long[] counts=bySchedule.computeIfAbsent(name,k->new long[5]);boolean completed=d.getVaccination()!=null&&"VALID".equalsIgnoreCase(d.getVaccination().getStatus())&&!d.getVaccination().getVaccinationDate().isAfter(r.to());String state=completed?"DONE":d.getStatus();if("DONE".equalsIgnoreCase(state)&&completed)counts[1]++;else if("DEFERRED".equalsIgnoreCase(state))counts[2]++;else if("CANCELLED".equalsIgnoreCase(state))counts[4]++;else if(d.getDueDate().isBefore(r.to()))counts[3]++;else counts[0]++;}
        bySchedule.forEach((name,c)->rows.add(row("schedule",name,"planned",c[0],"done",c[1],"deferred",c[2],"overdue",c[3])));
        List<Vaccination> shots=em.createQuery("select v from Vaccination v where v.cattle.farm.id=:farm and v.vaccinationDate between :from and :to and upper(v.source)='ON_FARM' and upper(v.status)='VALID'",Vaccination.class).setParameter("farm",farm).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(v->matches(v.getCattle(),r,v.getVaccinationDate())).toList();Map<String,Long> byVaccine=new TreeMap<>();for(Vaccination v:shots)byVaccine.merge(v.getVaccine().getName(),1L,Long::sum);rows.addAll(dimensions("onFarmVaccine",byVaccine));summary.put("doses",doses.size());summary.put("onFarmVaccinations",shots.size());
        ReportSection scheduleSection=scheduleSection(bySchedule);ReportSection vaccineSection=countSection("onFarmVaccine","Tiêm tại trại theo vắc-xin","Vắc-xin",byVaccine,"mũi");sections.add(scheduleSection);sections.add(vaccineSection);
        charts.add(countChart("Mũi đã tiêm theo lịch","Các mũi đã hoàn tất trước hoặc trong ngày cuối kỳ.","mũi",scheduleSection.rows(),"done"));charts.add(countChart("Mũi tiêm tại trại theo vắc-xin","Số bản ghi tiêm ON_FARM hợp lệ trong kỳ.","mũi",vaccineSection.rows(),"count"));
        if(doses.stream().anyMatch(d->"DEFERRED".equalsIgnoreCase(d.getStatus())))unavailable.add("Scheduled-dose deferral timestamps are not stored; DEFERRED counts use the current saved state for doses due in this period.");
    }

    private void health(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<String> unavailable,List<ReportSection> sections,List<ReportMetricChart> charts){
        List<HealthCase> cases=em.createQuery("select h from HealthCase h where h.cattle.farm.id=:farm and h.openedDate between :from and :to",HealthCase.class).setParameter("farm",farm).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(h->matches(h.getCattle(),r,h.getOpenedDate())).toList();
        List<HealthCase> closedEvents=em.createQuery("select h from HealthCase h where h.cattle.farm.id=:farm and h.closedDate between :from and :to",HealthCase.class).setParameter("farm",farm).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(h->matches(h.getCattle(),r,h.getClosedDate())).toList();
        Map<String,Long> closedByOutcome=countByCase(closedEvents,HealthCase::getOutcome);
        rows.addAll(dimensions("closedCaseOutcome",closedByOutcome));
        ZoneId zone=clock.zone();Instant from=r.from().atStartOfDay(zone).toInstant(),until=r.to().plusDays(1).atStartOfDay(zone).toInstant();
        List<Treatment> treatments=em.createQuery("select t from Treatment t where t.healthCase.cattle.farm.id=:farm and t.treatmentTime>=:from and t.treatmentTime<:until and upper(t.status)='VALID'",Treatment.class).setParameter("farm",farm).setParameter("from",from).setParameter("until",until).getResultList().stream().filter(t->matches(t.getHealthCase().getCattle(),r,t.getTreatmentTime().atZone(zone).toLocalDate())).toList();Map<String,Long> byMedicine=new TreeMap<>();for(Treatment t:treatments)byMedicine.merge(t.getMedicineNameSnapshot()==null?(t.getMedicine()==null?"Unspecified":t.getMedicine().getName()):t.getMedicineNameSnapshot(),1L,Long::sum);rows.addAll(dimensions("treatmentMedicine",byMedicine));
        List<Treatment> activeTreatments=em.createQuery("select t from Treatment t where t.healthCase.cattle.farm.id=:farm and t.treatmentTime<:until and upper(t.status)='VALID' and t.withdrawalEndDate>=:end",Treatment.class).setParameter("farm",farm).setParameter("until",until).setParameter("end",r.to()).getResultList().stream().filter(t->matches(t.getHealthCase().getCattle(),r,r.to())).toList();
        List<Vaccination> activeVaccinations=em.createQuery("select v from Vaccination v where v.cattle.farm.id=:farm and v.vaccinationDate<=:end and upper(v.status)='VALID' and v.withdrawalEndDate>=:end",Vaccination.class).setParameter("farm",farm).setParameter("end",r.to()).getResultList().stream().filter(v->matches(v.getCattle(),r,r.to())).toList();Set<Long> activeWithdrawal=new HashSet<>();activeTreatments.forEach(t->activeWithdrawal.add(t.getHealthCase().getCattle().getId()));activeVaccinations.forEach(v->activeWithdrawal.add(v.getCattle().getId()));
        summary.put("openedCases",cases.size());summary.put("movedToChronic",null);summary.put("closedCases",closedEvents.size());summary.put("closedCasesByOutcome",closedByOutcome);summary.put("chronicAtEnd",null);summary.put("treatments",treatments.size());summary.put("treatmentsByMedicine",byMedicine);summary.put("cattleWithActiveMeatWithdrawalAtEnd",activeWithdrawal.size());
        ReportSection openedSection=countSection("openedCases","Ca mở trong kỳ","Số ca",Map.of("Ca mở",(long)cases.size()),"ca");ReportSection closedSection=countSection("closedByOutcome","Ca đóng trong kỳ theo kết quả","Kết quả",closedByOutcome,"ca");ReportSection treatmentSection=countSection("treatmentsByMedicine","Lượt điều trị theo thuốc","Thuốc",byMedicine,"lượt điều trị");sections.add(openedSection);sections.add(closedSection);sections.add(treatmentSection);
        charts.add(countChart("Ca đóng trong kỳ theo kết quả","Mỗi ca đóng trong kỳ được tính một lần.","ca",closedSection.rows(),"count"));unavailable.add("Severity breakdowns, chronic transitions and chronic cases at the period end are omitted because health-case severity and chronicSince can be overwritten or cleared without a dated history.");
    }

    private List<ReportChartBar> reproduction(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<String> unavailable,List<ReportSection> sections,List<ReportMetricChart> charts){
        Instant from=r.from().atStartOfDay(clock.zone()).toInstant(),until=r.to().plusDays(1).atStartOfDay(clock.zone()).toInstant();ZoneId zone=clock.zone();
        List<ReproductionEvent> events=em.createQuery("select e from ReproductionEvent e where e.cattle.farm.id=:farm and e.eventTime>=:from and e.eventTime<:until and upper(e.status)='VALID' order by e.eventTime",ReproductionEvent.class).setParameter("farm",farm).setParameter("from",from).setParameter("until",until).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getEventTime().atZone(zone).toLocalDate())).toList();Map<String,Long> counts=new TreeMap<>(),breedingByMethod=new TreeMap<>(),checksByResult=new TreeMap<>();for(ReproductionEvent e:events){counts.merge(e.getType()+":"+Objects.toString(e.getResult(),""),1L,Long::sum);if("BREEDING".equalsIgnoreCase(e.getType()))breedingByMethod.merge(Objects.toString(e.getMethod(),"UNKNOWN"),1L,Long::sum);if("PREGNANCY_CHECK".equalsIgnoreCase(e.getType()))checksByResult.merge(Objects.toString(e.getResult(),"UNKNOWN"),1L,Long::sum);}rows.addAll(dimensions("eventTypeAndResult",counts));rows.addAll(dimensions("breedingMethod",breedingByMethod));rows.addAll(dimensions("pregnancyCheckResult",checksByResult));
        List<CalvingEvent> calvings=em.createQuery("select c from CalvingEvent c where c.dam.farm.id=:farm and c.birthTime>=:from and c.birthTime<:until and upper(c.status)='VALID' order by c.dam.id,c.birthTime",CalvingEvent.class).setParameter("farm",farm).setParameter("from",from).setParameter("until",until).getResultList().stream().filter(c->matches(c.getDam(),r,c.getBirthTime().atZone(zone).toLocalDate())).toList();
        List<CalvingEvent> allCalvings=em.createQuery("select c from CalvingEvent c where c.dam.farm.id=:farm and c.birthTime<:until and upper(c.status)='VALID' order by c.dam.id,c.birthTime",CalvingEvent.class).setParameter("farm",farm).setParameter("until",until).getResultList().stream().filter(c->matches(c.getDam(),r,c.getBirthTime().atZone(zone).toLocalDate())).toList();
        Map<String,Long> calvingCourses=new TreeMap<>();calvings.forEach(c->calvingCourses.merge(Objects.toString(c.getCourse(),"UNKNOWN"),1L,Long::sum));rows.addAll(dimensions("calvingCourse",calvingCourses));
        List<ReproductionEvent> allBreedings=em.createQuery("select e from ReproductionEvent e where e.cattle.farm.id=:farm and upper(e.type)='BREEDING' and e.eventTime<:until and upper(e.status)='VALID' order by e.cattle.id,e.eventTime",ReproductionEvent.class).setParameter("farm",farm).setParameter("until",until).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getEventTime().atZone(zone).toLocalDate())).toList();
        List<ReproductionEvent> checks=em.createQuery("select e from ReproductionEvent e where e.cattle.farm.id=:farm and upper(e.type)='PREGNANCY_CHECK' and e.eventTime<:until and upper(e.status)='VALID' order by e.eventTime,e.id",ReproductionEvent.class).setParameter("farm",farm).setParameter("until",until).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getEventTime().atZone(zone).toLocalDate())).toList();
        Map<Long,String> checkResultByBreeding=new HashMap<>();for(ReproductionEvent check:checks)if(check.getLinkedEvent()!=null&&check.getResult()!=null)checkResultByBreeding.put(check.getLinkedEvent().getId(),check.getResult().toUpperCase(Locale.ROOT));
        List<BigDecimal> intervalDays=new ArrayList<>(),daysOpen=new ArrayList<>(),servicesPerConception=new ArrayList<>(),ageFirstCalving=new ArrayList<>();
        Map<Long,List<CalvingEvent>> calvesByDam=new HashMap<>();allCalvings.forEach(c->calvesByDam.computeIfAbsent(c.getDam().getId(),k->new ArrayList<>()).add(c));
        for(List<CalvingEvent> damCalvings:calvesByDam.values())for(int i=1;i<damCalvings.size();i++){CalvingEvent current=damCalvings.get(i),previous=damCalvings.get(i-1);if(!current.getBirthTime().isBefore(from)){long days=ChronoUnit.DAYS.between(previous.getBirthTime(),current.getBirthTime());if(days>=0)intervalDays.add(BigDecimal.valueOf(days));}}
        List<PregnancyEpisode> closedEpisodes=em.createQuery("select p from PregnancyEpisode p where p.cattle.farm.id=:farm and p.closedDate between :fromDate and :toDate",PregnancyEpisode.class).setParameter("farm",farm).setParameter("fromDate",r.from()).setParameter("toDate",r.to()).getResultList().stream().filter(p->matches(p.getCattle(),r,p.getClosedDate())).toList();
        // GBR-106 (2)(3): measured per conception confirmed in the period (the breeding linked to a PREGNANT check), not per calving.
        Set<Long> conceived=new HashSet<>();
        for(ReproductionEvent check:checks){ReproductionEvent conceiving=check.getLinkedEvent();if(check.getEventTime().isBefore(from)||!"PREGNANT".equalsIgnoreCase(check.getResult())||conceiving==null||!Set.of("VALID","CORRECTED").contains(Objects.toString(conceiving.getStatus(),"").toUpperCase(Locale.ROOT))||!conceived.add(conceiving.getId()))continue;Long cow=conceiving.getCattle().getId();Instant previousCalving=calvesByDam.getOrDefault(cow,List.of()).stream().map(CalvingEvent::getBirthTime).filter(t->t.isBefore(conceiving.getEventTime())).max(Instant::compareTo).orElse(null);if(previousCalving!=null)daysOpen.add(BigDecimal.valueOf(ChronoUnit.DAYS.between(previousCalving.atZone(zone).toLocalDate(),conceiving.getEventTime().atZone(zone).toLocalDate())));long services=allBreedings.stream().filter(b->b.getCattle().getId().equals(cow)&&b.getEventTime().isBefore(conceiving.getEventTime())&&(previousCalving==null||!b.getEventTime().isBefore(previousCalving))).count()+1;servicesPerConception.add(BigDecimal.valueOf(services));}
        for(Cattle cow:em.createQuery("select c from Cattle c where c.farm.id=:farm and c.sex=:female",Cattle.class).setParameter("farm",farm).setParameter("female",Sex.FEMALE).getResultList()){List<CalvingEvent> damCalvings=calvesByDam.getOrDefault(cow.getId(),List.of());if(!damCalvings.isEmpty()&&cow.getBirthDate()!=null&&cow.getBirthDateAccuracy()!=BirthDateAccuracy.UNKNOWN){CalvingEvent first=damCalvings.get(0);if(!first.getBirthTime().isBefore(from)&&!first.getBirthTime().isAfter(r.to().plusDays(1).atStartOfDay(clock.zone()).toInstant().minusNanos(1)))ageFirstCalving.add(BigDecimal.valueOf(ChronoUnit.DAYS.between(cow.getBirthDate(),first.getBirthTime().atZone(zone).toLocalDate())/30.4375));}}
        List<ReproductionEvent> periodBreedings=allBreedings.stream().filter(e->!e.getEventTime().isBefore(from)).toList();long decided=0,conceptions=0,firstDecided=0,firstConceptions=0;for(ReproductionEvent breeding:periodBreedings){String result=checkResultByBreeding.get(breeding.getId());if("PREGNANT".equals(result)||"NOT_PREGNANT".equals(result)){decided++;if("PREGNANT".equals(result))conceptions++;Instant previousCalving=calvesByDam.getOrDefault(breeding.getCattle().getId(),List.of()).stream().map(CalvingEvent::getBirthTime).filter(t->t.isBefore(breeding.getEventTime())).max(Instant::compareTo).orElse(Instant.MIN);boolean earlierService=allBreedings.stream().anyMatch(other->other.getCattle().getId().equals(breeding.getCattle().getId())&&other.getEventTime().isBefore(breeding.getEventTime())&&!other.getEventTime().isBefore(previousCalving));if(!earlierService){firstDecided++;if("PREGNANT".equals(result))firstConceptions++;}}}
        long episodeOutcomes=closedEpisodes.stream().filter(p->Set.of("CALVED","LOST").contains(p.getStatus().toUpperCase(Locale.ROOT))).count(),losses=closedEpisodes.stream().filter(p->"LOST".equalsIgnoreCase(p.getStatus())).count();
        List<CalfOutcome> outcomes=em.createQuery("select o from CalfOutcome o where o.calving.dam.farm.id=:farm and o.calving.birthTime>=:from and o.calving.birthTime<:until and upper(o.calving.status)='VALID' and upper(o.status)<>'VOIDED'",CalfOutcome.class).setParameter("farm",farm).setParameter("from",from).setParameter("until",until).getResultList().stream().filter(o->matches(o.getCalving().getDam(),r,o.getCalving().getBirthTime().atZone(zone).toLocalDate())).toList();Map<String,Long> calvesByOutcome=new TreeMap<>();outcomes.forEach(o->calvesByOutcome.merge(Objects.toString(o.getOutcome(),"UNKNOWN"),1L,Long::sum));long liveCalves=calvesByOutcome.getOrDefault("LIVE",0L),stillborn=calvesByOutcome.getOrDefault("STILLBORN",0L);rows.addAll(dimensions("calfOutcome",calvesByOutcome));
        Map<String,Object> overdue=overdueFemales(farm,r,allCalvings,until,zone);
        TrackedFemaleStatuses tracked=trackedFemaleStatuses(farm,r,until,zone);
        summary.put("trackedFemales",tracked.total());summary.put("breedings",countType(events,"BREEDING"));summary.put("checks",countType(events,"PREGNANCY_CHECK"));summary.put("calvings",calvings.size());summary.put("liveCalves",liveCalves);summary.put("stillbirths",stillborn);summary.put("episodesLost",losses);summary.put("episodesCalved",closedEpisodes.stream().filter(p->"CALVED".equalsIgnoreCase(p.getStatus())).count());summary.put("averageCalvingIntervalDays",measuredAverage(intervalDays));summary.put("averageDaysOpen",measuredAverage(daysOpen));summary.put("averageServicesPerConception",measuredAverage(servicesPerConception));summary.put("overallConceptionRate",measuredRatio(conceptions,decided));summary.put("firstServiceConceptionRate",measuredRatio(firstConceptions,firstDecided));summary.put("pregnancyLossRate",measuredRatio(losses,episodeOutcomes));summary.put("averageAgeAtFirstCalvingMonths",measuredAverage(ageFirstCalving));summary.put("overdueFemales",overdue);
        sections.add(trackedFemaleSection(tracked.byStatus()));
        if(tracked.unresolved()>0)unavailable.add(tracked.unresolved()+" bò cái trong đàn tại cuối kỳ thiếu baseline purpose/life-stage hiệu lực; không thể xác định điều kiện theo dõi sinh sản nên đã loại khỏi bảng trạng thái.");
        ReportSection methodsSection=countSection("breedingMethod","Lần phối theo phương pháp","Phương pháp",breedingByMethod,"lần phối");ReportSection checksSection=countSection("pregnancyCheckResult","Khám thai theo kết quả","Kết quả khám",checksByResult,"lượt khám");ReportSection calvingSection=countSection("calvingCourse","Lần đẻ theo diễn biến","Diễn biến đẻ",calvingCourses,"lần đẻ");ReportSection calfSection=countSection("calfOutcome","Bê theo kết quả lúc sinh","Kết quả bê",calvesByOutcome,"con");
        sections.add(methodsSection);sections.add(checksSection);sections.add(calvingSection);sections.add(calfSection);charts.add(countChart("Lần phối theo phương pháp","Mỗi sự kiện phối VALID trong kỳ được tính một lần.","lần phối",methodsSection.rows(),"count"));charts.add(countChart("Bê theo kết quả lúc sinh","Chỉ tính outcome còn hiệu lực của lần đẻ VALID trong kỳ.","con",calfSection.rows(),"count"));
        Set<Long> periodBreedingIds=new HashSet<>();periodBreedings.forEach(breeding->periodBreedingIds.add(breeding.getId()));
        List<ConceptionObservation> observations=checks.stream().filter(check->check.getLinkedEvent()!=null&&check.getResult()!=null)
            .map(check->new ConceptionObservation(check.getLinkedEvent().getId(),check.getLinkedEvent().getEventTime(),check.getEventTime(),check.getResult()))
            .toList();
        return monthlyConceptionRate(r.from(),r.to(),zone,periodBreedingIds,observations);
    }

    static List<ReportChartBar> monthlyConceptionRate(LocalDate from,LocalDate to,ZoneId zone,Set<Long> breedingIds,List<ConceptionObservation> observations){
        Map<Long,ConceptionObservation> latestByBreeding=new HashMap<>();
        for(ConceptionObservation observation:observations){
            if(!breedingIds.contains(observation.breedingId()))continue;
            ConceptionObservation previous=latestByBreeding.get(observation.breedingId());
            if(previous==null||!observation.checkedAt().isBefore(previous.checkedAt()))latestByBreeding.put(observation.breedingId(),observation);
        }
        Map<YearMonth,long[]> counts=new LinkedHashMap<>();
        for(YearMonth month=YearMonth.from(from);!month.isAfter(YearMonth.from(to));month=month.plusMonths(1))counts.put(month,new long[2]);
        for(ConceptionObservation observation:latestByBreeding.values()){
            String result=Objects.toString(observation.result(),"").toUpperCase(Locale.ROOT);
            if(!"PREGNANT".equals(result)&&!"NOT_PREGNANT".equals(result))continue;
            LocalDate breedingDate=observation.breedingAt().atZone(zone).toLocalDate();
            if(breedingDate.isBefore(from)||breedingDate.isAfter(to))continue;
            long[] monthCounts=counts.get(YearMonth.from(breedingDate));
            if(monthCounts==null)continue;
            monthCounts[1]++;
            if("PREGNANT".equals(result))monthCounts[0]++;
        }
        DateTimeFormatter labelFormat=DateTimeFormatter.ofPattern("MM/yyyy");
        return counts.entrySet().stream().map(entry->{
            long numerator=entry.getValue()[0],denominator=entry.getValue()[1];
            BigDecimal value=denominator<3?null:BigDecimal.valueOf(numerator).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(denominator),1,RoundingMode.HALF_UP);
            return new ReportChartBar(entry.getKey().format(labelFormat),value,numerator,denominator);
        }).toList();
    }

    static ReportTotalRow fatteningTotalRow(Map<String,Object> summary,List<Map<String,Object>> rows){
        if(rows.isEmpty())return null;
        Map<String,Object> cells=new LinkedHashMap<>();
        cells.put("cattleCount",summary.get("cattleIncluded"));
        cells.put("insufficientWeights",summary.get("insufficientWeights"));
        cells.put("gainKg",summary.get("totalGainKg"));
        cells.put("feedKg",rows.stream().map(row->(BigDecimal)row.get("feedKg")).reduce(BigDecimal.ZERO,BigDecimal::add));
        cells.put("feedCost",rows.stream().mapToLong(row->((Number)row.get("feedCost")).longValue()).sum());
        cells.put("feedKgForIncluded",rows.stream().map(row->(BigDecimal)row.get("feedKgForIncluded")).reduce(BigDecimal.ZERO,BigDecimal::add));
        cells.put("feedCostForIncluded",rows.stream().mapToLong(row->((Number)row.get("feedCostForIncluded")).longValue()).sum());
        cells.put("feedKgPerGain",metricValue(summary.get("feedPerKgGain")));
        cells.put("feedCostPerGain",metricValue(summary.get("feedCostPerKgGain")));
        cells.put("adgKgPerDay",metricValue(summary.get("averageAdgKgPerDay")));
        cells.put("adgSampleSize",summary.get("cattleIncluded"));
        return new ReportTotalRow("Tổng",Collections.unmodifiableMap(cells));
    }

    record ConceptionObservation(Long breedingId,Instant breedingAt,Instant checkedAt,String result) {}

    static Object metricValue(Object metric){return metric instanceof Map<?,?> values?values.get("value"):metric;}

    private Map<String,Object> overdueFemales(Long farm,ReportRequest request,List<CalvingEvent> allCalvings,Instant until,ZoneId zone){Map<Long,LocalDate> lastCalving=new HashMap<>();for(CalvingEvent c:allCalvings){LocalDate date=c.getBirthTime().atZone(zone).toLocalDate();lastCalving.merge(c.getDam().getId(),date,(a,b)->a.isAfter(b)?a:b);}LocalDate asOf=until.minusNanos(1).atZone(zone).toLocalDate();Map<String,Object> params=parameters(farm,asOf);int postpartum=Optional.ofNullable((Number)params.get("POST_CALVING_DAYS")).map(Number::intValue).orElse(45),cycle=Optional.ofNullable((Number)params.get("ESTRUS_CYCLE_DAYS")).map(Number::intValue).orElse(21);List<Cattle> females=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.sex=:female",Cattle.class).setParameter("farm",farm).setParameter("female",Sex.FEMALE).getResultList();List<Map<String,Object>> overdue=new ArrayList<>();for(Cattle cow:females){LocalDate entry=firstEntry(cow.getId());if(entry==null||entry.isAfter(asOf)||cow.getExitDate()!=null&&!cow.getExitDate().isAfter(asOf)||!matches(cow,request,asOf)||purposeTypeAt(cow,asOf)!=PurposeType.BREEDING)continue;LocalDate last=lastCalving.get(cow.getId());if(last==null)continue;long pregnant=em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id=:id and p.confirmingCheck.eventTime<:until and (p.closedDate is null or p.closedDate>:asOf)",Long.class).setParameter("id",cow.getId()).setParameter("until",until).setParameter("asOf",asOf).getSingleResult();if(pregnant==0&&ChronoUnit.DAYS.between(last,asOf)>postpartum+3L*cycle)overdue.add(row("cattleId",cow.getId(),"displayCode",cow.getDisplayCode(),"daysSinceCalving",ChronoUnit.DAYS.between(last,asOf)));}return Map.of("count",overdue.size(),"items",overdue);}

    private TrackedFemaleStatuses trackedFemaleStatuses(Long farm,ReportRequest request,Instant until,ZoneId zone){
        LocalDate asOf=request.to();
        Map<String,Long> counts=new LinkedHashMap<>();
        counts.put("AWAITING_BREEDING",0L);counts.put("IN_ESTRUS",0L);counts.put("BRED",0L);counts.put("PREGNANT",0L);counts.put("POST_CALVING",0L);
        List<Cattle> females=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.sex=:female",Cattle.class).setParameter("farm",farm).setParameter("female",Sex.FEMALE).getResultList();
        Map<Long,LocalDate> firstEntryByCattle=new HashMap<>();
        for(Object[] entry:em.createQuery("select e.cattle.id,min(e.entryDate) from HerdEntry e where e.farm.id=:farm and e.cattle.sex=:female and e.status=:valid and e.entryDate<=:asOf group by e.cattle.id",Object[].class).setParameter("farm",farm).setParameter("female",Sex.FEMALE).setParameter("valid",EntryLineStatus.VALID).setParameter("asOf",asOf).getResultList())firstEntryByCattle.put((Long)entry[0],(LocalDate)entry[1]);
        List<Cattle> herdFemales=new ArrayList<>();
        for(Cattle cow:females){LocalDate entry=firstEntryByCattle.get(cow.getId());if(entry==null||cow.getExitDate()!=null&&!cow.getExitDate().isAfter(asOf))continue;if(!matchesTrackedBasicFilters(cow,request,asOf))continue;herdFemales.add(cow);}
        Set<Long> herdIds=herdFemales.stream().map(Cattle::getId).collect(java.util.stream.Collectors.toSet());
        if(herdIds.isEmpty())return new TrackedFemaleStatuses(0,0,counts);

        Map<Long,Map<ProfileFieldGroup,List<CattleProfileChange>>> profileChanges=new HashMap<>();
        for(CattleProfileChange change:em.createQuery("select h from CattleProfileChange h where h.farm.id=:farm and h.cattle.id in :cattleIds and h.fieldGroup in :fields order by h.cattle.id,h.fieldGroup,h.effectiveDate,h.id",CattleProfileChange.class).setParameter("farm",farm).setParameter("cattleIds",herdIds).setParameter("fields",List.of(ProfileFieldGroup.PURPOSE,ProfileFieldGroup.LIFE_STAGE)).getResultList())
            profileChanges.computeIfAbsent(change.getCattle().getId(),ignored->new EnumMap<>(ProfileFieldGroup.class)).computeIfAbsent(change.getFieldGroup(),ignored->new ArrayList<>()).add(change);
        Map<Long,PurposeType> farmPurposeTypes=new HashMap<>();
        for(ProductionPurpose purpose:em.createQuery("select p from ProductionPurpose p where p.farm.id=:farm",ProductionPurpose.class).setParameter("farm",farm).getResultList())farmPurposeTypes.put(purpose.getId(),purpose.getPurposeType());

        Map<Long,PregnancyEpisode> openPregnancyAtEnd=new HashMap<>();
        for(PregnancyEpisode episode:em.createQuery("select p from PregnancyEpisode p where p.cattle.farm.id=:farm and p.cattle.id in :cattleIds and p.confirmingCheck.eventTime<:until and upper(p.confirmingCheck.status)='VALID' and (p.closedDate is null or p.closedDate>:asOf) and not exists (select u from PregnancyUpdate u where u.episode=p and u.occurredTime<:until and upper(u.status)='VALID' and upper(u.type)='LOSS') and not exists (select c from CalvingEvent c where c.episode=p and c.birthTime<:until and upper(c.status)='VALID')",PregnancyEpisode.class).setParameter("farm",farm).setParameter("cattleIds",herdIds).setParameter("until",until).setParameter("asOf",asOf).getResultList())
            openPregnancyAtEnd.putIfAbsent(episode.getCattle().getId(),episode);

        Map<Long,ReproductionEvent> latestEvent=new HashMap<>();
        for(ReproductionEvent event:em.createQuery("select e from ReproductionEvent e where e.cattle.farm.id=:farm and e.cattle.id in :cattleIds and e.eventTime<:until and upper(e.status)='VALID' order by e.cattle.id,e.eventTime,e.id",ReproductionEvent.class).setParameter("farm",farm).setParameter("cattleIds",herdIds).setParameter("until",until).getResultList())latestEvent.put(event.getCattle().getId(),event);
        Map<Long,CalvingEvent> latestCalving=new HashMap<>();
        for(CalvingEvent calving:em.createQuery("select c from CalvingEvent c where c.dam.farm.id=:farm and c.dam.id in :cattleIds and c.birthTime<:until and upper(c.status)='VALID' order by c.dam.id,c.birthTime,c.id",CalvingEvent.class).setParameter("farm",farm).setParameter("cattleIds",herdIds).setParameter("until",until).getResultList())latestCalving.put(calving.getDam().getId(),calving);
        Map<Long,Instant> latestLoss=new HashMap<>();
        for(PregnancyUpdate update:em.createQuery("select u from PregnancyUpdate u where u.episode.cattle.farm.id=:farm and u.episode.cattle.id in :cattleIds and u.occurredTime<:until and upper(u.status)='VALID' and upper(u.type)='LOSS' order by u.episode.cattle.id,u.occurredTime,u.id",PregnancyUpdate.class).setParameter("farm",farm).setParameter("cattleIds",herdIds).setParameter("until",until).getResultList())latestLoss.put(update.getEpisode().getCattle().getId(),update.getOccurredTime());

        int unresolved=0;long total=0;
        int postpartum=Optional.ofNullable((Number)parameters(farm,asOf).get("POST_CALVING_DAYS")).map(Number::intValue).orElse(45);
        Instant estrusSince=until.minusSeconds(86_400);
        for(Cattle cow:herdFemales){
            boolean pregnant=openPregnancyAtEnd.containsKey(cow.getId());
            HistoricalFemaleProfile profile=historicalFemaleProfile(cow,asOf,profileChanges.getOrDefault(cow.getId(),Map.of()),farmPurposeTypes);
            if(!pregnant&&definitelyNotApplicable(profile))continue;
            if(!canEvaluateTrackedProfileFilters(request,profile)){
                if(pregnant||possiblyApplicable(profile))unresolved++;
                continue;
            }
            if(!trackedProfileFiltersMatch(cow,request,profile))continue;
            if(!pregnant&&!isApplicableFemale(profile)){
                if(possiblyApplicable(profile))unresolved++;
                continue;
            }
            String status=pregnant?"PREGNANT":reproductiveStatusAtEnd(latestEvent.get(cow.getId()),latestCalving.get(cow.getId()),latestLoss.get(cow.getId()),asOf,estrusSince,postpartum,zone);
            counts.compute(status,(key,value)->value+1);total++;
        }
        return new TrackedFemaleStatuses(total,unresolved,counts);
    }

    private String reproductiveStatusAtEnd(ReproductionEvent event,CalvingEvent calving,Instant loss,LocalDate asOf,Instant estrusSince,int postpartum,ZoneId zone){
        Instant eventAt=event==null?null:event.getEventTime(),calvingAt=calving==null?null:calving.getBirthTime(),latest=latestInstant(eventAt,calvingAt,loss);
        if(latest==null)return "AWAITING_BREEDING";
        if(loss!=null&&latest.equals(loss))return "AWAITING_BREEDING";
        if(calvingAt!=null&&latest.equals(calvingAt))return !calvingAt.isBefore(asOf.minusDays(postpartum).atStartOfDay(zone).toInstant())?"POST_CALVING":"AWAITING_BREEDING";
        if(event!=null&&latest.equals(eventAt)){
            String type=Objects.toString(event.getType(),"").toUpperCase(Locale.ROOT);
            if("ESTRUS".equals(type)&&!eventAt.isBefore(estrusSince))return "IN_ESTRUS";
            if("BREEDING".equals(type))return "BRED";
            if("PREGNANCY_CHECK".equals(type)&&"INCONCLUSIVE".equalsIgnoreCase(event.getResult()))return "BRED";
        }
        return "AWAITING_BREEDING";
    }

    private boolean matchesTrackedBasicFilters(Cattle cow,ReportRequest request,LocalDate asOf){
        return (request.penIds()==null||request.penIds().isEmpty()||request.penIds().contains(penIdAt(cow,asOf)))
            &&(request.breedIds()==null||request.breedIds().isEmpty()||request.breedIds().contains(cow.getBreed().getId()));
    }

    private boolean trackedProfileFiltersMatch(Cattle cow,ReportRequest request,HistoricalFemaleProfile profile){
        if(request.lifeStages()!=null&&!request.lifeStages().isEmpty()&&(profile.lifeStage()==null||!request.lifeStages().contains(profile.lifeStage().name())))return false;
        if(request.herdGroups()!=null&&!request.herdGroups().isEmpty()){
            if(profile.lifeStage()==null)return false;
            String group;
            if(profile.lifeStage()==LifeStage.UNWEANED_CALF||profile.lifeStage()==LifeStage.WEANED_CALF)group="CALVES";
            else if(profile.purposeType()==null)return false;
            else group=groupAt(cow,profile.purposeType(),profile.lifeStage());
            if(!request.herdGroups().contains(group))return false;
        }
        return true;
    }

    private boolean canEvaluateTrackedProfileFilters(ReportRequest request,HistoricalFemaleProfile profile){
        if(request.lifeStages()!=null&&!request.lifeStages().isEmpty()&&profile.lifeStage()==null)return false;
        if(request.herdGroups()!=null&&!request.herdGroups().isEmpty()&&(profile.lifeStage()==null||profile.purposeType()==null&&profile.lifeStage()!=LifeStage.UNWEANED_CALF&&profile.lifeStage()!=LifeStage.WEANED_CALF))return false;
        return true;
    }
    private boolean definitelyNotApplicable(HistoricalFemaleProfile profile){return profile.lifeStage()!=null&&profile.lifeStage()!=LifeStage.YOUNG_STOCK&&profile.lifeStage()!=LifeStage.ADULT||profile.purposeType()!=null&&profile.purposeType()!=PurposeType.BREEDING&&profile.purposeType()!=PurposeType.UNDECIDED;}
    private boolean possiblyApplicable(HistoricalFemaleProfile profile){return !definitelyNotApplicable(profile)&&(profile.lifeStage()==null||profile.purposeType()==null);}
    private boolean isApplicableFemale(HistoricalFemaleProfile profile){return profile.lifeStage()!=null&&(profile.lifeStage()==LifeStage.YOUNG_STOCK||profile.lifeStage()==LifeStage.ADULT)&&profile.purposeType()!=null&&(profile.purposeType()==PurposeType.BREEDING||profile.purposeType()==PurposeType.UNDECIDED);}
    private Instant latestInstant(Instant... values){Instant latest=null;for(Instant value:values)if(value!=null&&(latest==null||value.isAfter(latest)))latest=value;return latest;}

    private HistoricalFemaleProfile historicalFemaleProfile(Cattle cow,LocalDate asOf,Map<ProfileFieldGroup,List<CattleProfileChange>> changes,Map<Long,PurposeType> purposeTypes){
        String stageValue=profileValueAtReport(changes.get(ProfileFieldGroup.LIFE_STAGE),asOf,cow.getLifeStage()==null?null:cow.getLifeStage().name());
        String purposeValue=profileValueAtReport(changes.get(ProfileFieldGroup.PURPOSE),asOf,cow.getPurpose()==null?null:Objects.toString(cow.getPurpose().getId()));
        LifeStage stage=null;try{if(stageValue!=null)stage=LifeStage.valueOf(stageValue);}catch(IllegalArgumentException ignored){}
        PurposeType purposeType=null;
        try{if(purposeValue!=null)purposeType=purposeTypes.get(Long.valueOf(purposeValue));}catch(NumberFormatException ignored){}
        return new HistoricalFemaleProfile(stage,purposeType);
    }

    private String profileValueAtReport(List<CattleProfileChange> changes,LocalDate asOf,String current){
        if(changes==null||changes.isEmpty())return current;
        if(changes.get(0).getEffectiveDate().isAfter(asOf))return changes.get(0).getOldValue();
        String value=null;for(CattleProfileChange change:changes){if(change.getEffectiveDate().isAfter(asOf))break;value=change.getNewValue();}return value;
    }

    private String groupAt(Cattle cow,PurposeType purpose,LifeStage stage){if(stage==LifeStage.UNWEANED_CALF||stage==LifeStage.WEANED_CALF)return "CALVES";if(purpose==PurposeType.FATTENING)return "FATTENING";if(purpose==PurposeType.SIRE)return "BREEDING_BULLS";if(purpose==PurposeType.BREEDING&&cow.getSex()==Sex.FEMALE&&stage==LifeStage.ADULT)return "BREEDING_FEMALES";if(stage==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";return "OTHER";}

    private LocalDate firstEntryForFarm(Long cattle,Long farm){return em.createQuery("select min(e.entryDate) from HerdEntry e where e.cattle.id=:c and e.farm.id=:farm and e.status=:valid",LocalDate.class).setParameter("c",cattle).setParameter("farm",farm).setParameter("valid",EntryLineStatus.VALID).getSingleResult();}

    private ReportSection trackedFemaleSection(Map<String,Long> counts){List<Map<String,Object>> rows=counts.entrySet().stream().map(entry->row("label",switch(entry.getKey()){case "AWAITING_BREEDING"->"Chờ phối (AWAITING_BREEDING)";case "IN_ESTRUS"->"Động dục (IN_ESTRUS)";case "BRED"->"Đã phối (BRED)";case "PREGNANT"->"Mang thai (PREGNANT)";case "POST_CALVING"->"Sau sinh (POST_CALVING)";default->entry.getKey();},"count",entry.getValue())).toList();long total=counts.values().stream().mapToLong(Long::longValue).sum();return new ReportSection("trackedFemalesByStatus","Bò cái theo dõi theo trạng thái sinh sản","Trạng thái sinh sản",rows,new ReportTotalRow("Tổng (con)",row("count",total)));}

    private record HistoricalFemaleProfile(LifeStage lifeStage,PurposeType purposeType){}
    private record TrackedFemaleStatuses(long total,int unresolved,Map<String,Long> byStatus){}
    private Map<String,Object> measuredAverage(List<BigDecimal> values){Map<String,Object> result=new LinkedHashMap<>();result.put("value",values.size()<3?null:average(values));result.put("n",values.size());result.put("status",values.size()<3?"INSUFFICIENT_DATA":"AVAILABLE");return result;}
    private Map<String,Object> measuredRatio(long numerator,long denominator){Map<String,Object> result=new LinkedHashMap<>();result.put("numerator",numerator);result.put("denominator",denominator);result.put("value",denominator<3?null:BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator),4,RoundingMode.HALF_UP));result.put("n",denominator);result.put("status",denominator<3?"INSUFFICIENT_DATA":"AVAILABLE");return result;}

    private void movements(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<ReportSection> sections,List<ReportMetricChart> charts){
        List<HerdEntry> entries=em.createQuery("select e from HerdEntry e where e.farm.id=:farm and e.status=:valid and e.entryDate between :from and :to",HerdEntry.class).setParameter("farm",farm).setParameter("valid",EntryLineStatus.VALID).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getEntryDate())).toList();List<HerdExit> exits=em.createQuery("select e from HerdExit e where e.farm.id=:farm and e.status=:valid and e.voucher.status=:confirmed and e.voucher.exitDate between :from and :to",HerdExit.class).setParameter("farm",farm).setParameter("valid",ExitLineStatus.CONFIRMED).setParameter("confirmed",ExitVoucherStatus.CONFIRMED).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(e->matches(e.getCattle(),r,e.getVoucher().getExitDate())).toList();List<PenAssignment> moves=em.createQuery("select a from PenAssignment a where a.farm.id=:farm and a.fromDate between :from and :to and a.source=:source",PenAssignment.class).setParameter("farm",farm).setParameter("source",AssignmentSource.MOVE).setParameter("from",r.from()).setParameter("to",r.to()).getResultList().stream().filter(m->matches(m.getCattle(),r,m.getFromDate())).toList();Map<String,Long> entryBySource=groupEnum(entries.stream().map(e->Objects.toString(e.getSource(),"UNKNOWN")).toList()),exitByType=groupEnum(exits.stream().map(e->Objects.toString(e.getVoucher().getExitType(),"UNKNOWN")).toList()),movesByPen=groupEnum(moves.stream().map(m->m.getPen().getCode()).toList());rows.addAll(dimensions("entrySource",entryBySource));rows.addAll(dimensions("exitType",exitByType));rows.addAll(dimensions("penMoveTo",movesByPen));summary.put("entries",entries.size());summary.put("exits",exits.size());summary.put("penMoves",moves.size());ReportSection entrySection=countSection("entriesBySource","Nhập đàn theo nguồn","Nguồn nhập",entryBySource,"lượt");sections.add(entrySection);sections.add(countSection("exitsByType","Xuất đàn theo loại","Loại xuất",exitByType,"lượt"));sections.add(countSection("penMovesByPen","Chuyển chuồng theo chuồng đến","Chuồng đến",movesByPen,"lượt"));charts.add(countChart("Lượt nhập đàn theo nguồn","Số dòng nhập hợp lệ trong kỳ.","lượt",entrySection.rows(),"count"));}

    private void fattening(Long farm,ReportRequest r,List<Map<String,Object>> rows,Map<String,Object> summary,List<String> unavailable,List<ReportSection> sections,List<ReportMetricChart> charts){
        List<Cattle> cattle=em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus<>:voided",Cattle.class).setParameter("farm",farm).setParameter("voided",HerdStatus.VOIDED).getResultList();
        BigDecimal gainTotal=BigDecimal.ZERO,feedKg=BigDecimal.ZERO,feedKgForIncluded=BigDecimal.ZERO,startWeightTotal=BigDecimal.ZERO,endWeightTotal=BigDecimal.ZERO;
        long feedCost=0,feedCostForIncluded=0;
        List<BigDecimal> adgValues=new ArrayList<>(),projectedDays=new ArrayList<>();int included=0,insufficient=0,reached=0;
        Map<String,Map<String,Object>> byPen=new TreeMap<>();Map<String,List<BigDecimal>> adgByPen=new HashMap<>();
        List<FeedingRecord> feeding=em.createQuery("select f from FeedingRecord f where f.farm.id=:farm and f.status='VALID' and f.feedingDate between :from and :to",FeedingRecord.class).setParameter("farm",farm).setParameter("from",r.from()).setParameter("to",r.to()).getResultList();
        int periodDays=(int)(ChronoUnit.DAYS.between(r.from(),r.to())+1);long totalHeadDays=0;
        BigDecimal targetValue=parameters(farm,r.to()).get("TARGET_FINISHING_WEIGHT_KG") instanceof Number n?new BigDecimal(n.toString()):null;
        for(Cattle c:cattle){
            LocalDate entry=firstEntry(c.getId()),exit=c.getExitDate();
            LocalDate start=entry!=null&&entry.isAfter(r.from())?entry:r.from();
            LocalDate periodEnd=exit!=null&&!exit.isAfter(r.to())?exit:r.to();
            if(start.isAfter(periodEnd)||!matches(c,r,periodEnd))continue;
            FatteningPeriods periods=fatteningPeriods(c,start,periodEnd);
            if(!periods.complete()){
                String message="Some cattle have no reliable effective-purpose baseline for this RPT-07 period and were not included.";
                if(!unavailable.contains(message))unavailable.add(message);
                continue;
            }
            if(periods.segments().isEmpty())continue;

            long animalHeadDays=0,animalGrowthDays=0;FeedAllocation allocation=new FeedAllocation(BigDecimal.ZERO,0);
            boolean hasInsufficientWeights=false,targetReachedInFattening=false;BigDecimal animalGain=BigDecimal.ZERO,firstStartWeight=null,lastEndWeight=null;
            for(FatteningSegment segment:periods.segments()){
                animalHeadDays=Math.addExact(animalHeadDays,ChronoUnit.DAYS.between(segment.start(),segment.end())+1);
                FeedAllocation segmentFeed=allocatedFeed(c,segment.start(),segment.end(),feeding);
                allocation=new FeedAllocation(allocation.kilograms().add(segmentFeed.kilograms()),Math.addExact(allocation.cost(),segmentFeed.cost()));
                BigDecimal segmentStartWeight=weightAt(c.getId(),segment.start()),segmentEndWeight=weightAt(c.getId(),segment.end());
                if(segmentStartWeight==null||segmentEndWeight==null){hasInsufficientWeights=true;continue;}
                if(firstStartWeight==null)firstStartWeight=segmentStartWeight;
                lastEndWeight=segmentEndWeight;
                BigDecimal segmentGain=segmentEndWeight.subtract(segmentStartWeight);animalGain=animalGain.add(segmentGain);
                long segmentDays=Math.max(1,ChronoUnit.DAYS.between(segment.start(),segment.end()));
                animalGrowthDays=Math.addExact(animalGrowthDays,segmentDays);
                if(targetValue!=null&&segmentEndWeight.compareTo(targetValue)>=0)targetReachedInFattening=true;
            }
            if(targetReachedInFattening)reached++;
            totalHeadDays=Math.addExact(totalHeadDays,animalHeadDays);
            feedKg=feedKg.add(allocation.kilograms());feedCost=Math.addExact(feedCost,allocation.cost());
            String pen=penAt(c.getId(),periodEnd),penKey=pen==null?"\u0000":pen;
            Map<String,Object> penRow=byPen.computeIfAbsent(penKey,k->{Map<String,Object> item=new LinkedHashMap<>();item.put("pen",pen);item.put("label",pen==null?"Chưa phân chuồng":"Chuồng "+pen);item.put("cattleCount",0);item.put("insufficientWeights",0);item.put("gainKg",BigDecimal.ZERO);item.put("feedKg",BigDecimal.ZERO);item.put("feedCost",0L);item.put("feedKgForIncluded",BigDecimal.ZERO);item.put("feedCostForIncluded",0L);return item;});
            penRow.put("feedKg",((BigDecimal)penRow.get("feedKg")).add(allocation.kilograms()));
            penRow.put("feedCost",Math.addExact((Long)penRow.get("feedCost"),allocation.cost()));

            if(hasInsufficientWeights){
                insufficient++;penRow.put("insufficientWeights",((Number)penRow.get("insufficientWeights")).intValue()+1);continue;
            }
            long fatteningDays=Math.max(1,animalGrowthDays);BigDecimal animalAdg=animalGain.divide(BigDecimal.valueOf(fatteningDays),3,RoundingMode.HALF_UP);
            gainTotal=gainTotal.add(animalGain);startWeightTotal=startWeightTotal.add(firstStartWeight);endWeightTotal=endWeightTotal.add(lastEndWeight);included++;
            feedKgForIncluded=feedKgForIncluded.add(allocation.kilograms());feedCostForIncluded=Math.addExact(feedCostForIncluded,allocation.cost());adgValues.add(animalAdg);
            penRow.put("cattleCount",((Number)penRow.get("cattleCount")).intValue()+1);
            penRow.put("gainKg",((BigDecimal)penRow.get("gainKg")).add(animalGain));
            penRow.put("feedKgForIncluded",((BigDecimal)penRow.get("feedKgForIncluded")).add(allocation.kilograms()));
            penRow.put("feedCostForIncluded",Math.addExact((Long)penRow.get("feedCostForIncluded"),allocation.cost()));
            adgByPen.computeIfAbsent(penKey,k->new ArrayList<>()).add(animalAdg);
            FatteningSegment finalSegment=periods.segments().get(periods.segments().size()-1);
            boolean fatteningThroughPeriodEnd=finalSegment.end().equals(periodEnd);
            if(targetValue!=null&&fatteningThroughPeriodEnd){
                LocalDate projectionDate=finalSegment.end();
                LocalDate currentFatteningStart=currentFatteningStart(c,projectionDate);
                if(currentFatteningStart!=null){
                    Growth latest=em.createQuery("select g from Growth g where g.cattle.id=:id and upper(g.status)='VALID' and g.weightKg is not null and g.checkDate<=:to order by g.checkDate desc,g.id desc",Growth.class)
                        .setParameter("id",c.getId()).setParameter("to",projectionDate).setMaxResults(1).getResultStream().findFirst().orElse(null);
                    if(latest!=null&&!latest.getCheckDate().isBefore(currentFatteningStart)){
                        LocalDate recentFrom=currentFatteningStart.isAfter(latest.getCheckDate().minusDays(60))?currentFatteningStart:latest.getCheckDate().minusDays(60);
                        List<Growth> recent=em.createQuery("select g from Growth g where g.cattle.id=:id and upper(g.status)='VALID' and g.weightKg is not null and g.checkDate between :from and :to order by g.checkDate,g.id",Growth.class)
                            .setParameter("id",c.getId()).setParameter("from",recentFrom).setParameter("to",latest.getCheckDate()).getResultList();
                        if(recent.size()>=2){Growth first=recent.get(0),last=recent.get(recent.size()-1);long recentDays=ChronoUnit.DAYS.between(first.getCheckDate(),last.getCheckDate());BigDecimal recentGain=last.getWeightKg().subtract(first.getWeightKg());
                            if(recentDays>=14&&recentGain.signum()>0&&last.getWeightKg().compareTo(targetValue)<0)projectedDays.add(projectedDaysToTarget(targetValue,last.getWeightKg(),recentGain,recentDays));}
                    }
                }
            }
        }
        for(var entry:byPen.entrySet()){
            Map<String,Object> row=entry.getValue();BigDecimal gain=(BigDecimal)row.get("gainKg"),eligibleKg=(BigDecimal)row.get("feedKgForIncluded");
            row.put("feedKgPerGain",gain.signum()>0?eligibleKg.divide(gain,3,RoundingMode.HALF_UP):null);
            row.put("feedCostPerGain",gain.signum()>0?BigDecimal.valueOf((Long)row.get("feedCostForIncluded")).divide(gain,2,RoundingMode.HALF_UP):null);
            List<BigDecimal> penAdgs=adgByPen.getOrDefault(entry.getKey(),List.of());row.put("adgKgPerDay",average(penAdgs));row.put("adgSampleSize",penAdgs.size());rows.add(row);
        }
        BigDecimal feedPerGain=gainTotal.signum()>0?feedKgForIncluded.divide(gainTotal,3,RoundingMode.HALF_UP):null;
        BigDecimal costPerGain=gainTotal.signum()>0?BigDecimal.valueOf(feedCostForIncluded).divide(gainTotal,2,RoundingMode.HALF_UP):null;
        summary.put("averageHead",periodDays==0?null:BigDecimal.valueOf(totalHeadDays).divide(BigDecimal.valueOf(periodDays),2,RoundingMode.HALF_UP));
        summary.put("cattleIncluded",included);summary.put("insufficientWeights",insufficient);
        summary.put("averageStartWeightKg",included==0?null:startWeightTotal.divide(BigDecimal.valueOf(included),2,RoundingMode.HALF_UP));
        summary.put("averageEndWeightKg",included==0?null:endWeightTotal.divide(BigDecimal.valueOf(included),2,RoundingMode.HALF_UP));
        summary.put("totalGainKg",included==0?null:gainTotal);summary.put("averageAdgKgPerDay",meanMetric(adgValues));
        summary.put("feedUsedKg",feedKg);
        summary.put("feedPerKgGain",ratioMetric(feedKgForIncluded,gainTotal,included,feedPerGain));summary.put("feedCostPerKgGain",ratioMetric(BigDecimal.valueOf(feedCostForIncluded),gainTotal,included,costPerGain));summary.put("targetReached",targetValue==null?null:reached);summary.put("projectedDaysToTarget",meanMetric(projectedDays));
        if(targetValue==null)unavailable.add("The farm has no effective target finishing weight; target and projection indicators are suppressed.");
        ReportSection penSection=new ReportSection("fatteningByPen","Hiệu quả vỗ béo theo chuồng","Chuồng",List.copyOf(rows),fatteningTotalRow(summary,rows));sections.add(penSection);charts.add(countChart("Số bò đủ dữ liệu cân theo chuồng","Mỗi bò được tính trong chuồng tại thời điểm đo cuối kỳ.","con",penSection.rows(),"cattleCount"));
    }

    private record FatteningSegment(LocalDate start,LocalDate end){}
    private record FatteningPeriods(List<FatteningSegment> segments,boolean complete){}

    private LocalDate currentFatteningStart(Cattle cattle,LocalDate asOf){
        List<CattleProfileChange> changes=em.createQuery("select h from CattleProfileChange h where h.farm.id=:farm and h.cattle.id=:c and h.fieldGroup=:field order by h.effectiveDate,h.id",CattleProfileChange.class)
            .setParameter("farm",cattle.getFarm().getId()).setParameter("c",cattle.getId()).setParameter("field",ProfileFieldGroup.PURPOSE).getResultList();
        LocalDate entry=firstEntry(cattle.getId());LocalDate since=entry==null?LocalDate.MIN:entry;String purposeId;
        if(changes.isEmpty())purposeId=Objects.toString(cattle.getPurpose()==null?null:cattle.getPurpose().getId(),null);
        else purposeId=changes.get(0).getOldValue();
        PurposeType current=purposeTypeFor(cattle,purposeId);if(current==null)return null;
        if(current!=PurposeType.FATTENING)since=null;
        for(CattleProfileChange change:changes){
            if(change.getEffectiveDate().isAfter(asOf))break;
            PurposeType next=purposeTypeFor(cattle,change.getNewValue());if(next==null)return null;
            if(current!=PurposeType.FATTENING&&next==PurposeType.FATTENING)since=change.getEffectiveDate();
            else if(current==PurposeType.FATTENING&&next!=PurposeType.FATTENING)since=null;
            current=next;
        }
        if(current!=PurposeType.FATTENING||since==null)return null;
        return entry!=null&&entry.isAfter(since)?entry:since;
    }

    static BigDecimal projectedDaysToTarget(BigDecimal targetWeight,BigDecimal latestWeight,BigDecimal gain,long gainDays){
        if(targetWeight==null||latestWeight==null||gain==null||gain.signum()<=0||gainDays<=0||targetWeight.compareTo(latestWeight)<=0)return null;
        return targetWeight.subtract(latestWeight).multiply(BigDecimal.valueOf(gainDays)).divide(gain,0,RoundingMode.CEILING);
    }

    private FatteningPeriods fatteningPeriods(Cattle cattle,LocalDate start,LocalDate end){
        List<CattleProfileChange> changes=em.createQuery("select h from CattleProfileChange h where h.farm.id=:farm and h.cattle.id=:c and h.fieldGroup=:field order by h.effectiveDate,h.id",CattleProfileChange.class)
            .setParameter("farm",cattle.getFarm().getId()).setParameter("c",cattle.getId()).setParameter("field",ProfileFieldGroup.PURPOSE).getResultList();
        String purposeId=Objects.toString(cattle.getPurpose()==null?null:cattle.getPurpose().getId(),null);int nextChange=0;
        if(!changes.isEmpty()){
            while(nextChange<changes.size()&&!changes.get(nextChange).getEffectiveDate().isAfter(start)){purposeId=changes.get(nextChange).getNewValue();nextChange++;}
            if(nextChange==0){purposeId=changes.get(0).getOldValue();if(purposeId==null)return new FatteningPeriods(List.of(),false);}
        }
        LocalDate segmentStart=start;List<FatteningSegment> segments=new ArrayList<>();
        for(int i=nextChange;i<changes.size();i++){
            CattleProfileChange change=changes.get(i);LocalDate effective=change.getEffectiveDate();if(effective.isAfter(end))break;
            if(purposeTypeFor(cattle,purposeId)==null)return new FatteningPeriods(List.of(),false);
            if(purposeTypeFor(cattle,purposeId)==PurposeType.FATTENING&&segmentStart.isBefore(effective))segments.add(new FatteningSegment(segmentStart,effective.minusDays(1)));
            if(effective.isAfter(segmentStart))segmentStart=effective;
            purposeId=change.getNewValue();
        }
        PurposeType finalPurpose=purposeTypeFor(cattle,purposeId);if(finalPurpose==null)return new FatteningPeriods(List.of(),false);
        if(finalPurpose==PurposeType.FATTENING&&!segmentStart.isAfter(end))segments.add(new FatteningSegment(segmentStart,end));
        return new FatteningPeriods(List.copyOf(segments),true);
    }

    private PurposeType purposeTypeFor(Cattle cattle,String purposeId){
        try{ProductionPurpose purpose=em.find(ProductionPurpose.class,Long.valueOf(purposeId));return purpose!=null&&purpose.getFarm().getId().equals(cattle.getFarm().getId())?purpose.getPurposeType():null;}
        catch(RuntimeException ignored){return null;}
    }

    private Map<String,Object> meanMetric(List<BigDecimal> values){
        BigDecimal numerator=values.stream().reduce(BigDecimal.ZERO,BigDecimal::add);long denominator=values.size();
        Map<String,Object> metric=new LinkedHashMap<>();metric.put("value",values.isEmpty()?null:average(values));metric.put("numerator",numerator);metric.put("denominator",denominator);metric.put("n",denominator);metric.put("status",denominator<3?"INSUFFICIENT_DATA":"AVAILABLE");return Collections.unmodifiableMap(metric);
    }

    private Map<String,Object> ratioMetric(BigDecimal numerator,BigDecimal denominator,long sampleSize,BigDecimal value){
        Map<String,Object> metric=new LinkedHashMap<>();metric.put("value",value);metric.put("numerator",numerator);metric.put("denominator",denominator);metric.put("n",sampleSize);metric.put("status",sampleSize<3?"INSUFFICIENT_DATA":"AVAILABLE");return Collections.unmodifiableMap(metric);
    }

    private record FeedAllocation(BigDecimal kilograms,long cost){}

    private FeedAllocation allocatedFeed(Cattle cattle,LocalDate start,LocalDate end,List<FeedingRecord> feeding){
        BigDecimal kilograms=BigDecimal.ZERO;long cost=0;Map<LocalDate,Long> penByDay=new HashMap<>();
        for(PenAssignment assignment:em.createQuery("select a from PenAssignment a where a.cattle.id=:id and a.fromDate<=:to and (a.toDate is null or a.toDate>=:from)",PenAssignment.class).setParameter("id",cattle.getId()).setParameter("from",start).setParameter("to",end).getResultList()){
            LocalDate from=assignment.getFromDate().isAfter(start)?assignment.getFromDate():start;
            LocalDate through=assignment.getToDate()==null||!assignment.getToDate().isBefore(end)?end:assignment.getToDate();
            for(LocalDate day=from;!day.isAfter(through);day=day.plusDays(1))penByDay.put(day,assignment.getPen().getId());
        }
        for(FeedingRecord record:feeding){
            LocalDate feedDate=record.getFeedingDate();if(feedDate.isBefore(start)||feedDate.isAfter(end)||!Objects.equals(penByDay.get(feedDate),record.getPen().getId()))continue;
            long head=em.createQuery("select count(a) from PenAssignment a where a.pen.id=:pen and a.fromDate<=:day and (a.toDate is null or a.toDate>=:day)",Long.class).setParameter("pen",record.getPen().getId()).setParameter("day",feedDate).getSingleResult();
            if(head==0)continue;
            for(FeedingRecordLine line:em.createQuery("select l from FeedingRecordLine l where l.feedingRecord.id=:id",FeedingRecordLine.class).setParameter("id",record.getId()).getResultList()){
                kilograms=kilograms.add(line.getActualKg().divide(BigDecimal.valueOf(head),6,RoundingMode.HALF_UP));
                cost=Math.addExact(cost,BigDecimal.valueOf(line.getTotalCost()).divide(BigDecimal.valueOf(head),0,RoundingMode.HALF_UP).longValue());
            }
        }
        return new FeedAllocation(kilograms,cost);
    }

    private BigDecimal weightAt(Long cattleId,LocalDate date){List<Growth> weights=em.createQuery("select g from Growth g where g.cattle.id=:id and upper(g.status)='VALID' and g.weightKg is not null order by g.checkDate,g.id",Growth.class).setParameter("id",cattleId).getResultList();Growth before=null,after=null,nearest=null;long nearestDays=Long.MAX_VALUE;for(Growth g:weights){long diff=ChronoUnit.DAYS.between(date,g.getCheckDate());if(g.getCheckDate().isBefore(date)||g.getCheckDate().equals(date))before=g;if(g.getCheckDate().isAfter(date)&&after==null)after=g;if(Math.abs(diff)<nearestDays){nearest=g;nearestDays=Math.abs(diff);}}if(before!=null&&after!=null&&ChronoUnit.DAYS.between(before.getCheckDate(),date)<=60&&ChronoUnit.DAYS.between(date,after.getCheckDate())<=60){long span=ChronoUnit.DAYS.between(before.getCheckDate(),after.getCheckDate());if(span==0)return before.getWeightKg();BigDecimal fraction=BigDecimal.valueOf(ChronoUnit.DAYS.between(before.getCheckDate(),date)).divide(BigDecimal.valueOf(span),8,RoundingMode.HALF_UP);return before.getWeightKg().add(after.getWeightKg().subtract(before.getWeightKg()).multiply(fraction));}return nearest!=null&&nearestDays<=7?nearest.getWeightKg():null;}
    private LocalDate firstEntry(Long id){return em.createQuery("select min(e.entryDate) from HerdEntry e where e.cattle.id=:id and e.status=:valid",LocalDate.class).setParameter("id",id).setParameter("valid",EntryLineStatus.VALID).getSingleResult();}
    private String penAt(Long cattle,LocalDate day){return em.createQuery("select a.pen.code from PenAssignment a where a.cattle.id=:c and a.fromDate<=:day and (a.toDate is null or a.toDate>=:day) order by a.fromDate desc",String.class).setParameter("c",cattle).setParameter("day",day).setMaxResults(1).getResultStream().findFirst().orElse(null);}
    private boolean matches(Cattle c,ReportRequest r,LocalDate asOf){
        Set<String> supported= switch(r.reportType()){
            case "RPT-03" -> Set.of("pen","group");
            case "RPT-07" -> Set.of("pen");
            default -> Set.of("pen","breed","group","stage");
        };
        if(supported.contains("pen")&&r.penIds()!=null&&!r.penIds().isEmpty()&&!r.penIds().contains(penIdAt(c,asOf)))return false;
        if(supported.contains("breed")&&r.breedIds()!=null&&!r.breedIds().isEmpty()&&!r.breedIds().contains(c.getBreed().getId()))return false;
        if(supported.contains("stage")&&r.lifeStages()!=null&&!r.lifeStages().isEmpty()&&!r.lifeStages().contains(lifeStageAt(c,asOf)))return false;
        return !supported.contains("group")||r.herdGroups()==null||r.herdGroups().isEmpty()||r.herdGroups().contains(groupAt(c,asOf));
    }
    private Long penIdAt(Cattle cattle,LocalDate day){return em.createQuery("select a.pen.id from PenAssignment a where a.cattle.id=:c and a.farm.id=:farm and a.fromDate<=:day and (a.toDate is null or a.toDate>=:day) order by a.fromDate desc",Long.class).setParameter("c",cattle.getId()).setParameter("farm",cattle.getFarm().getId()).setParameter("day",day).setMaxResults(1).getResultStream().findFirst().orElse(null);}
    private String profileValueAt(Cattle c,ProfileFieldGroup field,LocalDate day,String current){List<CattleProfileChange> changes=em.createQuery("select h from CattleProfileChange h where h.farm.id=:farm and h.cattle.id=:c and h.fieldGroup=:field order by h.effectiveDate,h.id",CattleProfileChange.class).setParameter("farm",c.getFarm().getId()).setParameter("c",c.getId()).setParameter("field",field).getResultList();if(changes.isEmpty())return current;String value=Objects.toString(changes.get(0).getOldValue(),current);for(CattleProfileChange change:changes){if(change.getEffectiveDate().isAfter(day))break;value=change.getNewValue();}return value;}
    private String lifeStageAt(Cattle c,LocalDate day){return profileValueAt(c,ProfileFieldGroup.LIFE_STAGE,day,c.getLifeStage().name());}
    private ProductionPurpose purposeAt(Cattle c,LocalDate day){String purposeId=profileValueAt(c,ProfileFieldGroup.PURPOSE,day,Objects.toString(c.getPurpose().getId()));try{ProductionPurpose purpose=em.find(ProductionPurpose.class,Long.valueOf(purposeId));return purpose!=null&&purpose.getFarm().getId().equals(c.getFarm().getId())?purpose:c.getPurpose();}catch(NumberFormatException ignored){return c.getPurpose();}}
    private PurposeType purposeTypeAt(Cattle c,LocalDate day){ProductionPurpose purpose=purposeAt(c,day);return purpose==null?null:purpose.getPurposeType();}
    private String purposeNameAt(Cattle c,LocalDate day){ProductionPurpose purpose=purposeAt(c,day);return purpose==null?"UNKNOWN":purpose.getName();}
    private String groupAt(Cattle c,LocalDate day){String stageName=lifeStageAt(c,day);LifeStage stage;try{stage=LifeStage.valueOf(stageName);}catch(IllegalArgumentException ignored){stage=c.getLifeStage();}if(stage==LifeStage.UNWEANED_CALF||stage==LifeStage.WEANED_CALF)return "CALVES";PurposeType purpose=purposeTypeAt(c,day);if(purpose==PurposeType.FATTENING)return "FATTENING";if(purpose==PurposeType.SIRE)return "BREEDING_BULLS";if(purpose==PurposeType.BREEDING&&c.getSex()==Sex.FEMALE&&stage==LifeStage.ADULT)return "BREEDING_FEMALES";if(stage==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";return "OTHER";}
    private void validate(ReportRequest r){if(r==null||r.reportType()==null||r.from()==null||r.to()==null)throw DomainException.required("reportCriteria");if(r.from().isAfter(r.to()))throw DomainException.invalid("period");if(r.from().plusMonths(24).isBefore(r.to()))throw DomainException.unprocessable(MessageCodes.COM_10,"field","period","maximumMonths",24);if(!Set.of("RPT-01","RPT-02","RPT-03","RPT-04","RPT-05","RPT-06","RPT-07").contains(r.reportType()))throw DomainException.invalid("reportType");}
    private Map<String,Object> parameters(Long farmId,LocalDate date){List<FarmParameterVersion> rows=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:day order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class).setParameter("farm",farmId).setParameter("day",date).setMaxResults(1).getResultList();if(rows.isEmpty())return Map.of();try{return new com.fasterxml.jackson.databind.ObjectMapper().readValue(rows.get(0).getParameterValues(),new com.fasterxml.jackson.core.type.TypeReference<>(){});}catch(Exception ignored){return Map.of();}}
    private List<Map<String,Object>> dimensions(String name,Map<String,Long> data){return data.entrySet().stream().map(e->row("dimension",name,"value",e.getKey(),"count",e.getValue())).toList();}
    private ReportSection countSection(String key,String title,String heading,Map<String,Long> values,String unit){List<Map<String,Object>> rows=values.entrySet().stream().map(e->row("label",e.getKey(),"count",e.getValue())).toList();long total=values.values().stream().mapToLong(Long::longValue).sum();return new ReportSection(key,title,heading,rows,new ReportTotalRow("Tổng ("+unit+")",row("count",total)));}
    private ReportSection scheduleSection(Map<String,long[]> schedules){List<Map<String,Object>> rows=new ArrayList<>();long[] totals=new long[5];schedules.forEach((name,counts)->{rows.add(row("label",name,"planned",counts[0],"done",counts[1],"deferred",counts[2],"overdue",counts[3],"cancelled",counts[4]));for(int i=0;i<totals.length;i++)totals[i]+=counts[i];});return new ReportSection("scheduledDoses","Tuân thủ theo lịch tiêm","Lịch tiêm",List.copyOf(rows),new ReportTotalRow("Tổng (mũi)",row("planned",totals[0],"done",totals[1],"deferred",totals[2],"overdue",totals[3],"cancelled",totals[4])));}
    static ReportMetricChart countChart(String title,String sub,String unit,List<Map<String,Object>> rows,String valueKey){List<ReportMetricChartBar> bars=rows.stream().map(item->{Object value=item.get(valueKey);if(!(value instanceof Number n))throw new IllegalArgumentException("Missing numeric value for chart key: "+valueKey);Object label=item.get("label");if(!(label instanceof String text))throw new IllegalArgumentException("Missing chart label");return new ReportMetricChartBar(text,new BigDecimal(n.toString()),null,null,null);}).toList();return new ReportMetricChart(title,sub,unit,bars);}
    private Map<GrowthScopeKey,GrowthScope> growthScopes(Long farm,ReportRequest request,List<Growth> source){
        if(source.isEmpty())return Map.of();
        Set<Long> cattleIds=source.stream().map(g->g.getCattle().getId()).collect(java.util.stream.Collectors.toSet());
        Map<Long,List<PenAssignment>> assignmentsByCattle=new HashMap<>();
        for(PenAssignment assignment:em.createQuery("select a from PenAssignment a join fetch a.cattle join fetch a.pen where a.farm.id=:farm and a.cattle.id in :cattleIds and a.fromDate<=:to and (a.toDate is null or a.toDate>=:from) order by a.cattle.id,a.fromDate desc",PenAssignment.class).setParameter("farm",farm).setParameter("cattleIds",cattleIds).setParameter("from",request.from()).setParameter("to",request.to()).getResultList())
            assignmentsByCattle.computeIfAbsent(assignment.getCattle().getId(),ignored->new ArrayList<>()).add(assignment);
        Map<Long,Map<ProfileFieldGroup,List<CattleProfileChange>>> changesByCattle=new HashMap<>();
        for(CattleProfileChange change:em.createQuery("select h from CattleProfileChange h join fetch h.cattle where h.farm.id=:farm and h.cattle.id in :cattleIds and h.fieldGroup in :fields order by h.cattle.id,h.fieldGroup,h.effectiveDate,h.id",CattleProfileChange.class).setParameter("farm",farm).setParameter("cattleIds",cattleIds).setParameter("fields",List.of(ProfileFieldGroup.PURPOSE,ProfileFieldGroup.LIFE_STAGE)).getResultList())
            changesByCattle.computeIfAbsent(change.getCattle().getId(),ignored->new EnumMap<>(ProfileFieldGroup.class)).computeIfAbsent(change.getFieldGroup(),ignored->new ArrayList<>()).add(change);
        Map<Long,ProductionPurpose> purposesById=new HashMap<>();
        for(ProductionPurpose purpose:em.createQuery("select p from ProductionPurpose p where p.farm.id=:farm",ProductionPurpose.class).setParameter("farm",farm).getResultList())purposesById.put(purpose.getId(),purpose);
        Map<GrowthScopeKey,GrowthScope> resolved=new HashMap<>();
        for(Growth growth:source){
            GrowthScopeKey key=new GrowthScopeKey(growth.getCattle().getId(),growth.getCheckDate());
            resolved.computeIfAbsent(key,ignored->growthScope(growth,assignmentsByCattle,changesByCattle,purposesById));
        }
        return resolved;
    }

    private GrowthScope growthScope(Growth growth,Map<Long,List<PenAssignment>> assignmentsByCattle,Map<Long,Map<ProfileFieldGroup,List<CattleProfileChange>>> changesByCattle,Map<Long,ProductionPurpose> purposesById){
        Cattle cattle=growth.getCattle();LocalDate day=growth.getCheckDate();
        PenAssignment assignment=assignmentsByCattle.getOrDefault(cattle.getId(),List.of()).stream().filter(a->!a.getFromDate().isAfter(day)&&(a.getToDate()==null||!a.getToDate().isBefore(day))).findFirst().orElse(null);
        Map<ProfileFieldGroup,List<CattleProfileChange>> changes=changesByCattle.getOrDefault(cattle.getId(),Map.of());
        String stageName=profileValueAtHistory(changes.get(ProfileFieldGroup.LIFE_STAGE),day,cattle.getLifeStage().name());
        LifeStage stage;try{stage=LifeStage.valueOf(stageName);}catch(IllegalArgumentException ignored){stage=cattle.getLifeStage();}
        String purposeId=profileValueAtHistory(changes.get(ProfileFieldGroup.PURPOSE),day,Objects.toString(cattle.getPurpose().getId()));
        ProductionPurpose purpose;try{purpose=purposeId==null?cattle.getPurpose():purposesById.getOrDefault(Long.valueOf(purposeId),cattle.getPurpose());}catch(NumberFormatException ignored){purpose=cattle.getPurpose();}
        PurposeType purposeType=purpose==null?null:purpose.getPurposeType();
        return new GrowthScope(assignment==null?null:assignment.getPen().getId(),assignment==null?null:assignment.getPen().getCode(),stageName,groupAt(cattle,purposeType,stage));
    }

    private String profileValueAtHistory(List<CattleProfileChange> changes,LocalDate day,String current){
        if(changes==null||changes.isEmpty())return current;
        String value=Objects.toString(changes.get(0).getOldValue(),current);
        for(CattleProfileChange change:changes){if(change.getEffectiveDate().isAfter(day))break;value=change.getNewValue();}
        return value;
    }

    private boolean matchesGrowth(Cattle cattle,ReportRequest request,GrowthScope scope){
        if(request.penIds()!=null&&!request.penIds().isEmpty()&&!request.penIds().contains(scope.penId()))return false;
        if(request.breedIds()!=null&&!request.breedIds().isEmpty()&&!request.breedIds().contains(cattle.getBreed().getId()))return false;
        if(request.lifeStages()!=null&&!request.lifeStages().isEmpty()&&!request.lifeStages().contains(scope.lifeStage()))return false;
        return request.herdGroups()==null||request.herdGroups().isEmpty()||request.herdGroups().contains(scope.herdGroup());
    }

    private GrowthScope growthScope(Growth growth,Map<GrowthScopeKey,GrowthScope> scopes){return scopes.get(new GrowthScopeKey(growth.getCattle().getId(),growth.getCheckDate()));}

    private Map<String,List<Growth>> growthBuckets(List<Growth> events,String dimension,Map<GrowthScopeKey,GrowthScope> scopes){Map<String,List<Growth>> buckets=new TreeMap<>();for(Growth growth:events){GrowthScope scope=growthScope(growth,scopes);String key=switch(dimension){case "pen"->Objects.toString(scope.penCode(),"Chưa phân chuồng");case "group"->scope.herdGroup();case "stage"->scope.lifeStage();default->throw new IllegalArgumentException("Unknown growth dimension: "+dimension);};buckets.computeIfAbsent(key,ignored->new ArrayList<>()).add(growth);}return buckets;}

    private record GrowthScopeKey(Long cattleId,LocalDate date){}
    private record GrowthScope(Long penId,String penCode,String lifeStage,String herdGroup){}
    private ReportSection growthSection(String key,String title,String heading,Map<String,List<Growth>> buckets,List<Growth> allEvents){List<Map<String,Object>> rows=buckets.entrySet().stream().map(e->growthRow(e.getKey(),e.getValue())).toList();List<BigDecimal> adgs=growthAdgs(allEvents);long estimated=allEvents.stream().filter(g->"ESTIMATED".equalsIgnoreCase(g.getWeightType())).count();Map<String,Object> total=row("validWeighings",allEvents.size(),"averageWeightKg",averageWeight(allEvents),"adgKgPerDay",average(adgs),"adgSampleSize",adgs.size(),"estimatedCount",estimated,"estimatedShare",allEvents.isEmpty()?null:BigDecimal.valueOf(estimated).divide(BigDecimal.valueOf(allEvents.size()),4,RoundingMode.HALF_UP));return new ReportSection(key,title,heading,rows,new ReportTotalRow("Tổng",total));}
    private Map<String,Object> growthRow(String label,List<Growth> events){List<BigDecimal> adgs=growthAdgs(events);long estimated=events.stream().filter(g->"ESTIMATED".equalsIgnoreCase(g.getWeightType())).count();return row("label",label,"validWeighings",events.size(),"averageWeightKg",averageWeight(events),"adgKgPerDay",average(adgs),"adgSampleSize",adgs.size(),"estimatedCount",estimated,"estimatedShare",events.isEmpty()?null:BigDecimal.valueOf(estimated).divide(BigDecimal.valueOf(events.size()),4,RoundingMode.HALF_UP));}
    private BigDecimal averageWeight(List<Growth> events){return events.isEmpty()?null:events.stream().map(Growth::getWeightKg).reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(events.size()),2,RoundingMode.HALF_UP);}
    private List<BigDecimal> growthAdgs(List<Growth> events){Map<Long,List<Growth>> byCattle=new HashMap<>();events.stream().sorted(Comparator.comparing(Growth::getCheckDate).thenComparing(Growth::getId)).forEach(g->byCattle.computeIfAbsent(g.getCattle().getId(),k->new ArrayList<>()).add(g));List<BigDecimal> values=new ArrayList<>();for(List<Growth> weights:byCattle.values()){if(weights.size()<2)continue;Growth first=weights.get(0),last=weights.get(weights.size()-1);long days=ChronoUnit.DAYS.between(first.getCheckDate(),last.getCheckDate());if(days>=14)values.add(last.getWeightKg().subtract(first.getWeightKg()).divide(BigDecimal.valueOf(days),3,RoundingMode.HALF_UP));}return values;}
    private Map<String,Long> countByCase(List<HealthCase> cases,java.util.function.Function<HealthCase,String> dimension){Map<String,Long> counts=new TreeMap<>();for(HealthCase healthCase:cases)counts.merge(Objects.toString(dimension.apply(healthCase),"UNSPECIFIED"),1L,Long::sum);return counts;}
    private Map<String,Long> groupEnum(List<String> values){Map<String,Long> out=new TreeMap<>();values.forEach(v->out.merge(v,1L,Long::sum));return out;}
    private Map<String,Object> row(Object...pairs){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)out.put((String)pairs[i],pairs[i+1]);return out;}
    private BigDecimal average(List<BigDecimal> values){return values.isEmpty()?null:values.stream().reduce(BigDecimal.ZERO,BigDecimal::add).divide(BigDecimal.valueOf(values.size()),3,RoundingMode.HALF_UP);}
    private long countType(List<ReproductionEvent> rows,String type){return rows.stream().filter(e->type.equalsIgnoreCase(e.getType())).count();}
}
