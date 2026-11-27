package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.repository.FeedReceiptRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.HerdExitVoucherRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.PaymentResultDTO;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;

/**
 * Unit tests (Mockito, no Spring context, no database) for {@link VoucherPaymentService#record}, the main function of
 * UC-FE06-04 Record Herd Entry Voucher Payment (kind ENTRY, pay the seller) and of UC-FE13-04 Record Herd Exit Voucher
 * Collection (kind EXIT, collect from the buyer). The sum of RECORDED payments comes from the mocked repository. The
 * farm clock is fixed at 27/11/2026 10:00 (UTC+7).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VoucherPaymentServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final LocalDate VOUCHER_DATE = LocalDate.of(2026, 11, 10);
    private static final long FARM_ID = 501L;

    @Mock FarmAccessService access;
    @Mock HerdEntryVoucherRepository entryVouchers;
    @Mock HerdExitVoucherRepository exitVouchers;
    @Mock FeedReceiptRepository feedReceipts;
    @Mock VoucherPaymentRepository payments;
    @Mock AuditService audit;
    @Mock RecordRevisionService revisions;

    private VoucherPaymentService service;
    private Farm farm;
    private AppUser owner;
    private final List<VoucherPayment> saved = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new VoucherPaymentService(access, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), entryVouchers, exitVouchers, feedReceipts, payments,
            audit, revisions);
        farm = new Farm();
        farm.setId(FARM_ID);
        owner = new AppUser();
        owner.setId(31L);
        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
        when(payments.saveAndFlush(any(VoucherPayment.class))).thenAnswer(inv -> {
            VoucherPayment p = inv.getArgument(0);
            p.setId(900L + saved.size());
            saved.add(p);
            return p;
        });
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    private void assertNothingRecorded() {
        assertThat(saved).isEmpty();
        verifyNoInteractions(audit);
    }

    // ------------------------------------------------------------------ UC-FE06-04 record(ENTRY)

    /** Total payable 24.500.000 (cattle 24.000.000 + transport 500.000), paid before {@code paidBefore}. */
    private HerdEntryVoucher entryVoucher(EntryVoucherStatus status, long paidBefore, long paidAfter) {
        HerdEntryVoucher v = new HerdEntryVoucher();
        v.setId(81L);
        v.setFarm(farm);
        v.setCode("PN-2611-001");
        v.setEntryDate(VOUCHER_DATE);
        v.setCattleAmount(24_000_000L);
        v.setTransportFee(500_000L);
        v.setAmountPaid(paidBefore);
        v.setStatus(status);
        v.setVersion(5);
        when(entryVouchers.lockByIdAndFarmId(FARM_ID, 81L)).thenReturn(Optional.of(v));
        when(payments.sumByEntryVoucher(81L, PaymentRecordStatus.RECORDED)).thenReturn(paidBefore, paidAfter, paidAfter);
        return v;
    }

    private PaymentResultDTO pay(Long amount, LocalDate date, PaymentMethod method) {
        return service.record(FARM_ID, VoucherKind.ENTRY, 81L, new RecordPaymentRequest(date, amount, method, "UNC 0091", null, 5));
    }

    @Test
    void tcAnnt060401PayingTheWholeOutstandingAmountSettlesTheVoucher() {
        HerdEntryVoucher v = entryVoucher(EntryVoucherStatus.POSTED, 19_500_000L, 24_500_000L);

        PaymentResultDTO result = pay(5_000_000L, LocalDate.of(2026, 11, 20), PaymentMethod.BANK_TRANSFER);

        assertThat(saved).singleElement().satisfies(p -> {
            assertThat(p.getDirection()).isEqualTo(PaymentDirection.PAY);
            assertThat(p.getEntryVoucher()).isSameAs(v);
            assertThat(p.getStatus()).isEqualTo(PaymentRecordStatus.RECORDED);
            assertThat(p.getAmount()).isEqualTo(5_000_000L);
            assertThat(p.getRecordedBy()).isSameAs(owner);
            assertThat(p.getRecordedAt()).isEqualTo(NOW);
            assertThat(p.getReference()).isEqualTo("UNC 0091");
            assertThat(p.getNote()).isNull();
        });
        assertThat(v.getAmountPaid()).isEqualTo(24_500_000L);
        assertThat(result.summary().total()).isEqualTo(24_500_000L);
        assertThat(result.summary().outstanding()).isZero();
        assertThat(result.summary().state()).isEqualTo(PaymentState.PAID);
        verify(entryVouchers).saveAndFlush(v);
        verify(audit).log(any(FarmContext.class), eq("PAYMENT_RECORD"), eq("VoucherPayment"), eq(900L), anyMap());
    }

    @Test
    void tc0635AnAmountAboveTheOutstandingIsRejected() {
        entryVoucher(EntryVoucherStatus.POSTED, 19_500_000L, 19_500_000L);

        Throwable thrown = catchThrowable(() -> pay(5_000_001L, TODAY, PaymentMethod.CASH));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_13);
        assertThat(((DomainException) thrown).getParams()).containsEntry("amount", 5_000_000L);
        assertNothingRecorded();
    }

    @Test
    void tc0635APaymentDatedTomorrowIsRejected() {
        entryVoucher(EntryVoucherStatus.POSTED, 19_500_000L, 19_500_000L);

        assertDomain(catchThrowable(() -> pay(1_000_000L, TODAY.plusDays(1), PaymentMethod.CASH)), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_07);
        assertNothingRecorded();
    }

    @Test
    void tc0635APaymentDatedBeforeTheVoucherIsRejected() {
        entryVoucher(EntryVoucherStatus.POSTED, 19_500_000L, 19_500_000L);

        Throwable thrown = catchThrowable(() -> pay(1_000_000L, VOUCHER_DATE.minusDays(1), PaymentMethod.CASH));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_15);
        assertThat(((DomainException) thrown).getParams()).containsEntry("date", VOUCHER_DATE);
        assertNothingRecorded();
    }

    @Test
    void tc0635AZeroAmountIsRejected() {
        entryVoucher(EntryVoucherStatus.POSTED, 19_500_000L, 19_500_000L);

        Throwable thrown = catchThrowable(() -> pay(0L, TODAY, PaymentMethod.CASH));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "amount");
        assertNothingRecorded();
    }

    @Test
    void tcAnnt060402TheVoucherDateAndTodayAreBothAccepted() {
        entryVoucher(EntryVoucherStatus.POSTED, 0L, 1_000_000L);

        pay(1_000_000L, VOUCHER_DATE, PaymentMethod.CASH);
        pay(1_000L, TODAY, PaymentMethod.CASH);

        assertThat(saved).extracting(VoucherPayment::getPaymentDate).containsExactly(VOUCHER_DATE, TODAY);
    }

    @Test
    void tcAnnt060403ADraftOrVoidedVoucherCannotBePaid() {
        entryVoucher(EntryVoucherStatus.DRAFT, 0L, 0L);
        assertDomain(catchThrowable(() -> pay(1_000_000L, TODAY, PaymentMethod.CASH)), HttpStatus.CONFLICT, MessageCodes.COM_05);

        entryVoucher(EntryVoucherStatus.VOIDED, 0L, 0L);
        assertDomain(catchThrowable(() -> pay(1_000_000L, TODAY, PaymentMethod.CASH)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingRecorded();
    }

    @Test
    void tcAnnt060404AStaleOrMissingVoucherVersionIsAConflict() {
        entryVoucher(EntryVoucherStatus.POSTED, 0L, 0L);

        Throwable stale = catchThrowable(() ->
            service.record(FARM_ID, VoucherKind.ENTRY, 81L, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, null, 4)));
        Throwable missing = catchThrowable(() ->
            service.record(FARM_ID, VoucherKind.ENTRY, 81L, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, null, null)));

        assertDomain(stale, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(missing, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingRecorded();
    }

    @Test
    void tcAnnt060405AmountMethodAndDateAreRequired() {
        entryVoucher(EntryVoucherStatus.POSTED, 0L, 0L);

        Throwable amount = catchThrowable(() -> pay(null, TODAY, PaymentMethod.CASH));
        Throwable method = catchThrowable(() -> pay(1_000L, TODAY, null));
        Throwable date = catchThrowable(() -> pay(1_000L, null, PaymentMethod.CASH));

        assertDomain(amount, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) amount).getParams()).containsEntry("field", "amount");
        assertThat(((DomainException) method).getParams()).containsEntry("field", "method");
        assertThat(((DomainException) date).getParams()).containsEntry("field", "paymentDate");
        assertNothingRecorded();
    }

    @Test
    void tcAnnt060406AReferenceAbove100OrANoteAbove500CharactersIsRejected() {
        entryVoucher(EntryVoucherStatus.POSTED, 0L, 1_000L);

        Throwable reference = catchThrowable(() ->
            service.record(FARM_ID, VoucherKind.ENTRY, 81L, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, "R".repeat(101), null, 5)));
        Throwable note = catchThrowable(() ->
            service.record(FARM_ID, VoucherKind.ENTRY, 81L, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, "N".repeat(501), 5)));
        assertThat(((DomainException) reference).getParams()).containsEntry("field", "reference");
        assertThat(((DomainException) note).getParams()).containsEntry("field", "note");
        assertNothingRecorded();

        service.record(FARM_ID, VoucherKind.ENTRY, 81L, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, "R".repeat(100), "N".repeat(500), 5));
        assertThat(saved).hasSize(1);
    }

    @Test
    void tcAnnt060407AVoucherOfAnotherFarmIsNotFound() {
        when(entryVouchers.lockByIdAndFarmId(FARM_ID, 99L)).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() ->
            service.record(FARM_ID, VoucherKind.ENTRY, 99L, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, null, 5)));

        assertDomain(thrown, HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        assertNothingRecorded();
    }

    @Test
    void tc0637ATechnicianCannotRecordAnEntryPayment() {
        when(access.require(FARM_ID, FarmAction.RECORD_ENTRY_PAYMENT)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> pay(1_000L, TODAY, PaymentMethod.CASH));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertThat(FarmAction.RECORD_ENTRY_PAYMENT.allows(FarmRole.TECHNICIAN)).isFalse();
        verifyNoInteractions(entryVouchers, payments, audit);
    }

    // ------------------------------------------------------------------ UC-FE13-04 record(EXIT)

    /** Receivable 31.000.000 (cattle 31.500.000 - deductions 500.000), collected before {@code before}. */
    private HerdExitVoucher exitVoucher(ExitVoucherStatus status, long before, long after) {
        HerdExitVoucher v = new HerdExitVoucher();
        v.setId(71L);
        v.setFarm(farm);
        v.setCode("PX-2611-004");
        v.setExitType(ExitType.SALE);
        v.setExitDate(VOUCHER_DATE);
        v.setCattleAmount(31_500_000L);
        v.setDeductions(500_000L);
        v.setAmountCollected(before);
        v.setStatus(status);
        v.setVersion(3);
        when(exitVouchers.lockByIdAndFarmId(FARM_ID, 71L)).thenReturn(Optional.of(v));
        when(payments.sumByExitVoucher(71L, PaymentRecordStatus.RECORDED)).thenReturn(before, after, after);
        return v;
    }

    private PaymentResultDTO collect(long amount, LocalDate date) {
        return service.record(FARM_ID, VoucherKind.EXIT, 71L, new RecordPaymentRequest(date, amount, PaymentMethod.CASH, null, "Thu dot 2", 3));
    }

    @Test
    void tcAnnt130401ACollectionFromTheBuyerIsRecordedAndTheCollectedAmountFollows() {
        HerdExitVoucher v = exitVoucher(ExitVoucherStatus.CONFIRMED, 10_000_000L, 26_000_000L);

        PaymentResultDTO result = collect(16_000_000L, LocalDate.of(2026, 11, 15));

        assertThat(saved).singleElement().satisfies(p -> {
            assertThat(p.getDirection()).isEqualTo(PaymentDirection.COLLECT);
            assertThat(p.getExitVoucher()).isSameAs(v);
            assertThat(p.getEntryVoucher()).isNull();
            assertThat(p.getNote()).isEqualTo("Thu dot 2");
        });
        assertThat(v.getAmountCollected()).isEqualTo(26_000_000L);
        assertThat(result.summary().voucherType()).isEqualTo("EXIT");
        assertThat(result.summary().total()).isEqualTo(31_000_000L);
        assertThat(result.summary().outstanding()).isEqualTo(5_000_000L);
        assertThat(result.summary().state()).isEqualTo(PaymentState.PARTLY_PAID);
        verify(exitVouchers).saveAndFlush(v);
    }

    @Test
    void tc1321CollectingMoreThanTheRemainingReceivableIsRejected() {
        exitVoucher(ExitVoucherStatus.CONFIRMED, 26_000_000L, 26_000_000L);

        Throwable thrown = catchThrowable(() -> collect(6_000_000L, TODAY));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_13);
        assertThat(((DomainException) thrown).getParams()).containsEntry("amount", 5_000_000L);
        assertNothingRecorded();
    }

    @Test
    void tcAnnt130402ExactlyTheRemainingReceivableIsAccepted() {
        exitVoucher(ExitVoucherStatus.CONFIRMED, 26_000_000L, 31_000_000L);

        PaymentResultDTO result = collect(5_000_000L, TODAY);

        assertThat(result.summary().outstanding()).isZero();
        assertThat(result.summary().state()).isEqualTo(PaymentState.PAID);
    }

    @Test
    void tcAnnt130403OnlyAConfirmedExitVoucherCanBeCollected() {
        for (ExitVoucherStatus status : List.of(ExitVoucherStatus.DRAFT, ExitVoucherStatus.PENDING, ExitVoucherStatus.VOIDED)) {
            exitVoucher(status, 0L, 0L);
            assertDomain(catchThrowable(() -> collect(1_000L, TODAY)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        }
        assertNothingRecorded();
    }

    @Test
    void tcAnnt130404ACollectionDatedBeforeTheExitDateOrInTheFutureIsRejected() {
        exitVoucher(ExitVoucherStatus.CONFIRMED, 0L, 0L);

        assertDomain(catchThrowable(() -> collect(1_000L, VOUCHER_DATE.minusDays(1))), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_15);
        assertDomain(catchThrowable(() -> collect(1_000L, TODAY.plusDays(1))), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_07);
        assertNothingRecorded();
    }

    @Test
    void tc1301AManagerCannotRecordACollection() {
        when(access.require(FARM_ID, FarmAction.RECORD_EXIT_COLLECTION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> collect(1_000L, TODAY));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertThat(FarmAction.RECORD_EXIT_COLLECTION.allows(FarmRole.MANAGER)).isFalse();
        assertThat(FarmAction.RECORD_EXIT_COLLECTION.allows(FarmRole.OWNER)).isTrue();
        verify(exitVouchers, never()).lockByIdAndFarmId(any(), any());
        assertNothingRecorded();
    }
}
