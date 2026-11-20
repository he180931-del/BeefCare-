package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.ReportView;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * RPT-05 / M09 (GBR-106) and RPT-07 (GBR-107) against hand-computed values; every expected number is derived in the comments.
 * TODAY = 2026-10-28; farm parameters POST_CALVING_DAYS 45, ESTRUS_CYCLE_DAYS 21 (overdue for conception after 45 + 3 x 21 = 108 days).
 */
@ServiceIntegrationTest
@Transactional
@SuppressWarnings("unchecked")
class FarmReportIndicatorsIT extends DomainTestSupport {
    static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    @Autowired FarmReportService reports;
    @Autowired FarmDashboardService dashboard;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;
    private Farm farm;private AppUser owner;private Breed breed;private ProductionPurpose breeding;

    private void farmWithParameters(){
        farm=farm();owner=memberWithRole(farm,FarmRole.OWNER);breed=breed(farm);breeding=purpose(farm,PurposeType.BREEDING);
        FarmParameterVersion p=new FarmParameterVersion();p.setFarm(farm);p.setVersionNo(1);p.setEffectiveFrom(LocalDate.of(2024,1,1));p.setChangedBy(owner);p.setCreatedAt(clock.instant());
        p.setParameterValues("{\"POST_CALVING_DAYS\":45,\"ESTRUS_CYCLE_DAYS\":21,\"TARGET_FINISHING_WEIGHT_KG\":450}");save(p);actAs(owner);
    }
    private Instant at(String date){return LocalDate.parse(date).atTime(8,0).atZone(ZONE).toInstant();}
    private Cattle female(String birth){Cattle c=cattle(farm,breed,breeding,Sex.FEMALE,LifeStage.ADULT);c.setBirthDate(LocalDate.parse(birth));return c;}
    private CalvingEvent calving(Cattle dam,String date,String calf){
        CalvingEvent c=new CalvingEvent();c.setDam(dam);c.setBirthTime(at(date));c.setCourse("NORMAL");c.setDamCondition("GOOD");c.setRetainedPlacenta(false);c.setStatus("VALID");c.setRecordedAt(at(date));save(c);
        if(calf!=null){CalfOutcome o=new CalfOutcome();o.setCalving(c);o.setOutcome(calf);o.setRegistrationState("REGISTERED");save(o);}
        return c;
    }
    private ReproductionEvent event(Cattle cow,String type,String date,String result,ReproductionEvent linked){
        ReproductionEvent e=new ReproductionEvent();e.setCattle(cow);e.setType(type);e.setEventTime(at(date));e.setResult(result);e.setStatus("VALID");e.setUpdatedAt(at(date));e.setLinkedEvent(linked);return save(e);
    }
    private void pregnant(Cattle cow,String breedingDate,String checkDate){
        ReproductionEvent service=event(cow,"BREEDING",breedingDate,"BRED",null);ReproductionEvent check=event(cow,"PREGNANCY_CHECK",checkDate,"PREGNANT",service);
        PregnancyEpisode p=new PregnancyEpisode();p.setCattle(cow);p.setConfirmingCheck(check);p.setParity(1);p.setStatus("OPEN");p.setExpectedCalvingDate(LocalDate.parse(breedingDate).plusDays(283));save(p);
    }
    private static Map<String,Object> m(Object value){return (Map<String,Object>)value;}
    private static void assertDecimal(Map<String,Object> values,String key,String expected){assertThat((BigDecimal)values.get(key)).isEqualByComparingTo(expected);}

    private void reproductionHerd(){
        // Cow A: calvings 2025-03-01 and 2026-02-01 -> interval 337 d. B1 2026-03-20 NOT_PREGNANT, B2 2026-04-10 PREGNANT:
        // days open 2026-02-01..2026-04-10 = 68 d, services per conception 2; B1 is the cycle's first service (not conceived).
        Cattle a=female("2021-05-01");calving(a,"2025-03-01","LIVE");calving(a,"2026-02-01","LIVE");
        ReproductionEvent b1=event(a,"BREEDING","2026-03-20","BRED",null);event(a,"PREGNANCY_CHECK","2026-04-20","NOT_PREGNANT",b1);pregnant(a,"2026-04-10","2026-05-10");
        // Cow B: 2025-06-01, 2026-04-01 -> 304 d; first service 2026-05-21 conceived -> days open 50, services 1.
        Cattle b=female("2021-05-01");calving(b,"2025-06-01","LIVE");calving(b,"2026-04-01","LIVE");pregnant(b,"2026-05-21","2026-06-21");
        // Cow C: 2025-01-10, 2026-01-10 -> 365 d; D1 2026-03-01 INCONCLUSIVE then PREGNANT -> days open 50, services 1 (INCONCLUSIVE excluded).
        Cattle c=female("2021-05-01");calving(c,"2025-01-10","LIVE");calving(c,"2026-01-10","STILLBORN");
        ReproductionEvent d1=event(c,"BREEDING","2026-03-01","BRED",null);event(c,"PREGNANCY_CHECK","2026-04-01","INCONCLUSIVE",d1);ReproductionEvent cPregnancyCheck=event(c,"PREGNANCY_CHECK","2026-04-15","PREGNANT",d1);
        PregnancyEpisode pc=new PregnancyEpisode();pc.setCattle(c);pc.setConfirmingCheck(cPregnancyCheck);pc.setParity(2);pc.setStatus("OPEN");pc.setExpectedCalvingDate(LocalDate.of(2026,12,9));save(pc);
        // Heifer D born 2024-01-15 calves first on 2026-03-15: 790 d / 30.4375 = 25.95 months (n=1). Not pregnant 227 d after calving -> overdue.
        Cattle d=female("2024-01-15");calving(d,"2026-03-15",null);
        // Cow F: last calving 2026-07-05 = 115 d ago, not pregnant -> overdue at 108 d (not at the old 126-d fallback).
        Cattle f=female("2021-05-01");calving(f,"2026-07-05",null);
        // Cow E: valid calving 2026-08-01 (88 d, not overdue); a voided calving with a live calf must not be counted.
        Cattle e=female("2021-05-01");calving(e,"2026-08-01","LIVE");calving(e,"2026-09-01","LIVE").setStatus("VOIDED");
        registerInHerd(a,b,c,d,e,f);
    }

    private void registerInHerd(Cattle... cattle){
        Pen initialPen=pen(farm,"RPT05",cattle.length+1);registerInHerd(farm,owner,initialPen,cattle);
    }
    private void registerInHerd(Farm herdFarm,AppUser herdOwner,Pen initialPen,Cattle... cattle){
        TradingPartner seller=partner(herdFarm,herdOwner,true,false);HerdEntryVoucher voucher=entryVoucher(herdFarm,herdOwner,seller,0L,0L,EntryVoucherStatus.POSTED);int lineNo=0;
        for(Cattle cow:cattle){HerdEntry line=new HerdEntry();line.setFarm(herdFarm);line.setVoucher(voucher);line.setLineNo(++lineNo);line.setCattle(cow);line.setSource(EntrySource.EXTERNAL);line.setEntryDate(voucher.getEntryDate());line.setInitialPen(initialPen);line.setStatus(EntryLineStatus.VALID);line.setCreatedAt(clock.instant());line.setUpdatedAt(clock.instant());save(line);}
    }

    @Test void reproductionPerformanceMatchesGbr106ByHand() {
        farmWithParameters();reproductionHerd();em.flush();
        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-05",LocalDate.of(2026,1,1),LocalDate.of(2026,10,28),null,null,null,null));
        Map<String,Object> s=view.summary();
        // (1) intervals ending in the period: 337, 304, 365 -> 1006 / 3
        assertThat(m(s.get("averageCalvingIntervalDays"))).containsEntry("n",3).containsEntry("status","AVAILABLE");
        assertThat((BigDecimal)m(s.get("averageCalvingIntervalDays")).get("value")).isEqualByComparingTo("335.333");
        // (2) days open 68, 50, 50 -> 56; (3) services 2, 1, 1 -> 1.333
        assertThat((BigDecimal)m(s.get("averageDaysOpen")).get("value")).isEqualByComparingTo("56");
        assertThat((BigDecimal)m(s.get("averageServicesPerConception")).get("value")).isEqualByComparingTo("1.333");
        // (5) PREGNANT or NOT_PREGNANT breedings: B1 no, B2 yes, C1 yes, D1 yes -> 3/4; (4) first services B1 no, C1 yes, D1 yes -> 2/3
        assertThat(m(s.get("overallConceptionRate"))).containsEntry("numerator",3L).containsEntry("denominator",4L);
        assertThat((BigDecimal)m(s.get("overallConceptionRate")).get("value")).isEqualByComparingTo("0.75");
        assertThat(m(s.get("firstServiceConceptionRate"))).containsEntry("numerator",2L).containsEntry("denominator",3L);
        // (7) first calvings in the period: D 790 d, F 1891 d, E 1918 d (/30.4375) -> 25.955, 62.127, 63.014 months -> 50.366
        assertThat(m(s.get("averageAgeAtFirstCalvingMonths"))).containsEntry("n",3);
        assertThat((BigDecimal)m(s.get("averageAgeAtFirstCalvingMonths")).get("value")).isEqualByComparingTo("50.366");
        // calves of valid calvings only: LIVE A2, B2, E1 (+ A1/B1/C1 are before the period); STILLBORN C2
        assertThat(s).containsEntry("liveCalves",3L).containsEntry("stillbirths",1L);
        // (8) overdue for conception: D (227 d) and F (115 d) > 108 d
        assertThat(m(s.get("overdueFemales"))).containsEntry("count",2);
        assertThat(view.totalRow()).isNull();
        assertThat(view.chart().bars().stream().mapToLong(bar->bar.numerator()).sum()).isEqualTo(3);
        assertThat(view.chart().bars().stream().mapToLong(bar->bar.denominator()).sum()).isEqualTo(4);
    }

    @Test void trackedFemalesUseEndOfPeriodProfilesEventsFarmScopeAndFilters(){
        farmWithParameters();ProductionPurpose fattening=purpose(farm,PurposeType.FATTENING);Pen selectedPen=pen(farm,"TRACKED",20),otherPen=pen(farm,"OTHER",10);
        Cattle awaiting=female("2021-05-01"),estrus=female("2021-05-01"),bred=female("2021-05-01"),pregnant=female("2021-05-01"),postCalving=female("2021-05-01");
        Cattle youngStock=cattle(farm,breed,breeding,Sex.FEMALE,LifeStage.YOUNG_STOCK),purposeChanged=female("2021-05-01"),stageChanged=female("2021-05-01"),exitsAfterPeriod=female("2021-05-01"),exited=female("2021-05-01"),otherPenCow=female("2021-05-01");
        changePurpose(bred,breeding,fattening,LocalDate.of(2026,10,29));
        changePurpose(pregnant,breeding,fattening,LocalDate.of(2026,10,27));
        changePurpose(purposeChanged,breeding,fattening,LocalDate.of(2026,10,27));
        changeLifeStage(stageChanged,LifeStage.ADULT,LifeStage.WEANED_CALF,LocalDate.of(2026,10,27));
        exitsAfterPeriod.setExitDate(LocalDate.of(2026,10,29));exitsAfterPeriod.setExitType(ExitType.OTHER);exitsAfterPeriod.setHerdStatus(HerdStatus.EXITED);
        exited.setExitDate(LocalDate.of(2026,10,27));exited.setExitType(ExitType.OTHER);exited.setHerdStatus(HerdStatus.EXITED);

        event(estrus,"ESTRUS","2026-10-28","OBSERVED",null);
        event(bred,"BREEDING","2026-10-26","BRED",null);ReproductionEvent voidedEstrus=event(bred,"ESTRUS","2026-10-27","OBSERVED",null);voidedEstrus.setStatus("VOIDED");event(bred,"ESTRUS","2026-10-29","OBSERVED",null);
        ReproductionEvent pregnancyBreeding=event(pregnant,"BREEDING","2026-10-26","BRED",null);ReproductionEvent confirmingCheck=event(pregnant,"PREGNANCY_CHECK","2026-10-27","PREGNANT",pregnancyBreeding);
        PregnancyEpisode episode=new PregnancyEpisode();episode.setCattle(pregnant);episode.setConfirmingCheck(confirmingCheck);episode.setParity(1);episode.setExpectedCalvingDate(LocalDate.of(2027,7,6));episode.setStatus("LOST");episode.setClosedDate(LocalDate.of(2026,10,29));save(episode);
        PregnancyUpdate loss=new PregnancyUpdate();loss.setEpisode(episode);loss.setType("LOSS");loss.setOccurredTime(at("2026-10-29"));loss.setStatus("VALID");loss.setCorrected(false);save(loss);
        calving(postCalving,"2026-10-28",null);

        registerInHerd(farm,owner,selectedPen,awaiting,estrus,bred,pregnant,postCalving,youngStock,purposeChanged,stageChanged,exitsAfterPeriod,exited,otherPenCow);
        for(Cattle cow:new Cattle[]{awaiting,estrus,bred,pregnant,postCalving,youngStock,purposeChanged,stageChanged,exitsAfterPeriod,exited})assignToPen(cow,selectedPen);
        assignToPen(otherPenCow,otherPen);
        Farm foreignFarm=farm();AppUser foreignOwner=memberWithRole(foreignFarm,FarmRole.OWNER);Breed foreignBreed=breed(foreignFarm);ProductionPurpose foreignPurpose=purpose(foreignFarm,PurposeType.BREEDING);Pen foreignPen=pen(foreignFarm,"FOREIGN",5);
        Cattle foreignFemale=cattle(foreignFarm,foreignBreed,foreignPurpose,Sex.FEMALE,LifeStage.ADULT);registerInHerd(foreignFarm,foreignOwner,foreignPen,foreignFemale);
        em.flush();actAs(owner);

        ReportView all=reports.report(farm.getId(),new ReportRequest("RPT-05",LocalDate.of(2026,10,1),LocalDate.of(2026,10,28),null,null,null,null));
        Map<String,Object> counts=all.sections().stream().filter(section->section.key().equals("trackedFemalesByStatus")).findFirst().orElseThrow().rows().stream()
            .collect(java.util.stream.Collectors.toMap(row->(String)row.get("label"),row->(Long)row.get("count")));
        assertThat(all.summary()).containsEntry("trackedFemales",8L);
        assertThat(counts).containsEntry("Chờ phối (AWAITING_BREEDING)",4L).containsEntry("Động dục (IN_ESTRUS)",1L)
            .containsEntry("Đã phối (BRED)",1L).containsEntry("Mang thai (PREGNANT)",1L).containsEntry("Sau sinh (POST_CALVING)",1L);
        assertThat(all.sections().stream().filter(section->section.key().equals("trackedFemalesByStatus")).findFirst().orElseThrow().totalRow().cells()).containsEntry("count",8L);
        assertThat(all.unavailableData()).noneMatch(message->message.contains("baseline purpose/life-stage"));

        ReportView filtered=reports.report(farm.getId(),new ReportRequest("RPT-05",LocalDate.of(2026,10,1),LocalDate.of(2026,10,28),java.util.List.of(selectedPen.getId()),null,null,java.util.List.of("ADULT")));
        assertThat(filtered.summary()).containsEntry("trackedFemales",6L);
        assertThat(filtered.sections().stream().filter(section->section.key().equals("trackedFemalesByStatus")).findFirst().orElseThrow().totalRow().cells()).containsEntry("count",6L);
    }

    @Test void reproductionAtAGlanceUsesTheFarmPostCalvingParameter() {
        farmWithParameters();reproductionHerd();em.flush();
        Map<String,Object> m09=m(dashboard.dashboard(farm.getId(),new DashboardRequest(null,null,null,null,null)).indicators().get("M09"));
        assertThat((BigDecimal)m(m09.get("averageCalvingInterval")).get("value")).isEqualByComparingTo("335.333");
        assertThat((BigDecimal)m(m09.get("overallConceptionRate")).get("value")).isEqualByComparingTo("0.75");
        assertThat(m09).containsEntry("overdueCount",2);
    }

    @Test void fatteningPerformanceInterpolatesFromTheNearestWeightsAndSharesPenFeed() {
        farmWithParameters();Pen pen=pen(farm,"P1",10);
        Cattle steer=cattle(farm,breed,purpose(farm,PurposeType.FATTENING),Sex.MALE,LifeStage.ADULT),penMate=female("2021-05-01");
        for(Cattle c:new Cattle[]{steer,penMate}){PenAssignment a=new PenAssignment();a.setFarm(farm);a.setCattle(c);a.setPen(pen);a.setFromDate(LocalDate.of(2026,9,1));
            a.setSource(AssignmentSource.HERD_ENTRY);a.setMovedBy(owner);a.setRecordedAt(clock.instant());save(a);}
        weight(steer,LocalDate.of(2026,9,18),"300");weight(steer,LocalDate.of(2026,10,8),"330");weight(steer,LocalDate.of(2026,10,27),"360");
        FeedItem hay=new FeedItem();hay.setFarm(farm);hay.setCode("TA-"+next());hay.setName("Hay");hay.setFeedGroup("DRY_ROUGHAGE");hay.setAvailable(true);save(hay);
        FeedingRecord fed=new FeedingRecord();fed.setFarm(farm);fed.setPen(pen);fed.setFeedingDate(LocalDate.of(2026,10,10));fed.setSessionNo(1);fed.setHeadCount(2);fed.setStatus("VALID");
        fed.setRecordedBy(owner);fed.setRecordedAt(clock.instant());save(fed);
        FeedingRecordLine line=new FeedingRecordLine();line.setFeedingRecord(fed);line.setFeedItem(hay);line.setFeedCodeSnapshot(hay.getCode());line.setFeedNameSnapshot("Hay");
        line.setPlannedKg(new BigDecimal("20"));line.setActualKg(new BigDecimal("20"));line.setCostPerKg(new BigDecimal("5000"));line.setTotalCost(100_000L);save(line);em.flush();

        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-07",LocalDate.of(2026,9,28),LocalDate.of(2026,10,28),null,null,null,null));
        Map<String,Object> s=view.summary();
        // start 2026-09-28 between 09-18 (300) and 09-08's successor 10-08 (330): 300 + 30 x 10/20 = 315; end 10-28: nearest 10-27 = 360
        assertThat((BigDecimal)s.get("averageStartWeightKg")).isEqualByComparingTo("315");
        assertThat((BigDecimal)s.get("averageEndWeightKg")).isEqualByComparingTo("360");
        assertThat((BigDecimal)s.get("totalGainKg")).isEqualByComparingTo("45");
        assertThat((BigDecimal)m(s.get("averageAdgKgPerDay")).get("value")).isEqualByComparingTo("1.5"); // 45 kg / 30 days
        // 20 kg (100,000 d) fed to a pen of 2 on 10-10 -> 10 kg and 50,000 d attributed to the steer
        assertThat((BigDecimal)s.get("feedUsedKg")).isEqualByComparingTo("10");
        Map<String,Object> feedPerGain=m(s.get("feedPerKgGain"));assertDecimal(feedPerGain,"numerator","10");assertDecimal(feedPerGain,"denominator","45");assertThat(feedPerGain).containsEntry("n",1L);
        assertThat((BigDecimal)m(s.get("feedPerKgGain")).get("value")).isEqualByComparingTo("0.222");
        Map<String,Object> feedCostPerGain=m(s.get("feedCostPerKgGain"));assertDecimal(feedCostPerGain,"numerator","50000");assertDecimal(feedCostPerGain,"denominator","45");assertThat(feedCostPerGain).containsEntry("n",1L);
        assertThat((BigDecimal)m(s.get("feedCostPerKgGain")).get("value")).isEqualByComparingTo("1111.11");
        // Latest valid weight 360 kg on 10-27; the prior 60-day FATTENING window has 60 kg gain in 39 days.
        // Exact projection is (450 - 360) x 39 / 60 = 58.5 -> 59 days, anchored to the latest weight.
        assertThat(s).containsEntry("cattleIncluded",1).containsEntry("insufficientWeights",0).containsEntry("targetReached",0);
        assertThat((BigDecimal)m(s.get("projectedDaysToTarget")).get("value")).isEqualByComparingTo("59");
        assertThat(view.rows()).hasSize(1);
        Map<String,Object> totalCells=view.totalRow().cells();
        assertThat(totalCells).containsEntry("cattleCount",1).containsEntry("feedCost",50_000L);
        assertThat((BigDecimal)totalCells.get("gainKg")).isEqualByComparingTo("45");
        assertThat((BigDecimal)totalCells.get("feedKg")).isEqualByComparingTo("10");
        assertThat((BigDecimal)totalCells.get("feedKgPerGain")).isEqualByComparingTo("0.222");
        assertThat((BigDecimal)totalCells.get("feedCostPerGain")).isEqualByComparingTo("1111.11");
    }

    @Test void fatteningFeedTotalIncludesInsufficientCattleButRatiosUseOnlyCattleWithBothWeights() {
        farmWithParameters();Pen pen=pen(farm,"P1",10);ProductionPurpose fattening=purpose(farm,PurposeType.FATTENING);
        Cattle included=cattle(farm,breed,fattening,Sex.MALE,LifeStage.ADULT),insufficient=cattle(farm,breed,fattening,Sex.MALE,LifeStage.ADULT);
        for(Cattle cow:new Cattle[]{included,insufficient}){PenAssignment assignment=new PenAssignment();assignment.setFarm(farm);assignment.setCattle(cow);assignment.setPen(pen);assignment.setFromDate(LocalDate.of(2026,9,1));assignment.setSource(AssignmentSource.HERD_ENTRY);assignment.setMovedBy(owner);assignment.setRecordedAt(clock.instant());save(assignment);}
        weight(included,LocalDate.of(2026,9,28),"300");weight(included,LocalDate.of(2026,10,28),"330");
        FeedItem hay=new FeedItem();hay.setFarm(farm);hay.setCode("TA-"+next());hay.setName("Hay");hay.setFeedGroup("DRY_ROUGHAGE");hay.setAvailable(true);save(hay);
        FeedingRecord fed=new FeedingRecord();fed.setFarm(farm);fed.setPen(pen);fed.setFeedingDate(LocalDate.of(2026,10,10));fed.setSessionNo(1);fed.setHeadCount(2);fed.setStatus("VALID");fed.setRecordedBy(owner);fed.setRecordedAt(clock.instant());save(fed);
        FeedingRecordLine line=new FeedingRecordLine();line.setFeedingRecord(fed);line.setFeedItem(hay);line.setFeedCodeSnapshot(hay.getCode());line.setFeedNameSnapshot("Hay");line.setPlannedKg(new BigDecimal("40"));line.setActualKg(new BigDecimal("40"));line.setCostPerKg(new BigDecimal("5000"));line.setTotalCost(200_000L);save(line);em.flush();

        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-07",LocalDate.of(2026,9,28),LocalDate.of(2026,10,28),
            java.util.List.of(pen.getId()),java.util.List.of(-1L),java.util.List.of("OTHER"),java.util.List.of("YOUNG_STOCK")));

        // The two FATTENING cattle split the 40 kg pen ration evenly, including the animal with no usable weights.
        assertThat(view.summary()).containsEntry("cattleIncluded",1).containsEntry("insufficientWeights",1);
        assertThat((BigDecimal)view.summary().get("feedUsedKg")).isEqualByComparingTo("40");
        Map<String,Object> total=view.totalRow().cells();
        assertThat(total).containsEntry("feedCost",200_000L).containsEntry("feedCostForIncluded",100_000L);
        // Ratios use only the eligible animal's 20 kg / 100,000 đ and its 30 kg gain.
        assertThat((BigDecimal)total.get("feedKgForIncluded")).isEqualByComparingTo("20");
        assertThat((BigDecimal)m(view.summary().get("feedPerKgGain")).get("value")).isEqualByComparingTo("0.667");
        assertThat((BigDecimal)m(view.summary().get("feedCostPerKgGain")).get("value")).isEqualByComparingTo("3333.33");
        Map<String,Object> feedPerGain=m(view.summary().get("feedPerKgGain"));assertDecimal(feedPerGain,"numerator","20");assertDecimal(feedPerGain,"denominator","30");assertThat(feedPerGain).containsEntry("n",1L);
        Map<String,Object> feedCostPerGain=m(view.summary().get("feedCostPerKgGain"));assertDecimal(feedCostPerGain,"numerator","100000");assertDecimal(feedCostPerGain,"denominator","30");assertThat(feedCostPerGain).containsEntry("n",1L);
        assertThat(view.rows()).singleElement().satisfies(row->{
            assertThat(row).containsEntry("cattleCount",1).containsEntry("insufficientWeights",1).containsEntry("feedCost",200_000L);
            assertThat((BigDecimal)row.get("feedKg")).isEqualByComparingTo("40");
            assertThat((BigDecimal)row.get("feedKgForIncluded")).isEqualByComparingTo("20");
        });
        assertDecimal(total,"feedKg","40");assertDecimal(total,"feedKgForIncluded","20");
        assertThat(total).containsEntry("feedCost",200_000L).containsEntry("feedCostForIncluded",100_000L).containsEntry("insufficientWeights",1);
        assertThat(view.charts().get(0).bars()).singleElement().satisfies(bar->assertThat(bar.value()).isEqualByComparingTo("1"));
    }

    @Test void fatteningMetricsStartOnTheEffectiveDateWhenPurposeChangesIntoFattening() {
        farmWithParameters();Pen pen=pen(farm,"P1",10);ProductionPurpose fattening=purpose(farm,PurposeType.FATTENING);
        Cattle cow=cattle(farm,breed,breeding,Sex.FEMALE,LifeStage.ADULT);changePurpose(cow,breeding,fattening,LocalDate.of(2026,10,15));assignToPen(cow,pen);
        weight(cow,LocalDate.of(2026,10,1),"300");weight(cow,LocalDate.of(2026,10,15),"314");weight(cow,LocalDate.of(2026,10,31),"330");
        FeedItem hay=feedItem();feeding(pen,hay,LocalDate.of(2026,10,10),20);feeding(pen,hay,LocalDate.of(2026,10,20),20);em.flush();

        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-07",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),null,null,null,null));

        assertThat(view.summary()).containsEntry("cattleIncluded",1).containsEntry("insufficientWeights",0);
        assertThat((BigDecimal)view.summary().get("feedUsedKg")).isEqualByComparingTo("20");
        assertThat((BigDecimal)view.summary().get("averageHead")).isEqualByComparingTo("0.55");
        assertThat((BigDecimal)view.summary().get("totalGainKg")).isEqualByComparingTo("16");
        assertThat((BigDecimal)m(view.summary().get("averageAdgKgPerDay")).get("value")).isEqualByComparingTo("1.000");
        assertThat((BigDecimal)m(view.summary().get("projectedDaysToTarget")).get("value")).isEqualByComparingTo("120");
        assertThat((BigDecimal)m(view.summary().get("feedPerKgGain")).get("numerator")).isEqualByComparingTo("20");
        assertThat(view.totalRow().cells()).containsEntry("cattleCount",1).containsEntry("insufficientWeights",0);
    }

    @Test void fatteningMetricsStopOnTheDayBeforePurposeChangesOutOfFattening() {
        farmWithParameters();Pen pen=pen(farm,"P1",10);ProductionPurpose fattening=purpose(farm,PurposeType.FATTENING);
        Cattle cow=cattle(farm,breed,fattening,Sex.FEMALE,LifeStage.ADULT);changePurpose(cow,fattening,breeding,LocalDate.of(2026,10,15));assignToPen(cow,pen);
        weight(cow,LocalDate.of(2026,10,1),"300");weight(cow,LocalDate.of(2026,10,14),"313");weight(cow,LocalDate.of(2026,10,31),"330");
        FeedItem hay=feedItem();feeding(pen,hay,LocalDate.of(2026,10,10),20);feeding(pen,hay,LocalDate.of(2026,10,20),20);em.flush();

        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-07",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),null,null,null,null));

        assertThat(view.summary()).containsEntry("cattleIncluded",1).containsEntry("insufficientWeights",0);
        assertThat((BigDecimal)view.summary().get("feedUsedKg")).isEqualByComparingTo("20");
        assertThat((BigDecimal)view.summary().get("averageHead")).isEqualByComparingTo("0.45");
        assertThat((BigDecimal)view.summary().get("totalGainKg")).isEqualByComparingTo("13");
        assertThat((BigDecimal)m(view.summary().get("averageAdgKgPerDay")).get("value")).isEqualByComparingTo("1.000");
        assertThat(m(view.summary().get("projectedDaysToTarget"))).containsEntry("n",0L).containsEntry("status","INSUFFICIENT_DATA");
    }

    private void changePurpose(Cattle cattle,ProductionPurpose previous,ProductionPurpose next,LocalDate effectiveDate){
        CattleProfileChange change=new CattleProfileChange();change.setFarm(farm);change.setCattle(cattle);change.setFieldGroup(ProfileFieldGroup.PURPOSE);
        change.setOldValue(previous.getId().toString());change.setNewValue(next.getId().toString());change.setEffectiveDate(effectiveDate);change.setReason("RPT-07 effective-purpose fixture");change.setChangedBy(owner);change.setChangedAt(clock.instant());save(change);cattle.setPurpose(next);
    }

    private void changeLifeStage(Cattle cattle,LifeStage previous,LifeStage next,LocalDate effectiveDate){
        CattleProfileChange change=new CattleProfileChange();change.setFarm(farm);change.setCattle(cattle);change.setFieldGroup(ProfileFieldGroup.LIFE_STAGE);
        change.setOldValue(previous.name());change.setNewValue(next.name());change.setEffectiveDate(effectiveDate);change.setReason("RPT-05 effective-life-stage fixture");change.setChangedBy(owner);change.setChangedAt(clock.instant());save(change);cattle.setLifeStage(next);
    }

    private FeedItem feedItem(){FeedItem item=new FeedItem();item.setFarm(farm);item.setCode("TA-"+next());item.setName("Hay");item.setFeedGroup("DRY_ROUGHAGE");item.setAvailable(true);return save(item);}

    private void feeding(Pen pen,FeedItem item,LocalDate date,long kilograms){
        FeedingRecord record=new FeedingRecord();record.setFarm(farm);record.setPen(pen);record.setFeedingDate(date);record.setSessionNo(1);record.setHeadCount(1);record.setStatus("VALID");record.setRecordedBy(owner);record.setRecordedAt(clock.instant());save(record);
        FeedingRecordLine line=new FeedingRecordLine();line.setFeedingRecord(record);line.setFeedItem(item);line.setFeedCodeSnapshot(item.getCode());line.setFeedNameSnapshot(item.getName());line.setPlannedKg(BigDecimal.valueOf(kilograms));line.setActualKg(BigDecimal.valueOf(kilograms));line.setCostPerKg(new BigDecimal("5000"));line.setTotalCost(kilograms*5_000L);save(line);
    }

    @Test void growthFiltersUseTheHistoricalPenAndLifeStageAtEachWeighingAndStayFarmScoped() {
        farmWithParameters();Pen oldPen=pen(farm,"OLD",10),newPen=pen(farm,"NEW",10);Farm foreignFarm=farm();Pen foreignPen=pen(foreignFarm,"OTHER",10);
        ProductionPurpose fattening=purpose(farm,PurposeType.FATTENING);Cattle steer=cattle(farm,breed,fattening,Sex.MALE,LifeStage.ADULT);
        PenAssignment oldAssignment=new PenAssignment();oldAssignment.setFarm(farm);oldAssignment.setCattle(steer);oldAssignment.setPen(oldPen);oldAssignment.setFromDate(LocalDate.of(2026,10,1));oldAssignment.setToDate(LocalDate.of(2026,10,14));oldAssignment.setSource(AssignmentSource.HERD_ENTRY);oldAssignment.setMovedBy(owner);oldAssignment.setRecordedAt(clock.instant());save(oldAssignment);
        PenAssignment newAssignment=new PenAssignment();newAssignment.setFarm(farm);newAssignment.setCattle(steer);newAssignment.setPen(newPen);newAssignment.setFromDate(LocalDate.of(2026,10,15));newAssignment.setSource(AssignmentSource.MOVE);newAssignment.setMovedBy(owner);newAssignment.setRecordedAt(clock.instant());save(newAssignment);
        CattleProfileChange stageChange=new CattleProfileChange();stageChange.setFarm(farm);stageChange.setCattle(steer);stageChange.setFieldGroup(ProfileFieldGroup.LIFE_STAGE);stageChange.setOldValue(LifeStage.YOUNG_STOCK.name());stageChange.setNewValue(LifeStage.ADULT.name());stageChange.setEffectiveDate(LocalDate.of(2026,10,15));stageChange.setReason("report filter fixture");stageChange.setChangedBy(owner);stageChange.setChangedAt(clock.instant());save(stageChange);
        weight(steer,LocalDate.of(2026,10,10),"300");weight(steer,LocalDate.of(2026,10,15),"305");weight(steer,LocalDate.of(2026,10,20),"310");em.flush();

        ReportView oldScope=reports.report(farm.getId(),new ReportRequest("RPT-02",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),java.util.List.of(oldPen.getId()),null,null,java.util.List.of("YOUNG_STOCK")));
        ReportView newScope=reports.report(farm.getId(),new ReportRequest("RPT-02",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),java.util.List.of(newPen.getId()),null,null,java.util.List.of("ADULT")));
        ReportView foreignPenScope=reports.report(farm.getId(),new ReportRequest("RPT-02",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),java.util.List.of(foreignPen.getId()),null,null,null));

        assertThat(oldScope.summary()).containsEntry("validWeighings",1).containsEntry("recordsWithoutWeight",0L);
        assertThat(oldScope.sections().get(0).rows()).extracting(row->row.get("label")).containsExactly("OLD");
        assertThat(newScope.summary()).containsEntry("validWeighings",2).containsEntry("recordsWithoutWeight",0L);
        assertThat(newScope.sections().get(0).rows()).extracting(row->row.get("label")).containsExactly("NEW");
        assertThat(foreignPenScope.summary()).containsEntry("validWeighings",0).containsEntry("recordsWithoutWeight",0L);
    }

    @Test void growthReportAppliesPenBreedHerdGroupAndLifeStageFiltersToEachWeighing() {
        farmWithParameters();Pen selectedPen=pen(farm,"P1",10),otherPen=pen(farm,"P2",10);Breed otherBreed=breed(farm);
        ProductionPurpose breedingPurpose=purpose(farm,PurposeType.BREEDING),fatteningPurpose=purpose(farm,PurposeType.FATTENING);
        Cattle selected=cattle(farm,breed,breedingPurpose,Sex.FEMALE,LifeStage.ADULT);
        Cattle wrongPen=cattle(farm,breed,breedingPurpose,Sex.FEMALE,LifeStage.ADULT);
        Cattle wrongBreed=cattle(farm,otherBreed,breedingPurpose,Sex.FEMALE,LifeStage.ADULT);
        Cattle wrongGroup=cattle(farm,breed,fatteningPurpose,Sex.MALE,LifeStage.ADULT);
        Cattle wrongStage=cattle(farm,breed,breedingPurpose,Sex.FEMALE,LifeStage.YOUNG_STOCK);
        for(Cattle cow:new Cattle[]{selected,wrongBreed,wrongGroup,wrongStage})assignToPen(cow,selectedPen);
        assignToPen(wrongPen,otherPen);
        for(Cattle cow:new Cattle[]{selected,wrongPen,wrongBreed,wrongGroup,wrongStage})weight(cow,LocalDate.of(2026,10,20),"300");em.flush();

        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-02",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),
            java.util.List.of(selectedPen.getId()),java.util.List.of(breed.getId()),java.util.List.of("BREEDING_FEMALES"),java.util.List.of("ADULT")));

        assertThat(view.summary()).containsEntry("validWeighings",1).containsEntry("recordsWithoutWeight",0L);
        assertThat(view.rows()).singleElement().satisfies(row->assertThat(row).containsEntry("validWeighings",1));
        assertThat(view.sections().get(0).rows()).singleElement().satisfies(row->assertThat(row.get("label")).isEqualTo("P1"));
    }

    @Test void growthReportFilterQueriesStayBoundedAsMeasurementsGrow(){
        farmWithParameters();Pen selectedPen=pen(farm,"QUERY-COUNT",10);Cattle cow=cattle(farm,breed,breeding,Sex.FEMALE,LifeStage.ADULT);assignToPen(cow,selectedPen);
        for(int i=0;i<120;i++)weight(cow,LocalDate.of(2026,10,1).plusDays(i%28),Integer.toString(300+i));em.flush();
        ReportRequest request=new ReportRequest("RPT-02",LocalDate.of(2026,10,1),LocalDate.of(2026,10,28),java.util.List.of(selectedPen.getId()),java.util.List.of(breed.getId()),java.util.List.of("BREEDING_FEMALES"),java.util.List.of("ADULT"));
        ReportView[] result=new ReportView[1];long statements=statementCount(()->result[0]=reports.report(farm.getId(),request));

        assertThat(result[0].summary()).containsEntry("validWeighings",120).containsEntry("recordsWithoutWeight",0L);
        assertThat(statements).as("RPT-02 SQL statements should remain bounded for 120 filtered weighings").isLessThan(60);
    }

    private long statementCount(Runnable action){
        org.hibernate.stat.Statistics statistics=entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();boolean enabled=statistics.isStatisticsEnabled();statistics.setStatisticsEnabled(true);statistics.clear();
        try{action.run();return statistics.getPrepareStatementCount();}finally{statistics.setStatisticsEnabled(enabled);}
    }

    private void assignToPen(Cattle cattle,Pen pen){
        PenAssignment assignment=new PenAssignment();assignment.setFarm(farm);assignment.setCattle(cattle);assignment.setPen(pen);assignment.setFromDate(LocalDate.of(2026,9,1));assignment.setSource(AssignmentSource.HERD_ENTRY);assignment.setMovedBy(owner);assignment.setRecordedAt(clock.instant());save(assignment);
    }

    @Test void growthReportCountsOnlyValidNonNullWeightsAndComputesAdgAtFourteenDays() {
        farmWithParameters();Cattle steer=cattle(farm,breed,breeding,Sex.FEMALE,LifeStage.ADULT);
        weight(steer,LocalDate.of(2026,10,1),"300");weight(steer,LocalDate.of(2026,10,15),"314");
        Growth withoutWeight=new Growth();withoutWeight.setCattle(steer);withoutWeight.setCheckDate(LocalDate.of(2026,10,20));withoutWeight.setEntryTime(clock.instant());withoutWeight.setBcsScore(new BigDecimal("3.0"));withoutWeight.setStatus("VALID");save(withoutWeight);em.flush();

        ReportView view=reports.report(farm.getId(),new ReportRequest("RPT-02",LocalDate.of(2026,10,1),LocalDate.of(2026,10,31),null,null,null,null));

        assertThat(view.summary()).containsEntry("validWeighings",2).containsEntry("recordsWithoutWeight",1L);
        assertThat((BigDecimal)view.summary().get("averageADGKgPerDay")).isEqualByComparingTo("1.000");
        assertThat(view.sections().get(0).rows()).singleElement().satisfies(row->{
            assertThat(row).containsEntry("validWeighings",2).containsEntry("adgSampleSize",1);
            assertThat((BigDecimal)row.get("adgKgPerDay")).isEqualByComparingTo("1.000");
        });
        assertThat(view.unavailableData()).anyMatch(message->message.contains("1 VALID growth records"));
    }
}
