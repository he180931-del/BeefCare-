package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
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
import java.util.concurrent.atomic.AtomicInteger;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationCategory;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.repository.PreEntryHistoryDeclarationRepository;
import vn.edu.fpt.beefcare.repository.VaccinationRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Issue;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Resolved;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Unit tests (Mockito, no Spring context, no database) for {@link HerdEntryPostingService#post}, the main function of
 * UC-FE06-01 Register Herd Entry Voucher. The voucher rules ({@link EntryVoucherRules}) and the pen capacity check
 * ({@link PenOccupancyService}) run for real; the per-line rules ({@link EntryLineValidator}) are a mock that returns the
 * resolved line, so a line-level error such as a duplicate ear tag is given by the test. The farm clock is fixed at
 * 27/11/2026 10:00 (UTC+7); purchase voucher PN-2611-001 is dated 20/11/2026, priced per kg.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HerdEntryPostingServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final LocalDate ENTRY_DATE = LocalDate.of(2026, 11, 20);
    private static final long FARM_ID = 501L;

    @Mock HerdEntryVoucherRepository vouchers;
    @Mock HerdEntryRepository entries;
    @Mock CattleRepository cattleRepository;
    @Mock CattleQrTagRepository qrTags;
    @Mock PreEntryHistoryDeclarationRepository declarations;
    @Mock VaccinationRepository vaccinations;
    @Mock FarmAccessService access;
    @Mock EntryLineValidator lineValidator;
    @Mock PenRepository pens;
    @Mock PenAssignmentRepository assignments;
    @Mock EntryCatalogLookup catalog;
    @Mock PenAssignmentService penAssignments;
    @Mock CodeSequenceService codes;
    @Mock VoucherPaymentService payments;
    @Mock EntryReminderService reminders;
    @Mock AuditService audit;
    @Mock EntryVoucherMapper mapper;
    @Mock AttachmentService attachments;
    @Mock EntityManager em;

    private HerdEntryPostingService service;
    private Farm farm;
    private AppUser manager;
    private Pen pen;
    private Breed brahman;
    private ProductionPurpose fattening;
    private HerdEntryVoucher voucher;
    private final List<HerdEntry> lines = new ArrayList<>();
    private final Map<Integer, Resolved> resolvedByLine = new HashMap<>();
    private final Map<Integer, List<Issue>> issuesByLine = new HashMap<>();
    private final Map<Long, Integer> headcount = new HashMap<>();
    private final List<Cattle> createdCattle = new ArrayList<>();
    private final List<CattleQrTag> createdTags = new ArrayList<>();
    private List<VaccinationSchedule> schedules = List.of();

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service = new HerdEntryPostingService(vouchers, entries, cattleRepository, qrTags, declarations, vaccinations, access,
            new EntryVoucherRules(lineValidator, pens, clock), catalog, new PenOccupancyService(pens, assignments), penAssignments, codes, payments,
            reminders, audit, mapper, clock, attachments);
        ReflectionTestUtils.setField(service, "em", em);

        farm = new Farm();
        farm.setId(FARM_ID);
        manager = new AppUser();
        manager.setId(31L);
        pen = new Pen();
        pen.setId(11L);
        pen.setFarm(farm);
        pen.setCode("A-01");
        pen.setCapacity(10);
        pen.setStatus(ActiveStatus.ACTIVE);
        headcount.put(11L, 4);
        brahman = new Breed();
        brahman.setId(21L);
        brahman.setName("Brahman");
        fattening = new ProductionPurpose();
        fattening.setId(62L);
        fattening.setPurposeType(PurposeType.FATTENING);

        when(access.require(FARM_ID, FarmAction.MANAGE_ENTRY_VOUCHERS)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        when(entries.findAllByVoucherIdOrderByLineNoAsc(81L)).thenAnswer(inv -> lines);
        when(lineValidator.validate(any(), anyInt(), any(), any(), eq(true))).thenAnswer(inv -> {
            int lineNo = inv.getArgument(1);
            return new EntryLineValidator.Result(resolvedByLine.get(lineNo), issuesByLine.getOrDefault(lineNo, List.of()));
        });
        when(pens.lockAllByFarmIdAndIdIn(eq(FARM_ID), anyList())).thenReturn(List.of(pen));
        when(assignments.countOpenGroupedByPen(anyCollection())).thenAnswer(inv -> {
            List<Object[]> rows = new ArrayList<>();
            inv.<Collection<Long>>getArgument(0).forEach(id -> rows.add(new Object[] { id, (long) headcount.getOrDefault(id, 0) }));
            return rows;
        });
        AtomicInteger cattleNo = new AtomicInteger(10);
        when(codes.nextCattleCode(FARM_ID)).thenAnswer(inv -> String.format("BC-%06d", cattleNo.incrementAndGet()));
        AtomicInteger tagNo = new AtomicInteger(0);
        when(codes.nextQrTagCode(FARM_ID)).thenAnswer(inv -> "QR" + tagNo.incrementAndGet());
        when(cattleRepository.saveAndFlush(any(Cattle.class))).thenAnswer(inv -> {
            Cattle c = inv.getArgument(0);
            c.setId(300L + createdCattle.size());
            createdCattle.add(c);
            return c;
        });
        when(qrTags.saveAndFlush(any(CattleQrTag.class))).thenAnswer(inv -> {
            createdTags.add(inv.getArgument(0));
            return inv.getArgument(0);
        });
        when(entries.saveAndFlush(any(HerdEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mapper.notice(anyString(), any(Object[].class))).thenAnswer(inv -> {
            Object[] raw = inv.getRawArguments();
            Object[] kv = raw.length == 2 && raw[1] instanceof Object[] array ? array : Arrays.copyOfRange(raw, 1, raw.length);
            return new EntryDtos.Notice((String) raw[0], DomainException.params(kv), null);
        });
        when(mapper.issue(any(Issue.class))).thenAnswer(inv -> {
            Issue i = inv.getArgument(0);
            return new EntryDtos.Issue(i.lineNo(), i.severity().name(), i.code(), i.field(), i.params(), null);
        });
        when(em.createQuery(contains("from VaccinationSchedule s"), eq(VaccinationSchedule.class))).thenAnswer(inv -> scheduleQuery());
    }

    @SuppressWarnings("unchecked")
    private TypedQuery<VaccinationSchedule> scheduleQuery() {
        TypedQuery<VaccinationSchedule> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getResultList()).thenReturn(schedules);
        return query;
    }

    // ------------------------------------------------------------------ fixtures

    private HerdEntryVoucher purchase(long amountPaid, PaymentMethod method) {
        TradingPartner seller = new TradingPartner();
        seller.setId(41L);
        seller.setName("Nguyen Van Ban");
        seller.setSeller(true);
        seller.setStatus(ActiveStatus.ACTIVE);
        voucher = voucher(EntryType.PURCHASE);
        voucher.setSeller(seller);
        voucher.setQuarantineCertNo("KD-2611/01");
        voucher.setTransportFee(500_000L);
        voucher.setAmountPaid(amountPaid);
        voucher.setPaymentMethod(method);
        return voucher;
    }

    private HerdEntryVoucher voucher(EntryType type) {
        HerdEntryVoucher v = new HerdEntryVoucher();
        v.setId(81L);
        v.setFarm(farm);
        v.setCode("PN-2611-001");
        v.setEntryType(type);
        v.setEntryDate(ENTRY_DATE);
        v.setPricingBasis(PricingBasis.PER_KG);
        v.setCattleAmount(0L);
        v.setTransportFee(0L);
        v.setAmountPaid(0L);
        v.setStatus(EntryVoucherStatus.DRAFT);
        v.setVersion(6);
        when(vouchers.lockByIdAndFarmId(FARM_ID, 81L)).thenReturn(Optional.of(v));
        voucher = v;
        return v;
    }

    private static EntryLineRequest.VaccinationDeclaration noVaccination() {
        return new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.NONE, null, null);
    }

    private static EntryLineRequest data(Sex sex, EntryLineRequest.VaccinationDeclaration vaccination, EntryLineRequest.ReproductionDeclaration repro) {
        return new EntryLineRequest(null, null, null, null, 21L, sex, null, null, null, null, 62L, null, null, 11L, null, null, null, vaccination,
            new EntryLineRequest.DiseaseDeclaration(DeclarationStatus.UNKNOWN, null), repro, null);
    }

    /** A purchase line of 300 kg x 80.000 = 24.000.000 / 3 lines → 8.000.000 each. */
    private HerdEntry line(int no, Sex sex, String earTag, EntryLineRequest data) {
        HerdEntry line = new HerdEntry();
        line.setId(90L + no);
        line.setVoucher(voucher);
        line.setLineNo(no);
        line.setStatus(EntryLineStatus.DRAFT);
        line.setInitialPen(pen);
        lines.add(line);
        resolvedByLine.put(no, new Resolved(no, data, brahman, fattening, pen, sex, LocalDate.of(2025, 5, 1), BirthDateAccuracy.ESTIMATED,
            LifeStage.YOUNG_STOCK, earTag, new BigDecimal("100"), WeightBasis.MEASURED, 80_000L, 8_000_000L, null, null, null, null, null, null,
            null, ENTRY_DATE));
        return line;
    }

    private void threeLines() {
        for (int no = 1; no <= 3; no++) {
            line(no, Sex.MALE, "T-0" + no, data(Sex.MALE, noVaccination(), null));
        }
    }

    private EntryDtos.PostResult post(Integer version, boolean printQr) {
        return service.post(FARM_ID, 81L, new EntryActionRequests.PostRequest(version, printQr));
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    private void assertNothingCreated() {
        assertThat(createdCattle).isEmpty();
        assertThat(createdTags).isEmpty();
        assertThat(voucher.getStatus()).isEqualTo(EntryVoucherStatus.DRAFT);
        assertThat(lines).allSatisfy(l -> assertThat(l.getStatus()).isEqualTo(EntryLineStatus.DRAFT));
        verify(penAssignments, never()).openAssignment(any(), any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(payments, audit);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void tc0602PostingThreeValidLinesCreatesTheCattleAndEverythingThatComesWithThem() {
        purchase(10_000_000L, PaymentMethod.CASH);
        threeLines();

        EntryDtos.PostResult result = post(6, true);

        assertThat(createdCattle).extracting(Cattle::getDisplayCode).containsExactly("BC-000011", "BC-000012", "BC-000013");
        assertThat(createdCattle).allSatisfy(c -> {
            assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
            assertThat(c.getBreed()).isSameAs(brahman);
            assertThat(c.getCreatedBy()).isSameAs(manager);
        });
        assertThat(lines).allSatisfy(l -> {
            assertThat(l.getStatus()).isEqualTo(EntryLineStatus.VALID);
            assertThat(l.getCattle()).isNotNull();
            assertThat(l.getEntryDate()).isEqualTo(ENTRY_DATE);
            assertThat(l.getLineAmount()).isEqualTo(8_000_000L);
        });
        verify(penAssignments, times(3)).openAssignment(any(Cattle.class), eq(pen), eq(ENTRY_DATE), eq(AssignmentSource.HERD_ENTRY), any(), any(), any(),
            eq(manager));
        assertThat(createdTags).hasSize(3).allSatisfy(t -> assertThat(t.getStatus()).isEqualTo(QrTagStatus.ACTIVE));
        assertThat(voucher.getStatus()).isEqualTo(EntryVoucherStatus.POSTED);
        assertThat(voucher.getPostedBy()).isSameAs(manager);
        assertThat(voucher.getCattleAmount()).isEqualTo(24_000_000L);
        verify(payments).recordInitialPayment(any(FarmContext.class), eq(voucher), eq(10_000_000L), eq(PaymentMethod.CASH), any());
        verify(audit).log(any(FarmContext.class), eq("ENTRY_POST"), eq("HerdEntryVoucher"), eq(81L), anyMap());
        assertThat(result.cattleCodes()).containsExactly("BC-000011", "BC-000012", "BC-000013");
        assertThat(result.firstCode()).isEqualTo("BC-000011");
        assertThat(result.lastCode()).isEqualTo("BC-000013");
        assertThat(result.alreadyPosted()).isFalse();
        assertThat(result.printQr()).isTrue();
        assertThat(result.posted().code()).isEqualTo(MessageCodes.FE06_01);
        assertThat(result.posted().params()).containsEntry("count", 3);
    }

    @Test
    void tc0603ALineErrorStopsThePostingAndNothingIsCreated() {
        purchase(0L, null);
        threeLines();
        issuesByLine.put(3, List.of(EntryLineValidator.error(3, HttpStatus.UNPROCESSABLE_ENTITY, "MSG-FE05-02", "earTagNumber", "ear_tag", "T-03")));

        Throwable thrown = catchThrowable(() -> post(6, false));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, "MSG-FE05-02");
        assertThat(((DomainException) thrown).getParams()).containsEntry("ear_tag", "T-03");
        assertNothingCreated();
    }

    @Test
    void tc0604PostingAnAlreadyPostedVoucherReturnsTheFirstResultAndCreatesNothing() {
        purchase(0L, null);
        threeLines();
        voucher.setStatus(EntryVoucherStatus.POSTED);
        for (int i = 0; i < 3; i++) {
            Cattle c = new Cattle();
            c.setDisplayCode("BC-00000" + (5 + i));
            lines.get(i).setCattle(c);
            lines.get(i).setStatus(EntryLineStatus.VALID);
        }

        EntryDtos.PostResult result = post(null, false);

        assertThat(result.alreadyPosted()).isTrue();
        assertThat(result.cattleCodes()).containsExactly("BC-000005", "BC-000006", "BC-000007");
        assertThat(result.matchingSchedules()).isEmpty();
        assertThat(createdCattle).isEmpty();
        verifyNoInteractions(lineValidator, payments, audit);
    }

    @Test
    void tc0605AVoucherWithoutLinesCannotBePosted() {
        purchase(0L, null);

        assertDomain(catchThrowable(() -> post(6, false)), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_16);
        assertNothingCreated();
    }

    @Test
    void tc0606AnEntryDateInTheFutureIsRejected() {
        purchase(0L, null);
        voucher.setEntryDate(TODAY.plusDays(1));
        threeLines();

        Throwable thrown = catchThrowable(() -> post(6, false));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_03);
        assertNothingCreated();
    }

    @Test
    void tc0607ThreeLinesIntoAPenWithTwoFreePlacesAreRejected() {
        purchase(0L, null);
        threeLines();
        headcount.put(11L, 8);

        Throwable thrown = catchThrowable(() -> post(6, false));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("pen_code", "A-01").containsEntry("count", 3).containsEntry("free", 2);
        assertNothingCreated();
    }

    @Test
    void tcAnnt060101APenThatBecomesFullGivesAWarningButThePostingGoesAhead() {
        purchase(0L, null);
        threeLines();
        headcount.put(11L, 7);

        EntryDtos.PostResult result = post(6, false);

        assertThat(createdCattle).hasSize(3);
        assertThat(result.warnings()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE06_17);
    }

    @Test
    void tc0608AnUnmetPenCriterionWithoutAWarningReasonStopsThePosting() {
        purchase(0L, null);
        threeLines();
        issuesByLine.put(2, List.of(EntryLineValidator.error(2, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_06, "warningReason", "pen_code", "A-01")));

        assertDomain(catchThrowable(() -> post(6, false)), HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_06);
        assertNothingCreated();
    }

    @Test
    void tc0611AnAmountPaidAboveTheTotalIsRejected() {
        purchase(25_000_000L, PaymentMethod.CASH);
        threeLines();

        Throwable thrown = catchThrowable(() -> post(6, false));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE06_13);
        assertThat(((DomainException) thrown).getParams()).containsEntry("amount", 24_500_000L);
        assertNothingCreated();
    }

    @Test
    void tc0612AnAmountPaidWithoutAPaymentMethodIsRejected() {
        purchase(1_000_000L, null);
        threeLines();

        Throwable thrown = catchThrowable(() -> post(6, false));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "paymentMethod");
        assertNothingCreated();
    }

    @Test
    void tc0613MatchingVaccinationSchedulesAreListedButTheCattleAreNotEnrolled() {
        purchase(0L, null);
        threeLines();
        schedules = List.of(schedule(1L, "Fattening"), schedule(2L, "all cattle"), schedule(3L, "CALVES"));

        EntryDtos.PostResult result = post(6, false);

        assertThat(result.matchingSchedules()).extracting(EntryDtos.MatchingSchedule::scheduleId).containsExactly(1L, 2L);
        assertThat(result.matchingSchedules().get(0).cattleCodes()).containsExactly("BC-000011", "BC-000012", "BC-000013");
        assertThat(result.schedulesNotice().code()).isEqualTo(MessageCodes.FE06_05);
        assertThat(result.schedulesNotice().params()).containsEntry("count", 2);
        verify(em, never()).persist(any());
    }

    private VaccinationSchedule schedule(long id, String target) {
        VaccinationSchedule s = new VaccinationSchedule();
        s.setId(id);
        s.setTargetGroup(target);
        s.setStatus("ACTIVE");
        return s;
    }

    @Test
    void tc0614AKnownVaccinationBecomesOneHistoricalRecord() {
        purchase(0L, null);
        Vaccine fmd = new Vaccine();
        fmd.setId(51L);
        fmd.setName("LMLM");
        fmd.setDose("2 ml");
        when(catalog.vaccine(FARM_ID, 51L)).thenReturn(Optional.of(fmd));
        LocalDate march = LocalDate.of(2026, 3, 15);
        line(1, Sex.MALE, "T-01", data(Sex.MALE, new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, "So tiem cua nguoi ban",
            List.of(new EntryLineRequest.VaccinationItem(51L, null, march, null))), null));

        post(6, false);

        ArgumentCaptor<Vaccination> saved = ArgumentCaptor.forClass(Vaccination.class);
        verify(vaccinations).save(saved.capture());
        assertThat(saved.getValue().getSource()).isEqualTo("HISTORICAL");
        assertThat(saved.getValue().getVaccine()).isSameAs(fmd);
        assertThat(saved.getValue().getVaccinationDate()).isEqualTo(march);
        assertThat(saved.getValue().getScheduledDose()).isNull();
        assertThat(saved.getValue().getVaccinator()).isEqualTo(HerdEntryPostingService.PRE_ENTRY_VACCINATOR);
        ArgumentCaptor<PreEntryHistoryDeclaration> declared = ArgumentCaptor.forClass(PreEntryHistoryDeclaration.class);
        verify(declarations, times(2)).save(declared.capture());
        assertThat(declared.getAllValues()).extracting(PreEntryHistoryDeclaration::getCategory)
            .containsExactly(DeclarationCategory.VACCINATION, DeclarationCategory.DISEASE);
    }

    @Test
    void tc0614aACatalogueDoseAndAFreeTextDoseWithoutDateAreBothKept() {
        purchase(0L, null);
        Vaccine fmd = new Vaccine();
        fmd.setId(51L);
        fmd.setName("LMLM");
        when(catalog.vaccine(FARM_ID, 51L)).thenReturn(Optional.of(fmd));
        line(1, Sex.MALE, "T-01", data(Sex.MALE, new EntryLineRequest.VaccinationDeclaration(DeclarationStatus.KNOWN, "Nguoi ban ke", List.of(
            new EntryLineRequest.VaccinationItem(51L, null, LocalDate.of(2026, 3, 15), null),
            new EntryLineRequest.VaccinationItem(null, "  Tu huyet trung  ", null, null))), null));

        post(6, false);

        ArgumentCaptor<Vaccination> saved = ArgumentCaptor.forClass(Vaccination.class);
        verify(vaccinations, times(2)).save(saved.capture());
        Vaccination free = saved.getAllValues().get(1);
        assertThat(free.getVaccine()).isNull();
        assertThat(free.getVaccineNameSnapshot()).isEqualTo("Tu huyet trung");
        assertThat(free.getVaccinationDate()).isEqualTo(ENTRY_DATE);
        assertThat(free.getInformationSource()).isEqualTo("Nguoi ban ke; " + HerdEntryPostingService.UNKNOWN_VACCINATION_DATE);
    }

    @Test
    void tc0615APregnantCowWithTwoEarlierCalvingsGetsParityTwoAndAPregnancyCheckReminder() {
        purchase(0L, null);
        HerdEntry line = line(1, Sex.FEMALE, "T-01", data(Sex.FEMALE, noVaccination(),
            new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 2, YesNoUnknown.YES, 4, "Mang thai khoang 4 thang")));

        post(6, false);

        assertThat(createdCattle).singleElement().satisfies(c -> assertThat(c.getDeclaredParity()).isEqualTo(2));
        verify(reminders).pregnancyCheckAtEntry(line, createdCattle.get(0));
        ArgumentCaptor<PreEntryHistoryDeclaration> declared = ArgumentCaptor.forClass(PreEntryHistoryDeclaration.class);
        verify(declarations, times(3)).save(declared.capture());
        assertThat(declared.getAllValues().get(2)).satisfies(d -> {
            assertThat(d.getCategory()).isEqualTo(DeclarationCategory.REPRODUCTION);
            assertThat(d.getPregnantAtEntry()).isEqualTo(YesNoUnknown.YES);
            assertThat(d.getEstMonthsPregnant()).isEqualTo(4);
            assertThat(d.getEarlierCalvings()).isEqualTo(2);
        });
    }

    @Test
    void tc0622AFarmBornCalfIsRegisteredWithItsParentsAndWithoutMoney() {
        voucher(EntryType.FARM_BORN);
        Cattle dam = new Cattle();
        dam.setId(201L);
        CalfOutcome calf = new CalfOutcome();
        calf.setId(77L);
        calf.setRegistrationState("PENDING_CONFIRMATION");
        HerdEntry line = line(1, Sex.FEMALE, null, data(Sex.FEMALE, noVaccination(), null));
        line.setCalfOutcome(calf);
        resolvedByLine.put(1, new Resolved(1, data(Sex.FEMALE, noVaccination(), null), brahman, fattening, pen, Sex.FEMALE, ENTRY_DATE,
            BirthDateAccuracy.EXACT, LifeStage.UNWEANED_CALF, null, null, null, null, 0L, null, null, null, calf, dam, null, "SIRE-EXT-01", ENTRY_DATE));

        post(6, false);

        verify(catalog).lockCalf(FARM_ID, 77L);
        assertThat(createdCattle).singleElement().satisfies(c -> {
            assertThat(c.getDam()).isSameAs(dam);
            assertThat(c.getExternalSireCode()).isEqualTo("SIRE-EXT-01");
            assertThat(c.getLifeStage()).isEqualTo(LifeStage.UNWEANED_CALF);
            assertThat(c.getBirthDate()).isEqualTo(ENTRY_DATE);
        });
        assertThat(calf.getRegistrationState()).isEqualTo("REGISTERED");
        assertThat(calf.getRegisteredCattle()).isSameAs(createdCattle.get(0));
        verify(em).merge(calf);
        verify(reminders).resolveCalfReminder(calf);
        assertThat(voucher.getCattleAmount()).isZero();
        verifyNoInteractions(declarations, payments);
    }

    @Test
    void tcAnnt060102ACalfTagCodeAlreadyInUseIsRejected() {
        voucher(EntryType.FARM_BORN);
        CalfOutcome calf = new CalfOutcome();
        calf.setId(77L);
        calf.setTagCode(" QB-7 ");
        line(1, Sex.FEMALE, null, data(Sex.FEMALE, noVaccination(), null));
        resolvedByLine.put(1, new Resolved(1, data(Sex.FEMALE, noVaccination(), null), brahman, fattening, pen, Sex.FEMALE, ENTRY_DATE,
            BirthDateAccuracy.EXACT, LifeStage.UNWEANED_CALF, null, null, null, null, 0L, null, null, null, calf, null, null, null, ENTRY_DATE));
        when(qrTags.existsByTagCode("QB-7")).thenReturn(true);

        Throwable thrown = catchThrowable(() -> post(6, false));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, HerdEntryCodes.FE12_08);
        assertThat(((DomainException) thrown).getParams()).containsEntry("tag_code", "QB-7");
        assertThat(createdTags).isEmpty();
    }

    @Test
    void tcAnnt060103AStaleOrMissingVoucherVersionIsAConflict() {
        purchase(0L, null);
        threeLines();

        assertDomain(catchThrowable(() -> post(5, false)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertDomain(catchThrowable(() -> service.post(FARM_ID, 81L, null)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingCreated();
    }

    @Test
    void tcAnnt060104AVoidedVoucherCannotBePosted() {
        purchase(0L, null);
        threeLines();
        voucher.setStatus(EntryVoucherStatus.VOIDED);

        assertDomain(catchThrowable(() -> post(6, false)), HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(createdCattle).isEmpty();
    }

    @Test
    void tcAnnt060105AVoucherOfAnotherFarmIsNotFound() {
        when(vouchers.lockByIdAndFarmId(FARM_ID, 99L)).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() -> service.post(FARM_ID, 99L, new EntryActionRequests.PostRequest(1, false)));

        assertDomain(thrown, HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        verifyNoInteractions(cattleRepository, audit);
    }

    @Test
    void tc0637ATechnicianCannotPostAnEntryVoucher() {
        when(access.require(FARM_ID, FarmAction.MANAGE_ENTRY_VOUCHERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> post(6, false)), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_ENTRY_VOUCHERS.allows(FarmRole.TECHNICIAN)).isFalse();
        verifyNoInteractions(vouchers, cattleRepository, audit);
        verify(cattleRepository, never()).saveAndFlush(any());
    }
}
