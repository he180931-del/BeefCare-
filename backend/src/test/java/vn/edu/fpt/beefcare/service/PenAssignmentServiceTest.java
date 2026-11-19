package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.EnumSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.ReceptionCheck;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class PenAssignmentServiceTest extends DomainTestSupport {

    @Autowired
    PenAssignmentService assignments;

    @Autowired
    ReceptionCriteriaService receptionCriteria;

    Farm farm;
    AppUser user;
    Breed breed;
    ProductionPurpose purpose;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        user = user();
        breed = breed(farm);
        purpose = purpose(farm, PurposeType.BREEDING);
    }

    private Cattle cow() {
        return cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
    }

    private PenAssignment open(Cattle c, Pen p, java.time.LocalDate from) {
        return assignments.openAssignment(c, p, from, AssignmentSource.HERD_ENTRY, "first placement", null, null, user);
    }

    @Test
    void opensTheFirstPlacement() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        PenAssignment a = open(c, p, TODAY.minusDays(4));
        assertThat(a.getToDate()).isNull();
        assertThat(a.getSource()).isEqualTo(AssignmentSource.HERD_ENTRY);
        assertThat(a.getMovedBy().getId()).isEqualTo(user.getId());
        assertThat(assignments.findOpen(c.getId())).get().extracting(PenAssignment::getId).isEqualTo(a.getId());
    }

    @Test
    void atMostOneOpenAssignmentPerCattle() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        Pen q = pen(farm, "A2", 5);
        open(c, p, TODAY.minusDays(4));
        assertThatThrownBy(() -> open(c, q, TODAY.minusDays(1)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
    }

    @Test
    void anEventualFutureStartIsRejected() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        assertThatThrownBy(() -> open(c, p, TODAY.plusDays(1)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_07));
    }

    @Test
    void inactivePenIsBlockedForNewPlacements() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        p.setStatus(ActiveStatus.INACTIVE);
        em.flush();
        assertThatThrownBy(() -> open(c, p, TODAY))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05));
    }

    @Test
    void fullPenIsBlocked() {
        Pen p = pen(farm, "A1", 1);
        open(cow(), p, TODAY.minusDays(2));
        Cattle second = cow();
        assertThatThrownBy(() -> open(second, p, TODAY))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getParams()).containsEntry("free", 0);
            });
        assertThat(assignments.findOpen(second.getId())).isEmpty();
    }

    @Test
    void penOfAnotherFarmIsRejected() {
        Pen foreign = pen(farm(), "X1", 5);
        assertThatThrownBy(() -> open(cow(), foreign, TODAY)).isInstanceOf(DomainException.class);
    }

    @Test
    void exitedCattleCannotBePlaced() {
        Cattle c = cow();
        c.setHerdStatus(HerdStatus.EXITED);
        em.flush();
        assertThatThrownBy(() -> open(c, pen(farm, "A1", 5), TODAY)).isInstanceOf(DomainException.class);
    }

    @Test
    void moveClosesTheOldAssignmentAndOpensTheNewOneOnTheSameDay() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        Pen q = pen(farm, "A2", 5);
        PenAssignment first = open(c, p, TODAY.minusDays(10));
        PenAssignment second = assignments.move(c, q, TODAY.minusDays(3), AssignmentSource.MOVE, "regrouping", null, null, user);
        assertThat(first.getToDate()).isEqualTo(TODAY.minusDays(3));
        assertThat(second.getFromDate()).isEqualTo(TODAY.minusDays(3));
        assertThat(second.getToDate()).isNull();
        assertThat(assignments.history(c.getId())).hasSize(2);
        assertThat(assignments.findOpen(c.getId())).get().extracting(a -> a.getPen().getId()).isEqualTo(q.getId());
    }

    @Test
    void moveDateBeforeCurrentStartIsRejectedAndNothingChanges() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        Pen q = pen(farm, "A2", 5);
        PenAssignment first = open(c, p, TODAY.minusDays(5));
        assertThatThrownBy(() -> assignments.move(c, q, TODAY.minusDays(6), AssignmentSource.MOVE, "x", null, null, user))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_09);
                assertThat(e.getParams()).containsEntry("start_date", TODAY.minusDays(5));
            });
        assertThat(first.getToDate()).isNull();
        assertThat(assignments.history(c.getId())).hasSize(1);
    }

    @Test
    void moveDateInTheFutureIsRejected() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        Pen q = pen(farm, "A2", 5);
        open(c, p, TODAY.minusDays(5));
        assertThatThrownBy(() -> assignments.move(c, q, TODAY.plusDays(1), AssignmentSource.MOVE, "x", null, null, user))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_09));
    }

    @Test
    void movingIntoTheSamePenIsSkipped() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        open(c, p, TODAY.minusDays(5));
        assertThatThrownBy(() -> assignments.move(c, p, TODAY, AssignmentSource.MOVE, "x", null, null, user))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_07));
    }

    @Test
    void sameDayMoveGivesAnEmptyPeriodAndNoOverlap() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        Pen q = pen(farm, "A2", 5);
        open(c, p, TODAY);
        PenAssignment second = assignments.move(c, q, TODAY, AssignmentSource.CORRECTION, "Correction", null, null, user);
        assertThat(second.getSource()).isEqualTo(AssignmentSource.CORRECTION);
        assertThat(assignments.history(c.getId())).extracting(PenAssignment::getFromDate).containsExactly(TODAY, TODAY);
    }

    @Test
    void reopeningBeforeThePreviousPeriodEndedIsRejected() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        open(c, p, TODAY.minusDays(10));
        assignments.closeAssignment(c, TODAY.minusDays(2));
        assertThatThrownBy(() -> open(c, p, TODAY.minusDays(5)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_09));
        assertThat(open(c, p, TODAY.minusDays(2)).getToDate()).isNull();
    }

    @Test
    void closeWithoutOpenAssignmentIsAConflict() {
        Cattle c = cow();
        assertThatThrownBy(() -> assignments.closeAssignment(c, TODAY))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
    }

    @Test
    void notMetCriteriaNeedAWarningReasonWhichIsStoredWithTheCheck() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        criteria(p, 1, EnumSet.of(PurposeType.FATTENING), null, null, null, new BigDecimal("250"), user);
        ReceptionCheck check = receptionCriteria.check(p, c, TODAY);
        assertThat(check.allMet()).isFalse();

        assertThatThrownBy(() -> assignments.openAssignment(c, p, TODAY, AssignmentSource.HERD_ENTRY, null, check, null, user))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_06));
        assertThat(assignments.findOpen(c.getId())).isEmpty();

        PenAssignment a = assignments.openAssignment(c, p, TODAY, AssignmentSource.HERD_ENTRY, null, check, "no other pen free", user);
        assertThat(a.getWarningReason()).isEqualTo("no other pen free");
        assertThat(a.getCriteriaVersion().getVersionNo()).isEqualTo(1);
        assertThat(a.getReceptionCheck()).contains("PURPOSE_TYPE").contains("NOT_MET");
    }

    @Test
    void movingWithUnmetCriteriaAndNoReasonLeavesTheCurrentPlacementUntouched() {
        Cattle c = cow();
        Pen p = pen(farm, "A1", 5);
        Pen q = pen(farm, "A2", 5);
        criteria(q, 1, EnumSet.of(PurposeType.FATTENING), null, null, null, null, user);
        PenAssignment first = open(c, p, TODAY.minusDays(3));
        ReceptionCheck check = receptionCriteria.check(q, c, TODAY);
        assertThatThrownBy(() -> assignments.move(c, q, TODAY, AssignmentSource.MOVE, "x", check, null, user))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_06));
        assertThat(first.getToDate()).isNull();
        PenAssignment moved = assignments.move(c, q, TODAY, AssignmentSource.MOVE, "x", check, "needed for isolation", user);
        assertThat(moved.getWarningReason()).isEqualTo("needed for isolation");
    }
}
