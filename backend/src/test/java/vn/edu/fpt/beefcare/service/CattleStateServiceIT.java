package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class CattleStateServiceIT extends DomainTestSupport {
    @Autowired CattleStateService stateService;
    @Autowired VaccinationCommandService vaccinationCommands;
    @Autowired ReproductionCommandService reproductionCommands;
    @Autowired FarmParameterCommandService parameterCommands;
    @Autowired HealthCareCommandService healthCommands;

    @Test
    void latestVoidedWeightCannotMakeBreedingEligibleAndNewerCalvingWinsOverOldBreeding() {
        var farm = farm();
        var owner = memberWithRole(farm, FarmRole.OWNER);
        var cow = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        FarmParameterVersion params = new FarmParameterVersion();
        params.setFarm(farm); params.setVersionNo(1); params.setGestationLengthDays(283);
        params.setParameterValues("{\"MIN_BREEDING_WEIGHT_KG\":500,\"POST_CALVING_DAYS\":45}");
        params.setEffectiveFrom(TODAY.minusDays(2)); params.setChangedBy(owner); save(params);

        weight(cow, TODAY.minusDays(4), "300");
        var excluded = weight(cow, TODAY.minusDays(1), "900");
        excluded.setStatus("VOIDED");

        ReproductionEvent breeding = new ReproductionEvent();
        breeding.setCattle(cow); breeding.setType("BREEDING"); breeding.setEventTime(Instant.parse("2026-10-20T04:00:00Z"));
        breeding.setResult("BRED"); breeding.setStatus("VALID"); breeding.setTentativeExpectedCalvingDate(TODAY.plusDays(260));
        breeding.setUpdatedAt(Instant.parse("2026-10-20T04:01:00Z")); save(breeding);
        CalvingEvent calving = new CalvingEvent();
        calving.setDam(cow); calving.setBirthTime(Instant.parse("2026-10-25T04:00:00Z")); calving.setCourse("NORMAL");
        calving.setDamCondition("GOOD"); calving.setRetainedPlacenta(false); calving.setStatus("VALID"); calving.setRecordedAt(Instant.parse("2026-10-25T04:01:00Z")); save(calving);
        em.flush(); em.clear();

        var derived = stateService.state(em.find(vn.edu.fpt.beefcare.domain.Cattle.class, cow.getId()));

        assertThat(derived).containsEntry("reproductiveStatus", "POST_CALVING")
            .containsEntry("expectedCalvingDate", null)
            .containsEntry("breedingEligible", false)
            .containsEntry("failedBreedingConditions", java.util.List.of("MINIMUM_WEIGHT"));
    }

    @Test
    void stoppingScheduleCancelsEveryUncompletedDose() {
        var farm=farm();
        var manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);
        var cow=cattle(farm,breed(farm),purpose(farm,PurposeType.BREEDING),Sex.FEMALE,LifeStage.ADULT);
        Vaccine vaccine=new Vaccine();vaccine.setFarm(farm);vaccine.setCode("V"+next());vaccine.setName("Test vaccine");
        vaccine.setDiseasePrevented("Test disease");vaccine.setWithdrawalInfo("0");vaccine.setAvailable(true);save(vaccine);
        VaccinationSchedule schedule=new VaccinationSchedule();schedule.setFarm(farm);schedule.setVaccine(vaccine);schedule.setScheduleName("Test schedule");
        schedule.setTargetGroup("EXPLICIT");schedule.setFirstDueDate(TODAY);schedule.setDoseCount(2);schedule.setIntervalDays(21);schedule.setStatus("ACTIVE");save(schedule);
        for(int i=1;i<=2;i++){ScheduledDose dose=new ScheduledDose();dose.setSchedule(schedule);dose.setCattle(cow);dose.setDoseNo(i);dose.setDueDate(TODAY.plusDays((i-1)*21L));dose.setStatus("PLANNED");save(dose);}

        vaccinationCommands.stopScheduleInCommand(farm.getId(),schedule.getId(),schedule.getVersion());

        assertThat(em.createQuery("select count(d) from ScheduledDose d where d.schedule.id=:id and d.status='CANCELLED'",Long.class)
            .setParameter("id",schedule.getId()).getSingleResult()).isEqualTo(2);
        assertThat(em.find(VaccinationSchedule.class,schedule.getId()).getStatus()).isEqualTo("STOPPED");
    }

    @Test
    void notPregnantCheckDoesNotCreateEpisodeAndReturnsToAwaitingBreeding() {
        var farm=farm();
        var manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);
        var cow=cattle(farm,breed(farm),purpose(farm,PurposeType.BREEDING),Sex.FEMALE,LifeStage.ADULT);
        cow.setCreatedAt(Instant.parse("2026-10-01T04:00:00Z"));em.flush();
        var request=new vn.edu.fpt.beefcare.service.dto.ReproductionDtos.EventCommand(cow.getId(),cow.getVersion(),
            Instant.parse("2026-10-27T04:00:00Z"),null,"ULTRASOUND","NOT_PREGNANT",null,"check note",null,"External veterinarian",
            null,null,null,null,null,null,null,null,null);

        reproductionCommands.recordPregnancyCheck(farm.getId(),"not-pregnant-"+cow.getId(),request);
        em.flush();em.clear();
        var refreshed=em.find(vn.edu.fpt.beefcare.domain.Cattle.class,cow.getId());

        assertThat(em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id=:id",Long.class).setParameter("id",cow.getId()).getSingleResult()).isZero();
        assertThat(stateService.state(refreshed)).containsEntry("reproductiveStatus","AWAITING_BREEDING");
    }

    @Test
    void parameterSnapshotAcceptsDecimalWeightAndRejectsOutsideSrsRange() {
        var farm=farm();
        var manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);
        var valid=new CareDtos.ParameterVersionCommand(
            Map.of("WEANING_AGE_MONTHS",3,"YOUNG_STOCK_AGE_MONTHS",6,"ADULT_AGE_MONTHS",15,
                "MIN_BREEDING_WEIGHT_KG",new java.math.BigDecimal("247.5")),
            283,TODAY,"SRS SCR-56");

        var saved=parameterCommands.create(farm.getId(),"parameter-valid-"+farm.getId(),valid);

        assertThat(saved.parameters().get("MIN_BREEDING_WEIGHT_KG")).isEqualTo(new java.math.BigDecimal("247.5"));
        var invalid=new CareDtos.ParameterVersionCommand(Map.of("PREGNANCY_RECHECK_DAYS",6),null,TODAY,"SRS SCR-56");
        assertThatThrownBy(()->parameterCommands.create(farm.getId(),"parameter-invalid-"+farm.getId(),invalid))
            .isInstanceOf(DomainException.class);
    }

    @Test
    void parameterSnapshotEnforcesScr56BoundaryAndCrossFieldRules() {
        var farm=farm();var manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);
        var minimums = Map.<String,Object>ofEntries(
            Map.entry("WEANING_AGE_MONTHS",3), Map.entry("YOUNG_STOCK_AGE_MONTHS",6), Map.entry("ADULT_AGE_MONTHS",15),
            Map.entry("MIN_BREEDING_AGE_MONTHS",6), Map.entry("MIN_BREEDING_WEIGHT_KG",100), Map.entry("GESTATION_LENGTH_DAYS",270),
            Map.entry("PREGNANCY_CHECK_DAYS",25), Map.entry("PREGNANCY_RECHECK_DAYS",7), Map.entry("CALVING_LEAD_DAYS",1),
            Map.entry("POST_CALVING_DAYS",20), Map.entry("BREEDING_WINDOW_START_HOURS",0), Map.entry("BREEDING_WINDOW_END_HOURS",1),
            Map.entry("ESTRUS_CYCLE_DAYS",17), Map.entry("WEIGHING_INTERVAL_DAYS",7), Map.entry("VACCINATION_LEAD_DAYS",1),
            Map.entry("TARGET_FINISHING_WEIGHT_KG",150), Map.entry("BCS_SCALE","1-5:0.5"));
        var accepted = new CareDtos.ParameterVersionCommand(minimums,270,TODAY,"SCR-56 minimum boundaries");
        parameterCommands.create(farm.getId(),"scr56-min-"+farm.getId(),accepted);

        var maximums = new java.util.HashMap<String,Object>();
        maximums.put("WEANING_AGE_MONTHS",12);maximums.put("YOUNG_STOCK_AGE_MONTHS",24);maximums.put("ADULT_AGE_MONTHS",48);
        maximums.put("MIN_BREEDING_AGE_MONTHS",36);maximums.put("MIN_BREEDING_WEIGHT_KG",600);maximums.put("GESTATION_LENGTH_DAYS",300);
        maximums.put("PREGNANCY_CHECK_DAYS",90);maximums.put("PREGNANCY_RECHECK_DAYS",60);maximums.put("CALVING_LEAD_DAYS",60);
        maximums.put("POST_CALVING_DAYS",120);maximums.put("BREEDING_WINDOW_START_HOURS",24);maximums.put("BREEDING_WINDOW_END_HOURS",36);
        maximums.put("ESTRUS_CYCLE_DAYS",25);maximums.put("WEIGHING_INTERVAL_DAYS",180);maximums.put("VACCINATION_LEAD_DAYS",30);
        maximums.put("TARGET_FINISHING_WEIGHT_KG",900);maximums.put("BCS_SCALE","1-9:1");
        parameterCommands.create(farm.getId(),"scr56-max-"+farm.getId(),new CareDtos.ParameterVersionCommand(maximums,300,TODAY,"SCR-56 maximum boundaries"));

        var disableTarget = new java.util.HashMap<String,Object>();disableTarget.put("TARGET_FINISHING_WEIGHT_KG",null);
        var disabled=parameterCommands.create(farm.getId(),"scr56-target-off-"+farm.getId(),
            new CareDtos.ParameterVersionCommand(disableTarget,null,TODAY,"Disable target"));
        assertThat(disabled.parameters()).doesNotContainKey("TARGET_FINISHING_WEIGHT_KG");

        var invalids = java.util.List.of(
            Map.<String,Object>of("WEANING_AGE_MONTHS",2), Map.<String,Object>of("YOUNG_STOCK_AGE_MONTHS",25),
            Map.<String,Object>of("ADULT_AGE_MONTHS",49), Map.<String,Object>of("MIN_BREEDING_AGE_MONTHS",37),
            Map.<String,Object>of("MIN_BREEDING_WEIGHT_KG",99.99), Map.<String,Object>of("GESTATION_LENGTH_DAYS",301),
            Map.<String,Object>of("PREGNANCY_CHECK_DAYS",24), Map.<String,Object>of("PREGNANCY_RECHECK_DAYS",61),
            Map.<String,Object>of("CALVING_LEAD_DAYS",0), Map.<String,Object>of("POST_CALVING_DAYS",121),
            Map.<String,Object>of("BREEDING_WINDOW_START_HOURS",25), Map.<String,Object>of("BREEDING_WINDOW_END_HOURS",37),
            Map.<String,Object>of("ESTRUS_CYCLE_DAYS",26), Map.<String,Object>of("WEIGHING_INTERVAL_DAYS",181),
            Map.<String,Object>of("VACCINATION_LEAD_DAYS",31), Map.<String,Object>of("TARGET_FINISHING_WEIGHT_KG",901),
            Map.<String,Object>of("BCS_SCALE","1-5:1"), Map.<String,Object>of("WEANING_AGE_MONTHS",6,"YOUNG_STOCK_AGE_MONTHS",6),
            Map.<String,Object>of("BREEDING_WINDOW_START_HOURS",12,"BREEDING_WINDOW_END_HOURS",12));
        int index=0;
        for (var invalid : invalids) {
            var command=new CareDtos.ParameterVersionCommand(invalid,null,TODAY,"SCR-56 invalid boundary");
            assertThatThrownBy(()->parameterCommands.create(farm.getId(),"scr56-invalid-"+farm.getId()+"-"+invalid.hashCode(),command))
                .as("invalid parameters %s",invalid).isInstanceOf(DomainException.class);
            index++;
        }
        assertThat(index).isEqualTo(invalids.size());
        var tooLongNote=new CareDtos.ParameterVersionCommand(Map.of(),null,TODAY,"x".repeat(256));
        assertThatThrownBy(()->parameterCommands.create(farm.getId(),"scr56-long-note-"+farm.getId(),tooLongNote))
            .isInstanceOf(DomainException.class);
    }

    @Test
    void treatmentCorrectionRecomputesWithdrawalAndCannotMoveBeforeLaterObservation() {
        var farm=farm();var manager=memberWithRole(farm,FarmRole.MANAGER);actAs(manager);
        var cow=cattle(farm,breed(farm),purpose(farm,PurposeType.BREEDING),Sex.FEMALE,LifeStage.ADULT);
        HealthCase hc=new HealthCase();hc.setCattle(cow);hc.setOpenedDate(TODAY.minusDays(5));hc.setStatus("OPEN");hc.setIsSuspectedContagious(false);hc.setCaseCode("HC-IT");hc.setSeverity("MILD");save(hc);
        Treatment treatment=new Treatment();treatment.setHealthCase(hc);treatment.setTreatmentTime(Instant.parse("2026-10-25T04:00:00Z"));
        treatment.setEntryTime(clock.instant());treatment.setTreatmentDetail("Medicine");treatment.setDose("10 ml");treatment.setRoute("IM");
        treatment.setCourseDays(1);treatment.setWithdrawalDays(1);treatment.setWithdrawalPeriod("1");treatment.setWithdrawalEndDate(TODAY.minusDays(2));
        treatment.setResult("GIVEN");treatment.setStatus("VALID");save(treatment);
        HealthObservation later=new HealthObservation();later.setHealthCase(hc);later.setObservedTime(Instant.parse("2026-10-27T04:00:00Z"));
        later.setEntryTime(clock.instant());later.setSignsProgress("Later observation");later.setSource("ON_FARM");later.setStatus("VALID");later.setOpening(false);save(later);
        var invalid=new CareDtos.CorrectTreatment(treatment.getVersion(),"chronology correction",null,Instant.parse("2026-10-26T04:00:00Z"),
            null,null,null,null,null,null,null);

        assertThatThrownBy(()->healthCommands.correctTreatmentInCommand(farm.getId(),treatment.getId(),invalid)).isInstanceOf(DomainException.class);
        var valid=new CareDtos.CorrectTreatment(treatment.getVersion(),"withdrawal correction",null,null,null,null,null,2,3,null,null);
        healthCommands.correctTreatmentInCommand(farm.getId(),treatment.getId(),valid);

        assertThat(em.find(Treatment.class,treatment.getId()).getWithdrawalEndDate()).isEqualTo(TODAY.plusDays(1));
    }
}
