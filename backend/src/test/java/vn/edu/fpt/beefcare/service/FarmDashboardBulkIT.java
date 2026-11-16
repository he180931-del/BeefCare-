package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardRequest;
import vn.edu.fpt.beefcare.service.dto.FarmDashboardDtos.DashboardView;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
@SuppressWarnings("unchecked")
class FarmDashboardBulkIT extends DomainTestSupport {
    @Autowired FarmDashboardService dashboard;
    @Autowired CattleStateService cattleState;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;

    @Test void dashboardStateMatchesCattleStateServiceAndSqlCountDoesNotScalePerAnimal(){
        Farm farm=farm();var owner=memberWithRole(farm,FarmRole.OWNER);var breed=breed(farm);var breeding=purpose(farm,PurposeType.BREEDING);var fattening=purpose(farm,PurposeType.FATTENING);Pen pen=pen(farm,"DASH-BULK",100);actAs(owner);
        FarmParameterVersion parameters=new FarmParameterVersion();parameters.setFarm(farm);parameters.setVersionNo(1);parameters.setEffectiveFrom(TODAY.minusYears(1));parameters.setChangedBy(owner);parameters.setCreatedAt(clock.instant());
        parameters.setParameterValues("{\"POST_CALVING_DAYS\":45,\"ESTRUS_CYCLE_DAYS\":21,\"WEIGHING_INTERVAL_DAYS\":60,\"TARGET_FINISHING_WEIGHT_KG\":450}");save(parameters);

        List<Cattle> cattle=new ArrayList<>();
        for(int i=0;i<40;i++){
            Cattle cow=cattle(farm,breed,i==5?fattening:breeding,Sex.FEMALE,LifeStage.ADULT);cattle.add(cow);assign(cow,pen,owner);
            weight(cow,TODAY.minusDays(20),"300");weight(cow,TODAY.minusDays(2),i==5?"400":"320");
        }
        ReproductionEvent estrus=event(cattle.get(1),"ESTRUS",clock.instant().minusSeconds(7_200),"OBSERVED",null);
        ReproductionEvent breedingEvent=event(cattle.get(2),"BREEDING",at(TODAY.minusDays(20)),"BRED",null);breedingEvent.setTentativeExpectedCalvingDate(TODAY.plusDays(5));
        ReproductionEvent pregnantBreeding=event(cattle.get(3),"BREEDING",at(TODAY.minusDays(25)),"BRED",null);ReproductionEvent check=event(cattle.get(3),"PREGNANCY_CHECK",at(TODAY.minusDays(10)),"PREGNANT",pregnantBreeding);
        PregnancyEpisode episode=new PregnancyEpisode();episode.setCattle(cattle.get(3));episode.setConfirmingCheck(check);episode.setParity(1);episode.setExpectedCalvingDate(TODAY.plusDays(5));episode.setStatus("OPEN");save(episode);
        CalvingEvent calving=new CalvingEvent();calving.setDam(cattle.get(4));calving.setBirthTime(at(TODAY.minusDays(10)));calving.setCourse("NORMAL");calving.setDamCondition("GOOD");calving.setRetainedPlacenta(false);calving.setStatus("VALID");calving.setRecordedAt(clock.instant());save(calving);
        HealthCase healthCase=new HealthCase();healthCase.setCattle(cattle.get(0));healthCase.setOpenedDate(TODAY.minusDays(1));healthCase.setStatus("OPEN");healthCase.setIsSuspectedContagious(false);save(healthCase);
        Treatment treatment=new Treatment();treatment.setHealthCase(healthCase);treatment.setTreatmentTime(clock.instant());treatment.setEntryTime(clock.instant());treatment.setTreatmentDetail("Dashboard test");treatment.setDose("1 dose");treatment.setRoute("ORAL");treatment.setWithdrawalPeriod("3 days");treatment.setResult("GIVEN");treatment.setStatus("VALID");treatment.setWithdrawalEndDate(TODAY.plusDays(3));treatment.setCourseDays(1);treatment.setUpdatedAt(clock.instant());save(treatment);
        em.flush();List<Long> ids=cattle.stream().map(Cattle::getId).toList();em.clear();

        DashboardView[] result=new DashboardView[1];long statements=statementCount(()->result[0]=dashboard.dashboard(farm.getId(),new DashboardRequest(TODAY.minusDays(29),TODAY,null,null,null)));
        List<Cattle> oracleCattle=ids.stream().map(id->em.find(Cattle.class,id)).toList();Map<String,Object> indicators=result[0].indicators();Map<String,Object> expectedM02=oracleM02(oracleCattle);Map<String,Object> expectedM04=oracleM04(oracleCattle);Map<String,Object> expectedM05=oracleM05(oracleCattle);

        assertThat(indicators.get("M02")).isEqualTo(expectedM02);
        assertThat(indicators.get("M04")).isEqualTo(expectedM04);
        assertThat(indicators.get("M05")).isEqualTo(expectedM05);
        assertThat(((Map<String,Object>)indicators.get("M06"))).containsEntry("sampleCount",40);
        assertThat(((Map<String,Object>)indicators.get("M08")).get("totalHead")).isEqualTo(40L);
        assertThat(statements).as("dashboard SQL should remain bounded for 40 active cattle with two weights each").isLessThan(80);
    }

    private Map<String,Object> oracleM02(List<Cattle> cattle){long monitoring=0,underTreatment=0,withdrawal=0;for(Cattle cow:cattle){Map<String,Object> state=cattleState.state(cow);String health=(String)state.get("healthState");if("MONITORING".equals(health)||"UNDER_TREATMENT".equals(health))monitoring++;if("UNDER_TREATMENT".equals(health))underTreatment++;if(state.get("withdrawalEndDate")!=null)withdrawal++;}return Map.of("attentionCount",monitoring,"underTreatment",underTreatment,"activeWithdrawal",withdrawal);}

    private Map<String,Object> oracleM04(List<Cattle> cattle){long within30=0,within7=0;for(Cattle cow:cattle){Object raw=cattleState.state(cow).get("expectedCalvingDate");if(raw instanceof LocalDate date&&!date.isBefore(TODAY)&&!date.isAfter(TODAY.plusDays(30))){within30++;if(!date.isAfter(TODAY.plusDays(7)))within7++;}}return Map.of("within30Days",within30,"within7Days",within7);}

    private Map<String,Object> oracleM05(List<Cattle> cattle){Map<String,Long> groups=new java.util.LinkedHashMap<>();for(String group:List.of("BREEDING_FEMALES","YOUNG_STOCK","FATTENING","CALVES","BREEDING_BULLS","OTHER"))groups.put(group,0L);long pregnant=0;for(Cattle cow:cattle){String group=group(cow);groups.merge(group,1L,Long::sum);if("BREEDING_FEMALES".equals(group)&&"PREGNANT".equals(cattleState.state(cow).get("reproductiveStatus")))pregnant++;}return Map.of("byHerdGroup",groups,"pregnantBreedingFemales",pregnant);}

    private String group(Cattle cow){if(cow.getLifeStage()==LifeStage.UNWEANED_CALF||cow.getLifeStage()==LifeStage.WEANED_CALF)return "CALVES";PurposeType purpose=cow.getPurpose().getPurposeType();if(purpose==PurposeType.FATTENING)return "FATTENING";if(purpose==PurposeType.SIRE)return "BREEDING_BULLS";if(purpose==PurposeType.BREEDING&&cow.getLifeStage()==LifeStage.ADULT)return "BREEDING_FEMALES";if(cow.getLifeStage()==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";return "OTHER";}

    private void assign(Cattle cattle,Pen pen,vn.edu.fpt.beefcare.domain.AppUser owner){PenAssignment assignment=new PenAssignment();assignment.setFarm(cattle.getFarm());assignment.setCattle(cattle);assignment.setPen(pen);assignment.setFromDate(TODAY.minusDays(30));assignment.setSource(AssignmentSource.HERD_ENTRY);assignment.setMovedBy(owner);assignment.setRecordedAt(clock.instant());save(assignment);}
    private ReproductionEvent event(Cattle cow,String type,Instant time,String result,ReproductionEvent linked){ReproductionEvent event=new ReproductionEvent();event.setCattle(cow);event.setType(type);event.setEventTime(time);event.setResult(result);event.setStatus("VALID");event.setLinkedEvent(linked);event.setUpdatedAt(clock.instant());return save(event);}
    private Instant at(LocalDate date){return date.atTime(8,0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();}
    private long statementCount(Runnable action){org.hibernate.stat.Statistics statistics=entityManagerFactory.unwrap(SessionFactory.class).getStatistics();boolean enabled=statistics.isStatisticsEnabled();statistics.setStatisticsEnabled(true);statistics.clear();try{action.run();return statistics.getPrepareStatementCount();}finally{statistics.setStatisticsEnabled(enabled);}}
}
