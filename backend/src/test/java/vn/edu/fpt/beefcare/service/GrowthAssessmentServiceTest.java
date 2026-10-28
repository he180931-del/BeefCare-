package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest @Transactional
class GrowthAssessmentServiceTest extends DomainTestSupport {
    @Autowired GrowthAssessmentService service;
    @Autowired CattleProfileService profiles;
    @Autowired CattleTimelineService timeline;
    private Cattle animal(Farm f){return cattle(f,breed(f),purpose(f,PurposeType.FATTENING),Sex.MALE,LifeStage.ADULT);}
    private GrowthDtos.Measurement measurement(Instant time,String method,String weight,String bcs,boolean acknowledged){return new GrowthDtos.Measurement(time,null,method,weight==null?null:new BigDecimal(weight),null,null,bcs==null?null:new BigDecimal(bcs),null,acknowledged);}
    @Test void currentWeightPrefersMeasuredButAdgUsesAllValidWeightsAndProjectionUsesWeightDate() {
        Farm f=farm();actAs(memberWithRole(f,FarmRole.MANAGER));Cattle c=animal(f);
        Growth first=weight(c,TODAY.minusDays(30),"300");Growth last=weight(c,TODAY.minusDays(10),"320");last.setWeightType("ESTIMATED");em.flush();
        GrowthDtos.Summary result=service.history(f.getId(),c.getId(),90);
        assertThat(result.currentWeight().id()).isEqualTo(first.getId());assertThat(result.currentWeight().basis()).isEqualTo("MEASURED");
        assertThat(result.adg()).isEqualByComparingTo("1.000");assertThat(result.projectedFinishingDate()).isEqualTo(TODAY.minusDays(10).plusDays(130));
        FarmParameterVersion parameters=new FarmParameterVersion();parameters.setFarm(f);parameters.setVersionNo(1);parameters.setGestationLengthDays(283);parameters.setEffectiveFrom(TODAY);parameters.setChangedBy(user());parameters.setCreatedAt(clock.instant());parameters.setSourceNote("Disable target");
        parameters.setParameterValues(JsonSupport.toJson(Map.of("WEIGHING_INTERVAL_DAYS",30)));save(parameters);
        assertThat(service.history(f.getId(),c.getId(),90).projectedFinishingDate()).isNull();
    }
    @Test void bcsOnlyHalfStepsAndTapeFormulaArePreservedAndWrongRolesCannotRecord() {
        Farm f=farm();AppUser manager=memberWithRole(f,FarmRole.MANAGER);actAs(manager);Cattle c=animal(f);
        GrowthDtos.Record bcs=service.record(f.getId(),c.getId(),measurement(clock.instant(),null,null,"2.5",false));
        assertThat(bcs.weightKg()).isNull();assertThat(bcs.bcs()).isEqualByComparingTo("2.5");
        assertThatThrownBy(()->service.record(f.getId(),c.getId(),measurement(clock.instant(),null,null,"2.7",false))).isInstanceOf(DomainException.class);
        GrowthDtos.Record tape=service.record(f.getId(),c.getId(),new GrowthDtos.Measurement(clock.instant(),null,"TAPE",null,new BigDecimal("150"),new BigDecimal("120"),null,null,false));
        assertThat(tape.weightKg()).isEqualByComparingTo("238.7");assertThat(tape.basis()).isEqualTo("ESTIMATED");
        actAs(memberWithRole(f,FarmRole.OWNER));assertThatThrownBy(()->service.record(f.getId(),c.getId(),measurement(clock.instant(),"SCALE","300",null,true))).isInstanceOf(DomainException.class);
    }
    @Test void exclusionChangesIndicatorsAndTimelineKeepsBeforeSnapshotWithoutDeletingHistory() {
        Farm f=farm();actAs(memberWithRole(f,FarmRole.MANAGER));Cattle c=animal(f);
        Growth a=weight(c,TODAY.minusDays(30),"300"),b=weight(c,TODAY.minusDays(10),"320");
        GrowthDtos.Record excluded=service.correct(f.getId(),c.getId(),b.getId(),new GrowthDtos.Correction("EXCLUDE",null,"Cân nhầm",b.getVersion()));
        assertThat(excluded.status()).isEqualTo("EXCLUDED");assertThat(service.history(f.getId(),c.getId(),90).adg()).isNull();
        assertThat(timeline.timeline(f.getId(),c.getId(),"GROWTH",false)).extracting(CattleTimelineService.Event::sourceId).containsExactly(a.getId());
        assertThat(timeline.timeline(f.getId(),c.getId(),"GROWTH",true)).anyMatch(e->"REVISION".equals(e.type()));
        assertThat(service.history(f.getId(),c.getId(),90).records()).hasSize(2);
    }
    @Test void herdGroupsRespectSrsPriorityAndYoungBreedingFemaleIsYoungStock() {
        Farm f=farm();Cattle c=cattle(f,breed(f),purpose(f,PurposeType.BREEDING),Sex.FEMALE,LifeStage.YOUNG_STOCK);
        assertThat(profiles.herdGroup(c)).isEqualTo("YOUNG_STOCK");c.setLifeStage(LifeStage.ADULT);assertThat(profiles.herdGroup(c)).isEqualTo("BREEDING_FEMALES");
        c.setLifeStage(LifeStage.UNWEANED_CALF);assertThat(profiles.herdGroup(c)).isEqualTo("CALVES");
    }
}
