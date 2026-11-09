package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-16 A1: canOpen / canCorrect follow the source permission and herd-status guard (R-16-06 … R-16-08). */
@ServiceIntegrationTest
@Transactional
class CattleTimelineServiceTest extends DomainTestSupport {

    @Autowired
    CattleTimelineService timeline;

    private Farm farm;
    private Cattle cow;
    private Growth weighing;

    @BeforeEach
    void setUp() {
        farm = farm();
        cow = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        weighing = weight(cow, TODAY.minusDays(3), "320");
    }

    private CattleTimelineService.Event growthEvent() {
        return timeline.timeline(farm.getId(), cow.getId(), "GROWTH", true).stream()
            .filter(e -> "GROWTH_ASSESSMENT".equals(e.type())).findFirst().orElseThrow();
    }

    @Test
    void tc1609ManagerMayCorrectAValidGrowthRecordAndGetsItsId() {
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        CattleTimelineService.Event e = growthEvent();
        assertThat(e.canCorrect()).isTrue();
        assertThat(e.canOpen()).isTrue();
        assertThat(e.sourceId()).isEqualTo(weighing.getId());
    }

    @Test
    void tc1610TechnicianAndOwnerSeeTheRecordButCannotCorrectIt() {
        actAs(memberWithRole(farm, FarmRole.TECHNICIAN));
        assertThat(growthEvent().canCorrect()).isFalse();
        assertThat(growthEvent().canOpen()).isTrue();
        actAs(memberWithRole(farm, FarmRole.OWNER));
        assertThat(growthEvent().canCorrect()).isFalse();
    }

    @Test
    void anExcludedRecordIsNeverCorrectable() {
        weighing.setStatus("EXCLUDED");
        em.flush();
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        assertThat(growthEvent().canCorrect()).isFalse();
        // and it is hidden unless corrections are shown (R-16-04)
        assertThat(timeline.timeline(farm.getId(), cow.getId(), "GROWTH", false)).isEmpty();
    }

    @Test
    void tc1612ExitedCattleKeepTheirHistoryReadOnly() {
        cow.setHerdStatus(HerdStatus.EXITED);
        em.flush();
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        CattleTimelineService.Event e = growthEvent();
        assertThat(e.canOpen()).isTrue();
        assertThat(e.canCorrect()).isFalse();
    }

    @Test
    void tc1613CattleOfAnotherFarmIsNotFound() {
        Farm other = farm();
        actAs(memberWithRole(other, FarmRole.MANAGER));
        assertThatThrownBy(() -> timeline.timeline(other.getId(), cow.getId(), null, false))
            .isInstanceOfSatisfying(DomainException.class, ex -> assertThat(ex.getCode()).isEqualTo(MessageCodes.COM_08));
    }
}
