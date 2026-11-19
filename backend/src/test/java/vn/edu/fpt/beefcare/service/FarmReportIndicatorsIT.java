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
        ReproductionEvent service=event(cow,"BREEDING",breedingDate,"BRED",null);event(cow,"PREGNANCY_CHECK",checkDate,"PREGNANT",service);
        PregnancyEpisode p=new PregnancyEpisode();p.setCattle(cow);p.setParity(1);p.setStatus("OPEN");p.setExpectedCalvingDate(LocalDate.parse(breedingDate).plusDays(283));save(p);
    }
    private static Map<String,Object> m(Object value){return (Map<String,Object>)value;}

    private void reproductionHerd(){
        // Cow A: calvings 2025-03-01 and 2026-02-01 -> interval 337 d. B1 2026-03-20 NOT_PREGNANT, B2 2026-04-10 PREGNANT:
        // days open 2026-02-01..2026-04-10 = 68 d, services per conception 2; B1 is the cycle's first service (not conceived).
        Cattle a=female("2021-05-01");calving(a,"2025-03-01","LIVE");calving(a,"2026-02-01","LIVE");
        ReproductionEvent b1=event(a,"BREEDING","2026-03-20","BRED",null);event(a,"PREGNANCY_CHECK","2026-04-20","NOT_PREGNANT",b1);pregnant(a,"2026-04-10","2026-05-10");
        // Cow B: 2025-06-01, 2026-04-01 -> 304 d; first service 2026-05-21 conceived -> days open 50, services 1.
        Cattle b=female("2021-05-01");calving(b,"2025-06-01","LIVE");calving(b,"2026-04-01","LIVE");pregnant(b,"2026-05-21","2026-06-21");
        // Cow C: 2025-01-10, 2026-01-10 -> 365 d; D1 2026-03-01 INCONCLUSIVE then PREGNANT -> days open 50, services 1 (INCONCLUSIVE excluded).
        Cattle c=female("2021-05-01");calving(c,"2025-01-10","LIVE");calving(c,"2026-01-10","STILLBORN");
        ReproductionEvent d1=event(c,"BREEDING","2026-03-01","BRED",null);event(c,"PREGNANCY_CHECK","2026-04-01","INCONCLUSIVE",d1);event(c,"PREGNANCY_CHECK","2026-04-15","PREGNANT",d1);
        PregnancyEpisode pc=new PregnancyEpisode();pc.setCattle(c);pc.setParity(2);pc.setStatus("OPEN");pc.setExpectedCalvingDate(LocalDate.of(2026,12,9));save(pc);
        // Heifer D born 2024-01-15 calves first on 2026-03-15: 790 d / 30.4375 = 25.95 months (n=1). Not pregnant 227 d after calving -> overdue.
        Cattle d=female("2024-01-15");calving(d,"2026-03-15",null);
        // Cow F: last calving 2026-07-05 = 115 d ago, not pregnant -> overdue at 108 d (not at the old 126-d fallback).
        Cattle f=female("2021-05-01");calving(f,"2026-07-05",null);
        // Cow E: valid calving 2026-08-01 (88 d, not overdue); a voided calving with a live calf must not be counted.
        Cattle e=female("2021-05-01");calving(e,"2026-08-01","LIVE");calving(e,"2026-09-01","LIVE").setStatus("VOIDED");
    }

    @Test void reproductionPerformanceMatchesGbr106ByHand() {
        farmWithParameters();reproductionHerd();em.flush();
        Map<String,Object> s=reports.report(farm.getId(),new ReportRequest("RPT-05",LocalDate.of(2026,1,1),LocalDate.of(2026,10,28),null,null,null,null)).summary();
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

        Map<String,Object> s=reports.report(farm.getId(),new ReportRequest("RPT-07",LocalDate.of(2026,9,28),LocalDate.of(2026,10,28),null,null,null,null)).summary();
        // start 2026-09-28 between 09-18 (300) and 09-08's successor 10-08 (330): 300 + 30 x 10/20 = 315; end 10-28: nearest 10-27 = 360
        assertThat((BigDecimal)s.get("averageStartWeightKg")).isEqualByComparingTo("315");
        assertThat((BigDecimal)s.get("averageEndWeightKg")).isEqualByComparingTo("360");
        assertThat((BigDecimal)s.get("totalGainKg")).isEqualByComparingTo("45");
        assertThat((BigDecimal)s.get("averageAdgKgPerDay")).isEqualByComparingTo("1.5"); // 45 kg / 30 days
        // 20 kg (100,000 d) fed to a pen of 2 on 10-10 -> 10 kg and 50,000 d attributed to the steer
        assertThat((BigDecimal)s.get("feedUsedKg")).isEqualByComparingTo("10");
        assertThat((BigDecimal)s.get("feedPerKgGain")).isEqualByComparingTo("0.222");
        assertThat((BigDecimal)s.get("feedCostPerKgGain")).isEqualByComparingTo("1111.11");
        // 60-day ADG 60 kg / 39 d; (450 - 360) / 1.538462 = 58.5 -> 59 days; target not reached
        assertThat(s).containsEntry("cattleIncluded",1).containsEntry("insufficientWeights",0).containsEntry("targetReached",0);
        assertThat((BigDecimal)s.get("projectedDaysToTarget")).isEqualByComparingTo("59");
    }
}
