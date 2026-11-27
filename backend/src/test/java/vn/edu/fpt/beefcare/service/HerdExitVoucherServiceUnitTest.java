package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.GrowthRepository;
import vn.edu.fpt.beefcare.repository.HealthCaseRepository;
import vn.edu.fpt.beefcare.repository.HerdExitQueryRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.HerdExitVoucherRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.repository.ScheduledDoseRepository;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.HerdExitCheckService.Collected;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherRequests;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of the FE-13 use cases (D88 numbering):
 * UC-FE13-01 Record and Confirm Herd Exit Voucher ({@link HerdExitVoucherService#confirm}), UC-FE13-02 View Herd Exit
 * Vouchers ({@link HerdExitVoucherService#list}) and UC-FE13-03 Void Herd Exit Voucher
 * ({@link HerdExitVoucherService#voidVoucher}). The exit checks (what each cattle has open) and the placement service
 * are mocks; the cattle guard, the pen occupancy and the reception criteria run for real over mocked repositories. The
 * farm clock is fixed at 27/11/2026 10:00 (UTC+7); sale voucher PX-2611-004 is dated 20/11/2026.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HerdExitVoucherServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final LocalDate EXIT_DATE = LocalDate.of(2026, 11, 20);
    private static final long FARM_ID = 501L;

    @Mock FarmAccessService access;
    @Mock HerdExitVoucherRepository vouchers;
    @Mock HerdExitRepository lines;
    @Mock CattleRepository cattleRepository;
    @Mock CattleQrTagRepository qrTags;
    @Mock TradingPartnerRepository partners;
    @Mock PenRepository penRepository;
    @Mock PenAssignmentRepository assignmentRepository;
    @Mock PenCriteriaVersionRepository criteriaVersions;
    @Mock GrowthRepository growth;
    @Mock HealthCaseRepository healthCases;
    @Mock ScheduledDoseRepository doses;
    @Mock ReminderRepository reminders;
    @Mock VoucherPaymentRepository paymentRepository;
    @Mock HerdExitQueryRepository queries;
    @Mock PenAssignmentService penAssignments;
    @Mock CodeSequenceService codes;
    @Mock AuditService audit;
    @Mock RecordRevisionService revisions;
    @Mock VoucherPaymentService payments;
    @Mock HerdExitCheckService checks;
    @Mock HealthCaseReopener reopener;

    private HerdExitVoucherService service;
    private Farm farm;
    private AppUser owner;
    private TradingPartner buyer;
    private Pen a01;
    private HerdExitVoucher voucher;
    private final List<HerdExit> voucherLines = new ArrayList<>();
    private final Map<Long, Cattle> cattleById = new HashMap<>();
    private final Map<Long, Collected> collected = new HashMap<>();
    private final Map<Long, Integer> headcount = new HashMap<>();
    private final Map<Long, Pen> penById = new HashMap<>();

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service = new HerdExitVoucherService(access, clock, vouchers, lines, cattleRepository, qrTags, partners, penRepository, healthCases, doses,
            reminders, paymentRepository, queries, new CattleGuardService(lines, cattleRepository, clock), penAssignments,
            new PenOccupancyService(penRepository, assignmentRepository), new ReceptionCriteriaService(criteriaVersions, growth), codes, audit,
            revisions, payments, checks, reopener);
        farm = new Farm();
        farm.setId(FARM_ID);
        owner = new AppUser();
        owner.setId(31L);
        owner.setFullName("Nguyen Thanh An");
        buyer = new TradingPartner();
        buyer.setId(45L);
        buyer.setName("Thuong lai Hoa");
        buyer.setBuyer(true);
        buyer.setStatus(ActiveStatus.ACTIVE);
        a01 = pen(11L, "A-01", 10, ActiveStatus.ACTIVE, 7);

        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
        when(vouchers.lockByIdAndFarmId(FARM_ID, 71L)).thenAnswer(inv -> Optional.ofNullable(voucher));
        when(lines.findAllByVoucherIdAndStatusNotOrderByLineNoAsc(71L, ExitLineStatus.REMOVED)).thenAnswer(inv -> voucherLines);
        when(cattleRepository.lockAllByFarmIdAndIdIn(eq(FARM_ID), anyList())).thenAnswer(inv ->
            inv.<List<Long>>getArgument(1).stream().map(cattleById::get).filter(java.util.Objects::nonNull).toList());
        when(lines.findFirstByCattleIdAndStatusIn(anyLong(), anyCollection())).thenAnswer(inv ->
            voucherLines.stream().filter(l -> l.getCattle().getId().equals(inv.getArgument(0))).findFirst());
        when(lines.findAllByCattleIdAndStatusIn(anyLong(), anyCollection())).thenAnswer(inv ->
            voucherLines.stream().filter(l -> l.getCattle().getId().equals(inv.getArgument(0))).toList());
        when(checks.earliestExitDate(anyCollection())).thenReturn(Optional.empty());
        when(checks.collect(any(Cattle.class), any(LocalDate.class))).thenAnswer(inv -> collected.computeIfAbsent(inv.<Cattle>getArgument(0).getId(),
            id -> new Collected(cattleById.get(id), a01, null, List.of(), List.of(), List.of(), null, List.of())));
        when(checks.message(anyString(), any(Object[].class))).thenAnswer(inv -> {
            Object[] raw = inv.getRawArguments();
            Object[] kv = raw.length == 2 && raw[1] instanceof Object[] array ? array : Arrays.copyOfRange(raw, 1, raw.length);
            return new ExitVoucherDTO.Message((String) raw[0], DomainException.params(kv), null);
        });
        when(penAssignments.closeAssignment(any(Cattle.class), any(LocalDate.class))).thenAnswer(inv -> {
            PenAssignment closed = new PenAssignment();
            closed.setPen(a01);
            closed.setFromDate(LocalDate.of(2026, 10, 1));
            closed.setToDate(inv.getArgument(1));
            return closed;
        });
        when(penRepository.lockAllByFarmIdAndIdIn(eq(FARM_ID), anyList())).thenAnswer(inv ->
            inv.<List<Long>>getArgument(1).stream().map(penById::get).filter(java.util.Objects::nonNull).toList());
        when(assignmentRepository.countOpenGroupedByPen(anyCollection())).thenAnswer(inv -> {
            List<Object[]> rows = new ArrayList<>();
            inv.<Collection<Long>>getArgument(0).forEach(id -> rows.add(new Object[] { id, (long) headcount.getOrDefault(id, 0) }));
            return rows;
        });
        when(queries.activeReminder(anyLong(), anyString(), anyString())).thenReturn(Optional.empty());
    }

    private Pen pen(long id, String code, int capacity, ActiveStatus status, int used) {
        Pen p = new Pen();
        p.setId(id);
        p.setFarm(farm);
        p.setCode(code);
        p.setCapacity(capacity);
        p.setStatus(status);
        penById.put(id, p);
        headcount.put(id, used);
        return p;
    }

    private HerdExitVoucher sale(ExitVoucherStatus status, int cattle) {
        voucher = new HerdExitVoucher();
        voucher.setId(71L);
        voucher.setFarm(farm);
        voucher.setCode("PX-2611-004");
        voucher.setExitType(ExitType.SALE);
        voucher.setExitDate(EXIT_DATE);
        voucher.setBuyer(buyer);
        voucher.setPricingBasis(PricingBasis.PER_KG);
        voucher.setCattleAmount(0L);
        voucher.setDeductions(500_000L);
        voucher.setAmountCollected(10_000_000L);
        voucher.setPaymentMethod(PaymentMethod.CASH);
        voucher.setStatus(status);
        voucher.setReportedBy(owner);
        voucher.setCreatedAt(Instant.parse("2026-11-20T01:00:00Z"));
        voucher.setVersion(4);
        for (int i = 1; i <= cattle; i++) {
            line(100L + i, status == ExitVoucherStatus.CONFIRMED ? ExitLineStatus.CONFIRMED : ExitLineStatus.DRAFT);
        }
        return voucher;
    }

    private HerdExit line(long cattleId, ExitLineStatus status) {
        Cattle c = new Cattle();
        c.setId(cattleId);
        c.setFarm(farm);
        c.setDisplayCode("BO-0" + cattleId);
        c.setSex(Sex.MALE);
        c.setHerdStatus(status == ExitLineStatus.CONFIRMED ? HerdStatus.EXITED : HerdStatus.ACTIVE);
        cattleById.put(cattleId, c);
        HerdExit l = new HerdExit();
        l.setId(500L + cattleId);
        l.setFarm(farm);
        l.setVoucher(voucher);
        l.setLineNo(voucherLines.size() + 1);
        l.setCattle(c);
        l.setExitWeightKg(new BigDecimal("450"));
        l.setUnitPrice(70_000L);
        l.setStatus(status);
        if (status == ExitLineStatus.CONFIRMED) {
            l.setLastPen(a01);
        }
        voucherLines.add(l);
        return l;
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    // ------------------------------------------------------------------ UC-FE13-01 confirm()

    private ExitVoucherDTO.ConfirmResult confirm(Boolean acknowledged, Integer version) {
        return service.confirm(FARM_ID, 71L, new ExitVoucherRequests.Confirm(acknowledged, version), "idem-71");
    }

    private void assertNothingConfirmed() {
        assertThat(cattleById.values()).allSatisfy(c -> assertThat(c.getHerdStatus()).isNotEqualTo(HerdStatus.EXITED));
        assertThat(voucher.getStatus()).isNotEqualTo(ExitVoucherStatus.CONFIRMED);
        verify(penAssignments, never()).closeAssignment(any(), any());
        verifyNoInteractions(audit, payments);
    }

    @Test
    void tc1308ConfirmingExitsEveryCattleAndClosesWhatIsStillOpenForThem() {
        sale(ExitVoucherStatus.DRAFT, 3);
        HealthCase openCase = new HealthCase();
        openCase.setId(61L);
        openCase.setStatus("OPEN");
        ScheduledDose futureDose = new ScheduledDose();
        futureDose.setId(62L);
        futureDose.setStatus("PLANNED");
        Reminder reminder = new Reminder();
        reminder.setId(63L);
        reminder.setStatus("ACTIVE");
        PregnancyEpisode pregnancy = new PregnancyEpisode();
        pregnancy.setId(64L);
        pregnancy.setStatus("OPEN");
        collected.put(101L, new Collected(cattleById.get(101L), a01, null, List.of(openCase), List.of(), List.of(), null, List.of()));
        collected.put(102L, new Collected(cattleById.get(102L), a01, null, List.of(), List.of(futureDose), List.of(reminder), null, List.of()));
        collected.put(103L, new Collected(cattleById.get(103L), a01, null, List.of(), List.of(), List.of(), pregnancy, List.of()));

        ExitVoucherDTO.ConfirmResult result = confirm(true, 4);

        assertThat(cattleById.values()).allSatisfy(c -> {
            assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.EXITED);
            assertThat(c.getExitType()).isEqualTo(ExitType.SALE);
            assertThat(c.getExitDate()).isEqualTo(EXIT_DATE);
            verify(penAssignments).closeAssignment(c, EXIT_DATE);
        });
        assertThat(voucherLines).allSatisfy(l -> {
            assertThat(l.getStatus()).isEqualTo(ExitLineStatus.CONFIRMED);
            assertThat(l.getLastPen()).isSameAs(a01);
        });
        assertThat(openCase.getStatus()).isEqualTo("CLOSED");
        assertThat(openCase.getOutcome()).isEqualTo("CLOSED_BY_EXIT");
        assertThat(openCase.getClosedDate()).isEqualTo(EXIT_DATE);
        assertThat(futureDose.getStatus()).isEqualTo("CANCELLED");
        assertThat(reminder.getStatus()).isEqualTo("CANCELLED");
        assertThat(pregnancy.getStatus()).isEqualTo("LOST");
        assertThat(pregnancy.getCloseReason()).isEqualTo("DAM_EXITED");
        assertThat(voucher.getStatus()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(voucher.getConfirmedBy()).isSameAs(owner);
        assertThat(voucher.getConfirmedAt()).isEqualTo(NOW);
        assertThat(result.repeated()).isFalse();
        assertThat(result.effects()).hasSize(3);
        assertThat(result.message().code()).isEqualTo(MessageCodes.FE13_02);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> details = ArgumentCaptor.forClass(Map.class);
        verify(audit).log(any(FarmContext.class), eq("EXIT_CONFIRM"), eq("HerdExitVoucher"), eq(71L), details.capture());
        assertThat(details.getValue()).containsEntry("idempotencyKey", "idem-71");
    }

    @Test
    void tc1310ADraftCalfOfAnExitedDamStaysPendingConfirmation() {
        sale(ExitVoucherStatus.DRAFT, 1);
        CalfOutcome calf = new CalfOutcome();
        calf.setId(65L);
        calf.setRegistrationState("PENDING_CONFIRMATION");
        collected.put(101L, new Collected(cattleById.get(101L), a01, null, List.of(), List.of(), List.of(), null, List.of(calf)));

        ExitVoucherDTO.ConfirmResult result = confirm(true, 4);

        assertThat(calf.getRegistrationState()).isEqualTo("PENDING_CONFIRMATION");
        assertThat(result.effects().get(0).pendingCalfIds()).containsExactly(65L);
    }

    @Test
    void tc1315AnOutstandingAmountIsWhatIsLeftAfterDeductionsAndTheDeposit() {
        sale(ExitVoucherStatus.DRAFT, 1);
        when(paymentRepository.sumByExitVoucher(71L, PaymentRecordStatus.RECORDED)).thenReturn(10_000_000L);

        ExitVoucherDTO.ConfirmResult result = confirm(true, 4);

        assertThat(voucherLines.get(0).getLineAmount()).isEqualTo(31_500_000L);
        assertThat(voucher.getCattleAmount()).isEqualTo(31_500_000L);
        assertThat(voucher.getTotalReceivable()).isEqualTo(31_000_000L);
        verify(payments).recordInitialCollection(any(FarmContext.class), eq(voucher), eq(10_000_000L), eq(PaymentMethod.CASH), any());
        assertThat(result.voucher().payment().outstanding()).isEqualTo(21_000_000L);
    }

    @Test
    void tc1307ConfirmingWithoutTickingTheAcknowledgementIsRejected() {
        sale(ExitVoucherStatus.DRAFT, 2);

        assertDomain(catchThrowable(() -> confirm(false, 4)), HttpStatus.BAD_REQUEST, MessageCodes.COM_16);
        assertDomain(catchThrowable(() -> confirm(null, 4)), HttpStatus.BAD_REQUEST, MessageCodes.COM_16);
        assertNothingConfirmed();
    }

    @Test
    void tc1309ACattleAlreadyExitedByAnotherVoucherStopsTheWholeConfirmation() {
        sale(ExitVoucherStatus.DRAFT, 3);
        cattleById.get(102L).setHerdStatus(HerdStatus.EXITED);

        Throwable thrown = catchThrowable(() -> confirm(true, 4));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("cattle_code", "BO-0102");
        assertThat(cattleById.get(101L).getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        assertThat(cattleById.get(103L).getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        verifyNoInteractions(audit, payments);
    }

    @Test
    void tcAnnt130101ACattleWhoseOpenExitLineIsOnAnotherVoucherIsAConflict() {
        sale(ExitVoucherStatus.DRAFT, 1);
        HerdExit elsewhere = new HerdExit();
        elsewhere.setId(999L);
        when(lines.findFirstByCattleIdAndStatusIn(eq(101L), anyCollection())).thenReturn(Optional.of(elsewhere));

        assertDomain(catchThrowable(() -> confirm(true, 4)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingConfirmed();
    }

    @Test
    void tc1304AnExitDateBeforeTheLatestEventOrInTheFutureIsRejected() {
        sale(ExitVoucherStatus.DRAFT, 1);
        LocalDate weighed = LocalDate.of(2026, 11, 5);
        when(checks.earliestExitDate(anyCollection())).thenReturn(Optional.of(weighed));

        voucher.setExitDate(LocalDate.of(2026, 11, 4));
        Throwable before = catchThrowable(() -> confirm(true, 4));
        voucher.setExitDate(TODAY.plusDays(1));
        Throwable tomorrow = catchThrowable(() -> confirm(true, 4));

        assertDomain(before, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE13_03);
        assertThat(((DomainException) before).getParams()).containsEntry("earliest_date", weighed);
        assertDomain(tomorrow, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE13_03);
        assertNothingConfirmed();
    }

    @Test
    void tcAnnt130102WithoutAnyEventAFutureExitDateIsStillRejected() {
        sale(ExitVoucherStatus.DRAFT, 1);
        voucher.setExitDate(TODAY.plusDays(1));

        assertDomain(catchThrowable(() -> confirm(true, 4)), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_07);
        voucher.setExitDate(TODAY);
        confirm(true, 4);
        assertThat(voucher.getStatus()).isEqualTo(ExitVoucherStatus.CONFIRMED);
    }

    @Test
    void tc1305ASaleNeedsABuyerAndAnOtherExitNeedsADestination() {
        sale(ExitVoucherStatus.DRAFT, 1);
        voucher.setBuyer(null);
        Throwable noBuyer = catchThrowable(() -> confirm(true, 4));
        voucher.setExitType(ExitType.OTHER);
        voucher.setDestination("  ");
        Throwable noDestination = catchThrowable(() -> confirm(true, 4));

        assertDomain(noBuyer, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) noBuyer).getParams()).containsEntry("field", "buyerId");
        assertThat(((DomainException) noDestination).getParams()).containsEntry("field", "destination");
        assertNothingConfirmed();
    }

    @Test
    void tcAnnt130103APerKgVoucherNeedsTheExitWeightOfEveryCattle() {
        sale(ExitVoucherStatus.DRAFT, 2);
        voucherLines.get(1).setExitWeightKg(null);

        Throwable thrown = catchThrowable(() -> confirm(true, 4));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "exitWeightKg").containsEntry("cattle_code", "BO-0102");
        assertNothingConfirmed();
    }

    @Test
    void tc1316DeductionsAboveTheCattleAmountOrADepositAboveTheTotalAreRejected() {
        sale(ExitVoucherStatus.DRAFT, 1);
        voucher.setDeductions(31_500_001L);
        Throwable deductions = catchThrowable(() -> confirm(true, 4));
        voucher.setDeductions(500_000L);
        voucher.setAmountCollected(31_000_001L);
        Throwable deposit = catchThrowable(() -> confirm(true, 4));

        assertDomain(deductions, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) deductions).getParams()).containsEntry("field", "deductions");
        assertDomain(deposit, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_13);
        assertThat(((DomainException) deposit).getParams()).containsEntry("amount", 31_000_000L);
        assertNothingConfirmed();
    }

    @Test
    void tcAnnt130104ADepositWithoutAPaymentMethodIsRejected() {
        sale(ExitVoucherStatus.DRAFT, 1);
        voucher.setPaymentMethod(null);

        Throwable thrown = catchThrowable(() -> confirm(true, 4));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "paymentMethod");
        assertNothingConfirmed();
    }

    private void pendingDeath(LossKind kind, String cause, String disposal) {
        sale(ExitVoucherStatus.PENDING, 1);
        voucher.setExitType(ExitType.DEATH);
        voucher.setLossKind(kind);
        voucher.setBuyer(null);
        voucher.setDeathCause(cause);
        voucher.setCarcassDisposal(disposal);
        voucher.setAmountCollected(0L);
        voucher.setDeductions(0L);
        voucher.setPaymentMethod(null);
    }

    @Test
    void tc1312ConfirmingAPendingDeathExitsTheCattleAndResolvesTheOwnerReminder() {
        pendingDeath(LossKind.DIED, "Viem phoi cap", "Chon lap theo huong dan thu y");
        Reminder rem12 = new Reminder();
        rem12.setStatus("ACTIVE");
        when(queries.activeReminder(FARM_ID, "REM-12", "HerdExitVoucher:71")).thenReturn(Optional.of(rem12));

        ExitVoucherDTO.ConfirmResult result = confirm(true, 4);

        assertThat(cattleById.get(101L).getHerdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThat(cattleById.get(101L).getExitType()).isEqualTo(ExitType.DEATH);
        assertThat(rem12.getStatus()).isEqualTo("RESOLVED");
        assertThat(voucher.getCattleAmount()).isZero();
        assertThat(result.voucher().payment()).isNull();
        verifyNoInteractions(payments);
    }

    @Test
    void tcAnnt130105ALossNeedsACauseAndADeathAlsoNeedsTheCarcassDisposal() {
        pendingDeath(LossKind.DIED, null, "Chon lap");
        Throwable noCause = catchThrowable(() -> confirm(true, 4));
        voucher.setDeathCause("Viem phoi");
        voucher.setCarcassDisposal(" ");
        Throwable noDisposal = catchThrowable(() -> confirm(true, 4));

        assertThat(((DomainException) noCause).getParams()).containsEntry("field", "deathCause");
        assertThat(((DomainException) noDisposal).getParams()).containsEntry("field", "carcassDisposal");
        assertNothingConfirmed();

        voucher.setLossKind(LossKind.MISSING);
        confirm(true, 4);
        assertThat(voucher.getStatus()).isEqualTo(ExitVoucherStatus.CONFIRMED);
    }

    @Test
    void tc1324TheOwnerCanRecordADeathDirectlyWithoutAPendingVoucher() {
        sale(ExitVoucherStatus.DRAFT, 1);
        voucher.setExitType(ExitType.DEATH);
        voucher.setBuyer(null);
        voucher.setDeathCause("Sa chuong");
        voucher.setCarcassDisposal("Chon lap");
        voucher.setAmountCollected(0L);

        confirm(true, 4);

        assertThat(cattleById.get(101L).getHerdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThat(voucher.getReportedBy()).isSameAs(owner);
        verify(reminders, never()).save(any());
    }

    @Test
    void tcAnnt130106ConfirmingAgainReturnsTheFirstResultWithoutChangingAnything() {
        sale(ExitVoucherStatus.CONFIRMED, 2);

        ExitVoucherDTO.ConfirmResult result = confirm(null, null);

        assertThat(result.repeated()).isTrue();
        assertThat(result.voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        verify(penAssignments, never()).closeAssignment(any(), any());
        verifyNoInteractions(audit, payments);
    }

    @Test
    void tcAnnt130107AVoucherWithoutCattleCannotBeConfirmed() {
        sale(ExitVoucherStatus.DRAFT, 0);

        assertDomain(catchThrowable(() -> confirm(true, 4)), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_16);
    }

    @Test
    void tcAnnt130108AStaleVersionOrAClosedVoucherIsAConflict() {
        sale(ExitVoucherStatus.DRAFT, 1);
        Throwable stale = catchThrowable(() -> confirm(true, 3));
        voucher.setStatus(ExitVoucherStatus.DISMISSED);
        Throwable dismissed = catchThrowable(() -> confirm(true, 4));

        assertDomain(stale, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(dismissed, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingConfirmed();
    }

    @Test
    void tc1301AManagerCannotConfirmOrVoidAnExitVoucher() {
        sale(ExitVoucherStatus.DRAFT, 1);
        when(access.require(FARM_ID, FarmAction.MANAGE_EXIT_VOUCHERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> confirm(true, 4)), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertDomain(catchThrowable(() -> service.voidVoucher(FARM_ID, 71L, new ExitVoucherRequests.Void("Nham", null, null, 4))), HttpStatus.FORBIDDEN,
            MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_EXIT_VOUCHERS.allows(FarmRole.MANAGER)).isFalse();
        verifyNoInteractions(vouchers, audit);
    }

    // ------------------------------------------------------------------ UC-FE13-02 list()

    private HerdExitVoucher listed(long id, ExitType type, ExitVoucherStatus status, LocalDate date, long cattleAmount, long collectedAmount, int cattle) {
        HerdExitVoucher v = new HerdExitVoucher();
        v.setId(id);
        v.setFarm(farm);
        v.setCode("PX-" + id);
        v.setExitType(type);
        v.setStatus(status);
        v.setExitDate(date);
        v.setCattleAmount(cattleAmount);
        v.setDeductions(0L);
        v.setAmountCollected(collectedAmount);
        if (type == ExitType.DEATH) {
            v.setLossKind(LossKind.DIED);
        }
        List<HerdExit> ls = new ArrayList<>();
        for (int i = 0; i < cattle; i++) {
            HerdExit l = new HerdExit();
            l.setVoucher(v);
            l.setExitWeightKg(new BigDecimal("400"));
            ls.add(l);
        }
        allLines.addAll(ls);
        listedVouchers.add(v);
        return v;
    }

    private final List<HerdExitVoucher> listedVouchers = new ArrayList<>();
    private final List<HerdExit> allLines = new ArrayList<>();

    private void typicalQuarter() {
        listed(1L, ExitType.SALE, ExitVoucherStatus.CONFIRMED, LocalDate.of(2026, 11, 20), 60_000_000L, 40_000_000L, 2);
        listed(2L, ExitType.CULL, ExitVoucherStatus.CONFIRMED, LocalDate.of(2026, 11, 10), 15_000_000L, 15_000_000L, 1);
        listed(3L, ExitType.DEATH, ExitVoucherStatus.CONFIRMED, LocalDate.of(2026, 10, 5), 0L, 0L, 1);
        listed(4L, ExitType.SALE, ExitVoucherStatus.DRAFT, LocalDate.of(2026, 11, 25), 30_000_000L, 0L, 1);
        listed(5L, ExitType.DEATH, ExitVoucherStatus.PENDING, LocalDate.of(2026, 11, 26), 0L, 0L, 1);
        when(vouchers.findAllInPeriod(eq(FARM_ID), any(), any())).thenReturn(listedVouchers);
        when(lines.findAllByVoucherIdInAndStatusNot(anyCollection(), eq(ExitLineStatus.REMOVED))).thenReturn(allLines);
        when(queries.pensOfVouchers(anyCollection())).thenReturn(Map.of(1L, Set.of("A-01")));
        when(vouchers.countByFarmIdAndStatus(FARM_ID, ExitVoucherStatus.PENDING)).thenReturn(1L);
    }

    @Test
    void tcAnnt130201TheTilesCountExitedCattleRevenueAndWhatIsLeftToCollect() {
        typicalQuarter();

        ExitVoucherDTO.ListResult result = service.list(FARM_ID, null, null, null, null);

        ExitVoucherDTO.Tiles tiles = result.tiles();
        assertThat(tiles.cattleExitedByType()).containsEntry(ExitType.SALE, 2).containsEntry(ExitType.CULL, 1).containsEntry(ExitType.DEATH, 1)
            .containsEntry(ExitType.OTHER, 0);
        assertThat(tiles.cattleExited()).isEqualTo(4);
        assertThat(tiles.salesRevenue()).isEqualTo(75_000_000L);
        assertThat(tiles.toCollect()).isEqualTo(20_000_000L);
        assertThat(tiles.vouchersToCollect()).isEqualTo(1);
        assertThat(tiles.awaitingOwner()).isEqualTo(1);
        assertThat(result.statusCounts()).containsEntry("ALL", 5).containsEntry("CONFIRMED", 3).containsEntry("PENDING", 1);
        assertThat(result.vouchers()).extracting(ExitVoucherDTO.Row::id).containsExactly(1L, 2L, 3L, 4L, 5L);
    }

    @Test
    void tcAnnt130202WithoutDatesThePeriodRunsFromThePreviousQuarterStartToToday() {
        typicalQuarter();

        ExitVoucherDTO.ListResult result = service.list(FARM_ID, null, null, null, null);

        assertThat(result.from()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(result.to()).isEqualTo(TODAY);
        verify(vouchers).findAllInPeriod(FARM_ID, LocalDate.of(2026, 7, 1), TODAY);
    }

    @Test
    void tcAnnt130203StatusAndTypeFiltersNarrowTheRows() {
        typicalQuarter();

        ExitVoucherDTO.ListResult open = service.list(FARM_ID, List.of(ExitVoucherStatus.DRAFT, ExitVoucherStatus.PENDING), null, null, null);
        ExitVoucherDTO.ListResult deaths = service.list(FARM_ID, null, ExitType.DEATH, null, null);

        assertThat(open.vouchers()).extracting(ExitVoucherDTO.Row::id).containsExactly(4L, 5L);
        assertThat(open.statusCounts()).containsEntry("ALL", 5);
        assertThat(deaths.vouchers()).extracting(ExitVoucherDTO.Row::id).containsExactly(3L, 5L);
        assertThat(deaths.statusCounts()).containsEntry("ALL", 2);
    }

    @Test
    void tcAnnt130204ALossRowShowsNoMoney() {
        typicalQuarter();

        ExitVoucherDTO.ListResult result = service.list(FARM_ID, null, null, null, null);

        ExitVoucherDTO.Row death = result.vouchers().get(2);
        assertThat(death.loss()).isTrue();
        assertThat(death.totalReceivable()).isNull();
        assertThat(death.outstanding()).isNull();
        ExitVoucherDTO.Row sale = result.vouchers().get(0);
        assertThat(sale.totalReceivable()).isEqualTo(60_000_000L);
        assertThat(sale.outstanding()).isEqualTo(20_000_000L);
        assertThat(sale.pens()).containsExactly("A-01");
        assertThat(sale.totalWeightKg()).isEqualByComparingTo("800");
    }

    @Test
    void tcAnnt130205AStartAfterTheEndIsRejected() {
        Throwable thrown = catchThrowable(() -> service.list(FARM_ID, null, null, LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 19)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_11);
        verifyNoInteractions(vouchers);
    }

    @Test
    void tcAnnt130206ATechnicianCannotViewExitVouchers() {
        when(access.require(FARM_ID, FarmAction.VIEW_EXIT_VOUCHERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> service.list(FARM_ID, null, null, null, null)), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertThat(FarmAction.VIEW_EXIT_VOUCHERS.allows(FarmRole.TECHNICIAN)).isFalse();
        assertThat(FarmAction.VIEW_EXIT_VOUCHERS.allows(FarmRole.MANAGER)).isTrue();
        verifyNoInteractions(vouchers);
    }

    // ------------------------------------------------------------------ UC-FE13-03 voidVoucher()

    private ExitVoucherDTO.VoidResult voidIt(String reason, Map<Long, Long> overrides, Map<Long, String> warnings, Integer version) {
        return service.voidVoucher(FARM_ID, 71L, new ExitVoucherRequests.Void(reason, overrides, warnings, version));
    }

    private void assertNothingVoided() {
        assertThat(voucher.getStatus()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(cattleById.values()).allSatisfy(c -> assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.EXITED));
        verify(penAssignments, never()).openAssignment(any(), any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tc1317VoidingBringsTheCattleBackToTheirLastPenFromToday() {
        sale(ExitVoucherStatus.CONFIRMED, 2);

        ExitVoucherDTO.VoidResult result = voidIt("  Nhap nham nguoi mua  ", null, null, 4);

        assertThat(cattleById.values()).allSatisfy(c -> {
            assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
            assertThat(c.getExitType()).isNull();
            assertThat(c.getExitDate()).isNull();
            verify(penAssignments).openAssignment(c, a01, TODAY, AssignmentSource.CORRECTION, "Hủy phiếu xuất PX-2611-004", null, null, owner);
        });
        assertThat(voucherLines).allSatisfy(l -> assertThat(l.getStatus()).isEqualTo(ExitLineStatus.VOIDED));
        assertThat(voucher.getStatus()).isEqualTo(ExitVoucherStatus.VOIDED);
        assertThat(voucher.getCloseReason()).isEqualTo("Nhap nham nguoi mua");
        assertThat(voucher.getClosedBy()).isSameAs(owner);
        verify(revisions).record(any(), eq("HerdExitVoucher"), eq(71L), eq(RecordRevisionService.VOID), eq("Nhap nham nguoi mua"), any(), any());
        verify(audit).log(any(FarmContext.class), eq("EXIT_VOID"), eq("HerdExitVoucher"), eq(71L), anyMap());
        verify(doses, never()).saveAll(any());
        verify(healthCases, never()).saveAll(any());
        assertThat(result.message().code()).isEqualTo(MessageCodes.FE13_05);
        assertThat(result.message().params()).containsEntry("count", 2);
    }

    @Test
    void tc1318ALastPenThatWasStoppedNeedsAnotherPen() {
        sale(ExitVoucherStatus.CONFIRMED, 2);
        a01.setStatus(ActiveStatus.INACTIVE);

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", null, null, 4));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE13_09);
        assertThat(((DomainException) thrown).getParams()).containsEntry("pen", "A-01").containsEntry("cattle_codes", List.of("BO-0101", "BO-0102"));
        assertNothingVoided();
    }

    @Test
    void tcAnnt130301ALastPenWithoutRoomAlsoNeedsAnotherPen() {
        sale(ExitVoucherStatus.CONFIRMED, 2);
        headcount.put(11L, 9);

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", null, null, 4));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE13_09);
        assertThat(((DomainException) thrown).getParams()).containsEntry("cattle_codes", List.of("BO-0102"));
        assertNothingVoided();
    }

    @Test
    void tcAnnt130302AnOverridePenWithAnUnmetCriterionNeedsAWarningReason() {
        sale(ExitVoucherStatus.CONFIRMED, 1);
        Pen b01 = pen(12L, "B-01", 5, ActiveStatus.ACTIVE, 0);
        PenCriteriaVersion femaleOnly = new PenCriteriaVersion();
        femaleOnly.setId(9122L);
        femaleOnly.setPen(b01);
        femaleOnly.setVersionNo(1);
        femaleOnly.setSex(Sex.FEMALE);
        when(criteriaVersions.findFirstByPenIdOrderByVersionNoDesc(12L)).thenReturn(Optional.of(femaleOnly));

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", Map.of(101L, 12L), null, 4));
        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_06);
        assertNothingVoided();

        voidIt("Nhap nham", Map.of(101L, 12L), Map.of(101L, "Tam o chuong B"), 4);
        verify(penAssignments).openAssignment(eq(cattleById.get(101L)), eq(b01), eq(TODAY), eq(AssignmentSource.CORRECTION), anyString(), any(),
            eq("Tam o chuong B"), eq(owner));
    }

    @Test
    void tcAnnt130303AnOverrideForACattleNotOnTheVoucherIsRejected() {
        sale(ExitVoucherStatus.CONFIRMED, 1);

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", Map.of(999L, 11L), null, 4));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "penOverrides");
        assertNothingVoided();
    }

    @Test
    void tcAnnt130304ACattleNowOnAnotherOpenExitVoucherBlocksTheVoid() {
        sale(ExitVoucherStatus.CONFIRMED, 1);
        HerdExitVoucher other = new HerdExitVoucher();
        other.setId(72L);
        other.setCode("PX-2611-005");
        HerdExit otherLine = new HerdExit();
        otherLine.setVoucher(other);
        otherLine.setCattle(cattleById.get(101L));
        when(lines.findAllByCattleIdAndStatusIn(eq(101L), anyCollection())).thenReturn(List.of(voucherLines.get(0), otherLine));

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", null, null, 4));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE13_08);
        assertThat(((DomainException) thrown).getParams()).containsEntry("voucher_code", "PX-2611-005");
        assertNothingVoided();
    }

    @Test
    void tcAnnt130305ACattleThatIsNoLongerExitedIsAConflict() {
        sale(ExitVoucherStatus.CONFIRMED, 2);
        cattleById.get(102L).setHerdStatus(HerdStatus.ACTIVE);

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", null, null, 4));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("cattle_code", "BO-0102");
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tc1319AVoucherThatIsAlreadyVoidedCannotBeVoidedAgain() {
        sale(ExitVoucherStatus.CONFIRMED, 1);
        voucher.setStatus(ExitVoucherStatus.VOIDED);

        assertDomain(catchThrowable(() -> voidIt("Nhap nham", null, null, 4)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tc1320RecordedCollectionsStayRecordedAfterTheVoid() {
        sale(ExitVoucherStatus.CONFIRMED, 1);
        voucher.setAmountCollected(16_000_000L);

        voidIt("Nhap nham", null, null, 4);

        assertThat(voucher.getAmountCollected()).isEqualTo(16_000_000L);
        verify(paymentRepository, never()).saveAndFlush(any());
        verify(paymentRepository, never()).save(any());
        verifyNoInteractions(payments);
    }

    @Test
    void tcAnnt130306TheVoidReasonIsRequiredAndTheVersionMustMatch() {
        sale(ExitVoucherStatus.CONFIRMED, 1);

        assertDomain(catchThrowable(() -> voidIt("  ", null, null, 4)), HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertDomain(catchThrowable(() -> voidIt("Nhap nham", null, null, 3)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(catchThrowable(() -> voidIt("Nhap nham", null, null, null)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingVoided();
    }
}
