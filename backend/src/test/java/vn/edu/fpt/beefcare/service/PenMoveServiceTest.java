package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.service.dto.PenHistoryDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveResultDTO;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class PenMoveServiceTest extends DomainTestSupport {

    @Autowired
    PenMoveService moves;

    @Autowired
    PenAssignmentService assignments;

    @Autowired
    PenAssignmentRepository assignmentRepository;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    Breed breed;
    ProductionPurpose breeding;
    ProductionPurpose fattening;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        breed = breed(farm);
        breeding = purpose(farm, PurposeType.BREEDING);
        fattening = purpose(farm, PurposeType.FATTENING);
        actAs(owner);
    }

    private Cattle cowIn(Pen pen, LocalDate from) {
        Cattle c = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.ADULT);
        assignments.openAssignment(c, pen, from, AssignmentSource.HERD_ENTRY, "entry", null, null, owner);
        return c;
    }

    private List<Cattle> cowsIn(Pen pen, int n) {
        List<Cattle> list = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            list.add(cowIn(pen, TODAY.minusDays(20)));
        }
        return list;
    }

    private PenMoveRequest req(Pen to, String reason, Map<Long, String> warnings, Cattle... cattle) {
        return new PenMoveRequest(java.util.Arrays.stream(cattle).map(Cattle::getId).toList(), to.getId(), TODAY, reason, warnings, null, null);
    }

    private void assertCode(Runnable r, String code, HttpStatus status) {
        assertThatThrownBy(r::run)
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(code);
                assertThat(e.getStatus()).isEqualTo(status);
            });
    }

    private Pen currentPen(Cattle c) {
        return assignments.findOpen(c.getId()).orElseThrow().getPen();
    }

    @Test
    void movesCattleClosingOldAndOpeningNewAssignment() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        PenMoveResultDTO r = moves.move(farm.getId(), req(b, "better feed", null, c));
        assertThat(r.moved()).hasSize(1);
        assertThat(r.moved().get(0).source()).isEqualTo("MOVE");
        assertThat(r.message().code()).isEqualTo(MessageCodes.FE04_08);
        assertThat(r.message().params()).containsEntry("moved", 1).containsEntry("pen_code", "B");
        assertThat(r.destination().headcount()).isEqualTo(1);
        assertThat(currentPen(c).getId()).isEqualTo(b.getId());
        List<PenAssignment> history = assignments.history(c.getId());
        assertThat(history).hasSize(2);
        assertThat(history.get(0).getToDate()).isEqualTo(TODAY);
        assertThat(history.get(1).getFromDate()).isEqualTo(TODAY);
        assertThat(history.get(1).getSource()).isEqualTo(AssignmentSource.MOVE);
        assertThat(history.get(1).getReason()).isEqualTo("better feed");
        assertThat(history.get(1).getMovedBy().getId()).isEqualTo(owner.getId());
    }

    @Test
    void managerCanMoveTechnicianCannot() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        actAs(technician);
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, c)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        assertCode(() -> moves.check(farm.getId(), new PenMoveCheckRequest(List.of(c.getId()), b.getId(), TODAY)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        assertThat(currentPen(c).getId()).isEqualTo(a.getId());
        actAs(manager);
        assertThat(moves.move(farm.getId(), req(b, "x", null, c)).moved()).hasSize(1);
    }

    @Test
    void expiredServiceBlocksMoves() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        farm.setServiceStatus("EXPIRED");
        em.flush();
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, c)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        assertThat(currentPen(c).getId()).isEqualTo(a.getId());
    }

    @Test
    void scenario10FiveCattleIntoFourFreePlacesIsBlockedAndNothingChanges() {
        Pen from = pen(farm, "FROM", 10);
        Pen to = pen(farm, "TO", 10);
        cowsIn(to, 6);
        List<Cattle> five = cowsIn(from, 5);
        PenMoveRequest request = new PenMoveRequest(five.stream().map(Cattle::getId).toList(), to.getId(), TODAY, "regroup", null, null, null);
        assertThatThrownBy(() -> moves.move(farm.getId(), request))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                assertThat(e.getParams()).containsEntry("pen_code", "TO").containsEntry("count", 5).containsEntry("free", 4);
            });
        five.forEach(c -> assertThat(currentPen(c).getId()).isEqualTo(from.getId()));
        assertThat(assignmentRepository.countByPenIdAndToDateIsNull(to.getId())).isEqualTo(6);
        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(five.stream().map(Cattle::getId).toList(), to.getId(), TODAY));
        assertThat(check.blocked()).isTrue();
        assertThat(check.block().code()).isEqualTo(MessageCodes.FE04_05);
        assertThat(check.freePlaces()).isEqualTo(4);
        assertThat(check.movingCount()).isEqualTo(5);
    }

    @Test
    void scenario10LastPlaceGoesToOnlyOneOfTwoSequentialMovers() {
        Pen from = pen(farm, "FROM", 10);
        Pen to = pen(farm, "TO", 3);
        cowsIn(to, 2);
        Cattle first = cowIn(from, TODAY.minusDays(5));
        Cattle second = cowIn(from, TODAY.minusDays(5));
        assertThat(moves.move(farm.getId(), req(to, "one", null, first)).moved()).hasSize(1);
        assertThatThrownBy(() -> moves.move(farm.getId(), req(to, "two", null, second)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getParams()).containsEntry("free", 0);
            });
        assertThat(currentPen(second).getId()).isEqualTo(from.getId());
        assertThat(assignmentRepository.countByPenIdAndToDateIsNull(to.getId())).isEqualTo(3);
    }

    @Test
    void scenario11MoveDateBeforeCurrentFromDateIsBlocked() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(3));
        PenMoveRequest early = new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY.minusDays(4), "x", null, null, null);
        assertThatThrownBy(() -> moves.move(farm.getId(), early))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_09);
                assertThat(e.getParams()).containsEntry("start_date", TODAY.minusDays(3));
            });
        PenMoveRequest future = new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY.plusDays(1), "x", null, null, null);
        assertCode(() -> moves.move(farm.getId(), future), MessageCodes.FE04_09, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(currentPen(c).getId()).isEqualTo(a.getId());
        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(List.of(c.getId()), b.getId(), TODAY.minusDays(4)));
        assertThat(check.cattle().get(0).error().code()).isEqualTo(MessageCodes.FE04_09);
        PenMoveRequest sameDay = new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY.minusDays(3), "x", null, null, null);
        assertThat(moves.move(farm.getId(), sameDay).moved()).hasSize(1);
    }

    @Test
    void unmetCriteriaNeedAWarningReasonThatIsStoredWithTheCriteriaVersion() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        criteria(b, 1, Set.of(PurposeType.FATTENING), null, null, null, null, owner);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(List.of(c.getId()), b.getId(), TODAY));
        assertThat(check.blocked()).isFalse();
        assertThat(check.cattle().get(0).allMet()).isFalse();
        assertThat(check.cattle().get(0).warningReasonRequired()).isTrue();
        assertThat(check.cattle().get(0).warning().code()).isEqualTo(MessageCodes.FE04_06);
        assertThatThrownBy(() -> moves.move(farm.getId(), req(b, "need space", null, c)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_06);
                assertThat(e.getParams()).containsKey("criteria").containsEntry("pen_code", "B");
            });
        assertThat(currentPen(c).getId()).isEqualTo(a.getId());
        assertCode(() -> moves.move(farm.getId(), req(b, "need space", Map.of(c.getId(), "   "), c)), MessageCodes.FE04_06, HttpStatus.UNPROCESSABLE_ENTITY);
        moves.move(farm.getId(), req(b, "need space", Map.of(c.getId(), "only free pen"), c));
        PenAssignment open = assignments.findOpen(c.getId()).orElseThrow();
        assertThat(open.getPen().getId()).isEqualTo(b.getId());
        assertThat(open.getWarningReason()).isEqualTo("only free pen");
        assertThat(open.getCriteriaVersion()).isNotNull();
        assertThat(open.getCriteriaVersion().getVersionNo()).isEqualTo(1);
        assertThat(open.getReceptionCheck()).contains("NOT_MET");
    }

    @Test
    void warningReasonIsNeededOnlyForTheCattleThatFail() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        criteria(b, 1, null, null, Sex.FEMALE, null, null, owner);
        Cattle cow = cowIn(a, TODAY.minusDays(10));
        Cattle bull = cattle(farm, breed, fattening, Sex.MALE, LifeStage.ADULT);
        assignments.openAssignment(bull, a, TODAY.minusDays(10), AssignmentSource.HERD_ENTRY, "entry", null, null, owner);
        assertCode(() -> moves.move(farm.getId(), req(b, "r", null, cow, bull)), MessageCodes.FE04_06, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(currentPen(cow).getId()).isEqualTo(a.getId());
        assertThat(moves.move(farm.getId(), req(b, "r", Map.of(bull.getId(), "bull ok"), cow, bull)).moved()).hasSize(2);
        assertThat(assignments.findOpen(cow.getId()).orElseThrow().getWarningReason()).isNull();
    }

    @Test
    void inactiveDestinationIsBlocked() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        b.setStatus(ActiveStatus.INACTIVE);
        em.flush();
        Cattle c = cowIn(a, TODAY.minusDays(10));
        assertThatThrownBy(() -> moves.move(farm.getId(), req(b, "x", null, c)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
                assertThat(e.getParams()).containsEntry("free", 0);
            });
        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(List.of(c.getId()), b.getId(), TODAY));
        assertThat(check.blocked()).isTrue();
        assertThat(check.destinationActive()).isFalse();
        assertThat(currentPen(c).getId()).isEqualTo(a.getId());
    }

    @Test
    void cattleAlreadyInDestinationAreSkippedAndTheRestMove() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle inB = cowIn(b, TODAY.minusDays(10));
        Cattle inA = cowIn(a, TODAY.minusDays(10));
        PenMoveResultDTO r = moves.move(farm.getId(), req(b, "x", null, inB, inA));
        assertThat(r.moved()).extracting(PenMoveResultDTO.Moved::cattleId).containsExactly(inA.getId());
        assertThat(r.skipped()).hasSize(1);
        assertThat(r.skipped().get(0).message().code()).isEqualTo(MessageCodes.FE04_07);
        assertThat(assignments.history(inB.getId())).hasSize(1);
        PenMoveResultDTO none = moves.move(farm.getId(), req(b, "x", null, inB));
        assertThat(none.moved()).isEmpty();
        assertThat(none.message()).isNull();
        assertThat(none.skipped()).hasSize(1);
    }

    @Test
    void skippedCattleDoNotConsumeCapacity() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 2);
        Cattle one = cowIn(b, TODAY.minusDays(10));
        Cattle two = cowIn(b, TODAY.minusDays(10));
        Cattle three = cowIn(a, TODAY.minusDays(10));
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, one, two, three)), MessageCodes.FE04_05, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(moves.move(farm.getId(), req(b, "x", null, one, two)).moved()).isEmpty();
    }

    @Test
    void exitedAndVoidedCattleAreRejectedAndNothingElseMoves() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle ok = cowIn(a, TODAY.minusDays(10));
        Cattle exited = cowIn(a, TODAY.minusDays(10));
        exited.setHerdStatus(HerdStatus.EXITED);
        exited.setExitDate(TODAY.minusDays(1));
        em.flush();
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, ok, exited)), MessageCodes.COM_13, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(currentPen(ok).getId()).isEqualTo(a.getId());
        Cattle voided = cowIn(a, TODAY.minusDays(10));
        voided.setHerdStatus(HerdStatus.VOIDED);
        em.flush();
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, voided)), MessageCodes.COM_18, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void exitPendingCattleCannotBeMoved() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        var voucher = exitVoucher(farm, owner, null, 0, 0, ExitVoucherStatus.PENDING);
        exitLine(voucher, c, 1, ExitLineStatus.PENDING);
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, c)), MessageCodes.COM_17, HttpStatus.UNPROCESSABLE_ENTITY);
        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(List.of(c.getId()), b.getId(), TODAY));
        assertThat(check.cattle().get(0).error().code()).isEqualTo(MessageCodes.COM_17);
    }

    @Test
    void reasonIsRequiredAndCorrectionIsARecordedReverseMove() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        assertCode(() -> moves.move(farm.getId(), req(b, "  ", null, c)), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        assertCode(() -> moves.move(farm.getId(), req(b, null, null, c)), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        assertCode(() -> moves.move(farm.getId(), req(b, "x".repeat(501), null, c)), MessageCodes.COM_10, HttpStatus.BAD_REQUEST);
        moves.move(farm.getId(), req(b, "wrong pen", null, c));
        PenMoveResultDTO back = moves.move(farm.getId(), req(a, "Correction", null, c));
        assertThat(back.moved().get(0).source()).isEqualTo("CORRECTION");
        assertThat(currentPen(c).getId()).isEqualTo(a.getId());
        assertThat(assignments.history(c.getId())).hasSize(3);
    }

    @Test
    void movingResolvesActivePenMoveSuggestions() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        Reminder r = new Reminder();
        r.setFarm(farm);
        r.setCattle(c);
        r.setRuleType("REM-08");
        r.setSourceRecord("weaning");
        r.setDueTime(Instant.now());
        r.setStatus("ACTIVE");
        save(r);
        Reminder other = new Reminder();
        other.setFarm(farm);
        other.setCattle(c);
        other.setRuleType("REM-03");
        other.setSourceRecord("x");
        other.setDueTime(Instant.now());
        other.setStatus("ACTIVE");
        save(other);
        moves.move(farm.getId(), req(b, "per suggestion", null, c));
        em.flush();
        em.refresh(r);
        em.refresh(other);
        assertThat(r.getStatus()).isEqualTo("RESOLVED");
        assertThat(other.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void performerMustBeAnActiveMemberOfTheFarm() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        AppUser outsider = user();
        PenMoveRequest bad = new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY, "x", null, null, outsider.getId());
        assertCode(() -> moves.move(farm.getId(), bad), MessageCodes.COM_10, HttpStatus.BAD_REQUEST);
        PenMoveRequest good = new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY, "x", null, null, technician.getId());
        moves.move(farm.getId(), good);
        assertThat(assignments.findOpen(c.getId()).orElseThrow().getMovedBy().getId()).isEqualTo(technician.getId());
    }

    @Test
    void staleCattleVersionGivesMsgCom05() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        PenMoveRequest stale = new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY, "x", null, Map.of(c.getId(), c.getVersion() + 3), null);
        assertCode(() -> moves.move(farm.getId(), stale), MessageCodes.COM_05, HttpStatus.CONFLICT);
    }

    @Test
    void destinationOrCattleOfAnotherFarmIsNotFound() {
        Pen a = pen(farm, "A", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        Farm other = farm();
        Pen foreign = pen(other, "Z", 10);
        assertCode(() -> moves.move(farm.getId(), req(foreign, "x", null, c)), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
        Cattle foreignCattle = cattle(other, breed(other), purpose(other, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        Pen b = pen(farm, "B", 10);
        assertCode(() -> moves.move(farm.getId(), req(b, "x", null, foreignCattle)), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
    }

    @Test
    void checkReportsCriteriaTableAndLatestWeight() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 10);
        criteria(b, 1, Set.of(PurposeType.BREEDING), Set.of(LifeStage.ADULT), Sex.FEMALE, 12, new BigDecimal("400"), owner);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        weight(c, TODAY.minusDays(2), "350");
        PenMoveCheckDTO check = moves.check(farm.getId(), new PenMoveCheckRequest(List.of(c.getId()), b.getId(), null));
        var results = check.cattle().get(0).results();
        assertThat(results).hasSize(5);
        assertThat(results).filteredOn(x -> x.outcome() == ReceptionCriteriaService.Outcome.NOT_MET).extracting(x -> x.criterion()).containsExactly(ReceptionCriteriaService.Criterion.MIN_WEIGHT_KG);
        assertThat(check.criteriaVersionNo()).isEqualTo(1);
        assertThat(check.blocked()).isFalse();
        assertThat(check.cattle().get(0).currentPenCode()).isEqualTo("A");
    }

    @Test
    void penHistoryShowsCurrentPenAndRowsNewestFirst() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 8);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        clock.setFarmToday(TODAY);
        moves.move(farm.getId(), new PenMoveRequest(List.of(c.getId()), b.getId(), TODAY.minusDays(2), "moved out", null, null, manager.getId()));
        PenHistoryDTO h = moves.history(farm.getId(), c.getId());
        assertThat(h.current().penCode()).isEqualTo("B");
        assertThat(h.current().since()).isEqualTo(TODAY.minusDays(2));
        assertThat(h.current().capacity()).isEqualTo(8);
        assertThat(h.current().headcount()).isEqualTo(1);
        assertThat(h.history()).hasSize(2);
        assertThat(h.history().get(0).penCode()).isEqualTo("B");
        assertThat(h.history().get(0).toDate()).isNull();
        assertThat(h.history().get(0).reason()).isEqualTo("moved out");
        assertThat(h.history().get(0).recordedById()).isEqualTo(manager.getId());
        assertThat(h.history().get(1).penCode()).isEqualTo("A");
        assertThat(h.history().get(1).toDate()).isEqualTo(TODAY.minusDays(2));
        actAs(technician);
        assertThat(moves.history(farm.getId(), c.getId()).history()).hasSize(2);
    }

    @Test
    void exitedCattleHaveHistoryButNoCurrentPen() {
        Pen a = pen(farm, "A", 10);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        assignments.closeAssignment(c, TODAY);
        c.setHerdStatus(HerdStatus.EXITED);
        em.flush();
        PenHistoryDTO h = moves.history(farm.getId(), c.getId());
        assertThat(h.current()).isNull();
        assertThat(h.history()).hasSize(1);
        assertThat(h.herdStatus()).isEqualTo("EXITED");
    }

    @Test
    void sameCattleListedTwiceMovesOnce() {
        Pen a = pen(farm, "A", 10);
        Pen b = pen(farm, "B", 1);
        Cattle c = cowIn(a, TODAY.minusDays(10));
        PenMoveRequest dup = new PenMoveRequest(List.of(c.getId(), c.getId()), b.getId(), TODAY, "x", null, null, null);
        assertThat(moves.move(farm.getId(), dup).moved()).hasSize(1);
    }
}
