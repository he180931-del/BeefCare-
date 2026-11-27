package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PreEntryHistoryDeclarationRepository;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Header;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Issue;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Resolved;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE06-03 Correct Herd Entry Record
 * ({@link HerdEntryCorrectionService#correct}) and UC-FE06-05 Void Herd Entry Voucher
 * ({@link HerdEntryCorrectionService#voidVoucher}). The per-line rules are a mock that resolves the merged line (amount =
 * weight x unit price); the event probe, placements and reminders are mocks; the cattle guard is real. The farm clock
 * is fixed at 27/11/2026 10:00 (UTC+7). Purchase voucher PN-2611-001 of 05/11/2026 has three lines of 300 kg x 80.000
 * = 24.000.000 each and a transport fee of 500.000.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HerdEntryCorrectionServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final LocalDate ENTRY_DATE = LocalDate.of(2026, 11, 5);
    private static final long FARM_ID = 501L;

    @Mock HerdEntryVoucherRepository vouchers;
    @Mock HerdEntryRepository entries;
    @Mock CattleRepository cattleRepository;
    @Mock CattleQrTagRepository qrTags;
    @Mock PenAssignmentRepository assignments;
    @Mock PreEntryHistoryDeclarationRepository declarations;
    @Mock TradingPartnerRepository partners;
    @Mock VoucherPaymentRepository payments;
    @Mock FarmAccessService access;
    @Mock HerdExitRepository exits;
    @Mock CattleEventProbe probe;
    @Mock PenAssignmentService penAssignments;
    @Mock HerdEntryPostingService posting;
    @Mock EntryLineValidator lineValidator;
    @Mock EntryCatalogLookup catalog;
    @Mock EntryReminderService reminders;
    @Mock RecordRevisionService revisions;
    @Mock AuditService audit;
    @Mock EntryVoucherMapper mapper;
    @Mock EntityManager em;

    private HerdEntryCorrectionService service;
    private Farm farm;
    private AppUser manager;
    private Pen pen;
    private ProductionPurpose fattening;
    private HerdEntryVoucher voucher;
    private final Map<Long, Breed> breeds = new HashMap<>();
    private final List<HerdEntry> lines = new ArrayList<>();
    private final Map<Long, Cattle> cattleById = new HashMap<>();
    private final Map<Long, List<CattleEventProbe.Event>> events = new HashMap<>();
    private final Map<Long, LocalDate> earliest = new HashMap<>();
    private final Map<Long, PenAssignment> firstPlacement = new HashMap<>();
    private final List<VoucherPayment> recordedPayments = new ArrayList<>();
    private List<Issue> lineIssues = List.of();

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service = new HerdEntryCorrectionService(vouchers, entries, cattleRepository, qrTags, assignments, declarations, partners, payments, access,
            new CattleGuardService(exits, cattleRepository, clock), probe, penAssignments, posting, lineValidator, catalog, reminders, revisions, audit,
            mapper, clock);
        ReflectionTestUtils.setField(service, "em", em);
        farm = new Farm();
        farm.setId(FARM_ID);
        manager = new AppUser();
        manager.setId(31L);
        pen = new Pen();
        pen.setId(11L);
        pen.setCode("A-01");
        fattening = new ProductionPurpose();
        fattening.setId(62L);
        breed(21L, "Brahman", true);
        breed(22L, "Angus", false);

        when(access.require(FARM_ID, FarmAction.MANAGE_ENTRY_VOUCHERS)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        when(entries.findByIdAndFarmId(anyLong(), eq(FARM_ID))).thenAnswer(inv ->
            lines.stream().filter(l -> l.getId().equals(inv.getArgument(0))).findFirst());
        when(entries.findAllByVoucherIdOrderByLineNoAsc(81L)).thenAnswer(inv -> lines);
        when(cattleRepository.lockAllByFarmIdAndIdIn(eq(FARM_ID), anyList())).thenAnswer(inv ->
            inv.<List<Long>>getArgument(1).stream().map(cattleById::get).toList());
        when(lineValidator.validate(any(Header.class), anyInt(), any(EntryLineRequest.class), any(), eq(true), eq(false))).thenAnswer(inv -> {
            Header header = inv.getArgument(0);
            EntryLineRequest merged = inv.getArgument(2);
            long amount = merged.entryWeightKg().multiply(BigDecimal.valueOf(merged.unitPrice())).setScale(0, RoundingMode.HALF_UP).longValueExact();
            Resolved resolved = new Resolved(inv.getArgument(1), merged, breeds.get(merged.breedId()), fattening, pen, merged.sex(), merged.birthDate(),
                merged.birthDateAccuracy(), merged.lifeStage(), null, merged.entryWeightKg(), merged.weightBasis(), merged.unitPrice(), amount, null, null,
                null, null, null, null, null, header.voucherDate());
            return new EntryLineValidator.Result(resolved, lineIssues);
        });
        when(probe.events(anyLong())).thenAnswer(inv -> events.getOrDefault(inv.<Long>getArgument(0), List.of()));
        when(probe.earliestEventDate(anyLong())).thenAnswer(inv -> earliest.get(inv.<Long>getArgument(0)));
        when(penAssignments.history(anyLong())).thenAnswer(inv -> List.of(firstPlacement.get(inv.<Long>getArgument(0))));
        when(payments.findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(81L)).thenReturn(recordedPayments);
        RecordRevision revision = new RecordRevision();
        revision.setId(555L);
        when(revisions.record(any(), anyString(), anyLong(), anyString(), anyString(), any(), any())).thenReturn(revision);
        when(mapper.notice(anyString(), any(Object[].class))).thenAnswer(inv -> {
            Object[] raw = inv.getRawArguments();
            Object[] kv = raw.length == 2 && raw[1] instanceof Object[] array ? array : Arrays.copyOfRange(raw, 1, raw.length);
            return new EntryDtos.Notice((String) raw[0], DomainException.params(kv), null);
        });
        purchaseVoucher();
    }

    private void breed(long id, String name, boolean available) {
        Breed b = new Breed();
        b.setId(id);
        b.setName(name);
        b.setAvailable(available);
        breeds.put(id, b);
    }

    private void purchaseVoucher() {
        voucher = new HerdEntryVoucher();
        voucher.setId(81L);
        voucher.setFarm(farm);
        voucher.setCode("PN-2611-001");
        voucher.setEntryType(EntryType.PURCHASE);
        voucher.setEntryDate(ENTRY_DATE);
        voucher.setPricingBasis(PricingBasis.PER_KG);
        voucher.setCattleAmount(72_000_000L);
        voucher.setTransportFee(500_000L);
        voucher.setAmountPaid(0L);
        voucher.setStatus(EntryVoucherStatus.POSTED);
        voucher.setVersion(5);
        when(vouchers.lockByIdAndFarmId(FARM_ID, 81L)).thenReturn(Optional.of(voucher));
        line(91L, 301L, Sex.FEMALE);
        line(92L, 302L, Sex.MALE);
        line(93L, 303L, Sex.MALE);
    }

    private HerdEntry line(long entryId, long cattleId, Sex sex) {
        Cattle c = new Cattle();
        c.setId(cattleId);
        c.setFarm(farm);
        c.setDisplayCode("BO-0" + cattleId);
        c.setSex(sex);
        c.setBreed(breeds.get(21L));
        c.setPurpose(fattening);
        c.setLifeStage(LifeStage.YOUNG_STOCK);
        c.setBirthDate(LocalDate.of(2025, 5, 1));
        c.setBirthDateAccuracy(BirthDateAccuracy.ESTIMATED);
        c.setHerdStatus(HerdStatus.ACTIVE);
        cattleById.put(cattleId, c);
        HerdEntry l = new HerdEntry();
        l.setId(entryId);
        l.setVoucher(voucher);
        l.setLineNo(lines.size() + 1);
        l.setCattle(c);
        l.setStatus(EntryLineStatus.VALID);
        l.setEntryDate(ENTRY_DATE);
        l.setEntryWeightKg(new BigDecimal("300"));
        l.setWeightBasis(WeightBasis.MEASURED);
        l.setUnitPrice(80_000L);
        l.setLineAmount(24_000_000L);
        l.setInitialPen(pen);
        l.setVersion(2);
        lines.add(l);
        PenAssignment first = new PenAssignment();
        first.setId(7000L + cattleId);
        first.setCattle(c);
        first.setPen(pen);
        first.setFromDate(ENTRY_DATE);
        first.setSource(AssignmentSource.HERD_ENTRY);
        firstPlacement.put(cattleId, first);
        return l;
    }

    private static EntryActionRequests.Changes changes(LocalDate entryDate, String weightKg, Long breedId, Sex sex) {
        return new EntryActionRequests.Changes(entryDate, null, null, null, weightKg == null ? null : new BigDecimal(weightKg), null, null, breedId, sex, null,
            null, null, null, null, null);
    }

    private EntryDtos.CorrectionResult correct(long entryId, EntryActionRequests.Changes changes) {
        return service.correct(FARM_ID, entryId, new EntryActionRequests.CorrectEntryRequest("Can lai tai trai", 2, 5, changes));
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    private void assertNothingCorrected() {
        assertThat(lines).allSatisfy(l -> {
            assertThat(l.getEntryDate()).isEqualTo(ENTRY_DATE);
            assertThat(l.getEntryWeightKg()).isEqualByComparingTo("300");
        });
        assertThat(voucher.getEntryDate()).isEqualTo(ENTRY_DATE);
        verify(entries, never()).saveAndFlush(any());
        verifyNoInteractions(revisions, audit);
    }

    // ------------------------------------------------------------------ UC-FE06-03 correct()

    @Test
    void tc0627ANewWeightRecalculatesTheLineAndTheVoucherAndTheRevisionKeepsTheOldWeight() {
        EntryDtos.CorrectionResult result = correct(91L, changes(null, "320", null, null));

        HerdEntry entry = lines.get(0);
        assertThat(entry.getEntryWeightKg()).isEqualByComparingTo("320");
        assertThat(entry.getLineAmount()).isEqualTo(25_600_000L);
        assertThat(entry.isCorrected()).isTrue();
        assertThat(voucher.getCattleAmount()).isEqualTo(73_600_000L);
        assertThat(voucher.getTotalPayable()).isEqualTo(74_100_000L);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> before = ArgumentCaptor.forClass(Map.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> after = ArgumentCaptor.forClass(Map.class);
        verify(revisions).record(any(), eq("HerdEntry"), eq(91L), eq(RecordRevisionService.CORRECT), eq("Can lai tai trai"), before.capture(), after.capture());
        assertThat(before.getValue()).containsEntry("entryWeightKg", new BigDecimal("300")).containsEntry("voucherCattleAmount", 72_000_000L);
        assertThat(after.getValue()).containsEntry("entryWeightKg", new BigDecimal("320")).containsEntry("voucherCattleAmount", 73_600_000L);
        assertThat(result.notice().code()).isEqualTo(MessageCodes.FE06_06);
        assertThat(result.revisionId()).isEqualTo(555L);
        assertThat(result.overpaid()).isZero();
        verify(audit).log(any(FarmContext.class), eq("ENTRY_LINE_CORRECT"), eq("HerdEntry"), eq(91L), anyMap());
    }

    @Test
    void tc0628ChangingThePurchaseEntryDateMovesEveryCattleOfTheVoucher() {
        LocalDate newDate = LocalDate.of(2026, 11, 8);

        correct(91L, changes(newDate, null, null, null));

        assertThat(lines).allSatisfy(l -> assertThat(l.getEntryDate()).isEqualTo(newDate));
        assertThat(voucher.getEntryDate()).isEqualTo(newDate);
        assertThat(firstPlacement.values()).allSatisfy(a -> assertThat(a.getFromDate()).isEqualTo(newDate));
        verify(assignments, times(3)).saveAndFlush(any(PenAssignment.class));
        verify(reminders, times(3)).rescheduleEntryReminder(any(HerdEntry.class));
    }

    @Test
    void tc0625AnEntryDateAfterAnExistingEventIsRejected() {
        earliest.put(302L, LocalDate.of(2026, 11, 10));

        Throwable thrown = catchThrowable(() -> correct(91L, changes(LocalDate.of(2026, 11, 11), null, null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_07);
        assertThat(((DomainException) thrown).getParams())
            .containsEntry("reason", "EVENT_BEFORE_ENTRY_DATE")
            .containsEntry("cattle_code", "BO-0302")
            .containsEntry("date", LocalDate.of(2026, 11, 10));
        assertNothingCorrected();
    }

    @Test
    void tc0626AFemaleWithReproductiveEventsCannotBecomeMale() {
        events.put(301L, List.of(new CattleEventProbe.Event("REPRODUCTION", LocalDate.of(2026, 11, 20))));

        Throwable thrown = catchThrowable(() -> correct(91L, changes(null, null, null, Sex.MALE)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_07);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "SEX_CHANGE_WITH_REPRODUCTIVE_EVENTS").containsEntry("events", "REPRODUCTION");
        assertThat(cattleById.get(301L).getSex()).isEqualTo(Sex.FEMALE);
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060301AnEntryDateInTheFutureIsRejected() {
        assertDomain(catchThrowable(() -> correct(91L, changes(TODAY.plusDays(1), null, null, null))), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_03);
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060302AnEntryDateBeforeTheBirthOfACattleIsRejected() {
        cattleById.get(303L).setBirthDate(LocalDate.of(2026, 11, 3));

        Throwable thrown = catchThrowable(() -> correct(91L, changes(LocalDate.of(2026, 11, 2), null, null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_07);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "ENTRY_DATE_BEFORE_BIRTH_DATE").containsEntry("cattle_code", "BO-0303");
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060303AnEntryDateAfterARecordedPaymentIsRejected() {
        VoucherPayment paid = new VoucherPayment();
        paid.setStatus(PaymentRecordStatus.RECORDED);
        paid.setPaymentDate(LocalDate.of(2026, 11, 6));
        recordedPayments.add(paid);

        Throwable thrown = catchThrowable(() -> correct(91L, changes(LocalDate.of(2026, 11, 8), null, null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_07);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "PAYMENT_BEFORE_ENTRY_DATE");
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060304AChangeThatChangesNothingIsRejected() {
        Throwable thrown = catchThrowable(() -> correct(91L, changes(ENTRY_DATE, "300.0", 21L, Sex.FEMALE)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "changes");
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060305TheReasonIsRequiredAndAtMost500Characters() {
        Throwable blank = catchThrowable(() -> service.correct(FARM_ID, 91L, new EntryActionRequests.CorrectEntryRequest("  ", 2, 5, changes(null, "320", null, null))));
        Throwable tooLong = catchThrowable(() ->
            service.correct(FARM_ID, 91L, new EntryActionRequests.CorrectEntryRequest("R".repeat(501), 2, 5, changes(null, "320", null, null))));

        assertDomain(blank, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertDomain(tooLong, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060306AStaleEntryOrVoucherVersionIsAConflict() {
        Throwable staleEntry = catchThrowable(() ->
            service.correct(FARM_ID, 91L, new EntryActionRequests.CorrectEntryRequest("Can lai", 1, 5, changes(null, "320", null, null))));
        Throwable staleVoucher = catchThrowable(() ->
            service.correct(FARM_ID, 91L, new EntryActionRequests.CorrectEntryRequest("Can lai", 2, 4, changes(null, "320", null, null))));

        assertDomain(staleEntry, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(staleVoucher, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060307AVoidedVoucherOrVoidedLineCannotBeCorrected() {
        lines.get(1).setStatus(EntryLineStatus.VOID);
        Throwable voidLine = catchThrowable(() -> correct(92L, changes(null, "320", null, null)));
        voucher.setStatus(EntryVoucherStatus.VOIDED);
        Throwable voidVoucher = catchThrowable(() -> correct(91L, changes(null, "320", null, null)));

        assertDomain(voidLine, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(voidVoucher, HttpStatus.CONFLICT, MessageCodes.COM_05);
        verifyNoInteractions(revisions, audit);
    }

    private void farmBornVoucher() {
        voucher.setEntryType(EntryType.FARM_BORN);
        voucher.setCattleAmount(0L);
        voucher.setTransportFee(0L);
        lines.forEach(l -> {
            l.setUnitPrice(null);
            l.setLineAmount(0L);
            l.setEntryWeightKg(null);
            l.setWeightBasis(null);
        });
    }

    @Test
    void tcAnnt060308TheEntryDateOfAFarmBornCalfComesFromTheCalvingAndCannotBeChanged() {
        farmBornVoucher();

        Throwable thrown = catchThrowable(() -> correct(91L, changes(LocalDate.of(2026, 11, 8), null, null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_07);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "FARM_BORN_DATA_COMES_FROM_THE_CALVING");
        verifyNoInteractions(lineValidator, revisions);
    }

    @Test
    void tcAnnt060309TheWeightOfAFarmBornCalfCanBeCorrectedWithItsBasis() {
        farmBornVoucher();

        correct(91L, new EntryActionRequests.Changes(null, null, null, null, new BigDecimal("28.5"), WeightBasis.ESTIMATED, null, null, null, null, null,
            null, null, null, null));

        assertThat(lines.get(0).getEntryWeightKg()).isEqualByComparingTo("28.5");
        assertThat(lines.get(0).getWeightBasis()).isEqualTo(WeightBasis.ESTIMATED);
        assertThat(voucher.getCattleAmount()).isZero();
        verifyNoInteractions(lineValidator);
    }

    @Test
    void tcAnnt060310AReproductionDeclarationForAMaleIsRejected() {
        EntryActionRequests.Changes changes = new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, null, null, null, null, null,
            null, new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 1, null, null, null));

        Throwable thrown = catchThrowable(() -> correct(92L, changes));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "reproduction");
    }

    @Test
    void tcAnnt060311ABirthDateAfterTheEntryDateIsReportedAsACorrectionConflict() {
        lineIssues = List.of(EntryLineValidator.error(1, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_03, "birthDate"));

        Throwable thrown = catchThrowable(() -> correct(91L, changes(null, "320", null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_07);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "BIRTH_DATE_AFTER_ENTRY_DATE");
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060312ADiscontinuedBreedCannotBeChosen() {
        Throwable thrown = catchThrowable(() -> correct(92L, changes(null, null, 22L, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE18_08);
        assertThat(cattleById.get(302L).getBreed().getId()).isEqualTo(21L);
        assertNothingCorrected();
    }

    @Test
    void tcAnnt060313LoweringTheWeightOfAPaidVoucherReportsTheOverpaidAmount() {
        voucher.setAmountPaid(72_500_000L);

        EntryDtos.CorrectionResult result = correct(92L, changes(null, "250", null, null));

        assertThat(voucher.getCattleAmount()).isEqualTo(68_000_000L);
        assertThat(result.overpaid()).isEqualTo(4_000_000L);
        assertThat(result.overpaidNotice().code()).isEqualTo(MessageCodes.FE06_23);
        assertThat(result.overpaidNotice().params()).containsEntry("amount", 4_000_000L);
    }

    @Test
    void tcAnnt060314TheEntryOfAnExitedCattleCannotBeCorrected() {
        cattleById.get(301L).setHerdStatus(HerdStatus.EXITED);

        assertDomain(catchThrowable(() -> correct(91L, changes(null, "320", null, null))), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_13);
        assertNothingCorrected();
    }

    @Test
    void tc0637ATechnicianCannotCorrectAnEntry() {
        when(access.require(FARM_ID, FarmAction.MANAGE_ENTRY_VOUCHERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> correct(91L, changes(null, "320", null, null))), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verifyNoInteractions(entries, vouchers, revisions);
    }

    // ------------------------------------------------------------------ UC-FE06-05 voidVoucher()

    private EntryDtos.VoidResult voidIt(String reason, Integer version) {
        return service.voidVoucher(FARM_ID, 81L, new EntryActionRequests.VoidRequest(reason, version));
    }

    private void assertNothingVoided() {
        assertThat(voucher.getStatus()).isNotEqualTo(EntryVoucherStatus.VOIDED);
        assertThat(cattleById.values()).allSatisfy(c -> assertThat(c.getHerdStatus()).isNotEqualTo(HerdStatus.VOIDED));
        assertThat(lines).allSatisfy(l -> assertThat(l.getStatus()).isEqualTo(EntryLineStatus.VALID));
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tcAnnt060501VoidingAPurchaseVoucherVoidsEveryCattleTagAndPlacement() {
        Map<Long, CattleQrTag> tags = new HashMap<>();
        for (Cattle c : cattleById.values()) {
            CattleQrTag tag = new CattleQrTag();
            tag.setCattle(c);
            tag.setStatus(QrTagStatus.ACTIVE);
            tags.put(c.getId(), tag);
            when(qrTags.findFirstByCattleIdAndStatus(c.getId(), QrTagStatus.ACTIVE)).thenReturn(Optional.of(tag));
            when(penAssignments.findOpen(c.getId())).thenReturn(Optional.of(firstPlacement.get(c.getId())));
        }

        EntryDtos.VoidResult result = voidIt("  Nhap nham phieu  ", 5);

        assertThat(cattleById.values()).allSatisfy(c -> {
            assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.VOIDED);
            assertThat(c.getVoidReason()).isEqualTo("Nhap nham phieu");
            verify(penAssignments).closeAssignment(c, TODAY);
        });
        assertThat(lines).allSatisfy(l -> assertThat(l.getStatus()).isEqualTo(EntryLineStatus.VOID));
        assertThat(tags.values()).allSatisfy(t -> {
            assertThat(t.getStatus()).isEqualTo(QrTagStatus.RETIRED);
            assertThat(t.getClosedAt()).isEqualTo(NOW);
        });
        verify(reminders, times(3)).cancelEntryReminders(any(HerdEntry.class));
        assertThat(voucher.getStatus()).isEqualTo(EntryVoucherStatus.VOIDED);
        assertThat(voucher.getVoidReason()).isEqualTo("Nhap nham phieu");
        assertThat(voucher.getVoidedBy()).isSameAs(manager);
        assertThat(voucher.getVoidedAt()).isEqualTo(NOW);
        verify(revisions).record(any(), eq("HerdEntryVoucher"), eq(81L), eq(RecordRevisionService.VOID), eq("Nhap nham phieu"), any(), any());
        verify(audit).log(any(FarmContext.class), eq("ENTRY_VOID"), eq("HerdEntryVoucher"), eq(81L), anyMap());
        assertThat(result.notice().code()).isEqualTo(MessageCodes.FE06_22);
    }

    @Test
    void tc0632ACattleWithALaterEventBlocksTheWholeVoucher() {
        events.put(302L, List.of(new CattleEventProbe.Event("VACCINATION", LocalDate.of(2026, 11, 15))));

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", 5));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_21);
        assertThat(((DomainException) thrown).getParams()).containsEntry("voucher_code", "PN-2611-001").containsEntry("cattle_codes", "BO-0302");
        assertNothingVoided();
    }

    @Test
    void tcAnnt060502AnExitedCattleBlocksTheWholeVoucher() {
        cattleById.get(303L).setHerdStatus(HerdStatus.EXITED);

        Throwable thrown = catchThrowable(() -> voidIt("Nhap nham", 5));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_21);
        assertThat(((DomainException) thrown).getParams()).containsEntry("cattle_codes", "BO-0303");
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tc0633VoidingAFarmBornVoucherSendsTheCalvesBackToPendingConfirmation() {
        voucher.setEntryType(EntryType.FARM_BORN);
        lines.remove(2);
        cattleById.remove(303L);
        List<CalfOutcome> calves = new ArrayList<>();
        List<Cattle> dams = new ArrayList<>();
        for (HerdEntry l : lines) {
            Cattle dam = new Cattle();
            dam.setId(200L + l.getId());
            CalvingEvent calving = new CalvingEvent();
            calving.setDam(dam);
            CalfOutcome calf = new CalfOutcome();
            calf.setId(l.getId());
            calf.setCalving(calving);
            calf.setRegistrationState("REGISTERED");
            calf.setRegisteredCattle(l.getCattle());
            l.setCalfOutcome(calf);
            calves.add(calf);
            dams.add(dam);
        }

        voidIt("Ghi nham be", 5);

        assertThat(cattleById.values()).allSatisfy(c -> assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.VOIDED));
        assertThat(calves).allSatisfy(calf -> {
            assertThat(calf.getRegistrationState()).isEqualTo("PENDING_CONFIRMATION");
            assertThat(calf.getRegisteredCattle()).isNull();
            verify(em).merge(calf);
        });
        verify(reminders).raiseCalfReminder(calves.get(0), dams.get(0));
        verify(reminders).raiseCalfReminder(calves.get(1), dams.get(1));
    }

    @Test
    void tc0634RecordedPaymentsStayRecordedAfterTheVoucherIsVoided() {
        voucher.setAmountPaid(10_000_000L);

        voidIt("Nhap nham", 5);

        assertThat(voucher.getAmountPaid()).isEqualTo(10_000_000L);
        verifyNoInteractions(payments);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> details = ArgumentCaptor.forClass(Map.class);
        verify(audit).log(any(FarmContext.class), eq("ENTRY_VOID"), eq("HerdEntryVoucher"), eq(81L), details.capture());
        assertThat(details.getValue()).containsEntry("paidKept", 10_000_000L);
    }

    @Test
    void tcAnnt060503OnlyAPostedVoucherCanBeVoided() {
        voucher.setStatus(EntryVoucherStatus.DRAFT);
        Throwable draft = catchThrowable(() -> voidIt("Nhap nham", 5));
        voucher.setStatus(EntryVoucherStatus.VOIDED);
        Throwable again = catchThrowable(() -> voidIt("Nhap nham", 5));

        assertDomain(draft, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(again, HttpStatus.CONFLICT, MessageCodes.COM_05);
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tcAnnt060504AStaleOrMissingVoucherVersionIsAConflict() {
        assertDomain(catchThrowable(() -> voidIt("Nhap nham", 4)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(catchThrowable(() -> voidIt("Nhap nham", null)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingVoided();
    }

    @Test
    void tcAnnt060505TheVoidReasonIsRequiredAndAtMost500Characters() {
        assertDomain(catchThrowable(() -> voidIt("   ", 5)), HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertDomain(catchThrowable(() -> voidIt("R".repeat(501), 5)), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertNothingVoided();

        voidIt("R".repeat(500), 5);
        assertThat(voucher.getVoidReason()).hasSize(500);
    }

    @Test
    void tcAnnt060506AVoucherOfAnotherFarmIsNotFound() {
        when(vouchers.lockByIdAndFarmId(FARM_ID, 99L)).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() -> service.voidVoucher(FARM_ID, 99L, new EntryActionRequests.VoidRequest("Nhap nham", 1)));

        assertDomain(thrown, HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        verifyNoInteractions(revisions, audit);
    }

    @Test
    void tc0637ATechnicianCannotVoidAnEntryVoucher() {
        when(access.require(FARM_ID, FarmAction.MANAGE_ENTRY_VOUCHERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> voidIt("Nhap nham", 5)), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertNothingVoided();
    }
}
