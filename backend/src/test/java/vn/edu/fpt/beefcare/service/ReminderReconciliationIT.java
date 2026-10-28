package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.FarmReminderQueryService.ReminderView;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** JOB-01 and SCR-44 against Table III-3 (REM-01..REM-13) and GBR-63, on the real H2 schema. */
@ServiceIntegrationTest
@Transactional
class ReminderReconciliationIT extends DomainTestSupport {
    static final String ALL_PARAMETERS="{\"WEIGHING_INTERVAL_DAYS\":30,\"BREEDING_WINDOW_START_HOURS\":8,\"BREEDING_WINDOW_END_HOURS\":12,\"PREGNANCY_CHECK_DAYS\":28,"
        +"\"PREGNANCY_RECHECK_DAYS\":14,\"CALVING_LEAD_DAYS\":30,\"VACCINATION_LEAD_DAYS\":7,\"POST_CALVING_DAYS\":45,\"TARGET_FINISHING_WEIGHT_KG\":450}";
    static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
    @Autowired ReminderReconciliationService job;
    @Autowired FarmReminderQueryService screen;
    @Autowired ReproductionReminderService reproductionReminders;

    private AppUser owner;

    private Farm farmWith(String parameters) {
        Farm farm=farm();owner=memberWithRole(farm,FarmRole.OWNER);parameters(farm,1,TODAY.minusDays(60),parameters);return farm;
    }
    private void parameters(Farm farm,int version,LocalDate from,String values) {
        FarmParameterVersion p=new FarmParameterVersion();p.setFarm(farm);p.setVersionNo(version);p.setParameterValues(values);p.setEffectiveFrom(from);
        p.setChangedBy(owner);p.setCreatedAt(clock.instant());save(p);
    }
    private Cattle cow(Farm farm){return cattle(farm,breed(farm),purpose(farm,PurposeType.BREEDING),Sex.FEMALE,LifeStage.ADULT);}
    private Instant day(LocalDate date){return date.atStartOfDay(ZONE).toInstant();}
    private ReproductionEvent event(Cattle cow,String type,Instant time,String result) {
        ReproductionEvent e=new ReproductionEvent();e.setCattle(cow);e.setType(type);e.setEventTime(time);e.setResult(result);e.setStatus("VALID");e.setUpdatedAt(time);return save(e);
    }
    private CalvingEvent calving(Cattle cow,Instant time) {
        CalvingEvent c=new CalvingEvent();c.setDam(cow);c.setBirthTime(time);c.setCourse("NORMAL");c.setDamCondition("GOOD");c.setRetainedPlacenta(false);c.setStatus("VALID");c.setRecordedAt(time);return save(c);
    }
    private void reconcile(Farm farm){job.reconcileFarm(farm.getId());em.flush();}
    private List<Reminder> rows(Farm farm,String rule) {
        return em.createQuery("select r from Reminder r where r.farm.id=:f and r.ruleType=:rule order by r.id",Reminder.class).setParameter("f",farm.getId()).setParameter("rule",rule).getResultList();
    }
    private List<ReminderView> seenBy(Farm farm,AppUser user,String rule){actAs(user);return screen.mine(farm.getId()).stream().filter(v->v.ruleType().equals(rule)).toList();}

    @Test void weighingIsResolvedByANewWeightSupersededByANewParameterVersionAndCancelledAtExit() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);weight(cow,TODAY.minusDays(40),"400");
        reconcile(farm);
        assertThat(rows(farm,"REM-01")).singleElement().satisfies(r->{assertThat(r.getStatus()).isEqualTo("ACTIVE");assertThat(r.getDueTime()).isEqualTo(day(TODAY.minusDays(10)));});
        assertThat(seenBy(farm,owner,"REM-01")).singleElement().satisfies(v->{assertThat(v.id()).isNotNull();assertThat(v.urgency()).isEqualTo("OVERDUE");});

        weight(cow,TODAY,"410");reconcile(farm);
        assertThat(rows(farm,"REM-01")).extracting(Reminder::getStatus).containsExactly("RESOLVED","ACTIVE");

        parameters(farm,2,TODAY,ALL_PARAMETERS.replace("\"WEIGHING_INTERVAL_DAYS\":30","\"WEIGHING_INTERVAL_DAYS\":5"));reconcile(farm);
        assertThat(rows(farm,"REM-01")).extracting(Reminder::getStatus).containsExactly("RESOLVED","SUPERSEDED","ACTIVE");
        assertThat(seenBy(farm,owner,"REM-01")).singleElement().satisfies(v->{assertThat(v.urgency()).isEqualTo("UPCOMING");assertThat(v.parameterVersion()).isEqualTo(2);});

        cow.setHerdStatus(HerdStatus.EXITED);reconcile(farm);
        assertThat(rows(farm,"REM-01")).extracting(Reminder::getStatus).containsExactly("RESOLVED","SUPERSEDED","CANCELLED");
    }

    @Test void vaccinationDoseIsDueOnItsPlannedDateResolvedByTheVaccinationAndReopenedWhenThatIsVoided() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);
        Vaccine vaccine=new Vaccine();vaccine.setFarm(farm);vaccine.setCode("V"+next());vaccine.setName("FMD");vaccine.setDiseasePrevented("FMD");vaccine.setWithdrawalInfo("0");vaccine.setAvailable(true);save(vaccine);
        VaccinationSchedule schedule=new VaccinationSchedule();schedule.setFarm(farm);schedule.setVaccine(vaccine);schedule.setScheduleName("FMD");schedule.setTargetGroup("EXPLICIT");
        schedule.setFirstDueDate(TODAY.plusDays(5));schedule.setDoseCount(2);schedule.setIntervalDays(21);schedule.setStatus("ACTIVE");save(schedule);
        ScheduledDose first=dose(schedule,cow,1,TODAY.plusDays(5));dose(schedule,cow,2,TODAY.plusDays(26));
        reconcile(farm);
        assertThat(rows(farm,"REM-06")).hasSize(2).first().satisfies(r->assertThat(r.getDueTime()).isEqualTo(day(TODAY.plusDays(5))));
        // Table III-3: "due within 7 days; overdue after the date". The second dose is outside the 7-day lead window.
        assertThat(seenBy(farm,owner,"REM-06")).singleElement().satisfies(v->assertThat(v.urgency()).isEqualTo("UPCOMING"));

        first.setStatus("DONE");reconcile(farm);
        assertThat(rows(farm,"REM-06")).extracting(Reminder::getStatus).containsExactly("RESOLVED","ACTIVE");

        Long reminderId=rows(farm,"REM-06").get(0).getId();first.setStatus("PLANNED");reconcile(farm);
        assertThat(rows(farm,"REM-06")).hasSize(2).first().satisfies(r->{assertThat(r.getId()).isEqualTo(reminderId);assertThat(r.getStatus()).isEqualTo("ACTIVE");});

        schedule.setStatus("STOPPED");reconcile(farm);
        assertThat(rows(farm,"REM-06")).extracting(Reminder::getStatus).containsOnly("CANCELLED");
    }
    private ScheduledDose dose(VaccinationSchedule schedule,Cattle cow,int no,LocalDate due){
        ScheduledDose d=new ScheduledDose();d.setSchedule(schedule);d.setCattle(cow);d.setDoseNo(no);d.setDueDate(due);d.setStatus("PLANNED");return save(d);
    }

    @Test void tentativeCalvingFromABreedingIsSupersededByTheConfirmedEpisodeWhichIsCancelledAtExit() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);
        ReproductionEvent breeding=event(cow,"BREEDING",day(TODAY.minusDays(40)),"BRED");breeding.setTentativeExpectedCalvingDate(TODAY.plusDays(20));
        reconcile(farm);
        assertThat(rows(farm,"REM-03")).singleElement().satisfies(r->assertThat(r.getStatus()).isEqualTo("ACTIVE"));
        assertThat(seenBy(farm,owner,"REM-05")).singleElement().satisfies(v->{assertThat(v.basisLabel()).isEqualTo("TENTATIVE");assertThat(v.urgency()).isEqualTo("UPCOMING");
            assertThat(v.dueTime()).isEqualTo(day(TODAY.plusDays(20)));});

        event(cow,"PREGNANCY_CHECK",day(TODAY.minusDays(5)),"PREGNANT");
        PregnancyEpisode episode=new PregnancyEpisode();episode.setCattle(cow);episode.setParity(1);episode.setStatus("OPEN");episode.setExpectedCalvingDate(TODAY.plusDays(25));save(episode);
        reconcile(farm);
        assertThat(rows(farm,"REM-03")).extracting(Reminder::getStatus).containsExactly("RESOLVED");
        assertThat(rows(farm,"REM-05")).extracting(Reminder::getStatus).containsExactly("SUPERSEDED","ACTIVE");
        assertThat(seenBy(farm,owner,"REM-05")).singleElement().satisfies(v->assertThat(v.basisLabel()).isEqualTo("CONFIRMED"));

        cow.setHerdStatus(HerdStatus.EXITED);reconcile(farm);
        assertThat(rows(farm,"REM-05")).extracting(Reminder::getStatus).containsExactly("SUPERSEDED","CANCELLED");
    }

    @Test void postCalvingReadinessUsesTheParameterAndAnEstrusResolvesItAndOpensTheBreedingWindow() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);CalvingEvent calved=calving(cow,day(TODAY.minusDays(50)));
        reconcile(farm);
        assertThat(rows(farm,"REM-07")).singleElement().satisfies(r->{assertThat(r.getSourceRecord()).isEqualTo("CALVING_EVENT:"+calved.getId());
            assertThat(r.getDueTime()).isEqualTo(calved.getBirthTime().plus(45,ChronoUnit.DAYS));});

        Instant estrus=clock.instant().minus(9,ChronoUnit.HOURS);event(cow,"ESTRUS",estrus,"OBSERVED");reconcile(farm);
        assertThat(rows(farm,"REM-07")).extracting(Reminder::getStatus).containsExactly("RESOLVED");
        assertThat(seenBy(farm,owner,"REM-02")).singleElement().satisfies(v->{assertThat(v.dueTime()).isEqualTo(estrus.plus(8,ChronoUnit.HOURS));
            assertThat(v.windowEnd()).isEqualTo(estrus.plus(12,ChronoUnit.HOURS));});

        clock.set(clock.instant().plus(4,ChronoUnit.HOURS));reconcile(farm);
        assertThat(rows(farm,"REM-02")).extracting(Reminder::getStatus).containsExactly("CANCELLED");
    }

    @Test void aMissingParameterSuppressesOnlyItsOwnReminder() {
        Farm farm=farmWith("{\"WEIGHING_INTERVAL_DAYS\":30}");Cattle cow=cow(farm);weight(cow,TODAY.minusDays(1),"400");calving(cow,day(TODAY.minusDays(50)));
        reconcile(farm);
        assertThat(rows(farm,"REM-07")).isEmpty();
        assertThat(rows(farm,"REM-01")).hasSize(1);
    }

    @Test void correctingABreedingReopensItsReminderInsteadOfInsertingADuplicateRuleKey() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);ReproductionEvent breeding=event(cow,"BREEDING",day(TODAY.minusDays(3)),"BRED");
        reproductionReminders.breedingRecorded(cow,breeding);em.flush();
        breeding.setEventTime(day(TODAY.minusDays(2)));reproductionReminders.eventCorrected(cow,breeding,null);em.flush();
        assertThat(rows(farm,"REM-03")).singleElement().satisfies(r->{assertThat(r.getStatus()).isEqualTo("ACTIVE");assertThat(r.getDueTime()).isEqualTo(day(TODAY.plusDays(26)));});
    }

    @Test void aBreedingResolvesThePostCalvingReminder() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);CalvingEvent calved=calving(cow,day(TODAY.minusDays(50)));
        reproductionReminders.calvingRecorded(cow,calved.getId(),calved.getBirthTime());
        reproductionReminders.breedingRecorded(cow,event(cow,"BREEDING",day(TODAY.minusDays(1)),"BRED"));em.flush();
        assertThat(rows(farm,"REM-07")).extracting(Reminder::getStatus).containsExactly("RESOLVED");
    }

    @Test void draftCalfReminderKeepsItsTimeSoItIsHighlightedAndIsCancelledWhenTheCalvingIsVoided() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);CalvingEvent calved=calving(cow,day(TODAY.minusDays(4)));
        CalfOutcome calf=new CalfOutcome();calf.setCalving(calved);calf.setRegistrationState("PENDING_CONFIRMATION");save(calf);
        reconcile(farm);clock.set(clock.instant().plus(1,ChronoUnit.HOURS));reconcile(farm);
        assertThat(rows(farm,"REM-09")).singleElement().satisfies(r->assertThat(r.getDueTime()).isEqualTo(calved.getRecordedAt()));
        assertThat(seenBy(farm,owner,"REM-09")).singleElement().satisfies(v->assertThat(v.highlighted()).isTrue());
        assertThat(seenBy(farm,memberWithRole(farm,FarmRole.TECHNICIAN),"REM-09")).isEmpty();

        calved.setStatus("VOIDED");reconcile(farm);
        assertThat(rows(farm,"REM-09")).extracting(Reminder::getStatus).containsExactly("CANCELLED");
    }

    @Test void lowFeedStockIsResolvedAndRaisedAgainWhenStockFallsBackAndOnlyOwnerAndManagersSeeIt() {
        Farm farm=farmWith(ALL_PARAMETERS);
        FeedItem hay=new FeedItem();hay.setFarm(farm);hay.setCode("TA-"+next());hay.setName("Hay");hay.setFeedGroup("DRY_ROUGHAGE");hay.setMinimumStockKg(new BigDecimal("50"));
        hay.setOnHandKg(new BigDecimal("40"));hay.setAvgUnitCost(BigDecimal.TEN);hay.setAvailable(true);save(hay);
        reconcile(farm);
        assertThat(rows(farm,"REM-10")).extracting(Reminder::getStatus).containsExactly("ACTIVE");
        assertThat(seenBy(farm,owner,"REM-10")).hasSize(1);
        assertThat(seenBy(farm,memberWithRole(farm,FarmRole.TECHNICIAN),"REM-10")).isEmpty();

        hay.setOnHandKg(new BigDecimal("100"));reconcile(farm);
        assertThat(rows(farm,"REM-10")).extracting(Reminder::getStatus).containsExactly("RESOLVED");
        hay.setOnHandKg(new BigDecimal("30"));reconcile(farm);
        assertThat(rows(farm,"REM-10")).extracting(Reminder::getStatus).containsExactly("ACTIVE");
    }

    @Test void finishingWeightIsResolvedByExitAndCancelledWhenTheWeightNoLongerReachesTheTarget() {
        Farm farm=farmWith(ALL_PARAMETERS);ProductionPurpose fattening=purpose(farm,PurposeType.FATTENING);
        Cattle sold=cattle(farm,breed(farm),fattening,Sex.MALE,LifeStage.ADULT);weight(sold,TODAY.minusDays(1),"460");
        Cattle corrected=cattle(farm,breed(farm),fattening,Sex.MALE,LifeStage.ADULT);weight(corrected,TODAY.minusDays(9),"420");Growth heavy=weight(corrected,TODAY.minusDays(1),"455");
        reconcile(farm);
        assertThat(rows(farm,"REM-13")).extracting(Reminder::getStatus).containsExactly("ACTIVE","ACTIVE");
        assertThat(seenBy(farm,memberWithRole(farm,FarmRole.TECHNICIAN),"REM-13")).isEmpty();

        sold.setHerdStatus(HerdStatus.EXITED);heavy.setStatus("VOIDED");reconcile(farm);
        assertThat(rows(farm,"REM-13")).extracting(r->r.getCattle().getId(),Reminder::getStatus)
            .containsExactlyInAnyOrder(tuple(sold.getId(),"RESOLVED"),tuple(corrected.getId(),"CANCELLED"));
    }

    @Test void readingIsSideEffectFreeTheJobIsIdempotentAndOtherFarmsCannotRead() {
        Farm farm=farmWith(ALL_PARAMETERS);Cattle cow=cow(farm);weight(cow,TODAY.minusDays(40),"400");event(cow,"BREEDING",day(TODAY.minusDays(30)),"BRED");
        reconcile(farm);reconcile(farm);
        List<String> before=em.createQuery("select concat(r.ruleKey,'=',r.status) from Reminder r where r.farm.id=:f order by r.id",String.class).setParameter("f",farm.getId()).getResultList();
        actAs(owner);screen.mine(farm.getId());screen.mine(farm.getId());em.flush();
        assertThat(em.createQuery("select concat(r.ruleKey,'=',r.status) from Reminder r where r.farm.id=:f order by r.id",String.class).setParameter("f",farm.getId()).getResultList())
            .isEqualTo(before).hasSize(2);
        Farm other=farm();actAs(memberWithRole(other,FarmRole.OWNER));
        assertThatThrownBy(()->screen.mine(farm.getId())).isInstanceOf(DomainException.class);
    }
}
