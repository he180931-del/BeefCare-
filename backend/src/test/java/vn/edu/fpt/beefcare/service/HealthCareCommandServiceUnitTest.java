package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of FE-10: UC-FE10-02 Open Health Case
 * ({@link HealthCareCommandService#open}), UC-FE10-03 Update Health Case Status and Observation
 * ({@link HealthCareCommandService#updateStatus}, and the D62 reopen {@link HealthCareCommandService#reopen}), UC-FE10-04
 * Record Treatment ({@link HealthCareCommandService#recordTreatment}) and UC-FE10-05 Correct or Void Treatment or
 * Follow-up ({@link HealthCareCommandService#correctTreatment}, {@link HealthCareCommandService#voidTreatment},
 * {@link HealthCareCommandService#correctObservation}, {@link HealthCareCommandService#voidObservation}). Cases,
 * observations, treatments and medicines live in memory behind {@link FakeJpql}; the cattle guard, the record revision
 * service, the case reopener and the cattle state derivation (health state GBR-45, withdrawal end GBR-46) are the real
 * classes; the loss voucher service and the case code counter are mocks; the idempotency wrapper runs the command; the
 * farm access check applies the real {@link FarmAction} role table. The farm clock is fixed at 27/11/2026 10:00
 * (UTC+7) unless a test sets another day. Cattle BO-2001 entered the herd on 01/06/2026.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HealthCareCommandServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final long FARM_ID = 950L;
    private static final long CATTLE_ID = 2001L;
    private static final String KEY = "idem-1";

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock CattleRepository cattleRepository;
    @Mock HerdExitRepository exitLines;
    @Mock IdempotencyCommandService idempotency;
    @Mock AuditService audit;
    @Mock RecordRevisionRepository revisionRepository;
    @Mock HerdExitVoucherService exitVouchers;
    @Mock CodeSequenceService codes;

    private HealthCareCommandService service;
    private Farm farm;
    private Cattle cattle;
    private FarmRole role = FarmRole.MANAGER;
    private final Map<FarmRole, AppUser> users = new HashMap<>();
    private final List<FarmMembership> memberships = new ArrayList<>();
    private final Map<Long, Cattle> cattleById = new HashMap<>();
    private final Map<Long, Medicine> medicines = new HashMap<>();
    private final List<HealthCase> cases = new ArrayList<>();
    private final List<HealthObservation> observations = new ArrayList<>();
    private final List<Treatment> treatments = new ArrayList<>();
    private final List<Vaccination> vaccinations = new ArrayList<>();
    private final List<RecordRevision> savedRevisions = new ArrayList<>();
    private boolean pendingDeath;
    private int codeCounter;
    private long nextId = 3000L;

    @BeforeEach
    void setUp() {
        farm = new Farm();
        farm.setId(FARM_ID);
        build(NOW);
        user(FarmRole.OWNER, 30L, "Owner Hoa");
        user(FarmRole.MANAGER, 31L, "Manager Lan");
        user(FarmRole.TECHNICIAN, 32L, "Technician Minh");
        cattle = cattle(CATTLE_ID, "BO-2001");
        medicine(61L, "Oxytetracycline", true, 7);
        medicine(62L, "Thuốc ngưng", false, 0);

        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenAnswer(inv -> {
            FarmAction action = inv.getArgument(1);
            if (role == null || !action.allows(role)) {
                throw DomainException.forbidden(MessageCodes.COM_01);
            }
            return new FarmContext(farm, users.get(role), role);
        });
        when(idempotency.execute(anyLong(), any(FarmAction.class), anyString(), anyString(), any(), any(Class.class), any(Supplier.class)))
            .thenAnswer(inv -> inv.<Supplier<?>>getArgument(6).get());
        when(cattleRepository.lockByIdAndFarmId(anyLong(), anyLong())).thenAnswer(inv -> Optional.ofNullable(cattleById.get(inv.<Long>getArgument(1)))
            .filter(c -> c.getFarm().getId().equals(inv.getArgument(0))));
        when(exitLines.findFirstByCattleIdAndStatus(anyLong(), eq(ExitLineStatus.PENDING))).thenAnswer(inv -> {
            if (!pendingDeath) {
                return Optional.empty();
            }
            HerdExitVoucher voucher = new HerdExitVoucher();
            voucher.setExitType(ExitType.DEATH);
            voucher.setExitDate(LocalDate.of(2026, 11, 26));
            HerdExit line = new HerdExit();
            line.setVoucher(voucher);
            return Optional.of(line);
        });
        when(codes.nextHealthCaseCode(FARM_ID)).thenAnswer(inv -> String.format("HC-%04d", ++codeCounter));
        when(exitVouchers.createPendingLossVoucher(any(HealthCase.class), any(AppUser.class), any(LocalDate.class), any(LossKind.class))).thenAnswer(inv -> {
            HerdExitVoucher voucher = new HerdExitVoucher();
            voucher.setId(880L);
            return voucher;
        });
        when(revisionRepository.save(any(RecordRevision.class))).thenAnswer(inv -> {
            RecordRevision r = inv.getArgument(0);
            r.setId(700L + savedRevisions.size());
            savedRevisions.add(r);
            return r;
        });
        doAnswer(inv -> {
            Object entity = inv.getArgument(0);
            ReflectionTestUtils.setField(entity, "id", nextId++);
            if (entity instanceof HealthCase h) {
                cases.add(h);
            } else if (entity instanceof HealthObservation o) {
                observations.add(o);
            } else if (entity instanceof Treatment t) {
                treatments.add(t);
            }
            return null;
        }).when(em).persist(any());

        new FakeJpql(em)
            .on("h.caseCode=:code", p -> List.of(cases.stream().filter(h -> h.getCaseCode().equals(p.get("code"))).count()))
            .on("from HealthCase h where h.id=:id", p -> cases.stream()
                .filter(h -> h.getId().equals(p.get("id")) && h.getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from HealthObservation o where o.id=:id", p -> observations.stream()
                .filter(o -> o.getId().equals(p.get("id")) && o.getHealthCase().getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from Treatment t where t.id=:id", p -> treatments.stream()
                .filter(t -> t.getId().equals(p.get("id")) && t.getHealthCase().getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from Medicine m where m.id=:id", p -> Optional.ofNullable(medicines.get((Long) p.get("id"))).stream().toList())
            .on("from FarmMembership m", p -> memberships.stream().filter(m -> m.getUser().getId().equals(p.get("user"))).toList())
            .on("from Vaccination v where v.id=:id and v.cattle.id=:cattle", p -> vaccinations.stream()
                .filter(v -> v.getId().equals(p.get("id")) && v.getCattle().getId().equals(p.get("cattle"))).toList())
            .on("from HerdEntry e", p -> List.of(LocalDate.of(2026, 6, 1)))
            .onText("(o.observedTime) from HealthObservation o", (jpql, p) -> recordTime(jpql, p, observations.stream()
                .filter(o -> o.getHealthCase().getId().equals(p.get("id")) && "VALID".equals(o.getStatus()) && !o.getId().equals(p.get("ex")))
                .map(HealthObservation::getObservedTime)))
            .onText("(t.treatmentTime) from Treatment t", (jpql, p) -> recordTime(jpql, p, treatments.stream()
                .filter(t -> t.getHealthCase().getId().equals(p.get("id")) && "VALID".equals(t.getStatus()) && !t.getId().equals(p.get("ex")))
                .map(Treatment::getTreatmentTime)))
            .on("isSuspectedContagious=true", p -> List.of(casesOf(p).filter(h -> List.of("OPEN", "CHRONIC").contains(h.getStatus()))
                .filter(h -> Boolean.TRUE.equals(h.getIsSuspectedContagious())).count()))
            .on("count(distinct h.id) from HealthCase h join Treatment", p -> List.of(casesOf(p).filter(h -> "OPEN".equals(h.getStatus()))
                .filter(h -> treatments.stream().anyMatch(t -> t.getHealthCase() == h && "VALID".equals(t.getStatus()))).count()))
            .on("count(h) from HealthCase h where h.cattle.id=:id", p -> List.of(casesOf(p).filter(h -> List.of("OPEN", "CHRONIC").contains(h.getStatus())).count()))
            .on("max(t.withdrawalEndDate) from Treatment", p -> Collections.singletonList(treatments.stream()
                .filter(t -> t.getHealthCase().getCattle().getId().equals(p.get("id")) && "VALID".equals(t.getStatus()))
                .map(Treatment::getWithdrawalEndDate).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null)))
            .on("max(v.withdrawalEndDate) from Vaccination", p -> Collections.singletonList(null))
            .on("from ScheduledDose d where d.cattle.id=:id", p -> List.of(0L))
            .on("from PregnancyEpisode p", p -> List.of())
            .on("from ReproductionEvent e", p -> List.of())
            .on("max(c.birthTime) from CalvingEvent", p -> Collections.singletonList(null))
            .on("max(u.occurredTime) from PregnancyUpdate", p -> Collections.singletonList(null));
    }

    /** (Re)builds the service on a farm clock at {@code now}. */
    private void build(Instant now) {
        FarmClock clock = new FarmClock(Clock.fixed(now, ZoneOffset.UTC));
        CattleStateService state = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(state, "em", em);
        RecordRevisionService revisions = new RecordRevisionService(revisionRepository, clock);
        service = new HealthCareCommandService(access, new CattleGuardService(exitLines, cattleRepository, clock), idempotency, audit, revisions, clock,
            state, exitVouchers, new HealthCaseReopener(revisions, audit), codes);
        ReflectionTestUtils.setField(service, "em", em);
    }

    private static List<Instant> recordTime(String jpql, Map<String, Object> p, Stream<Instant> times) {
        Instant t = (Instant) p.get("t");
        Stream<Instant> side = jpql.contains("<=:t") ? times.filter(x -> !x.isAfter(t)) : jpql.contains(">:t") ? times.filter(x -> x.isAfter(t)) : times;
        Optional<Instant> value = jpql.startsWith("select max") ? side.max(Comparator.naturalOrder()) : side.min(Comparator.naturalOrder());
        return Collections.singletonList(value.orElse(null));
    }

    private Stream<HealthCase> casesOf(Map<String, Object> p) {
        return cases.stream().filter(h -> h.getCattle().getId().equals(p.get("id")));
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

    private Cattle cattle(long id, String code) {
        ProductionPurpose purpose = new ProductionPurpose();
        purpose.setPurposeType(PurposeType.FATTENING);
        Cattle c = new Cattle();
        c.setId(id);
        c.setDisplayCode(code);
        c.setFarm(farm);
        c.setPurpose(purpose);
        c.setSex(Sex.MALE);
        c.setLifeStage(LifeStage.ADULT);
        c.setHerdStatus(HerdStatus.ACTIVE);
        cattleById.put(id, c);
        return c;
    }

    private void medicine(long id, String name, boolean available, int withdrawalDays) {
        Medicine m = new Medicine();
        m.setId(id);
        m.setName(name);
        m.setAvailable(available);
        m.setWithdrawalDays(withdrawalDays);
        m.setFarm(farm);
        medicines.put(id, m);
    }

    private static Instant at(int month, int day, int hour) {
        return LocalDate.of(2026, month, day).atTime(hour, 0).toInstant(ZoneOffset.ofHours(7));
    }

    /** A case of BO-2001 opened at {@code openedAt} with its opening observation. */
    private HealthCase healthCase(String status, Instant openedAt) {
        HealthCase h = new HealthCase();
        ReflectionTestUtils.setField(h, "id", nextId++);
        h.setCattle(cattle);
        h.setCaseCode("HC-01" + cases.size());
        h.setOpenedDate(LocalDate.ofInstant(openedAt, ZoneOffset.ofHours(7)));
        h.setStatus(status);
        h.setSeverity("MODERATE");
        h.setVersion(1);
        if ("CHRONIC".equals(status)) {
            h.setChronicSince(LocalDate.of(2026, 11, 10));
        }
        cases.add(h);
        HealthObservation opening = observation(h, openedAt);
        opening.setOpening(true);
        return h;
    }

    private HealthCase closedCase(String outcome) {
        HealthCase h = healthCase("CLOSED", at(11, 1, 10));
        h.setOutcome(outcome);
        h.setClosedDate(LocalDate.of(2026, 11, 20));
        h.setClosedAt(at(11, 20, 10));
        h.setClosedBy(users.get(FarmRole.MANAGER));
        return h;
    }

    private HealthObservation observation(HealthCase h, Instant time) {
        HealthObservation o = new HealthObservation();
        ReflectionTestUtils.setField(o, "id", nextId++);
        o.setHealthCase(h);
        o.setObservedTime(time);
        o.setSignsProgress("Sốt, bỏ ăn");
        o.setProgress("UNCHANGED");
        o.setVersion(1);
        observations.add(o);
        return o;
    }

    private Treatment treatment(HealthCase h, Instant time, int courseDays, int withdrawalDays) {
        Treatment t = new Treatment();
        ReflectionTestUtils.setField(t, "id", nextId++);
        t.setHealthCase(h);
        t.setMedicine(medicines.get(61L));
        t.setMedicineNameSnapshot("Oxytetracycline");
        t.setTreatmentTime(time);
        t.setDose("10 ml");
        t.setRoute("INTRAMUSCULAR");
        t.setCourseDays(courseDays);
        t.setWithdrawalDays(withdrawalDays);
        t.setWithdrawalEndDate(LocalDate.ofInstant(time, ZoneOffset.ofHours(7)).plusDays(courseDays - 1L + withdrawalDays));
        t.setVersion(1);
        treatments.add(t);
        return t;
    }

    private static CareDtos.OpenHealthCase open(Instant at, String temperature, String signs, String severity) {
        return new CareDtos.OpenHealthCase(CATTLE_ID, null, null, at, null, temperature == null ? null : new BigDecimal(temperature), signs, null, null, severity, null);
    }

    private static CareDtos.OpenHealthCase openWithTemperature(String temperature) {
        return open(at(11, 26, 8), temperature, "Sốt, bỏ ăn", "MODERATE");
    }

    private static CareDtos.CaseStatus status(Integer version, String action, String description, String progress, String outcome, Instant at, String temperature) {
        return new CareDtos.CaseStatus(version, action, description, progress, null, null, outcome, null, null, at,
            temperature == null ? null : new BigDecimal(temperature));
    }

    private static CareDtos.TreatmentCommand treat(Integer version, long medicineId, Instant at, Integer courseDays, Integer withdrawalDays, Boolean returnToOpen) {
        return new CareDtos.TreatmentCommand(version, medicineId, at, "10 ml", "INTRAMUSCULAR", courseDays, withdrawalDays, null, null, null, returnToOpen);
    }

    private static CareDtos.CorrectTreatment correctWithdrawal(Integer version, Integer withdrawalDays, String reason) {
        return new CareDtos.CorrectTreatment(version, reason, null, null, null, null, null, withdrawalDays, null, null, null);
    }

    private static DomainException domainError(Runnable call) {
        DomainException error = catchThrowableOfType(DomainException.class, call::run);
        assertThat(error).as("the call should be rejected with a DomainException").isNotNull();
        return error;
    }

    private static Object snapshot(String json, String key) {
        return JsonSupport.fromJson(json, Map.class).get(key);
    }

    // ================================================================== UC-FE10-02 open

    @Test
    void tc1001ATemperatureOf29Point9IsRejected() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, openWithTemperature("29.9")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_06);
        assertThat(error.getParams()).containsEntry("field", "temperatureC");
        assertThat(cases).isEmpty();
    }

    @Test
    void tc1001ATemperatureOf34Point9IsSavedAfterTheScreenConfirmation() {
        CareDtos.HealthCaseResult result = service.open(FARM_ID, KEY, openWithTemperature("34.9"));

        assertThat(result.caseCode()).isEqualTo("HC-0001");
        assertThat(observations).singleElement().satisfies(o -> assertThat(o.getTemperatureC()).isEqualByComparingTo("34.9"));
    }

    @Test
    void tc1001ATemperatureOf35Point0IsAccepted() {
        service.open(FARM_ID, KEY, openWithTemperature("35.0"));

        assertThat(observations).singleElement().satisfies(o -> assertThat(o.getTemperatureC()).isEqualByComparingTo("35.0"));
    }

    @Test
    void tc1001ATemperatureOf43Point0IsAccepted() {
        service.open(FARM_ID, KEY, openWithTemperature("43.0"));

        assertThat(observations).singleElement().satisfies(o -> assertThat(o.getTemperatureC()).isEqualByComparingTo("43.0"));
    }

    @Test
    void tc1001ATemperatureOf43Point1IsSavedAfterTheScreenConfirmation() {
        service.open(FARM_ID, KEY, openWithTemperature("43.1"));

        assertThat(observations).singleElement().satisfies(o -> assertThat(o.getTemperatureC()).isEqualByComparingTo("43.1"));
    }

    @Test
    void tc1001ATemperatureOf45Point1IsRejected() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, openWithTemperature("45.1")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_06);
        assertThat(cases).isEmpty();
    }

    @Test
    void tc1001ABlankTemperatureIsAccepted() {
        service.open(FARM_ID, KEY, openWithTemperature(null));

        assertThat(observations).singleElement().satisfies(o -> assertThat(o.getTemperatureC()).isNull());
    }

    @Test
    void tc1002MissingSignsAreRequired() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, open(at(11, 26, 8), null, " ", "MODERATE")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "signs");
        assertThat(cases).isEmpty();
    }

    @Test
    void tc1002AMissingSeverityIsRequired() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, open(at(11, 26, 8), null, "Sốt", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "severity");
        assertThat(cases).isEmpty();
    }

    @Test
    void tc1003OpeningACaseForAHealthyCattleGivesACodeAndMonitoring() {
        CareDtos.HealthCaseResult result = service.open(FARM_ID, KEY, openWithTemperature("39.5"));

        assertThat(result.caseCode()).isEqualTo("HC-0001");
        assertThat(result.status()).isEqualTo("OPEN");
        assertThat(result.healthState()).isEqualTo("MONITORING");
        assertThat(observations).singleElement().satisfies(o -> {
            assertThat(o.getOpening()).isTrue();
            assertThat(o.getHealthCase()).isSameAs(cases.get(0));
            assertThat(o.getObservedTime()).isEqualTo(at(11, 26, 8));
        });
        assertThat(cases.get(0).getOpenedDate()).isEqualTo(LocalDate.of(2026, 11, 26));
    }

    @Test
    void tc1004ASecondProblemOpensASecondCase() {
        HealthCase first = healthCase("OPEN", at(11, 20, 8));

        CareDtos.HealthCaseResult result = service.open(FARM_ID, KEY, open(at(11, 26, 8), null, "Què chân sau", "MILD"));

        assertThat(cases).hasSize(2);
        assertThat(result.id()).isNotEqualTo(first.getId());
        assertThat(first.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tc1006AReactionCaseIsLinkedToTheVaccination() {
        Vaccination v = new Vaccination();
        v.setId(555L);
        v.setCattle(cattle);
        vaccinations.add(v);

        service.open(FARM_ID, KEY, new CareDtos.OpenHealthCase(CATTLE_ID, null, null, at(11, 26, 8), null, null, "Sưng chỗ tiêm", null, null, "MILD", 555L));

        assertThat(cases.get(0).getReactionVaccination()).isSameAs(v);
        assertThat(observations.get(0).getVaccination()).isSameAs(v);
    }

    @Test
    void tc1018ACattleOnAPendingDeathVoucherGetsNoNewCase() {
        pendingDeath = true;

        DomainException error = domainError(() -> service.open(FARM_ID, KEY, openWithTemperature("39.5")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_17);
        assertThat(cases).isEmpty();
    }

    @Test
    void tc1024ATechnicianCannotOpenACase() {
        role = FarmRole.TECHNICIAN;

        DomainException error = domainError(() -> service.open(FARM_ID, KEY, openWithTemperature("39.5")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(cases).isEmpty();
    }

    @Test
    void tc1029TheOwnerOpensACase() {
        role = FarmRole.OWNER;

        service.open(FARM_ID, KEY, openWithTemperature("39.5"));

        assertThat(observations.get(0).getRecorder().getFullName()).isEqualTo("Owner Hoa");
        assertThat(observations.get(0).getObserver().getFullName()).isEqualTo("Owner Hoa");
    }

    @Test
    void tcTuan100201AnObservationInTheFutureIsRejected() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, open(at(11, 27, 11), null, "Sốt", "MILD")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
        assertThat(cases).isEmpty();
    }

    @Test
    void tcTuan100202AnObservationBeforeTheHerdEntryIsRejected() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, open(at(5, 31, 8), null, "Sốt", "MILD")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_15);
        assertThat(error.getParams()).containsEntry("date", LocalDate.of(2026, 6, 1));
    }

    @Test
    void tcTuan100203AnExitedCattleGetsNoNewCase() {
        cattle.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.open(FARM_ID, KEY, openWithTemperature("39.5")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(cases).isEmpty();
    }

    @Test
    void tcTuan100204ADiagnosisOf101CharactersIsInvalid() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY,
            new CareDtos.OpenHealthCase(CATTLE_ID, null, null, at(11, 26, 8), null, null, "Sốt", "x".repeat(101), null, "MILD", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "diagnosis");
    }

    @Test
    void tcTuan100205SignsOf1001CharactersAreInvalid() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY, open(at(11, 26, 8), null, "x".repeat(1001), "MILD")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "signs");
    }

    @Test
    void tcTuan100206AnObserverWhoIsNotAMemberIsInvalid() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY,
            new CareDtos.OpenHealthCase(CATTLE_ID, null, null, at(11, 26, 8), 99L, null, "Sốt", null, null, "MILD", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "observerId");
    }

    @Test
    void tcTuan100207ATechnicianCanBeTheObserver() {
        service.open(FARM_ID, KEY, new CareDtos.OpenHealthCase(CATTLE_ID, null, null, at(11, 26, 8), 32L, null, "Sốt", "Viêm phổi", true, "SEVERE", null));

        assertThat(observations.get(0).getObserver().getFullName()).isEqualTo("Technician Minh");
        assertThat(observations.get(0).getRecorder().getFullName()).isEqualTo("Manager Lan");
        assertThat(cases.get(0).getIsSuspectedContagious()).isTrue();
        assertThat(cases.get(0).getSuspectedDiagnosis()).isEqualTo("Viêm phổi");
    }

    @Test
    void tcTuan100208AVaccinationOfAnotherCattleCannotBeLinked() {
        Vaccination v = new Vaccination();
        v.setId(556L);
        v.setCattle(cattle(2002L, "BO-2002"));
        vaccinations.add(v);

        DomainException error = domainError(() -> service.open(FARM_ID, KEY,
            new CareDtos.OpenHealthCase(CATTLE_ID, null, null, at(11, 26, 8), null, null, "Sưng", null, null, "MILD", 556L)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "vaccinationId");
    }

    @Test
    void tcTuan100209ACaseCodeAlreadyUsedInTheFarmIsSkipped() {
        HealthCase old = healthCase("CLOSED", at(10, 1, 8));
        old.setCaseCode("HC-0001");

        CareDtos.HealthCaseResult result = service.open(FARM_ID, KEY, openWithTemperature("39.5"));

        assertThat(result.caseCode()).isEqualTo("HC-0002");
    }

    @Test
    void tcTuan100210AnUnknownCattleIsNotFound() {
        DomainException error = domainError(() -> service.open(FARM_ID, KEY,
            new CareDtos.OpenHealthCase(9999L, null, null, at(11, 26, 8), null, null, "Sốt", null, null, "MILD", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
    }

    // ================================================================== UC-FE10-03 updateStatus

    @Test
    void tc1005AClosedCaseCannotBeUpdated() {
        HealthCase h = closedCase("RECOVERED");

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "KEEP", "Đã ăn lại", "IMPROVED", null, at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(observations).hasSize(1);
    }

    @Test
    void tc1007AnUpdateBeforeTheOpeningIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "KEEP", "Còn sốt", "UNCHANGED", null, at(11, 1, 9), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_07);
        assertThat(error.getParams()).containsEntry("date", at(11, 1, 10)).containsEntry("field", "observedAt");
        assertThat(observations).hasSize(1);
    }

    @Test
    void tc1011MovingATreatedOpenCaseToChronicLeavesMonitoring() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));
        treatment(h, at(11, 2, 8), 3, 7);

        CareDtos.HealthCaseResult result = service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "TO_CHRONIC", null, null, null, at(11, 26, 8), null));

        assertThat(result.status()).isEqualTo("CHRONIC");
        assertThat(result.chronicSince()).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(result.healthState()).isEqualTo("MONITORING");
        assertThat(result.observationId()).isNull();
    }

    @Test
    void tc1012AChronicCaseMovesBackToOpen() {
        HealthCase h = healthCase("CHRONIC", at(11, 1, 10));

        CareDtos.HealthCaseResult result = service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "TO_OPEN", null, null, null, at(11, 26, 8), null));

        assertThat(result.status()).isEqualTo("OPEN");
        assertThat(h.getChronicSince()).isNull();
    }

    @Test
    void tc1013ClosingTheOnlyCaseAsRecoveredLeavesTheCattleHealthy() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        CareDtos.HealthCaseResult result = service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "RECOVERED", at(11, 26, 8), null));

        assertThat(result.status()).isEqualTo("CLOSED");
        assertThat(result.outcome()).isEqualTo("RECOVERED");
        assertThat(result.healthState()).isEqualTo("HEALTHY");
        assertThat(h.getClosedDate()).isEqualTo(LocalDate.of(2026, 11, 26));
        verify(exitVouchers, never()).createPendingLossVoucher(any(), any(), any(), any());
    }

    @Test
    void tc1014ClosingAsDiedCreatesAPendingLossVoucherAndKeepsTheCattleActive() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        CareDtos.HealthCaseResult result = service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "DIED", at(11, 26, 8), null));

        verify(exitVouchers).createPendingLossVoucher(h, users.get(FarmRole.MANAGER), LocalDate.of(2026, 11, 26), LossKind.DIED);
        assertThat(result.pendingExitVoucherId()).isEqualTo(880L);
        assertThat(result.status()).isEqualTo("CLOSED");
        assertThat(cattle.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
    }

    @Test
    void tc1015ClosingAsMissingCreatesAMissingLossVoucher() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "MISSING", at(11, 26, 8), null));

        verify(exitVouchers).createPendingLossVoucher(h, users.get(FarmRole.MANAGER), LocalDate.of(2026, 11, 26), LossKind.MISSING);
        assertThat(h.getOutcome()).isEqualTo("MISSING");
    }

    @Test
    void tc1016AFailedLossVoucherLeavesTheCaseOpen() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));
        when(exitVouchers.createPendingLossVoucher(any(HealthCase.class), any(AppUser.class), any(LocalDate.class), any(LossKind.class)))
            .thenThrow(DomainException.unprocessable(MessageCodes.COM_02));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "DIED", at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_02);
        assertThat(h.getStatus()).isEqualTo("OPEN");
        assertThat(h.getOutcome()).isNull();
    }

    @Test
    void tc1017AClosureBeforeTheLastFollowUpIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));
        observation(h, at(11, 20, 8));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "RECOVERED", at(11, 19, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_07);
        assertThat(error.getParams()).containsEntry("date", at(11, 20, 8));
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tc1027KeepingTheStatusWithAnEmptyFollowUpIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "KEEP", null, null, null, at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "latestProgress");
        assertThat(observations).hasSize(1);
    }

    @Test
    void tc1027AStatusChangeWithOnlyATemperatureNeedsTheFollowUp() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "TO_CHRONIC", null, null, null, at(11, 26, 8), "39.0")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "latestProgress");
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tc1027AClosureWithADescriptionButNoProgressIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", "Đã khỏi", null, "RECOVERED", at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "progress");
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tc1027AClosureWithAnEmptyFollowUpSavesNoObservation() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        CareDtos.HealthCaseResult result = service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "RECOVERED", at(11, 26, 8), null));

        assertThat(result.observationId()).isNull();
        assertThat(observations).hasSize(1);
        assertThat(h.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void tc1028ADescriptionWithoutProgressIsNotFilledIn() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "KEEP", "Còn ho", null, null, at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(error.getParams()).containsEntry("field", "progress");
        assertThat(observations).hasSize(1);
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tc1001AnUpdateWithATemperatureOf45Point1IsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "KEEP", "Sốt cao", "WORSENED", null, at(11, 26, 8), "45.1")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_06);
        assertThat(observations).hasSize(1);
    }

    @Test
    void tc1029TheOwnerClosesACase() {
        role = FarmRole.OWNER;
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", "Đã khỏi", "IMPROVED", "RECOVERED", at(11, 26, 8), null));

        assertThat(h.getClosedBy().getFullName()).isEqualTo("Owner Hoa");
        assertThat(observations).hasSize(2).last().satisfies(o -> assertThat(o.getRecorder().getFullName()).isEqualTo("Owner Hoa"));
    }

    @Test
    void tcTuan100301KeepingTheStatusSavesTheFollowUp() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        CareDtos.HealthCaseResult result = service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "KEEP", "Đã ăn lại", "IMPROVED", null, at(11, 26, 8), "38.6"));

        assertThat(result.observationId()).isNotNull();
        assertThat(observations).hasSize(2).last().satisfies(o -> {
            assertThat(o.getProgress()).isEqualTo("IMPROVED");
            assertThat(o.getSignsProgress()).isEqualTo("Đã ăn lại");
            assertThat(o.getTemperatureC()).isEqualByComparingTo("38.6");
            assertThat(o.getOpening()).isFalse();
        });
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tcTuan100302AnOpenCaseCannotBeMovedToOpen() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "TO_OPEN", null, null, null, at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "action");
    }

    @Test
    void tcTuan100303AClosureWithoutAKnownOutcomeIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "CLOSE", null, null, "CLOSED_BY_EXIT", at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "outcome");
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tcTuan100304AStaleVersionIsAConflict() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(0, "TO_CHRONIC", null, null, null, at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tcTuan100305ATechnicianCannotUpdateACase() {
        role = FarmRole.TECHNICIAN;
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        DomainException error = domainError(() -> service.updateStatus(FARM_ID, h.getId(), KEY, status(1, "TO_CHRONIC", null, null, null, at(11, 26, 8), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(h.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tcTuan100306TheConfirmingMemberIsStoredOnTheClosure() {
        HealthCase h = healthCase("OPEN", at(11, 1, 10));

        service.updateStatus(FARM_ID, h.getId(), KEY, new CareDtos.CaseStatus(1, "CLOSE", null, null, null, null, "RECOVERED", null, 30L, at(11, 26, 8), null));

        assertThat(h.getClosedBy().getFullName()).isEqualTo("Owner Hoa");
        assertThat(h.getClosedAt()).isEqualTo(at(11, 26, 8));
    }

    // ================================================================== UC-FE10-03 reopen (D62)

    @Test
    void tc1030AReopenWithoutAReasonIsRejected() {
        HealthCase h = closedCase("RECOVERED");

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, " ")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "reason");
        assertThat(h.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void tc1030AReopenedRecoveredCaseIsOpenWithARevision() {
        HealthCase h = closedCase("RECOVERED");

        CareDtos.HealthCaseResult result = service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Tái phát"));

        assertThat(result.status()).isEqualTo("OPEN");
        assertThat(result.healthState()).isEqualTo("MONITORING");
        assertThat(h.getOutcome()).isNull();
        assertThat(h.getClosedDate()).isNull();
        assertThat(h.getClosedBy()).isNull();
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("REOPEN");
            assertThat(r.getReason()).isEqualTo("Tái phát");
            assertThat(snapshot(r.getBeforeSnapshot(), "outcome")).isEqualTo("RECOVERED");
        });
    }

    @Test
    void tc1030AReopenedCaseCannotBeReopenedAgain() {
        HealthCase h = closedCase("RECOVERED");
        service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Tái phát"));

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), "idem-2", new CareDtos.ReopenCase(1, "Lần nữa")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "case_not_closed");
    }

    @Test
    void tc1031AManagerCannotReopenADiedCase() {
        HealthCase h = closedCase("DIED");

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Bò còn sống")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(h.getStatus()).isEqualTo("CLOSED");
        verify(exitVouchers, never()).dismissForCaseReopen(any(), any(), anyString());
    }

    @Test
    void tc1031TheOwnerReopensADiedCaseAndDismissesItsVoucher() {
        role = FarmRole.OWNER;
        pendingDeath = true;
        HealthCase h = closedCase("DIED");

        CareDtos.HealthCaseResult result = service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Bò còn sống"));

        verify(exitVouchers).dismissForCaseReopen(any(FarmContext.class), eq(h), eq("Bò còn sống"));
        assertThat(result.status()).isEqualTo("OPEN");
        assertThat(cattle.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
    }

    @Test
    void tc1032ACaseClosedByExitIsNeverReopened() {
        HealthCase h = closedCase("CLOSED_BY_EXIT");

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Thử")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "case_closed_by_exit");
    }

    @Test
    void tcTuan100307AReasonOf501CharactersIsInvalid() {
        HealthCase h = closedCase("RECOVERED");

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(h.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void tcTuan100308AStaleVersionIsAConflict() {
        HealthCase h = closedCase("RECOVERED");

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(0, "Tái phát")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(h.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void tcTuan100309ADiedCaseOfAnExitedCattleCannotBeReopened() {
        role = FarmRole.OWNER;
        HealthCase h = closedCase("DIED");
        cattle.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Bò còn sống")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(h.getStatus()).isEqualTo("CLOSED");
    }

    @Test
    void tcTuan100310ARecoveredCaseOfAnExitPendingCattleCannotBeReopened() {
        HealthCase h = closedCase("RECOVERED");
        pendingDeath = true;

        DomainException error = domainError(() -> service.reopen(FARM_ID, h.getId(), KEY, new CareDtos.ReopenCase(1, "Tái phát")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_17);
        assertThat(h.getStatus()).isEqualTo("CLOSED");
    }

    // ================================================================== UC-FE10-04 recordTreatment

    @Test
    void tc1008TheFirstTreatmentPutsTheCattleUnderTreatment() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), null, null, null));

        assertThat(result.healthState()).isEqualTo("UNDER_TREATMENT");
        assertThat(treatments).singleElement().satisfies(t -> assertThat(t.getMedicineNameSnapshot()).isEqualTo("Oxytetracycline"));
    }

    @Test
    void tc1009AThreeDayCourseWithSevenDaysWithdrawalEndsOn10Nov() {
        build(Instant.parse("2026-11-03T03:00:00Z"));
        HealthCase h = healthCase("OPEN", at(10, 31, 8));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 1, 8), 3, 7, null));

        assertThat(result.withdrawalEndDate()).isEqualTo(LocalDate.of(2026, 11, 10));
        assertThat(result.cattleWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 11, 10));
        assertThat(result.courseDays()).isEqualTo(3);
    }

    @Test
    void tc1010ATreatmentOfAChronicCaseReturnsItToOpenByDefault() {
        HealthCase h = healthCase("CHRONIC", at(11, 1, 10));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), null, null, null));

        assertThat(result.caseStatus()).isEqualTo("OPEN");
        assertThat(result.returnedToOpen()).isTrue();
        assertThat(result.healthState()).isEqualTo("UNDER_TREATMENT");
        assertThat(h.getChronicSince()).isNull();
    }

    @Test
    void tc1010AMaintenanceTreatmentKeepsTheCaseChronic() {
        HealthCase h = healthCase("CHRONIC", at(11, 1, 10));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), 1, 7, false));

        assertThat(result.caseStatus()).isEqualTo("CHRONIC");
        assertThat(result.returnedToOpen()).isFalse();
        assertThat(result.healthState()).isEqualTo("MONITORING");
        assertThat(result.withdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 3));
        assertThat(result.cattleWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 3));
    }

    @Test
    void tc1024ATechnicianCannotRecordATreatment() {
        role = FarmRole.TECHNICIAN;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_HEALTH.allows(FarmRole.TECHNICIAN)).isFalse();
        assertThat(treatments).isEmpty();
    }

    @Test
    void tc1025ADiscontinuedMedicineIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 62L, at(11, 26, 8), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE18_08);
        assertThat(error.getParams()).containsEntry("field", "medicineId");
        assertThat(treatments).isEmpty();
    }

    @Test
    void tc1029TheOwnerRecordsATreatment() {
        role = FarmRole.OWNER;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), null, null, null));

        assertThat(result.id()).isNotNull();
        verify(audit).log(org.mockito.ArgumentMatchers.<FarmContext>argThat(ctx -> ctx.user().getFullName().equals("Owner Hoa")),
            eq("HEALTH_TREATMENT"), eq("Treatment"), eq(result.id()), any());
    }

    @Test
    void tcTuan100401ATreatmentOnAClosedCaseIsRejected() {
        HealthCase h = closedCase("RECOVERED");

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(treatments).isEmpty();
    }

    @Test
    void tcTuan100402ATreatmentBeforeTheLatestRecordIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        observation(h, at(11, 25, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 24, 8), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_07);
        assertThat(error.getParams()).containsEntry("date", at(11, 25, 8));
    }

    @Test
    void tcTuan100403ATreatmentInTheFutureIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 27, 11), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
    }

    @Test
    void tcTuan100404ACourseOf31DaysIsInvalid() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), 31, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "courseDays");
    }

    @Test
    void tcTuan100405ACourseOf30DaysIsAccepted() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), 30, 0, null));

        assertThat(result.withdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 25));
    }

    @Test
    void tcTuan100406AWithdrawalOf366DaysIsInvalid() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), 1, 366, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "withdrawalDays");
    }

    @Test
    void tcTuan100407TheWithdrawalDefaultsToTheMedicine() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        CareDtos.TreatmentResult result = service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), 1, null, null));

        assertThat(treatments.get(0).getWithdrawalDays()).isEqualTo(7);
        assertThat(result.withdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 3));
    }

    @Test
    void tcTuan100408AMissingDoseIsRequired() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY,
            new CareDtos.TreatmentCommand(1, 61L, at(11, 26, 8), " ", "INTRAMUSCULAR", null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "dose");
    }

    @Test
    void tcTuan100409ADoseWithoutAnAmountIsInvalid() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY,
            new CareDtos.TreatmentCommand(1, 61L, at(11, 26, 8), "nhiều", "INTRAMUSCULAR", null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "dose");
        assertThat(treatments).isEmpty();
    }

    @Test
    void tcTuan100410AnUnknownRouteIsInvalidAndAnAliasIsNormalised() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY,
            new CareDtos.TreatmentCommand(1, 61L, at(11, 26, 8), "10 ml", "NASAL", null, null, null, null, null, null)));
        service.recordTreatment(FARM_ID, h.getId(), "idem-2", new CareDtos.TreatmentCommand(1, 61L, at(11, 26, 8), "10 ml", "im", null, null, null, null, null, null));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "route");
        assertThat(treatments).singleElement().satisfies(t -> assertThat(t.getRoute()).isEqualTo("INTRAMUSCULAR"));
    }

    @Test
    void tcTuan100411AnExternalPerformerNameOf101CharactersIsInvalid() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY,
            new CareDtos.TreatmentCommand(1, 61L, at(11, 26, 8), "10 ml", "INTRAMUSCULAR", null, null, null, "x".repeat(101), null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "performerName");
    }

    @Test
    void tcTuan100412AnExitedCattleGetsNoTreatment() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        cattle.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(1, 61L, at(11, 26, 8), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(treatments).isEmpty();
    }

    @Test
    void tcTuan100413AStaleCaseVersionIsAConflict() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY, treat(0, 61L, at(11, 26, 8), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(treatments).isEmpty();
    }

    @Test
    void tcTuan100414AMissingMedicineIsRequired() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));

        DomainException error = domainError(() -> service.recordTreatment(FARM_ID, h.getId(), KEY,
            new CareDtos.TreatmentCommand(1, null, at(11, 26, 8), "10 ml", "INTRAMUSCULAR", null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "medicineId");
    }

    // ================================================================== UC-FE10-05 correctTreatment

    @Test
    void tc1018AnOldTreatmentOfAnExitPendingCattleCanBeCorrected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);
        pendingDeath = true;

        CareDtos.RecordStatus result = service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 14, null));

        assertThat(result.status()).isEqualTo("VALID");
        assertThat(t.getWithdrawalDays()).isEqualTo(14);
    }

    @Test
    void tc1019ALongerWithdrawalMovesTheEndDateAndKeepsTheOldValue() {
        build(Instant.parse("2026-11-05T03:00:00Z"));
        HealthCase h = healthCase("OPEN", at(10, 31, 8));
        Treatment t = treatment(h, at(11, 1, 8), 3, 7);

        CareDtos.RecordStatus result = service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 14, null));

        assertThat(result.withdrawalBefore()).isEqualTo(LocalDate.of(2026, 11, 10));
        assertThat(result.withdrawalAfter()).isEqualTo(LocalDate.of(2026, 11, 17));
        assertThat(t.getWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 11, 17));
        assertThat(t.getIsCorrected()).isTrue();
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("CORRECT");
            assertThat(snapshot(r.getBeforeSnapshot(), "withdrawalDays")).isEqualTo(7);
            assertThat(snapshot(r.getAfterSnapshot(), "withdrawalDays")).isEqualTo(14);
        });
    }

    @Test
    void tc1022ACorrectionWithoutANoteIsSaved() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, null));

        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getReason()).isNull());
    }

    @Test
    void tc1022ANoteOf501CharactersIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "reason");
        assertThat(t.getWithdrawalDays()).isEqualTo(7);
    }

    @Test
    void tc1023ATreatmentOfACaseClosedByExitIsFrozen() {
        HealthCase h = closedCase("CLOSED_BY_EXIT");
        Treatment t = treatment(h, at(11, 2, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "case_closed_by_exit");
        assertThat(t.getWithdrawalDays()).isEqualTo(7);
    }

    @Test
    void tc1029TheOwnerCorrectsATreatment() {
        role = FarmRole.OWNER;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, "Sai số ngày"));

        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa"));
    }

    @Test
    void tcTuan100501AStaleVersionIsAConflict() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(0, 10, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(t.getWithdrawalDays()).isEqualTo(7);
    }

    @Test
    void tcTuan100502AVoidedTreatmentCannotBeCorrected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);
        t.setStatus("VOIDED");

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
    }

    @Test
    void tcTuan100503AMovedTimeCannotCrossThePreviousRecord() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        observation(h, at(11, 21, 8));
        Treatment t = treatment(h, at(11, 22, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY,
            new CareDtos.CorrectTreatment(1, null, null, at(11, 21, 7), null, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_07);
        assertThat(error.getParams()).containsEntry("date", at(11, 21, 8));
        assertThat(t.getTreatmentTime()).isEqualTo(at(11, 22, 8));
    }

    @Test
    void tcTuan100504AMovedTimeInTheFutureIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY,
            new CareDtos.CorrectTreatment(1, null, null, at(11, 27, 11), null, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
    }

    @Test
    void tcTuan100505ATreatmentOfAnExitedCattleCannotBeCorrected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);
        cattle.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
    }

    @Test
    void tcTuan100506ATechnicianCannotCorrectATreatment() {
        role = FarmRole.TECHNICIAN;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY, correctWithdrawal(1, 10, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(t.getWithdrawalDays()).isEqualTo(7);
    }

    @Test
    void tcTuan100507ACourseOfZeroDaysIsInvalid() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY,
            new CareDtos.CorrectTreatment(1, null, null, null, null, null, 0, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "courseDays");
    }

    @Test
    void tcTuan100508ADiscontinuedMedicineCannotBeChosen() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.correctTreatment(FARM_ID, t.getId(), KEY,
            new CareDtos.CorrectTreatment(1, null, 62L, null, null, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE18_08);
        assertThat(t.getMedicine().getId()).isEqualTo(61L);
    }

    // ================================================================== UC-FE10-05 voidTreatment

    @Test
    void tc1020VoidingTheOnlyTreatmentReturnsTheCattleToMonitoring() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 3, 7);

        CareDtos.RecordStatus result = service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, "Ghi nhầm"));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(result.healthState()).isEqualTo("MONITORING");
        assertThat(result.withdrawalBefore()).isEqualTo(LocalDate.of(2026, 11, 30));
        assertThat(result.withdrawalAfter()).isNull();
        assertThat(t.getStatusReason()).isEqualTo("Ghi nhầm");
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getAction()).isEqualTo("VOID"));
    }

    @Test
    void tc1023ATreatmentOfACaseClosedByExitCannotBeVoided() {
        HealthCase h = closedCase("CLOSED_BY_EXIT");
        Treatment t = treatment(h, at(11, 2, 8), 1, 7);

        DomainException error = domainError(() -> service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(t.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tc1029TheOwnerVoidsATreatment() {
        role = FarmRole.OWNER;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, null));

        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa");
            assertThat(r.getReason()).isNull();
        });
    }

    @Test
    void tcTuan100509AStaleVersionIsAConflict() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(0, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(t.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan100510AVoidedTreatmentCannotBeVoidedAgain() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);
        t.setStatus("VOIDED");

        DomainException error = domainError(() -> service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan100511ATechnicianCannotVoidATreatment() {
        role = FarmRole.TECHNICIAN;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(t.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan100512ATreatmentOfAnExitedCattleCannotBeVoided() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);
        cattle.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(t.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan100513AVoidNoteOf501CharactersIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        Treatment t = treatment(h, at(11, 21, 8), 1, 7);

        DomainException error = domainError(() -> service.voidTreatment(FARM_ID, t.getId(), KEY, new CareDtos.VoidRecord(1, "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(t.getStatus()).isEqualTo("VALID");
    }

    // ================================================================== UC-FE10-05 correctObservation

    @Test
    void tc1001ACorrectedTemperatureOf45Point1IsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.correctObservation(FARM_ID, o.getId(), KEY,
            new CareDtos.CorrectObservation(1, null, null, new BigDecimal("45.1"), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_06);
        assertThat(o.getTemperatureC()).isNull();
    }

    @Test
    void tc1001ACorrectedTemperatureOf34Point9IsSaved() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        service.correctObservation(FARM_ID, o.getId(), KEY, new CareDtos.CorrectObservation(1, null, null, new BigDecimal("34.9"), null, null, null));

        assertThat(o.getTemperatureC()).isEqualByComparingTo("34.9");
        assertThat(o.getIsCorrected()).isTrue();
    }

    @Test
    void tc1022AnObservationNoteOf501CharactersIsRejected() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.correctObservation(FARM_ID, o.getId(), KEY,
            new CareDtos.CorrectObservation(1, "x".repeat(501), null, null, "Ho", null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(o.getSignsProgress()).isEqualTo("Sốt, bỏ ăn");
    }

    @Test
    void tcTuan100514MovingTheOpeningObservationMovesTheOpeningDate() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation opening = observations.get(0);

        service.correctObservation(FARM_ID, opening.getId(), KEY, new CareDtos.CorrectObservation(1, null, at(11, 19, 8), null, null, null, null));

        assertThat(opening.getObservedTime()).isEqualTo(at(11, 19, 8));
        assertThat(h.getOpenedDate()).isEqualTo(LocalDate.of(2026, 11, 19));
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(snapshot(r.getBeforeSnapshot(), "signs")).isEqualTo("Sốt, bỏ ăn"));
    }

    @Test
    void tcTuan100515AFollowUpCannotBeMovedBeforeThePreviousRecord() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 22, 8));

        DomainException error = domainError(() -> service.correctObservation(FARM_ID, o.getId(), KEY,
            new CareDtos.CorrectObservation(1, null, at(11, 19, 8), null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_07);
        assertThat(error.getParams()).containsEntry("date", at(11, 20, 8));
        assertThat(o.getObservedTime()).isEqualTo(at(11, 22, 8));
    }

    @Test
    void tcTuan100516AnUnknownProgressIsInvalid() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.correctObservation(FARM_ID, o.getId(), KEY,
            new CareDtos.CorrectObservation(1, null, null, null, null, "BETTER", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "progress");
    }

    @Test
    void tcTuan100517AStaleVersionIsAConflict() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.correctObservation(FARM_ID, o.getId(), KEY,
            new CareDtos.CorrectObservation(0, null, null, null, "Ho", null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(o.getSignsProgress()).isEqualTo("Sốt, bỏ ăn");
    }

    @Test
    void tcTuan100518BlankSignsAreRequired() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.correctObservation(FARM_ID, o.getId(), KEY,
            new CareDtos.CorrectObservation(1, null, null, null, " ", null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "signs");
    }

    // ================================================================== UC-FE10-05 voidObservation

    @Test
    void tc1021TheOpeningObservationCannotBeVoided() {
        healthCase("OPEN", at(11, 20, 8));
        HealthObservation opening = observations.get(0);

        DomainException error = domainError(() -> service.voidObservation(FARM_ID, opening.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE10_13);
        assertThat(opening.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan100519AFollowUpIsVoidedWithARevision() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        CareDtos.RecordStatus result = service.voidObservation(FARM_ID, o.getId(), KEY, new CareDtos.VoidRecord(1, null));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("VOID");
            assertThat(r.getReason()).isNull();
            assertThat(snapshot(r.getBeforeSnapshot(), "status")).isEqualTo("VALID");
        });
    }

    @Test
    void tcTuan100520AStaleVersionIsAConflict() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.voidObservation(FARM_ID, o.getId(), KEY, new CareDtos.VoidRecord(0, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(o.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan100521AVoidedFollowUpCannotBeVoidedAgain() {
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));
        o.setStatus("VOIDED");

        DomainException error = domainError(() -> service.voidObservation(FARM_ID, o.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
    }

    @Test
    void tcTuan100522AFollowUpOfACaseClosedByExitCannotBeVoided() {
        HealthCase h = closedCase("CLOSED_BY_EXIT");
        HealthObservation o = observation(h, at(11, 5, 8));

        DomainException error = domainError(() -> service.voidObservation(FARM_ID, o.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "case_closed_by_exit");
    }

    @Test
    void tcTuan100523ATechnicianCannotVoidAFollowUp() {
        role = FarmRole.TECHNICIAN;
        HealthCase h = healthCase("OPEN", at(11, 20, 8));
        HealthObservation o = observation(h, at(11, 21, 8));

        DomainException error = domainError(() -> service.voidObservation(FARM_ID, o.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(o.getStatus()).isEqualTo("VALID");
    }
}
