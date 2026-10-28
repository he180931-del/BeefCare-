package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.PenOccupancyService.Occupancy;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class PenOccupancyServiceTest extends DomainTestSupport {

    @Autowired
    PenOccupancyService occupancy;

    @Autowired
    PenAssignmentService assignments;

    private Farm farm;
    private AppUser user;
    private Breed breed;
    private ProductionPurpose purpose;

    private void setUpFarm() {
        farm = farm();
        user = user();
        breed = breed(farm);
        purpose = purpose(farm, PurposeType.BREEDING);
    }

    private void place(Pen pen, int count) {
        for (int i = 0; i < count; i++) {
            Cattle c = cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
            assignments.openAssignment(c, pen, TODAY.minusDays(5), AssignmentSource.HERD_ENTRY, null, null, null, user);
        }
    }

    @Test
    void headcountIsTheNumberOfOpenAssignmentsAndFreePlacesIsDerived() {
        setUpFarm();
        Pen a = pen(farm, "A1", 10);
        Pen b = pen(farm, "B1", 5);
        place(a, 3);
        assertThat(occupancy.headcount(a.getId())).isEqualTo(3);
        assertThat(occupancy.headcount(b.getId())).isZero();
        assertThat(occupancy.freePlaces(a)).isEqualTo(7);
        assertThat(occupancy.headcounts(List.of(a.getId(), b.getId()))).containsEntry(a.getId(), 3).containsEntry(b.getId(), 0);
    }

    @Test
    void closedAssignmentsDoNotCount() {
        setUpFarm();
        Pen a = pen(farm, "A1", 2);
        Cattle c = cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
        assignments.openAssignment(c, a, TODAY.minusDays(5), AssignmentSource.HERD_ENTRY, null, null, null, user);
        assertThat(occupancy.headcount(a.getId())).isEqualTo(1);
        assignments.closeAssignment(c, TODAY.minusDays(1));
        assertThat(occupancy.headcount(a.getId())).isZero();
    }

    @Test
    void aggregateCapacityIsCheckedPerPenAcrossLines() {
        setUpFarm();
        Pen a = pen(farm, "A1", 3);
        place(a, 2); // one free place
        // two voucher lines into the same pen are one entry of 2 -> blocked although each line alone would fit
        assertThatThrownBy(() -> occupancy.assertCanReceive(farm.getId(), Map.of(a.getId(), 2)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getParams()).containsEntry("pen_code", "A1").containsEntry("count", 2).containsEntry("free", 1);
            });
        assertThat(occupancy.assertCanReceive(farm.getId(), Map.of(a.getId(), 1))).singleElement().satisfies(o -> {
            assertThat(o.before()).isEqualTo(2);
            assertThat(o.after()).isEqualTo(3);
            assertThat(o.willBeFull()).isTrue();
        });
    }

    @Test
    void inactivePenCannotReceive() {
        setUpFarm();
        Pen a = pen(farm, "A1", 5);
        a.setStatus(ActiveStatus.INACTIVE);
        em.flush();
        assertThatThrownBy(() -> occupancy.assertCanReceive(farm.getId(), Map.of(a.getId(), 1)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getParams()).containsEntry("free", 0);
            });
    }

    @Test
    void fiveCattleIntoPenWithFourFreePlacesIsBlocked() {
        setUpFarm();
        Pen a = pen(farm, "A1", 6);
        place(a, 2);
        assertThatThrownBy(() -> occupancy.assertCanReceive(farm.getId(), Map.of(a.getId(), 5)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getParams()).containsEntry("count", 5).containsEntry("free", 4);
            });
    }

    @Test
    void pensOfOtherFarmsAreUnavailable() {
        setUpFarm();
        Farm other = farm();
        Pen foreign = pen(other, "X1", 5);
        assertThatThrownBy(() -> occupancy.assertCanReceive(farm.getId(), Map.of(foreign.getId(), 1)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_08));
    }

    @Test
    void pensAreLockedAndReturnedInAscendingIdOrder() {
        setUpFarm();
        Pen first = pen(farm, "A1", 5);
        Pen second = pen(farm, "A2", 5);
        Pen third = pen(farm, "A3", 5);
        Map<Long, Pen> locked = occupancy.lockPens(farm.getId(), List.of(third.getId(), first.getId(), second.getId()));
        assertThat(locked.keySet()).containsExactly(first.getId(), second.getId(), third.getId());
        List<Occupancy> result = occupancy.assertCanReceive(farm.getId(), Map.of(third.getId(), 1, first.getId(), 2));
        assertThat(result).extracting(Occupancy::penId).containsExactly(first.getId(), third.getId());
    }

    @Test
    void previewShowsBeforeAndAfterWithoutValidating() {
        setUpFarm();
        Pen a = pen(farm, "A1", 2);
        place(a, 1);
        assertThat(occupancy.preview(farm.getId(), Map.of(a.getId(), 5))).singleElement().satisfies(o -> {
            assertThat(o.before()).isEqualTo(1);
            assertThat(o.after()).isEqualTo(6);
            assertThat(o.capacity()).isEqualTo(2);
        });
    }
}
