package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
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
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of FE-08: UC-FE08-01 Record Cattle Growth
 * Assessment ({@link GrowthAssessmentService#record}), UC-FE08-02 View Growth and BCS History
 * ({@link GrowthAssessmentService#history}) and UC-FE08-03 Correct Growth Assessment Record
 * ({@link GrowthAssessmentService#correct}). The growth records, herd entry date, farm parameters and memberships live in
 * memory behind {@link FakeJpql}; the cattle guard and the record revision service are the real classes over mocked
 * repositories; the farm access check applies the real {@link FarmAction} role table. The farm clock is fixed at
 * 27/11/2026 10:00 (UTC+7). Cattle BO-0001 (FATTENING) entered the herd on 10/10/2026.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GrowthAssessmentServiceSpecUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final long FARM_ID = 701L;
    private static final long CATTLE_ID = 8001L;
    private static final LocalDate ENTRY_DATE = LocalDate.of(2026, 10, 10);

    private static ValidatorFactory factory;
    private static Validator validator;

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock CattleRepository cattleRepository;
    @Mock HerdExitRepository exits;
    @Mock RecordRevisionRepository revisionRepository;
    @Mock AuditService audit;
    @Mock OutboxService outbox;

    private GrowthAssessmentService service;
    private Farm farm;
    private Cattle cattle;
    private final Map<FarmRole, AppUser> users = new HashMap<>();
    private FarmRole role = FarmRole.MANAGER;
    private final List<Growth> growths = new ArrayList<>();
    private final List<RecordRevision> savedRevisions = new ArrayList<>();
    private final List<FarmParameterVersion> parameterVersions = new ArrayList<>();
    private final List<FarmMembership> memberships = new ArrayList<>();
    private final Map<Long, Cattle> cattleById = new HashMap<>();
    private LocalDate entryDate = ENTRY_DATE;
    private long nextId = 9001L;

    @BeforeAll
    static void startValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        factory.close();
    }

    @BeforeEach
    void setUp() {
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        RecordRevisionService revisions = new RecordRevisionService(revisionRepository, clock);
        service = new GrowthAssessmentService(em, access, new CattleGuardService(exits, cattleRepository, clock), clock, audit, revisions, outbox);
        farm = new Farm();
        farm.setId(FARM_ID);
        user(FarmRole.OWNER, 30L, "Owner Hoa");
        user(FarmRole.MANAGER, 31L, "Manager Lan");
        user(FarmRole.TECHNICIAN, 32L, "Technician Minh");
        cattle = cattle(CATTLE_ID, "BO-0001", farm, PurposeType.FATTENING);

        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenAnswer(inv -> {
            FarmAction action = inv.getArgument(1);
            if (role == null || !action.allows(role)) {
                throw DomainException.forbidden(MessageCodes.COM_01);
            }
            return new FarmContext(farm, users.get(role), role);
        });
        when(cattleRepository.lockByIdAndFarmId(anyLong(), anyLong())).thenAnswer(inv -> Optional.ofNullable(cattleById.get(inv.<Long>getArgument(1)))
            .filter(c -> c.getFarm().getId().equals(inv.getArgument(0))));
        when(exits.findFirstByCattleIdAndStatus(anyLong(), eq(ExitLineStatus.PENDING))).thenReturn(Optional.empty());
        when(em.find(eq(Cattle.class), anyLong())).thenAnswer(inv -> cattleById.get(inv.<Long>getArgument(1)));
        when(em.find(eq(Growth.class), anyLong(), eq(LockModeType.PESSIMISTIC_WRITE))).thenAnswer(inv ->
            growths.stream().filter(g -> g.getId().equals(inv.getArgument(1))).findFirst().orElse(null));
        org.mockito.Mockito.doAnswer(inv -> {
            Growth g = inv.getArgument(0);
            ReflectionTestUtils.setField(g, "id", nextId++);
            g.setVersion(0);
            growths.add(g);
            return null;
        }).when(em).persist(any(Growth.class));
        when(revisionRepository.save(any(RecordRevision.class))).thenAnswer(inv -> {
            RecordRevision r = inv.getArgument(0);
            r.setId(600L + savedRevisions.size());
            savedRevisions.add(r);
            return r;
        });

        new FakeJpql(em)
            .on("from HerdEntry h", p -> entryDate == null ? List.of() : List.of(entryDate))
            .on("g.id<>:id", p -> growths.stream()
                .filter(g -> g.getCattle().getId().equals(p.get("c")) && !g.getId().equals(p.get("id")))
                .filter(g -> List.of("VALID", "CORRECTED").contains(g.getStatus()) && g.getWeightKg() != null)
                .filter(g -> !g.getCheckDate().isBefore((LocalDate) p.get("start")) && !g.getCheckDate().isAfter((LocalDate) p.get("end")))
                .sorted(Comparator.comparing(Growth::getCheckDate).thenComparing(Growth::getId).reversed()).toList())
            .on("from Growth g where g.cattle.id=:c order by", p -> growths.stream()
                .filter(g -> g.getCattle().getId().equals(p.get("c")))
                .sorted(Comparator.comparing(Growth::getCheckDate).thenComparing(Growth::getEntryTime).thenComparing(Growth::getId)).toList())
            .on("from RecordRevision r", p -> savedRevisions.stream()
                .filter(r -> ((Collection<?>) p.get("ids")).contains(r.getSourceId())).toList())
            .on("from FarmParameterVersion p", p -> parameterVersions)
            .on("from FarmMembership m", p -> memberships.stream()
                .filter(m -> m.getUser().getId().equals(p.get("u")) && "ACTIVE".equals(m.getStatus())).toList());
    }

    // ------------------------------------------------------------------ fixtures

    private void user(FarmRole r, long id, String name) {
        AppUser u = new AppUser();
        u.setId(id);
        u.setFullName(name);
        users.put(r, u);
        FarmMembership m = new FarmMembership();
        m.setFarm(farm);
        m.setUser(u);
        m.setRole(r.name());
        m.setStatus("ACTIVE");
        memberships.add(m);
    }

    private Cattle cattle(long id, String code, Farm owner, PurposeType type) {
        ProductionPurpose purpose = new ProductionPurpose();
        purpose.setPurposeType(type);
        Cattle c = new Cattle();
        c.setId(id);
        c.setDisplayCode(code);
        c.setFarm(owner);
        c.setPurpose(purpose);
        c.setHerdStatus(HerdStatus.ACTIVE);
        cattleById.put(id, c);
        return c;
    }

    private Growth stored(LocalDate day, String kg, String method, String status) {
        Growth g = new Growth();
        ReflectionTestUtils.setField(g, "id", nextId++);
        g.setCattle(cattle);
        g.setCheckDate(day);
        g.setObservedAt(day.atTime(8, 0).toInstant(ZoneOffset.ofHours(7)));
        g.setEntryTime(day.atTime(9, 0).toInstant(ZoneOffset.ofHours(7)));
        g.setMethod(method);
        g.setWeightKg(kg == null ? null : new BigDecimal(kg));
        g.setWeightType(kg == null ? null : ("SCALE".equals(method) ? "MEASURED" : "ESTIMATED"));
        g.setStatus(status);
        g.setMeasuredBy(users.get(FarmRole.MANAGER));
        g.setVersion(1);
        growths.add(g);
        return g;
    }

    private Growth stored(LocalDate day, String kg) {
        return stored(day, kg, "SCALE", "VALID");
    }

    private static Instant at(int year, int month, int day, int hour) {
        return LocalDate.of(year, month, day).atTime(hour, 0).toInstant(ZoneOffset.ofHours(7));
    }

    private static GrowthDtos.Measurement scale(Instant at, String kg) {
        return new GrowthDtos.Measurement(at, null, "SCALE", new BigDecimal(kg), null, null, null, null, false);
    }

    private static GrowthDtos.Measurement measurement(Instant at, Long measuredBy, String method, String kg, String girth, String length, String bcs,
                                                      String note, boolean acknowledged) {
        return new GrowthDtos.Measurement(at, measuredBy, method, kg == null ? null : new BigDecimal(kg), girth == null ? null : new BigDecimal(girth),
            length == null ? null : new BigDecimal(length), bcs == null ? null : new BigDecimal(bcs), note, acknowledged);
    }

    private static GrowthDtos.Correction correction(String action, GrowthDtos.Measurement values, String note, Integer version) {
        return new GrowthDtos.Correction(action, values, note, version);
    }

    private static DomainException domainError(Runnable call) {
        DomainException error = catchThrowableOfType(DomainException.class, call::run);
        assertThat(error).as("the call should be rejected with a DomainException").isNotNull();
        return error;
    }

    private void assertNothingSaved() {
        verify(em, never()).persist(any());
        verify(outbox, never()).enqueue(anyLong(), anyString(), anyString(), any(), any());
    }

    private void pendingDeathVoucher() {
        HerdExitVoucher voucher = new HerdExitVoucher();
        voucher.setExitType(ExitType.DEATH);
        voucher.setExitDate(LocalDate.of(2026, 11, 26));
        HerdExit line = new HerdExit();
        line.setVoucher(voucher);
        line.setStatus(ExitLineStatus.PENDING);
        when(exits.findFirstByCattleIdAndStatus(CATTLE_ID, ExitLineStatus.PENDING)).thenReturn(Optional.of(line));
    }

    private void exited() {
        cattle.setHerdStatus(HerdStatus.EXITED);
        cattle.setExitType(ExitType.SALE);
        cattle.setExitDate(LocalDate.of(2026, 11, 20));
    }

    private static BigDecimal snapshotNumber(String json, String key) {
        Object value = JsonSupport.fromJson(json, Map.class).get(key);
        return value == null ? null : new BigDecimal(value.toString());
    }

    // ================================================================== UC-FE08-01 record

    @Test
    void tc0801NeitherWeightNorBcsIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, null, null, null, null, null, null, false)));

        assertThat(error.getCode()).isEqualTo("MSG-FE08-02");
        assertThat(error.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertNothingSaved();
    }

    @Test
    void tc0802AWeightOfZeroIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "0")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "weightKg");
        assertThat(validator.validate(scale(at(2026, 11, 20, 8), "0"))).extracting(v -> v.getPropertyPath().toString()).containsExactly("weightKg");
        assertNothingSaved();
    }

    @Test
    void tc0802AWeightOfOneKgIsAccepted() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "1"));

        assertThat(saved.weightKg()).isEqualByComparingTo("1");
        assertThat(growths).hasSize(1);
    }

    @Test
    void tc0802AWeightOf1500KgIsAccepted() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "1500"));

        assertThat(saved.weightKg()).isEqualByComparingTo("1500");
        assertThat(growths).hasSize(1);
    }

    @Test
    void tc0802AWeightOf1500Point1KgIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "1500.1")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "weightKg");
        assertNothingSaved();
    }

    @Test
    void tc0803ABcsOf3Point3IsOffTheHalfPointScale() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, null, null, null, null, "3.3", null, false)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "bcs");
        assertNothingSaved();
    }

    @Test
    void tc0803ABcsOf5Point5IsAboveTheScale() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, null, null, null, null, "5.5", null, false)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "bcs");
        assertNothingSaved();
    }

    @Test
    void tc0804AMeasurementBeforeTheHerdEntryDateIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 10, 9, 8), "300")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_15);
        assertThat(error.getParams()).containsEntry("date", ENTRY_DATE);
        assertNothingSaved();
    }

    @Test
    void tc0804AMeasurementTomorrowIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 28, 8), "300")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
        assertNothingSaved();
    }

    @Test
    void tc0805TapeMeasurementComputesTheEstimatedWeight() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, "TAPE", null, "180", "150", null, null, false));

        assertThat(saved.weightKg()).isEqualByComparingTo("429.6");
        assertThat(saved.basis()).isEqualTo("ESTIMATED");
        assertThat(saved.method()).isEqualTo("TAPE");
        assertThat(GrowthAssessmentService.tapeWeight(new BigDecimal("180"), new BigDecimal("150"))).isEqualByComparingTo("429.6");
    }

    @Test
    void tc0806AnElectronicScaleReadingIsMeasured() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340.0"));

        assertThat(saved.basis()).isEqualTo("MEASURED");
        assertThat(growths.get(0).getWeightType()).isEqualTo("MEASURED");
        assertThat(List.of(GrowthDtos.Measurement.class.getRecordComponents())).extracting(c -> c.getName()).doesNotContain("basis", "weightType");
    }

    @Test
    void tc0807AChangeOfMoreThan20PercentWithin30DaysNeedsConfirmation() {
        stored(LocalDate.of(2026, 11, 1), "300");

        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 10, 8), "370")));

        assertThat(error.getCode()).isEqualTo("MSG-FE08-04");
        assertThat(error.getParams()).containsEntry("new", new BigDecimal("370")).containsEntry("last", new BigDecimal("300"))
            .containsEntry("date", LocalDate.of(2026, 11, 1));
        assertThat(growths).hasSize(1);
        assertNothingSaved();
    }

    @Test
    void tc0808AWeighingOlderThan30DaysIsNotCompared() {
        stored(LocalDate.of(2026, 10, 10), "300");

        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 10, 8), "370"));

        assertThat(saved.weightKg()).isEqualByComparingTo("370");
        assertThat(growths).hasSize(2);
    }

    @Test
    void tc0816RecordingAWeightPublishesTheEventThatResolvesRem01() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340"));

        verify(outbox).enqueue(FARM_ID, "GROWTH_RECORDED", "Growth", saved.id(), Map.of("cattleId", CATTLE_ID));
        verify(audit).log(any(FarmContext.class), eq("GROWTH_RECORD"), eq("Growth"), eq(saved.id()), eq(Map.of("cattleId", CATTLE_ID)));
    }

    @Test
    void tc0819ATechnicianCannotRecord() {
        role = FarmRole.TECHNICIAN;

        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(FarmAction.MANAGE_GROWTH.allows(FarmRole.TECHNICIAN)).isFalse();
        assertNothingSaved();
    }

    @Test
    void tc0820AManagerCanNameATechnicianAsTheMeasurer() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), 32L, "SCALE", "340", null, null, null, null, false));

        assertThat(saved.measuredBy()).isEqualTo(32L);
        assertThat(saved.measuredByName()).isEqualTo("Technician Minh");
        ArgumentCaptor<FarmContext> actor = ArgumentCaptor.forClass(FarmContext.class);
        verify(audit).log(actor.capture(), eq("GROWTH_RECORD"), eq("Growth"), anyLong(), any());
        assertThat(actor.getValue().user().getFullName()).isEqualTo("Manager Lan");
    }

    @Test
    void tc0821ACattleOnAPendingDeathVoucherTakesNoNewRecord() {
        pendingDeathVoucher();

        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_17);
        assertThat(error.getParams()).containsEntry("cattle_code", "BO-0001").containsEntry("loss_kind", ExitType.DEATH);
        assertNothingSaved();
    }

    @Test
    void tc0822TheOwnerRecordsAWeightAndBcs() {
        role = FarmRole.OWNER;

        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, "SCALE", "340", null, null, "3.5", null, false));

        assertThat(saved.weightKg()).isEqualByComparingTo("340");
        assertThat(saved.bcs()).isEqualByComparingTo("3.5");
        assertThat(saved.measuredByName()).isEqualTo("Owner Hoa");
        assertThat(saved.status()).isEqualTo("VALID");
        assertThat(saved.recordedAt()).isEqualTo(NOW);
    }

    @Test
    void tcTuan080101AConfirmedLargeChangeIsSaved() {
        stored(LocalDate.of(2026, 11, 1), "300");

        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 10, 8), null, "SCALE", "370", null, null, null, null, true));

        assertThat(saved.weightKg()).isEqualByComparingTo("370");
        assertThat(growths).hasSize(2);
    }

    @Test
    void tcTuan080102AChangeOfExactly20PercentNeedsNoConfirmation() {
        stored(LocalDate.of(2026, 11, 1), "300");

        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 10, 8), "360"));

        assertThat(saved.weightKg()).isEqualByComparingTo("360");
    }

    @Test
    void tcTuan080103BcsAloneNeedsNoMethodOrWeight() {
        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, null, null, null, null, "3.0", null, false));

        assertThat(saved.weightKg()).isNull();
        assertThat(saved.basis()).isNull();
        assertThat(saved.method()).isEqualTo("OTHER");
        assertThat(saved.bcs()).isEqualByComparingTo("3.0");
    }

    @Test
    void tcTuan080104AWeightWithoutAMethodIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, null, "340", null, null, null, null, false)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "method");
        assertNothingSaved();
    }

    @Test
    void tcTuan080105AWeightWithTwoDecimalsIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340.25")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "weightKg");
        assertNothingSaved();
    }

    @Test
    void tcTuan080106AHeartGirthBelow50CmIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, "TAPE", null, "49", "150", null, null, false)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "heartGirthCm");
        assertNothingSaved();
    }

    @Test
    void tcTuan080107ABodyLengthAbove250CmIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, "TAPE", null, "180", "251", null, null, false)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "bodyLengthCm");
        assertNothingSaved();
    }

    @Test
    void tcTuan080108AMeasurerWhoIsNotAnActiveMemberIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), 99L, "SCALE", "340", null, null, null, null, false)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "measuredBy");
        assertNothingSaved();
    }

    @Test
    void tcTuan080109AnExitedCattleTakesNoNewRecord() {
        exited();

        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(error.getParams()).containsEntry("cattle_code", "BO-0001");
        assertNothingSaved();
    }

    @Test
    void tcTuan080110AVoidedCattleTakesNoNewRecord() {
        cattle.setHerdStatus(HerdStatus.VOIDED);
        cattle.setVoidReason("Nhập nhầm");

        DomainException error = domainError(() -> service.record(FARM_ID, CATTLE_ID, scale(at(2026, 11, 20, 8), "340")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_18);
        assertNothingSaved();
    }

    @Test
    void tcTuan080111AnUnknownCattleIsNotFound() {
        DomainException error = domainError(() -> service.record(FARM_ID, 9999L, scale(at(2026, 11, 20, 8), "340")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertNothingSaved();
    }

    @Test
    void tcTuan080112ANineStepFarmScaleAcceptsBcs7() {
        FarmParameterVersion version = new FarmParameterVersion();
        version.setFarm(farm);
        version.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        version.setParameterValues("{\"BCS_SCALE\":\"1-9:1\"}");
        parameterVersions.add(version);

        GrowthDtos.Record saved = service.record(FARM_ID, CATTLE_ID, measurement(at(2026, 11, 20, 8), null, null, null, null, null, "7", null, false));

        assertThat(saved.bcs()).isEqualByComparingTo("7");
    }

    @Test
    void tcTuan080113ANoteOf501CharactersFailsValidation() {
        GrowthDtos.Measurement request = measurement(at(2026, 11, 20, 8), null, "SCALE", "340", null, null, null, "x".repeat(501), false);

        assertThat(validator.validate(request)).extracting(v -> v.getPropertyPath().toString()).containsExactly("note");
        assertThat(validator.validate(measurement(at(2026, 11, 20, 8), null, "SCALE", "340", null, null, null, "x".repeat(500), false))).isEmpty();
    }

    // ================================================================== UC-FE08-02 history

    @Test
    void tc0809TheLatestMeasuredWeightWinsOverALaterEstimate() {
        stored(LocalDate.of(2026, 11, 1), "320", "SCALE", "VALID");
        stored(LocalDate.of(2026, 11, 5), "330", "TAPE", "VALID");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.currentWeight().weightKg()).isEqualByComparingTo("320");
        assertThat(summary.currentWeight().basis()).isEqualTo("MEASURED");
    }

    @Test
    void tc0810Adg90IsOneKgPerDay() {
        stored(LocalDate.of(2026, 10, 1), "300");
        stored(LocalDate.of(2026, 10, 31), "330");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.adg()).isEqualByComparingTo("1.000");
        assertThat(summary.windowDays()).isEqualTo(90);
    }

    @Test
    void tc0811TwoWeighingsTenDaysApartGiveNoAdg() {
        stored(LocalDate.of(2026, 11, 1), "300");
        stored(LocalDate.of(2026, 11, 11), "310");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.adg()).isNull();
    }

    @Test
    void tc0812AnExcludedMeasurementIsLeftOutOfTheIndicators() {
        stored(LocalDate.of(2026, 10, 1), "300");
        stored(LocalDate.of(2026, 10, 31), "330");
        Growth excluded = stored(LocalDate.of(2026, 11, 10), "400", "SCALE", "EXCLUDED");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.adg()).isEqualByComparingTo("1.000");
        assertThat(summary.currentWeight().weightKg()).isEqualByComparingTo("330");
        assertThat(summary.records()).filteredOn(r -> r.id().equals(excluded.getId())).singleElement()
            .satisfies(r -> assertThat(r.status()).isEqualTo("EXCLUDED"));
    }

    @Test
    void tc0817TheFinishingDateIsProjectedFromAdg60() {
        stored(LocalDate.of(2026, 10, 2), "370");
        stored(LocalDate.of(2026, 11, 1), "400");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.finishingStatus()).isEqualTo("PROJECTED");
        assertThat(summary.targetKg()).isEqualByComparingTo("450");
        assertThat(summary.adg60()).isEqualByComparingTo("1.000");
        assertThat(summary.missingKg()).isEqualByComparingTo("50");
        assertThat(summary.finishingDays()).isEqualTo(50);
        assertThat(summary.projectedFinishingDate()).isEqualTo(LocalDate.of(2026, 11, 1).plusDays(50));
    }

    @Test
    void tc0818AWeightAboveTheTargetReachesIt() {
        stored(LocalDate.of(2026, 11, 1), "455");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.finishingStatus()).isEqualTo("TARGET_REACHED");
        assertThat(summary.missingKg()).isEqualByComparingTo("0");
        assertThat(summary.projectedFinishingDate()).isNull();
    }

    @Test
    void tcTuan080201ATechnicianCanViewTheHistory() {
        role = FarmRole.TECHNICIAN;
        stored(LocalDate.of(2026, 11, 1), "320");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.records()).hasSize(1);
        assertThat(FarmAction.VIEW_CATTLE.allows(FarmRole.TECHNICIAN)).isTrue();
    }

    @Test
    void tcTuan080202ACattleOfAnotherFarmIsNotFound() {
        Farm other = new Farm();
        other.setId(702L);
        cattle(8002L, "BO-0002", other, PurposeType.FATTENING);

        DomainException error = domainError(() -> service.history(FARM_ID, 8002L, 90));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void tcTuan080203AnUnknownCattleIsNotFound() {
        DomainException error = domainError(() -> service.history(FARM_ID, 9999L, 90));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
    }

    @Test
    void tcTuan080204AWindowOutsideTheAllowedPeriodsIsRejected() {
        DomainException error = domainError(() -> service.history(FARM_ID, CATTLE_ID, 45));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "windowDays");
    }

    @Test
    void tcTuan080205AUserWithoutFarmAccessIsRefused() {
        role = null;

        DomainException error = domainError(() -> service.history(FARM_ID, CATTLE_ID, 90));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        verify(em, never()).find(eq(Cattle.class), anyLong());
    }

    @Test
    void tcTuan080206ABreedingCattleHasNoFinishingProjection() {
        cattle.getPurpose().setPurposeType(PurposeType.BREEDING);
        stored(LocalDate.of(2026, 11, 1), "400");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.finishingStatus()).isEqualTo("NOT_APPLICABLE");
        assertThat(summary.targetKg()).isNull();
    }

    @Test
    void tcTuan080207ALosingAdg60GivesNoProjection() {
        stored(LocalDate.of(2026, 10, 2), "410");
        stored(LocalDate.of(2026, 11, 1), "400");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.finishingStatus()).isEqualTo("INSUFFICIENT_WEIGHTS");
        assertThat(summary.projectedFinishingDate()).isNull();
    }

    @Test
    void tcTuan080208TwoWeighingsExactly14DaysApartGiveAnAdg() {
        stored(LocalDate.of(2026, 11, 1), "300");
        stored(LocalDate.of(2026, 11, 15), "314");

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.adg()).isEqualByComparingTo("1.000");
    }

    @Test
    void tcTuan080209TheNextWeighingIsTheLastWeighingPlusTheInterval() {
        stored(LocalDate.of(2026, 11, 1), "300");
        stored(LocalDate.of(2026, 11, 20), null, "OTHER", "VALID").setBcsScore(new BigDecimal("3.0"));

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.nextWeighing()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(summary.latestBcs()).isEqualByComparingTo("3.0");
    }

    @Test
    void tcTuan080210ANeverWeighedCattleIsDueFromItsEntryDate() {
        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.nextWeighing()).isEqualTo(ENTRY_DATE.plusDays(30));
        assertThat(summary.currentWeight()).isNull();
        assertThat(summary.finishingStatus()).isEqualTo("INSUFFICIENT_WEIGHTS");
    }

    @Test
    void tcTuan080211EachRecordCarriesItsRevisionsNewestRecordFirst() {
        Growth first = stored(LocalDate.of(2026, 10, 20), "300");
        Growth second = stored(LocalDate.of(2026, 11, 1), "342");
        second.setCorrected(true);
        RecordRevision revision = new RecordRevision();
        revision.setId(700L);
        revision.setSourceType("GROWTH_ASSESSMENT");
        revision.setSourceId(second.getId());
        revision.setAction("CORRECT");
        revision.setActor(users.get(FarmRole.MANAGER));
        revision.setChangedAt(NOW);
        revision.setBeforeSnapshot("{\"weightKg\":340}");
        revision.setAfterSnapshot("{\"weightKg\":342}");
        savedRevisions.add(revision);

        GrowthDtos.Summary summary = service.history(FARM_ID, CATTLE_ID, 90);

        assertThat(summary.records()).extracting(GrowthDtos.Record::id).containsExactly(second.getId(), first.getId());
        assertThat(summary.records().get(0).corrected()).isTrue();
        assertThat(summary.records().get(0).revisions()).singleElement().satisfies(r -> {
            assertThat(r.action()).isEqualTo("CORRECT");
            assertThat(r.changedBy()).isEqualTo("Manager Lan");
            assertThat(r.before()).containsEntry("weightKg", 340);
        });
        assertThat(summary.records().get(1).revisions()).isEmpty();
    }

    // ================================================================== UC-FE08-03 correct

    @Test
    void tc0812DeletingAMeasurementExcludesItAndKeepsTheRevision() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        GrowthDtos.Record result = service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("EXCLUDE", null, null, 1));

        assertThat(result.status()).isEqualTo("EXCLUDED");
        assertThat(record.getStatus()).isEqualTo("EXCLUDED");
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("EXCLUDE");
            assertThat(r.getReason()).isNull();
            assertThat(snapshotNumber(r.getBeforeSnapshot(), "weightKg")).isEqualByComparingTo("340");
        });
        assertThat(result.revisions()).hasSize(1);
        verify(outbox).enqueue(FARM_ID, "GROWTH_CORRECTED", "Growth", record.getId(), Map.of("cattleId", CATTLE_ID));
    }

    @Test
    void tc0813ACorrectionWithABlankNoteKeepsTheOriginalValue() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        GrowthDtos.Record result = service.correct(FARM_ID, CATTLE_ID, record.getId(),
            correction("CORRECT", scale(at(2026, 11, 1, 8), "342"), "  ", 1));

        assertThat(result.weightKg()).isEqualByComparingTo("342");
        assertThat(result.corrected()).isTrue();
        assertThat(result.status()).isEqualTo("VALID");
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("CORRECT");
            assertThat(r.getReason()).isNull();
            assertThat(snapshotNumber(r.getBeforeSnapshot(), "weightKg")).isEqualByComparingTo("340");
            assertThat(snapshotNumber(r.getAfterSnapshot(), "weightKg")).isEqualByComparingTo("342");
        });
    }

    @Test
    void tc0814ANoteOf501CharactersIsRejected() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");
        GrowthDtos.Correction request = correction("EXCLUDE", null, "x".repeat(501), 1);

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), request));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "reason");
        assertThat(savedRevisions).isEmpty();
        verify(em, never()).flush();
        assertThat(validator.validate(request)).extracting(v -> v.getPropertyPath().toString()).containsExactly("reason");
    }

    @Test
    void tc0815AStaleVersionIsAConflict() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");
        record.setVersion(2);

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(),
            correction("CORRECT", scale(at(2026, 11, 1, 8), "342"), null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(record.getWeightKg()).isEqualByComparingTo("340");
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tc0821AnOldRecordOfACattleOnAPendingDeathVoucherCanBeDeleted() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");
        pendingDeathVoucher();

        GrowthDtos.Record result = service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("EXCLUDE", null, null, 1));

        assertThat(result.status()).isEqualTo("EXCLUDED");
    }

    @Test
    void tc0822TheOwnerCorrectsARecordOfAManager() {
        role = FarmRole.OWNER;
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        GrowthDtos.Record result = service.correct(FARM_ID, CATTLE_ID, record.getId(),
            correction("CORRECT", scale(at(2026, 11, 1, 8), "342"), "Cân lại", 1));

        assertThat(result.weightKg()).isEqualByComparingTo("342");
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa");
            assertThat(r.getReason()).isEqualTo("Cân lại");
            assertThat(snapshotNumber(r.getBeforeSnapshot(), "weightKg")).isEqualByComparingTo("340");
        });
    }

    @Test
    void tcTuan080301AMissingExpectedVersionIsAConflict() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("EXCLUDE", null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "expected_version_required");
    }

    @Test
    void tcTuan080302ARecordOfAnotherCattleIsNotFound() {
        Cattle other = cattle(8003L, "BO-0003", farm, PurposeType.FATTENING);
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");
        record.setCattle(other);

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("EXCLUDE", null, null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan080303AnUnknownActionIsRejected() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("DELETE", null, null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "action");
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan080304ACorrectionWithoutValuesIsRejected() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("CORRECT", null, null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "values");
    }

    @Test
    void tcTuan080305ARecordOfAnExitedCattleCannotBeCorrected() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");
        exited();

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("EXCLUDE", null, null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan080306ATechnicianCannotCorrect() {
        role = FarmRole.TECHNICIAN;
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(), correction("EXCLUDE", null, null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan080307ACorrectedWeightAbove1500KgIsRejected() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "340");

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(),
            correction("CORRECT", scale(at(2026, 11, 1, 8), "1500.1"), null, 1)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "weightKg");
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan080308TheCorrectedRecordIsNotComparedWithItself() {
        Growth record = stored(LocalDate.of(2026, 11, 1), "300");

        GrowthDtos.Record result = service.correct(FARM_ID, CATTLE_ID, record.getId(),
            correction("CORRECT", scale(at(2026, 11, 1, 8), "380"), null, 1));

        assertThat(result.weightKg()).isEqualByComparingTo("380");
    }

    @Test
    void tcTuan080309ACorrectionFarFromAnotherRecentWeighingNeedsConfirmation() {
        stored(LocalDate.of(2026, 11, 1), "300");
        Growth record = stored(LocalDate.of(2026, 11, 10), "310");

        DomainException error = domainError(() -> service.correct(FARM_ID, CATTLE_ID, record.getId(),
            correction("CORRECT", scale(at(2026, 11, 10, 8), "380"), null, 1)));

        assertThat(error.getCode()).isEqualTo("MSG-FE08-04");
        assertThat(savedRevisions).isEmpty();
    }
}
