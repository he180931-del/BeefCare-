package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.GrowthRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.service.dto.PenMoveRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveResultDTO;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main function of UC-FE04-03 Reassign Cattle to Another
 * Pen: {@link PenMoveService#move}. Only the repositories, the access check, the pen service, the audit log and the
 * entity manager are mocks; the placement, occupancy, reception-criteria and cattle-guard rules run for real on top
 * of them. The farm clock is fixed at 27/11/2026 10:00 (UTC+7). Pen A-01 (10 places, 4 used) holds the cattle from
 * 01/11/2026; pen B-01 has 5 places.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PenMoveServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final LocalDate PLACED = LocalDate.of(2026, 11, 1);
    private static final long FARM_ID = 501L;

    @Mock FarmAccessService access;
    @Mock PenService penService;
    @Mock PenRepository pens;
    @Mock PenAssignmentRepository assignments;
    @Mock PenCriteriaVersionRepository criteria;
    @Mock GrowthRepository growth;
    @Mock HerdExitRepository exits;
    @Mock CattleRepository cattleRepository;
    @Mock FarmMembershipRepository memberships;
    @Mock ReminderRepository reminders;
    @Mock AuditService audit;
    @Mock EntityManager entityManager;

    private PenMoveService service;
    private Farm farm;
    private AppUser manager;
    private Pen a01;
    private Pen b01;
    private final Map<Long, Pen> penById = new HashMap<>();
    private final Map<Long, Integer> headcount = new HashMap<>();
    private final Map<Long, Cattle> cattleById = new HashMap<>();
    private final Map<Long, PenAssignment> openById = new HashMap<>();
    private final Map<Long, PenCriteriaVersion> criteriaByPen = new HashMap<>();
    private final List<PenAssignment> saved = new ArrayList<>();

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        PenOccupancyService occupancy = new PenOccupancyService(pens, assignments);
        ReceptionCriteriaService reception = new ReceptionCriteriaService(criteria, growth);
        PenAssignmentService placements = new PenAssignmentService(assignments, criteria, occupancy, reception, clock);
        CattleGuardService guard = new CattleGuardService(exits, cattleRepository, clock);
        service = new PenMoveService(access, clock, penService, occupancy, placements, reception, guard, cattleRepository, memberships,
            criteria, reminders, audit, entityManager);

        farm = new Farm();
        farm.setId(FARM_ID);
        manager = new AppUser();
        manager.setId(31L);
        manager.setFullName("Nguyen Thanh An");
        a01 = pen(11L, "A-01", 10, ActiveStatus.ACTIVE, 4);
        b01 = pen(12L, "B-01", 5, ActiveStatus.ACTIVE, 0);
        when(access.require(FARM_ID, FarmAction.MOVE_CATTLE)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        when(penService.findPen(eq(FARM_ID), anyLong())).thenAnswer(inv -> penById.get(inv.<Long>getArgument(1)));
        when(cattleRepository.lockByIdAndFarmId(eq(FARM_ID), anyLong())).thenAnswer(inv -> Optional.ofNullable(cattleById.get(inv.<Long>getArgument(1))));
        when(exits.findFirstByCattleIdAndStatus(anyLong(), eq(ExitLineStatus.PENDING))).thenReturn(Optional.empty());
        when(assignments.findFirstByCattleIdAndToDateIsNull(anyLong())).thenAnswer(inv ->
            Optional.ofNullable(openById.get(inv.<Long>getArgument(0))).filter(a -> a.getToDate() == null));
        when(pens.lockAllByFarmIdAndIdIn(eq(FARM_ID), anyList())).thenAnswer(inv ->
            inv.<List<Long>>getArgument(1).stream().map(penById::get).filter(java.util.Objects::nonNull).toList());
        when(assignments.countOpenGroupedByPen(anyCollection())).thenAnswer(inv -> {
            List<Object[]> rows = new ArrayList<>();
            inv.<Collection<Long>>getArgument(0).forEach(id -> rows.add(new Object[] { id, (long) headcount.getOrDefault(id, 0) }));
            return rows;
        });
        when(assignments.countByPenIdAndToDateIsNull(anyLong())).thenAnswer(inv -> (long) headcount.getOrDefault(inv.<Long>getArgument(0), 0));
        when(criteria.findFirstByPenIdOrderByVersionNoDesc(anyLong())).thenAnswer(inv -> Optional.ofNullable(criteriaByPen.get(inv.<Long>getArgument(0))));
        when(growth.findFirstByCattleIdAndStatusNotOrderByCheckDateDescEntryTimeDesc(anyLong(), eq("EXCLUDED"))).thenReturn(Optional.empty());
        when(assignments.existsOverlappingFrom(anyLong(), any())).thenReturn(false);
        AtomicLong ids = new AtomicLong(8000);
        when(assignments.saveAndFlush(any(PenAssignment.class))).thenAnswer(inv -> {
            PenAssignment a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(ids.incrementAndGet());
                saved.add(a);
            }
            return a;
        });
        when(reminders.findAllByFarmIdAndCattleIdInAndRuleTypeAndStatus(anyLong(), anyCollection(), eq("REM-08"), eq("ACTIVE"))).thenReturn(List.of());
    }

    private Pen pen(long id, String code, int capacity, ActiveStatus status, int used) {
        Pen pen = new Pen();
        pen.setId(id);
        pen.setFarm(farm);
        pen.setCode(code);
        pen.setName("Chuong " + code);
        pen.setCapacity(capacity);
        pen.setStatus(status);
        penById.put(id, pen);
        headcount.put(id, used);
        return pen;
    }

    private Cattle cattle(long id, Sex sex, int version, Pen in) {
        Cattle c = new Cattle();
        c.setId(id);
        c.setFarm(farm);
        c.setDisplayCode("BO-0" + id);
        c.setSex(sex);
        c.setHerdStatus(HerdStatus.ACTIVE);
        c.setVersion(version);
        cattleById.put(id, c);
        PenAssignment open = new PenAssignment();
        open.setId(7000L + id);
        open.setFarm(farm);
        open.setCattle(c);
        open.setPen(in);
        open.setFromDate(PLACED);
        open.setSource(AssignmentSource.HERD_ENTRY);
        openById.put(id, open);
        return c;
    }

    private static PenMoveRequest move(List<Long> ids, Pen to, LocalDate date, String reason, Map<Long, String> warnings, Map<Long, Integer> versions) {
        return new PenMoveRequest(ids, to.getId(), date, reason, warnings, versions, null);
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    private void assertNothingWritten() {
        assertThat(saved).isEmpty();
        assertThat(openById.values()).allSatisfy(a -> assertThat(a.getToDate()).isNull());
        verifyNoInteractions(audit);
        verify(entityManager, never()).lock(any(), any(LockModeType.class));
    }

    @Test
    void tc0415MovingOneCattleClosesTheOldPlacementAndOpensTheNewOneOnTheSameDate() {
        Cattle x = cattle(101L, Sex.MALE, 3, a01);
        LocalDate moveDate = LocalDate.of(2026, 11, 5);

        PenMoveResultDTO result = service.move(FARM_ID, move(List.of(101L), b01, moveDate, "  Tach dan  ", null, Map.of(101L, 3)));

        assertThat(openById.get(101L).getToDate()).isEqualTo(moveDate);
        assertThat(saved).singleElement().satisfies(a -> {
            assertThat(a.getPen()).isSameAs(b01);
            assertThat(a.getFromDate()).isEqualTo(moveDate);
            assertThat(a.getToDate()).isNull();
            assertThat(a.getSource()).isEqualTo(AssignmentSource.MOVE);
            assertThat(a.getReason()).isEqualTo("Tach dan");
            assertThat(a.getMovedBy()).isSameAs(manager);
        });
        assertThat(result.moved()).singleElement().satisfies(m -> {
            assertThat(m.fromPenCode()).isEqualTo("A-01");
            assertThat(m.toPenCode()).isEqualTo("B-01");
            assertThat(m.source()).isEqualTo("MOVE");
        });
        assertThat(result.skipped()).isEmpty();
        assertThat(result.message().code()).isEqualTo(MessageCodes.FE04_08);
        assertThat(result.message().params()).containsEntry("moved", 1).containsEntry("pen_code", "B-01");
        verify(entityManager).lock(x, LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        verify(audit).log(any(FarmContext.class), eq("PEN_MOVE"), eq("Cattle"), eq(101L), anyMap());
    }

    @Test
    void tc0410AnInactiveDestinationBlocksTheMove() {
        cattle(101L, Sex.MALE, 3, a01);
        b01.setStatus(ActiveStatus.INACTIVE);

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, Map.of(101L, 3))));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("pen_code", "B-01").containsEntry("count", 1).containsEntry("free", 0);
        assertNothingWritten();
    }

    @Test
    void tc0411ThreeCattleDoNotFitIntoTwoFreePlaces() {
        cattle(101L, Sex.MALE, 3, a01);
        cattle(102L, Sex.MALE, 0, a01);
        cattle(103L, Sex.MALE, 1, a01);
        headcount.put(12L, 3);

        Throwable thrown = catchThrowable(() ->
            service.move(FARM_ID, move(List.of(101L, 102L, 103L), b01, null, "Tach dan", null, Map.of(101L, 3, 102L, 0, 103L, 1))));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("count", 3).containsEntry("free", 2);
        assertNothingWritten();
    }

    @Test
    void tcAnnt040301TwoCattleFillTheLastTwoFreePlaces() {
        cattle(101L, Sex.MALE, 3, a01);
        cattle(102L, Sex.MALE, 0, a01);
        headcount.put(12L, 3);

        PenMoveResultDTO result = service.move(FARM_ID, move(List.of(102L, 101L), b01, null, "Tach dan", null, Map.of(101L, 3, 102L, 0)));

        assertThat(result.moved()).extracting(PenMoveResultDTO.Moved::cattleId).containsExactly(101L, 102L);
        assertThat(saved).hasSize(2).allSatisfy(a -> assertThat(a.getFromDate()).isEqualTo(TODAY));
    }

    @Test
    void tc0412AnUnmetCriterionWithoutAWarningReasonIsBlocked() {
        cattle(101L, Sex.MALE, 3, a01);
        criteriaByPen.put(12L, femaleOnly());

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", Map.of(101L, "   "), Map.of(101L, 3))));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_06);
        assertThat(((DomainException) thrown).getParams())
            .containsEntry("cattle_code", "BO-0101")
            .containsEntry("pen_code", "B-01")
            .containsEntry("criteria", "SEX (MALE, expected FEMALE)");
        assertNothingWritten();
    }

    private PenCriteriaVersion femaleOnly() {
        PenCriteriaVersion v = new PenCriteriaVersion();
        v.setId(9122L);
        v.setPen(b01);
        v.setVersionNo(2);
        v.setSex(Sex.FEMALE);
        when(criteria.getReferenceById(9122L)).thenReturn(v);
        return v;
    }

    @Test
    void tc0413WithAWarningReasonTheMoveGoesAheadAndTheReasonIsStoredWithTheNewPlacement() {
        cattle(101L, Sex.MALE, 3, a01);
        PenCriteriaVersion v2 = femaleOnly();
        criteriaByPen.put(12L, v2);

        service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", Map.of(101L, "  Tam giu cho cach ly  "), Map.of(101L, 3)));

        assertThat(saved).singleElement().satisfies(a -> {
            assertThat(a.getWarningReason()).isEqualTo("Tam giu cho cach ly");
            assertThat(a.getCriteriaVersion()).isSameAs(v2);
            assertThat(a.getReceptionCheck()).contains("NOT_MET");
        });
    }

    @Test
    void tc0414ADateBeforeTheCurrentPlacementOrInTheFutureIsRejected() {
        cattle(101L, Sex.MALE, 3, a01);

        Throwable before = catchThrowable(() ->
            service.move(FARM_ID, move(List.of(101L), b01, LocalDate.of(2026, 10, 31), "Tach dan", null, Map.of(101L, 3))));
        Throwable tomorrow = catchThrowable(() ->
            service.move(FARM_ID, move(List.of(101L), b01, TODAY.plusDays(1), "Tach dan", null, Map.of(101L, 3))));

        assertDomain(before, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_09);
        assertThat(((DomainException) before).getParams()).containsEntry("start_date", PLACED);
        assertDomain(tomorrow, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_09);
        assertNothingWritten();
    }

    @Test
    void tc0414TheFirstDayOfThePlacementAndTodayAreAccepted() {
        cattle(101L, Sex.MALE, 3, a01);
        cattle(102L, Sex.MALE, 0, a01);

        service.move(FARM_ID, move(List.of(101L), b01, PLACED, "Tach dan", null, Map.of(101L, 3)));
        service.move(FARM_ID, move(List.of(102L), b01, null, "Tach dan", null, Map.of(102L, 0)));

        assertThat(saved).extracting(PenAssignment::getFromDate).containsExactly(PLACED, TODAY);
        assertThat(openById.get(101L).getToDate()).isEqualTo(PLACED);
        assertThat(openById.get(102L).getToDate()).isEqualTo(TODAY);
    }

    @Test
    void tc0417ACattleAlreadyInTheDestinationIsSkippedAndTheOthersMove() {
        cattle(101L, Sex.MALE, 3, a01);
        cattle(102L, Sex.FEMALE, 0, a01);
        cattle(103L, Sex.FEMALE, 5, b01);
        headcount.put(12L, 3);

        PenMoveResultDTO result = service.move(FARM_ID,
            move(List.of(101L, 102L, 103L), b01, null, "Tach dan", null, Map.of(101L, 3, 102L, 0, 103L, 5)));

        assertThat(result.moved()).extracting(PenMoveResultDTO.Moved::cattleId).containsExactly(101L, 102L);
        assertThat(result.skipped()).singleElement().satisfies(s -> {
            assertThat(s.cattleId()).isEqualTo(103L);
            assertThat(s.message().code()).isEqualTo(MessageCodes.FE04_07);
            assertThat(s.message().params()).containsEntry("cattle_code", "BO-0103").containsEntry("pen_code", "B-01");
        });
        assertThat(result.message().params()).containsEntry("moved", 2);
        assertThat(openById.get(103L).getToDate()).isNull();
    }

    @Test
    void tc0418AnExitedCattleCannotMove() {
        Cattle x = cattle(101L, Sex.MALE, 3, a01);
        x.setHerdStatus(HerdStatus.EXITED);
        x.setExitDate(LocalDate.of(2026, 11, 20));
        x.setExitType(ExitType.SALE);

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, Map.of(101L, 3))));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_13);
        assertThat(((DomainException) thrown).getParams()).containsEntry("cattle_code", "BO-0101");
        assertNothingWritten();
    }

    @Test
    void tc0419ACattleOnAPendingDeathVoucherCannotMove() {
        cattle(101L, Sex.MALE, 3, a01);
        HerdExitVoucher voucher = new HerdExitVoucher();
        voucher.setId(61L);
        voucher.setExitType(ExitType.DEATH);
        voucher.setLossKind(LossKind.DIED);
        voucher.setExitDate(LocalDate.of(2026, 11, 25));
        HerdExit line = new HerdExit();
        line.setVoucher(voucher);
        line.setStatus(ExitLineStatus.PENDING);
        when(exits.findFirstByCattleIdAndStatus(101L, ExitLineStatus.PENDING)).thenReturn(Optional.of(line));

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, Map.of(101L, 3))));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_17);
        assertThat(((DomainException) thrown).getParams()).containsEntry("loss_kind", LossKind.DIED);
        assertNothingWritten();
    }

    @Test
    void tc0420ACorrectionMoveBackIsAnotherSegmentWithSourceCorrection() {
        cattle(101L, Sex.MALE, 3, a01);
        openById.get(101L).setPen(b01);

        PenMoveResultDTO result = service.move(FARM_ID, move(List.of(101L), a01, null, "Correction", null, Map.of(101L, 3)));

        assertThat(saved).singleElement().satisfies(a -> {
            assertThat(a.getPen()).isSameAs(a01);
            assertThat(a.getSource()).isEqualTo(AssignmentSource.CORRECTION);
        });
        assertThat(result.moved().get(0).source()).isEqualTo("CORRECTION");
        assertThat(openById.get(101L).getToDate()).isEqualTo(TODAY);
        verify(assignments, never()).delete(any());
        verify(assignments, never()).deleteById(any());
    }

    @Test
    void tc0421MovingResolvesTheActivePenMoveSuggestion() {
        cattle(101L, Sex.MALE, 3, a01);
        Reminder rem08 = new Reminder();
        rem08.setId(44L);
        rem08.setRuleType("REM-08");
        rem08.setStatus("ACTIVE");
        when(reminders.findAllByFarmIdAndCattleIdInAndRuleTypeAndStatus(FARM_ID, List.of(101L), "REM-08", "ACTIVE")).thenReturn(List.of(rem08));

        service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, Map.of(101L, 3)));

        assertThat(rem08.getStatus()).isEqualTo("RESOLVED");
        verify(reminders).saveAll(List.of(rem08));
    }

    @Test
    void tc0426AStaleCattleVersionIsAConflictNamingTheCattleAndItsPen() {
        cattle(101L, Sex.MALE, 3, a01);

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, Map.of(101L, 2))));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams())
            .containsEntry("cattle_code", "BO-0101")
            .containsEntry("pen_code", "A-01")
            .containsEntry("expected", 2)
            .containsEntry("actual", 3);
        assertNothingWritten();
    }

    @Test
    void tcAnnt040302AMissingCattleVersionIsAConflict() {
        cattle(101L, Sex.MALE, 3, a01);

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, null)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "expected_version_required");
        assertNothingWritten();
    }

    @Test
    void tcAnnt040303TheMoveReasonIsRequired() {
        cattle(101L, Sex.MALE, 3, a01);

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "   ", null, Map.of(101L, 3))));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "reason");
        verify(cattleRepository, never()).lockByIdAndFarmId(anyLong(), anyLong());
    }

    @Test
    void tcAnnt040304AReasonOf501CharactersIsRejectedAnd500IsAccepted() {
        cattle(101L, Sex.MALE, 3, a01);

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "x".repeat(501), null, Map.of(101L, 3))));
        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(saved).isEmpty();

        service.move(FARM_ID, move(List.of(101L), b01, null, "x".repeat(500), null, Map.of(101L, 3)));
        assertThat(saved).singleElement().satisfies(a -> assertThat(a.getReason()).hasSize(500));
    }

    @Test
    void tcAnnt040305TheMoveCanBeRecordedForAnotherActiveMember() {
        cattle(101L, Sex.MALE, 3, a01);
        AppUser technician = new AppUser();
        technician.setId(33L);
        FarmMembership membership = new FarmMembership();
        membership.setUser(technician);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(FARM_ID, 33L, FarmAccessService.ACTIVE)).thenReturn(Optional.of(membership));

        service.move(FARM_ID, new PenMoveRequest(List.of(101L), 12L, null, "Tach dan", null, Map.of(101L, 3), 33L));

        assertThat(saved).singleElement().satisfies(a -> assertThat(a.getMovedBy()).isSameAs(technician));
    }

    @Test
    void tcAnnt040306APerformerWhoIsNotAnActiveMemberIsRejected() {
        cattle(101L, Sex.MALE, 3, a01);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(FARM_ID, 99L, FarmAccessService.ACTIVE)).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() ->
            service.move(FARM_ID, new PenMoveRequest(List.of(101L), 12L, null, "Tach dan", null, Map.of(101L, 3), 99L)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "performedBy");
        assertNothingWritten();
    }

    @Test
    void tcAnnt040307WhenEveryCattleIsAlreadyThereNothingMovesAndNoPlaceIsNeeded() {
        cattle(103L, Sex.FEMALE, 5, b01);
        headcount.put(12L, 5);

        PenMoveResultDTO result = service.move(FARM_ID, move(List.of(103L), b01, null, "Tach dan", null, Map.of(103L, 5)));

        assertThat(result.moved()).isEmpty();
        assertThat(result.skipped()).hasSize(1);
        assertThat(result.message()).isNull();
        assertNothingWritten();
        verify(reminders, never()).saveAll(any());
    }

    @Test
    void tc0423ATechnicianCannotMoveCattle() {
        when(access.require(FARM_ID, FarmAction.MOVE_CATTLE)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> service.move(FARM_ID, move(List.of(101L), b01, null, "Tach dan", null, Map.of(101L, 3))));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verifyNoInteractions(cattleRepository, pens, audit);
    }
}
