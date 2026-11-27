package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
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
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleProfileChange;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.ProfileFieldGroup;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ReplacementReason;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.service.dto.CattleDtos;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of the four FE-05 use cases (D88
 * numbering): UC-FE05-01 View Cattle List and Profile ({@link CattleProfileService#list}, {@link CattleProfileService#get}), UC-FE05-02 Update Cattle
 * Profile ({@link CattleProfileService#update}), UC-FE05-03 Issue or Replace Cattle QR Tag
 * ({@link CattleProfileService#issueTag}) and UC-FE05-04 Scan Cattle QR Code ({@link CattleProfileService#resolve}).
 * The JPQL queries are mocked {@link TypedQuery} objects chosen by their text; the cattle guard is the real
 * {@link CattleGuardService} over mocked repositories. The farm clock is fixed at 27/11/2026 10:00 (UTC+7).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CattleProfileServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final long FARM_ID = 501L;
    private static final ObjectMapper MAPPER = JsonMapper.builder()
        .addModule(new JavaTimeModule())
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .build();
    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock HerdExitRepository exits;
    @Mock CattleRepository cattleRepository;
    @Mock PenAssignmentService placements;
    @Mock GrowthAssessmentService growth;
    @Mock CattleStateService state;
    @Mock AuditService audit;
    @Mock CodeSequenceService codes;
    @Mock CattleQrTagRepository tags;
    @Mock OutboxService outbox;
    @Mock EntryDeclarationReadService declarations;

    private CattleProfileService service;
    private Farm farm;
    private AppUser owner;
    private Breed brahman;
    private final Map<PurposeType, ProductionPurpose> purposes = new HashMap<>();
    private final Map<Long, BigDecimal> weights = new HashMap<>();
    private final List<CattleProfileChange> history = new ArrayList<>();
    private final List<CattleQrTag> persistedTags = new ArrayList<>();

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        service = new CattleProfileService(em, access, new CattleGuardService(exits, cattleRepository, clock), clock, placements, growth, state, audit,
            codes, tags, outbox, MAPPER, declarations);
        farm = new Farm();
        farm.setId(FARM_ID);
        owner = new AppUser();
        owner.setId(31L);
        owner.setFullName("Nguyen Thanh An");
        brahman = new Breed();
        brahman.setId(21L);
        brahman.setName("Brahman");
        long id = 61;
        for (PurposeType type : PurposeType.values()) {
            ProductionPurpose p = new ProductionPurpose();
            p.setId(id++);
            p.setName(type.name().charAt(0) + type.name().substring(1).toLowerCase());
            p.setPurposeType(type);
            p.setAvailable(true);
            p.setFarm(farm);
            purposes.put(type, p);
            when(em.find(ProductionPurpose.class, p.getId())).thenReturn(p);
        }
        caller(FarmRole.OWNER);
        when(exits.findFirstByCattleIdAndStatus(anyLong(), eq(ExitLineStatus.PENDING))).thenReturn(Optional.empty());
        when(placements.findOpen(anyLong())).thenReturn(Optional.empty());
        when(growth.summary(any(Cattle.class), eq(90))).thenAnswer(inv -> summary(weights.get(inv.<Cattle>getArgument(0).getId())));
        when(em.createQuery(contains("from HerdEntry h"), eq(HerdEntry.class))).thenAnswer(inv -> rows(List.of()));
        when(em.createQuery(contains("from PregnancyEpisode p"), eq(Long.class))).thenAnswer(inv -> count(0));
        when(em.createQuery(contains("lower(c.earTagNumber)=:tag"), eq(Long.class))).thenAnswer(inv -> count(0));
        when(em.createQuery(contains("from Reminder r"), eq(Reminder.class))).thenAnswer(inv -> rows(List.of()));
        when(em.createQuery(contains("from CalfOutcome o"), eq(Long.class))).thenAnswer(inv -> count(0));
        when(em.createQuery(contains("lower(c.displayCode)=:code"), eq(Cattle.class))).thenAnswer(inv -> rows(List.of()));
        org.mockito.Mockito.doAnswer(inv -> {
            Object entity = inv.getArgument(0);
            if (entity instanceof CattleProfileChange change) {
                history.add(change);
            } else if (entity instanceof CattleQrTag tag) {
                tag.setId(700L + persistedTags.size());
                persistedTags.add(tag);
            }
            return null;
        }).when(em).persist(any());
    }

    private void caller(FarmRole role) {
        FarmContext ctx = new FarmContext(farm, owner, role);
        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenReturn(ctx);
    }

    private static GrowthDtos.Summary summary(BigDecimal weight) {
        GrowthDtos.Record current = weight == null
            ? null
            : new GrowthDtos.Record(1L, 1L, NOW, NOW, 31L, "An", "SCALE", weight, "MEASURED", null, null, null, null, "VALID", false, 0, null);
        return new GrowthDtos.Summary(current, null, null, 90, null, null, null, weight == null ? 0 : 1, List.of(), null, null, null, null);
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> rows(List<T> rows) {
        TypedQuery<T> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getResultList()).thenReturn(rows);
        when(query.getResultStream()).thenAnswer(inv -> rows.stream());
        return query;
    }

    @SuppressWarnings("unchecked")
    private static TypedQuery<Long> count(long value) {
        TypedQuery<Long> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getSingleResult()).thenReturn(value);
        return query;
    }

    private Cattle cattle(long id, Sex sex, LifeStage stage, PurposeType purpose) {
        Cattle c = new Cattle();
        c.setId(id);
        c.setFarm(farm);
        c.setDisplayCode("BO-0" + id);
        c.setSex(sex);
        c.setLifeStage(stage);
        c.setPurpose(purposes.get(purpose));
        c.setBreed(brahman);
        c.setHerdStatus(HerdStatus.ACTIVE);
        c.setBirthDate(LocalDate.of(2024, 3, 1));
        c.setVersion(2);
        when(cattleRepository.lockByIdAndFarmId(FARM_ID, id)).thenReturn(Optional.of(c));
        when(em.find(Cattle.class, id)).thenReturn(c);
        return c;
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    private static Set<String> invalidFields(Object request) {
        return VALIDATOR.validate(request).stream().map(v -> v.getPropertyPath().toString()).collect(Collectors.toSet());
    }

    // ------------------------------------------------------------------ UC-FE05-01 list()

    private void herd(List<Cattle> cattle) {
        when(em.createQuery(startsWith("select c from Cattle c join fetch c.breed"), eq(Cattle.class))).thenAnswer(inv -> rows(cattle));
    }

    private CattleDtos.Page list(String q, String herdStatus, int page, int size, String sort) {
        return service.list(FARM_ID, q, herdStatus, null, null, null, null, null, null, null, page, size, sort, null);
    }

    private String groupOf(Sex sex, LifeStage stage, PurposeType purpose) {
        herd(List.of(cattle(101L, sex, stage, purpose)));
        CattleDtos.Page page = list(null, null, 0, 20, null);
        String group = page.items().get(0).herdGroup();
        assertThat(page.counts()).containsEntry(group, 1L);
        return group;
    }

    @Test
    void tc0501AnAdultBreedingCowIsABreedingFemale() {
        assertThat(groupOf(Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING)).isEqualTo("BREEDING_FEMALES");
    }

    @Test
    void tc0502AWeanedCalfIsACalfWhateverItsPurpose() {
        assertThat(groupOf(Sex.FEMALE, LifeStage.WEANED_CALF, PurposeType.BREEDING)).isEqualTo("CALVES");
    }

    @Test
    void tc0503AnAdultFatteningBullIsFattening() {
        assertThat(groupOf(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING)).isEqualTo("FATTENING");
    }

    @Test
    void tc0504AnAdultSireIsABreedingBull() {
        assertThat(groupOf(Sex.MALE, LifeStage.ADULT, PurposeType.SIRE)).isEqualTo("BREEDING_BULLS");
    }

    @Test
    void tc0505AYoungBreedingHeiferIsYoungStock() {
        assertThat(groupOf(Sex.FEMALE, LifeStage.YOUNG_STOCK, PurposeType.BREEDING)).isEqualTo("YOUNG_STOCK");
    }

    @Test
    void tc0506AnAdultCowWithUndecidedPurposeIsOther() {
        assertThat(groupOf(Sex.FEMALE, LifeStage.ADULT, PurposeType.UNDECIDED)).isEqualTo("OTHER");
    }

    @Test
    void tc0507TheCountsSplitTheActiveHerdIntoGroupsAndKeepExitedAndVoidedApart() {
        List<Cattle> herd = new ArrayList<>();
        PurposeType[] types = { PurposeType.FATTENING, PurposeType.BREEDING, PurposeType.SIRE, PurposeType.UNDECIDED };
        for (int i = 0; i < 25; i++) {
            Cattle c = cattle(200L + i, i % 2 == 0 ? Sex.FEMALE : Sex.MALE, i % 5 == 0 ? LifeStage.WEANED_CALF : LifeStage.ADULT, types[i % 4]);
            if (i >= 20) {
                c.setHerdStatus(i < 23 ? HerdStatus.EXITED : HerdStatus.VOIDED);
            }
            herd.add(c);
        }
        herd(herd);

        CattleDtos.Page page = list(null, null, 0, 50, null);

        assertThat(page.total()).isEqualTo(20);
        assertThat(page.counts()).containsEntry("ACTIVE", 20L).containsEntry("EXITED", 3L).containsEntry("VOIDED", 2L).containsKey("OTHER");
        long groups = List.of("CALVES", "FATTENING", "BREEDING_BULLS", "BREEDING_FEMALES", "YOUNG_STOCK", "OTHER").stream()
            .mapToLong(page.counts()::get).sum();
        assertThat(groups).isEqualTo(20);
        assertThat(list(null, "ALL", 0, 50, null).total()).isEqualTo(25);
        assertThat(list(null, "EXITED", 0, 50, null).total()).isEqualTo(3);
    }

    @Test
    void tcAnnt050101TheSearchMatchesDisplayCodeEarTagOrNameIgnoringCase() {
        Cattle a = cattle(101L, Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);
        a.setEarTagNumber("T-01");
        Cattle b = cattle(102L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        b.setName("Ba Vang");
        herd(List.of(a, b));

        assertThat(list("t-01", null, 0, 20, null).items()).extracting(CattleDtos.Profile::id).containsExactly(101L);
        assertThat(list("BA VANG", null, 0, 20, null).items()).extracting(CattleDtos.Profile::id).containsExactly(102L);
        assertThat(list("bo-0102", null, 0, 20, null).items()).extracting(CattleDtos.Profile::id).containsExactly(102L);
        assertThat(list("khong co", null, 0, 20, null).items()).isEmpty();
    }

    @Test
    void tcAnnt050102OnlyOwnersAndManagersSeeTheExitPendingFilter() {
        Cattle pending = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        Cattle other = cattle(102L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        herd(List.of(pending, other));
        when(exits.findFirstByCattleIdAndStatus(101L, ExitLineStatus.PENDING)).thenReturn(Optional.of(deathLine()));

        assertThat(list(null, "EXIT_PENDING", 0, 20, null).items()).extracting(CattleDtos.Profile::id).containsExactly(101L);
        caller(FarmRole.TECHNICIAN);
        assertThat(list(null, "EXIT_PENDING", 0, 20, null).items()).isEmpty();
        assertThat(list(null, null, 0, 20, null).items()).allSatisfy(p -> assertThat(p.exitPending()).isFalse());
    }

    private static HerdExit deathLine() {
        HerdExitVoucher voucher = new HerdExitVoucher();
        voucher.setId(61L);
        voucher.setExitType(ExitType.DEATH);
        voucher.setLossKind(LossKind.DIED);
        voucher.setExitDate(LocalDate.of(2026, 11, 25));
        HerdExit line = new HerdExit();
        line.setVoucher(voucher);
        line.setStatus(ExitLineStatus.PENDING);
        return line;
    }

    @Test
    void tcAnnt050103PenWeightAndWithdrawalFiltersUseTheDerivedValues() {
        Cattle a = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        Cattle b = cattle(102L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        Cattle c = cattle(103L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        herd(List.of(a, b, c));
        Pen pen = new Pen();
        pen.setId(11L);
        pen.setCode("A-01");
        PenAssignment open = new PenAssignment();
        open.setPen(pen);
        open.setFromDate(LocalDate.of(2026, 11, 1));
        when(placements.findOpen(101L)).thenReturn(Optional.of(open));
        weights.put(102L, new BigDecimal("320.5"));
        when(state.state(b)).thenReturn(Map.of("withdrawalEndDate", TODAY));
        when(state.state(c)).thenReturn(Map.of("withdrawalEndDate", TODAY.minusDays(1)));

        assertThat(service.list(FARM_ID, null, null, null, null, 11L, null, null, null, null, 0, 20, null, null).items())
            .extracting(CattleDtos.Profile::id).containsExactly(101L);
        assertThat(service.list(FARM_ID, null, null, null, null, null, null, null, null, null, 0, 20, null, true).items())
            .extracting(CattleDtos.Profile::id).containsExactly(102L);
        assertThat(service.list(FARM_ID, null, null, null, null, null, null, null, "MEAT_WITHDRAWAL", null, 0, 20, null, null).items())
            .extracting(CattleDtos.Profile::id).containsExactly(102L);
    }

    @Test
    void tcAnnt050104SortingByWeightDescendingKeepsCattleWithoutWeightLast() {
        herd(List.of(
            cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING),
            cattle(102L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING),
            cattle(103L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING)
        ));
        weights.put(101L, new BigDecimal("300"));
        weights.put(103L, new BigDecimal("450"));

        assertThat(list(null, null, 0, 20, "-latestWeightKg").items()).extracting(CattleDtos.Profile::id).containsExactly(103L, 101L, 102L);
        assertThat(list(null, null, 0, 20, "latestWeightKg").items()).extracting(CattleDtos.Profile::id).containsExactly(101L, 103L, 102L);
    }

    @Test
    void tcAnnt050105PagesCutTheFilteredRowsAndKeepTheTotal() {
        List<Cattle> herd = new ArrayList<>();
        for (long id = 101; id <= 105; id++) {
            herd.add(cattle(id, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING));
        }
        herd(herd);

        CattleDtos.Page page = list(null, null, 1, 2, null);

        assertThat(page.total()).isEqualTo(5);
        assertThat(page.items()).extracting(CattleDtos.Profile::id).containsExactly(103L, 104L);
        assertThat(list(null, null, 0, 200, null).items()).hasSize(5);
    }

    @Test
    void tcAnnt050106InvalidPagingStatusOrSortParametersAreRejected() {
        herd(List.of());

        assertDomain(catchThrowable(() -> list(null, null, 0, 0, null)), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> list(null, null, 0, 201, null)), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> list(null, null, -1, 20, null)), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        Throwable status = catchThrowable(() -> list(null, "SOLD", 0, 20, null));
        assertDomain(status, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) status).getParams()).containsEntry("field", "herdStatus");
        Throwable sort = catchThrowable(() -> list(null, null, 0, 20, "weight"));
        assertThat(((DomainException) sort).getParams()).containsEntry("field", "sort");
    }

    // ------------------------------------------------------------------ UC-FE05-01 get()

    private Cattle purchased() {
        Cattle c = cattle(111L, Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);
        c.setEarTagNumber("T-11");
        c.setName("Mai");
        c.setColourMarkings("Vang, dom trang tren tran");
        c.setNotes("Hien");
        Cattle dam = new Cattle();
        dam.setId(55L);
        dam.setDisplayCode("BO-055");
        c.setDam(dam);
        c.setExternalSireCode("RED-ANGUS-7");
        Pen pen = new Pen();
        pen.setId(11L);
        pen.setCode("A-01");
        pen.setName("Chuong sinh san 1");
        PenAssignment open = new PenAssignment();
        open.setPen(pen);
        open.setFromDate(LocalDate.of(2026, 10, 12));
        when(placements.findOpen(111L)).thenReturn(Optional.of(open));
        weights.put(111L, new BigDecimal("385.5"));
        vn.edu.fpt.beefcare.domain.TradingPartner seller = new vn.edu.fpt.beefcare.domain.TradingPartner();
        seller.setName("Anh Hung Ba Vi");
        HerdEntryVoucher voucher = new HerdEntryVoucher();
        voucher.setId(82L);
        voucher.setCode("PN-2610-002");
        voucher.setSeller(seller);
        HerdEntry entry = new HerdEntry();
        entry.setId(92L);
        entry.setVoucher(voucher);
        entry.setSource(vn.edu.fpt.beefcare.domain.enumeration.EntrySource.EXTERNAL);
        entry.setEntryDate(LocalDate.of(2026, 10, 12));
        entry.setEntryWeightKg(new BigDecimal("360"));
        entry.setWeightBasis(vn.edu.fpt.beefcare.domain.enumeration.WeightBasis.MEASURED);
        entry.setQuarantineUntil(LocalDate.of(2026, 10, 26));
        when(em.createQuery(contains("from HerdEntry h"), eq(HerdEntry.class))).thenAnswer(inv -> rows(List.of(entry)));
        when(declarations.forEntry(entry)).thenReturn(List.of(
            new CattleDtos.Declaration("VACCINATION", "UNKNOWN", null, null, "Nguoi ban", null, null, null),
            new CattleDtos.Declaration("REPRODUCTION", "KNOWN", null, null, "Nguoi ban", 1, "YES", 4)
        ));
        return c;
    }

    @Test
    void tcAnnt050107TheOwnerSeesIdentityStatePenEntryAndEveryAction() {
        Cattle c = purchased();
        when(state.state(c)).thenReturn(Map.of("healthState", "HEALTHY", "withdrawalEndDate", TODAY.plusDays(3)));

        CattleDtos.Profile profile = service.get(FARM_ID, 111L);

        assertThat(profile.displayCode()).isEqualTo("BO-0111");
        assertThat(profile.earTagNumber()).isEqualTo("T-11");
        assertThat(profile.breedName()).isEqualTo("Brahman");
        assertThat(profile.purposeType()).isEqualTo(PurposeType.BREEDING);
        assertThat(profile.herdGroup()).isEqualTo("BREEDING_FEMALES");
        assertThat(profile.penCode()).isEqualTo("A-01");
        assertThat(profile.penSince()).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(profile.latestWeightKg()).isEqualByComparingTo("385.5");
        assertThat(profile.healthState()).isEqualTo("HEALTHY");
        assertThat(profile.withdrawalActive()).isTrue();
        assertThat(profile.colourMarkings()).isEqualTo("Vang, dom trang tren tran");
        assertThat(profile.notes()).isEqualTo("Hien");
        assertThat(profile.damCode()).isEqualTo("BO-055");
        assertThat(profile.sireCode()).isNull();
        assertThat(profile.externalSireCode()).isEqualTo("RED-ANGUS-7");
        assertThat(profile.canUpdate()).isTrue();
        assertThat(profile.canChangePurpose()).isTrue();
        assertThat(profile.quarantineUntil()).isEqualTo(LocalDate.of(2026, 10, 26));
        CattleDtos.Entry entry = profile.entry();
        assertThat(entry.source()).isEqualTo("EXTERNAL");
        assertThat(entry.weightKg()).isEqualByComparingTo("360");
        assertThat(entry.weightBasis()).isEqualTo("MEASURED");
        assertThat(entry.voucherCode()).isEqualTo("PN-2610-002");
        assertThat(entry.seller()).isEqualTo("Anh Hung Ba Vi");
        assertThat(entry.declarations()).extracting(CattleDtos.Declaration::status).containsExactly("UNKNOWN", "KNOWN");
        verify(access).require(FARM_ID, FarmAction.VIEW_CATTLE);
        verifyNoInteractions(audit, outbox);
        verify(em, never()).persist(any());
    }

    @Test
    void tc0535ATechnicianSeesTheDeclarationsButNoVoucherMoneyOrActions() {
        purchased();
        caller(FarmRole.TECHNICIAN);

        CattleDtos.Profile profile = service.get(FARM_ID, 111L);

        assertThat(profile.canUpdate()).isFalse();
        assertThat(profile.canChangePurpose()).isFalse();
        assertThat(profile.entry().entryDate()).isEqualTo(LocalDate.of(2026, 10, 12));
        assertThat(profile.entry().id()).isNull();
        assertThat(profile.entry().voucherId()).isNull();
        assertThat(profile.entry().voucherCode()).isNull();
        assertThat(profile.entry().seller()).isNull();
        assertThat(profile.entry().declarations()).hasSize(2);
    }

    @Test
    void tcAnnt050108AManagerCanUpdateButNotChangeThePurpose() {
        purchased();
        caller(FarmRole.MANAGER);

        CattleDtos.Profile profile = service.get(FARM_ID, 111L);

        assertThat(profile.canUpdate()).isTrue();
        assertThat(profile.canChangePurpose()).isFalse();
        assertThat(profile.entry().voucherCode()).isEqualTo("PN-2610-002");
    }

    @Test
    void tc0521ACattleOnAPendingDeathVoucherShowsExitPendingAndCannotBeUpdated() {
        purchased();
        when(exits.findFirstByCattleIdAndStatus(111L, ExitLineStatus.PENDING)).thenReturn(Optional.of(new HerdExit()));

        CattleDtos.Profile owner = service.get(FARM_ID, 111L);
        caller(FarmRole.TECHNICIAN);
        CattleDtos.Profile technician = service.get(FARM_ID, 111L);

        assertThat(owner.exitPending()).isTrue();
        assertThat(owner.canUpdate()).isFalse();
        assertThat(technician.exitPending()).isFalse();
    }

    @Test
    void tc0532AnExitedCattleOpensReadOnlyWithoutCurrentState() {
        Cattle c = purchased();
        c.setHerdStatus(HerdStatus.EXITED);
        c.setExitType(ExitType.SALE);
        c.setExitDate(LocalDate.of(2026, 11, 20));
        when(placements.findOpen(111L)).thenReturn(Optional.empty());

        CattleDtos.Profile profile = service.get(FARM_ID, 111L);

        assertThat(profile.herdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThat(profile.exitType()).isEqualTo(ExitType.SALE);
        assertThat(profile.exitDate()).isEqualTo(LocalDate.of(2026, 11, 20));
        assertThat(profile.penCode()).isNull();
        assertThat(profile.canUpdate()).isFalse();
        assertThat(profile.healthState()).isNull();
        assertThat(profile.withdrawalActive()).isFalse();
        verify(state, never()).state(any());
    }

    @Test
    void tc0538AVoidedCattleHidesTheEntryDeclarations() {
        Cattle c = purchased();
        c.setHerdStatus(HerdStatus.VOIDED);

        CattleDtos.Profile profile = service.get(FARM_ID, 111L);

        assertThat(profile.herdStatus()).isEqualTo(HerdStatus.VOIDED);
        assertThat(profile.canUpdate()).isFalse();
        assertThat(profile.entry().voucherCode()).isEqualTo("PN-2610-002");
        assertThat(profile.entry().declarations()).isNull();
        verify(declarations, never()).forEntry(any());
        verify(state, never()).state(any());
    }

    @Test
    void tcAnnt050109AFarmBornCalfWithoutEntryOrWeightHasNoEntryBlock() {
        Cattle calf = cattle(112L, Sex.MALE, LifeStage.UNWEANED_CALF, PurposeType.UNDECIDED);
        Cattle sire = new Cattle();
        sire.setId(56L);
        sire.setDisplayCode("BO-056");
        calf.setSire(sire);

        CattleDtos.Profile profile = service.get(FARM_ID, 112L);

        assertThat(profile.herdGroup()).isEqualTo("CALVES");
        assertThat(profile.sireCode()).isEqualTo("BO-056");
        assertThat(profile.damCode()).isNull();
        assertThat(profile.entry()).isNull();
        assertThat(profile.quarantineUntil()).isNull();
        assertThat(profile.latestWeightKg()).isNull();
        assertThat(profile.penCode()).isNull();
    }

    @Test
    void tcAnnt050110ACattleOfAnotherFarmOrAnUnknownIdIsNotFound() {
        Cattle other = cattle(113L, Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);
        Farm otherFarm = new Farm();
        otherFarm.setId(502L);
        other.setFarm(otherFarm);

        assertDomain(catchThrowable(() -> service.get(FARM_ID, 113L)), HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        assertDomain(catchThrowable(() -> service.get(FARM_ID, 999L)), HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        verify(placements, never()).findOpen(113L);
    }

    @Test
    void tcAnnt050111ACallerWithoutAccessToTheFarmReadsNoProfile() {
        purchased();
        when(access.require(FARM_ID, FarmAction.VIEW_CATTLE)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> service.get(FARM_ID, 111L)), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verify(em, never()).find(Cattle.class, 111L);
    }

    // ------------------------------------------------------------------ UC-FE05-02 update()

    private static final LocalDate ENTERED = LocalDate.of(2026, 10, 10);

    private Cattle profile(Sex sex, LifeStage stage, PurposeType purpose) {
        Cattle c = cattle(101L, sex, stage, purpose);
        c.setEarTagNumber("T-09");
        c.setName("Bong");
        HerdEntryVoucher voucher = new HerdEntryVoucher();
        voucher.setId(81L);
        voucher.setCode("PN-2610-001");
        HerdEntry entry = new HerdEntry();
        entry.setId(91L);
        entry.setVoucher(voucher);
        entry.setEntryDate(ENTERED);
        when(em.createQuery(contains("from HerdEntry h"), eq(HerdEntry.class))).thenAnswer(inv -> rows(List.of(entry)));
        return c;
    }

    private static CattleDtos.ProfileUpdate change(String earTag, Long purposeId, LifeStage stage, LocalDate effective, Integer version, boolean ack) {
        return new CattleDtos.ProfileUpdate(earTag, "Bong", null, null, purposeId, stage, effective, "Cap nhat theo thuc te", version, ack);
    }

    private void assertNothingSaved() {
        assertThat(history).isEmpty();
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tc0508AnEarTagUsedByAnotherActiveCattleIsRejected() {
        profile(Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);
        when(em.createQuery(contains("lower(c.earTagNumber)=:tag"), eq(Long.class))).thenAnswer(inv -> count(1));

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change(" T-01 ", null, null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, "MSG-FE05-02");
        assertThat(((DomainException) thrown).getParams()).containsEntry("ear_tag", "T-01");
        assertNothingSaved();
    }

    @Test
    void tc0509AnEarTagLeftByAnExitedCattleCanBeReused() {
        Cattle c = profile(Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);
        TypedQuery<Long> activeOnly = count(0);
        when(em.createQuery(contains("lower(c.earTagNumber)=:tag"), eq(Long.class))).thenReturn(activeOnly);

        service.update(FARM_ID, 101L, change("T-01", null, null, TODAY, 2, false));

        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);
        verify(em, org.mockito.Mockito.atLeastOnce()).createQuery(jpql.capture(), eq(Long.class));
        assertThat(jpql.getAllValues()).anySatisfy(q -> assertThat(q).contains("c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE"));
        verify(activeOnly).setParameter("tag", "t-01");
        assertThat(c.getEarTagNumber()).isEqualTo("T-01");
        assertThat(history).singleElement().satisfies(h -> {
            assertThat(h.getFieldGroup()).isEqualTo(ProfileFieldGroup.EAR_TAG);
            assertThat(h.getOldValue()).isEqualTo("T-09");
            assertThat(h.getNewValue()).isEqualTo("T-01");
        });
    }

    @Test
    void tc0510TextFieldsStayWithinTheirLengthLimits() {
        CattleDtos.ProfileUpdate tooLong = new CattleDtos.ProfileUpdate("T".repeat(31), "N".repeat(51), "M".repeat(256), "G".repeat(1001), null, null,
            TODAY, "Cap nhat", 2, false);
        CattleDtos.ProfileUpdate atLimit = new CattleDtos.ProfileUpdate("T".repeat(30), "N".repeat(50), "M".repeat(255), "G".repeat(1000), null, null,
            TODAY, "R".repeat(500), 2, false);

        assertThat(invalidFields(tooLong)).containsExactlyInAnyOrder("earTagNumber", "name", "colourMarkings", "notes");
        assertThat(invalidFields(atLimit)).isEmpty();
    }

    @Test
    void tc0511AManagerCannotChangeThePurpose() {
        caller(FarmRole.MANAGER);
        profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.SIRE).getId(), null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.FORBIDDEN, "MSG-FE05-03");
        verify(em, never()).find(eq(ProductionPurpose.class), any());
        assertNothingSaved();
    }

    @Test
    void tc0512ABullCannotGetABreedingPurpose() {
        profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);

        Throwable thrown = catchThrowable(() ->
            service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.BREEDING).getId(), null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, "MSG-FE05-12");
        assertThat(((DomainException) thrown).getParams()).containsEntry("purpose_type", PurposeType.BREEDING).containsEntry("sex", Sex.MALE);
        assertNothingSaved();
    }

    @Test
    void tc0513ACowCanBeMovedToFattening() {
        Cattle c = profile(Sex.FEMALE, LifeStage.WEANED_CALF, PurposeType.UNDECIDED);

        CattleDtos.Profile saved = service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.FATTENING).getId(), null, TODAY, 2, false));

        assertThat(c.getPurpose().getPurposeType()).isEqualTo(PurposeType.FATTENING);
        assertThat(saved.purposeType()).isEqualTo(PurposeType.FATTENING);
        assertThat(history).singleElement().satisfies(h -> assertThat(h.getFieldGroup()).isEqualTo(ProfileFieldGroup.PURPOSE));
    }

    @Test
    void tc0514TheEffectiveDateCannotBeBeforeTheEntryDateOrInTheFuture() {
        profile(Sex.FEMALE, LifeStage.YOUNG_STOCK, PurposeType.BREEDING);

        Throwable beforeEntry = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", null, LifeStage.ADULT, ENTERED.minusDays(1), 2, false)));
        Throwable tomorrow = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", null, LifeStage.ADULT, TODAY.plusDays(1), 2, false)));

        assertDomain(beforeEntry, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_15);
        assertThat(((DomainException) beforeEntry).getParams()).containsEntry("date", ENTERED);
        assertDomain(tomorrow, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_07);
        assertNothingSaved();
    }

    @Test
    void tc0515AValidStageChangeIsRecordedOnceAndTheHerdGroupFollows() {
        Cattle c = profile(Sex.FEMALE, LifeStage.YOUNG_STOCK, PurposeType.BREEDING);
        LocalDate effective = LocalDate.of(2026, 11, 20);

        CattleDtos.Profile saved = service.update(FARM_ID, 101L, change("T-09", null, LifeStage.ADULT, effective, 2, false));

        assertThat(history).singleElement().satisfies(h -> {
            assertThat(h.getFieldGroup()).isEqualTo(ProfileFieldGroup.LIFE_STAGE);
            assertThat(h.getOldValue()).isEqualTo("YOUNG_STOCK");
            assertThat(h.getNewValue()).isEqualTo("ADULT");
            assertThat(h.getEffectiveDate()).isEqualTo(effective);
            assertThat(h.getReason()).isEqualTo("Cap nhat theo thuc te");
            assertThat(h.getChangedBy()).isSameAs(owner);
        });
        assertThat(saved.lifeStage()).isEqualTo(LifeStage.ADULT);
        assertThat(saved.herdGroup()).isEqualTo("BREEDING_FEMALES");
        assertThat(c.getUpdatedAt()).isEqualTo(NOW);
        verify(placements, never()).move(any(), any(), any(), any(), any(), any(), any(), any());
        verify(audit).log(any(FarmContext.class), eq("CATTLE_PROFILE_UPDATE"), eq("Cattle"), eq(101L), anyMap());
    }

    @Test
    void tc0516LeavingBreedingWithoutAnOpenPregnancyAsksForConfirmation() {
        profile(Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);

        Throwable thrown = catchThrowable(() ->
            service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.FATTENING).getId(), null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, "MSG-FE05-11");
        assertThat(((DomainException) thrown).getParams()).containsEntry("cattle_code", "BO-0101");
        assertNothingSaved();
    }

    @Test
    void tc0516AfterConfirmationTheCowLeavesBreeding() {
        Cattle c = profile(Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);

        CattleDtos.Profile saved = service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.FATTENING).getId(), null, TODAY, 2, true));

        assertThat(c.getPurpose().getPurposeType()).isEqualTo(PurposeType.FATTENING);
        assertThat(saved.herdGroup()).isEqualTo("FATTENING");
        assertThat(history).extracting(CattleProfileChange::getFieldGroup).containsExactly(ProfileFieldGroup.PURPOSE);
    }

    private Reminder stageSuggestion() {
        Reminder r = new Reminder();
        r.setId(44L);
        r.setRuleType("REM-08");
        r.setSourceId("STAGE:YOUNG_STOCK");
        r.setStatus("ACTIVE");
        when(em.createQuery(contains("from Reminder r"), eq(Reminder.class))).thenAnswer(inv -> rows(List.of(r)));
        return r;
    }

    @Test
    void tc0517SavingTheSuggestedStageResolvesTheStageSuggestion() {
        profile(Sex.FEMALE, LifeStage.WEANED_CALF, PurposeType.BREEDING);
        Reminder suggestion = stageSuggestion();

        service.update(FARM_ID, 101L, change("T-09", null, LifeStage.YOUNG_STOCK, LocalDate.of(2026, 11, 25), 2, false));

        assertThat(suggestion.getStatus()).isEqualTo("RESOLVED");
    }

    @Test
    void tc0518WithoutAStageChangeTheSuggestionStaysOpen() {
        Cattle c = profile(Sex.FEMALE, LifeStage.WEANED_CALF, PurposeType.BREEDING);
        Reminder suggestion = stageSuggestion();

        service.update(FARM_ID, 101L, new CattleDtos.ProfileUpdate("T-09", "Bong", null, "Can theo doi", null, null, TODAY, "Ghi chu", 2, false));

        assertThat(c.getLifeStage()).isEqualTo(LifeStage.WEANED_CALF);
        assertThat(suggestion.getStatus()).isEqualTo("ACTIVE");
        verify(em, never()).createQuery(contains("from Reminder r"), eq(Reminder.class));
    }

    @Test
    void tc0519ADiscontinuedPurposeCannotBeChosen() {
        profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        purposes.get(PurposeType.SIRE).setAvailable(false);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.SIRE).getId(), null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_08);
        assertNothingSaved();
    }

    @Test
    void tc0520AnExitedCattleCannotBeUpdated() {
        Cattle c = profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        c.setHerdStatus(HerdStatus.EXITED);
        c.setExitDate(LocalDate.of(2026, 11, 20));

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", null, null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_13);
        assertNothingSaved();
    }

    @Test
    void tc0521ACattleOnAPendingDeathVoucherCannotBeUpdated() {
        profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        when(exits.findFirstByCattleIdAndStatus(101L, ExitLineStatus.PENDING)).thenReturn(Optional.of(deathLine()));

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", null, null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_17);
        assertNothingSaved();
    }

    @Test
    void tcAnnt050201AStaleProfileVersionIsAConflict() {
        profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-01", null, null, TODAY, 1, false)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertNothingSaved();
    }

    @Test
    void tcAnnt050202APurposeOfAnotherFarmIsRejected() {
        profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        Farm other = new Farm();
        other.setId(999L);
        purposes.get(PurposeType.SIRE).setFarm(other);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.SIRE).getId(), null, TODAY, 2, false)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "productionPurposeId");
        assertNothingSaved();
    }

    @Test
    void tcAnnt050203DescriptiveChangesAreRecordedAsOneEntryAndBlanksBecomeEmpty() {
        Cattle c = profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);

        service.update(FARM_ID, 101L, new CattleDtos.ProfileUpdate("T-09", "   ", " Lang trang ", null, null, null, TODAY, "Bo sung", 2, false));

        assertThat(c.getName()).isNull();
        assertThat(c.getColourMarkings()).isEqualTo("Lang trang");
        assertThat(history).singleElement().satisfies(h -> {
            assertThat(h.getFieldGroup()).isEqualTo(ProfileFieldGroup.DESCRIPTIVE);
            assertThat(h.getOldValue()).contains("\"name\":\"Bong\"");
            assertThat(h.getNewValue()).contains("\"colourMarkings\":\"Lang trang\"");
        });
    }

    @Test
    void tcAnnt050204AnUnchangedProfileWritesNoHistoryButStillTouchesTheCattle() {
        Cattle c = profile(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);

        service.update(FARM_ID, 101L, change("T-09", purposes.get(PurposeType.FATTENING).getId(), LifeStage.ADULT, TODAY, 2, false));

        assertThat(history).isEmpty();
        verify(em, never()).createQuery(contains("lower(c.earTagNumber)=:tag"), eq(Long.class));
        verify(em, never()).find(eq(ProductionPurpose.class), any());
        assertThat(c.getUpdatedAt()).isEqualTo(NOW);
        verify(outbox).enqueue(eq(FARM_ID), eq("CATTLE_PROFILE_UPDATED"), eq("Cattle"), eq(101L), anyMap());
    }

    // ------------------------------------------------------------------ UC-FE05-03 issueTag()

    private CattleQrTag tag(long id, Cattle c, String code, QrTagStatus status) {
        CattleQrTag t = new CattleQrTag();
        t.setId(id);
        t.setFarm(farm);
        t.setCattle(c);
        t.setTagCode(code);
        t.setStatus(status);
        t.setIssuedAt(Instant.parse("2026-10-10T02:00:00Z"));
        return t;
    }

    @Test
    void tc0522ReplacingALostTagRetiresTheOldOneAndKeepsTheDisplayCode() {
        Cattle c = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        CattleQrTag q1 = tag(601L, c, "Q1", QrTagStatus.ACTIVE);
        when(tags.findFirstByCattleIdAndStatus(101L, QrTagStatus.ACTIVE)).thenReturn(Optional.of(q1));

        CattleDtos.Tag issued = service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(ReplacementReason.LOST, "Q2", "In lai", 2));

        assertThat(q1.getStatus()).isEqualTo(QrTagStatus.REPLACED);
        assertThat(q1.getReplacementReason()).isEqualTo(ReplacementReason.LOST);
        assertThat(q1.getClosedAt()).isEqualTo(NOW);
        assertThat(persistedTags).singleElement().satisfies(q2 -> {
            assertThat(q2.getStatus()).isEqualTo(QrTagStatus.ACTIVE);
            assertThat(q2.getIssuedBy()).isSameAs(owner);
            assertThat(q1.getReplacedByTag()).isSameAs(q2);
        });
        assertThat(issued.tagCode()).isEqualTo("Q2");
        assertThat(issued.displayCode()).isEqualTo("BO-0101");
        assertThat(issued.scanUrl()).isEqualTo("/tags/Q2");
        assertThat(c.getDisplayCode()).isEqualTo("BO-0101");
        verify(audit).log(any(FarmContext.class), eq("CATTLE_QR_ISSUE"), eq("Cattle"), eq(101L), eq(Map.of("tagCode", "Q2")));
    }

    @Test
    void tc0523ReplacingATagWithoutAReasonIsRejected() {
        Cattle c = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        when(tags.findFirstByCattleIdAndStatus(101L, QrTagStatus.ACTIVE)).thenReturn(Optional.of(tag(601L, c, "Q1", QrTagStatus.ACTIVE)));

        Throwable thrown = catchThrowable(() -> service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(null, "Q2", null, 2)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "reason");
        assertThat(persistedTags).isEmpty();
    }

    @Test
    void tc0524TheFirstTagNeedsNoReasonAndGetsAGeneratedCode() {
        cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        when(tags.findFirstByCattleIdAndStatus(101L, QrTagStatus.ACTIVE)).thenReturn(Optional.empty());
        when(codes.nextQrTagCode(FARM_ID)).thenReturn("QR7K2M9X");

        CattleDtos.Tag issued = service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(null, null, null, 2));

        assertThat(issued.tagCode()).isEqualTo("QR7K2M9X");
        assertThat(issued.status()).isEqualTo("ACTIVE");
        assertThat(issued.reason()).isNull();
        assertThat(persistedTags).hasSize(1);
    }

    @Test
    void tc0525APrePrintedCodeAlreadyUsedByAnotherTagIsRejected() {
        cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        when(tags.existsByTagCode("Q-PRE-01")).thenReturn(true);

        Throwable thrown = catchThrowable(() -> service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(null, " Q-PRE-01 ", null, 2)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, "MSG-FE12-08");
        assertThat(persistedTags).isEmpty();
        verifyNoInteractions(audit);
    }

    @Test
    void tc0520AnExitedCattleCannotGetANewTag() {
        Cattle c = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        c.setHerdStatus(HerdStatus.EXITED);

        Throwable thrown = catchThrowable(() -> service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(null, "Q2", null, 2)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_13);
        assertThat(persistedTags).isEmpty();
    }

    @Test
    void tcAnnt050301AStaleCattleVersionIsAConflict() {
        cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);

        Throwable thrown = catchThrowable(() -> service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(null, "Q2", null, 1)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(persistedTags).isEmpty();
    }

    @Test
    void tcAnnt050302ABlankTagCodeFallsBackToAGeneratedCode() {
        cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        when(codes.nextQrTagCode(FARM_ID)).thenReturn("QR7K2M9Y");

        assertThat(service.issueTag(FARM_ID, 101L, new CattleDtos.TagRequest(null, "   ", null, 2)).tagCode()).isEqualTo("QR7K2M9Y");
    }

    @Test
    void tcAnnt050303APrePrintedCodeIsUpToFiftyLettersDigitsHyphensOrUnderscores() {
        assertThat(invalidFields(new CattleDtos.TagRequest(null, "Q 1", null, 2))).contains("tagCode");
        assertThat(invalidFields(new CattleDtos.TagRequest(null, "Q".repeat(51), null, 2))).contains("tagCode");
        assertThat(invalidFields(new CattleDtos.TagRequest(null, "Q-1_" + "a".repeat(46), null, 2))).isEmpty();
        assertThat(invalidFields(new CattleDtos.TagRequest(null, "Q2", null, null))).contains("cattleVersion");
    }

    // ------------------------------------------------------------------ UC-FE05-04 resolve()

    @Test
    void tc0527AReplacedTagOpensTheCattleAndPointsToTheCurrentTag() {
        Cattle c = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        CattleQrTag q1 = tag(601L, c, "Q1", QrTagStatus.REPLACED);
        q1.setClosedAt(Instant.parse("2026-11-20T02:00:00Z"));
        when(tags.findByTagCode("Q1")).thenReturn(Optional.of(q1));
        when(tags.findFirstByCattleIdAndStatus(101L, QrTagStatus.ACTIVE)).thenReturn(Optional.of(tag(602L, c, "Q2", QrTagStatus.ACTIVE)));

        CattleDtos.Resolved resolved = service.resolve(FARM_ID, "Q1");

        assertThat(resolved.cattleId()).isEqualTo(101L);
        assertThat(resolved.replacedTag()).isTrue();
        assertThat(resolved.messageCode()).isEqualTo("MSG-FE05-05");
        assertThat(resolved.currentTagCode()).isEqualTo("Q2");
        assertThat(resolved.replacedAt()).isEqualTo(Instant.parse("2026-11-20T02:00:00Z"));
        assertThat(resolved.cattle().displayCode()).isEqualTo("BO-0101");
    }

    private CattleQrTag tagOfFarm(long farmId) {
        Farm other = new Farm();
        other.setId(farmId);
        Cattle c = new Cattle();
        c.setId(301L);
        c.setFarm(other);
        CattleQrTag t = tag(611L, c, "QB1", QrTagStatus.ACTIVE);
        t.setFarm(other);
        when(tags.findByTagCode("QB1")).thenReturn(Optional.of(t));
        return t;
    }

    @Test
    void tc0528ATagOfAnotherFarmOfTheUserAsksToSwitchFarmWithoutCattleData() {
        tagOfFarm(502L);
        when(access.require(502L, FarmAction.VIEW_CATTLE)).thenReturn(new FarmContext(new Farm(), owner, FarmRole.MANAGER));

        CattleDtos.Resolved resolved = service.resolve(FARM_ID, "QB1");

        assertThat(resolved.farmId()).isEqualTo(502L);
        assertThat(resolved.switchFarmRequired()).isTrue();
        assertThat(resolved.messageCode()).isEqualTo("MSG-FE05-06");
        assertThat(resolved.cattleId()).isNull();
        assertThat(resolved.cattle()).isNull();
    }

    @Test
    void tc0529ATagOfAFarmTheUserDoesNotBelongToIsNotFound() {
        tagOfFarm(503L);
        when(access.require(503L, FarmAction.VIEW_CATTLE)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> service.resolve(FARM_ID, "QB1"));

        assertDomain(thrown, HttpStatus.NOT_FOUND, "MSG-FE05-09");
        assertThat(((DomainException) thrown).getParams()).isEmpty();
    }

    @Test
    void tc0530APaymentQrCodeIsNotACattleTag() {
        Throwable link = catchThrowable(() -> service.resolve(FARM_ID, "https://img.vietqr.io/image/970422-0123456789-compact.png?amount=100000"));
        Throwable emv = catchThrowable(() -> service.resolve(FARM_ID, "00020101021238570010A00000072701270006970422011301234567890208QRIBFTTA53037045802VN6304ABCD"));

        assertDomain(link, HttpStatus.NOT_FOUND, "MSG-FE05-09");
        assertDomain(emv, HttpStatus.NOT_FOUND, "MSG-FE05-09");
        verify(tags, never()).findByTagCode(contains("vietqr"));
    }

    @Test
    void tc0531TheCodeOfADraftCalfSaysTheCalfIsNotRegisteredYet() {
        when(em.createQuery(contains("from CalfOutcome o"), eq(Long.class))).thenAnswer(inv -> count(1));

        Throwable thrown = catchThrowable(() -> service.resolve(FARM_ID, "BE-2611-01"));

        assertDomain(thrown, HttpStatus.NOT_FOUND, "MSG-FE05-10");
    }

    @Test
    void tc0533AManuallyTypedEarTagOpensThatCattle() {
        Cattle c = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        c.setEarTagNumber("T-01");
        TypedQuery<Cattle> lookup = rows(List.of(c));
        when(em.createQuery(contains("lower(c.displayCode)=:code"), eq(Cattle.class))).thenReturn(lookup);

        CattleDtos.Resolved resolved = service.resolve(FARM_ID, "  T-01 ");

        verify(lookup).setParameter("code", "t-01");
        assertThat(resolved.cattleId()).isEqualTo(101L);
        assertThat(resolved.replacedTag()).isFalse();
        assertThat(resolved.messageCode()).isNull();
    }

    @Test
    void tcAnnt050401AScanUrlIsReducedToItsTagCode() {
        Cattle c = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        when(tags.findByTagCode("Q7")).thenReturn(Optional.of(tag(607L, c, "Q7", QrTagStatus.ACTIVE)));

        CattleDtos.Resolved resolved = service.resolve(FARM_ID, "https://beefcare.vn/tags/Q7");

        assertThat(resolved.cattleId()).isEqualTo(101L);
        assertThat(resolved.replacedTag()).isFalse();
        assertThat(resolved.currentTagCode()).isNull();
    }

    @Test
    void tcAnnt050402ADisplayCodeWinsOverAnEarTagAndAnActiveCattleOverAnExitedOne() {
        Cattle byCode = cattle(101L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        byCode.setDisplayCode("T-01");
        Cattle exited = cattle(102L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        exited.setEarTagNumber("T-02");
        exited.setHerdStatus(HerdStatus.EXITED);
        Cattle active = cattle(103L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        active.setEarTagNumber("T-02");
        Cattle sameTag = cattle(104L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING);
        sameTag.setEarTagNumber("T-01");
        when(em.createQuery(contains("lower(c.displayCode)=:code"), eq(Cattle.class)))
            .thenAnswer(inv -> rows(List.of(sameTag, byCode)))
            .thenAnswer(inv -> rows(List.of(active, exited)));

        assertThat(service.resolve(FARM_ID, "t-01").cattleId()).isEqualTo(101L);
        assertThat(service.resolve(FARM_ID, "T-02").cattleId()).isEqualTo(103L);
    }

    @Test
    void tcAnnt050403AnEmptyOrOverlongCodeIsRejected() {
        assertDomain(catchThrowable(() -> service.resolve(FARM_ID, "   ")), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> service.resolve(FARM_ID, "Q".repeat(501))), HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> service.resolve(FARM_ID, "Q".repeat(500))), HttpStatus.NOT_FOUND, "MSG-FE05-09");
        verify(tags, never()).findByTagCode("   ");
    }
}
