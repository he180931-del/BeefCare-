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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
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
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of FE-09: UC-FE09-01 View Vaccination
 * Schedules ({@link VaccinationCommandService#schedules}), UC-FE09-02 Create Vaccination Schedule
 * ({@link VaccinationCommandService#createSchedule}), UC-FE09-03 Update or Stop Vaccination Schedule
 * ({@link VaccinationCommandService#editSchedule}, {@link VaccinationCommandService#stopSchedule}), UC-FE09-04 Record
 * Vaccination ({@link VaccinationCommandService#record}) and UC-FE09-06 Correct or Void Vaccination Record
 * ({@link VaccinationCommandService#correct}, {@link VaccinationCommandService#voidRecord}). Schedules, doses,
 * vaccinations, cattle and pen placements live in memory behind {@link FakeJpql}; the cattle guard, the record revision
 * service and the cattle state derivation (withdrawal end, GBR-46) are the real classes; the idempotency wrapper runs
 * the command; the farm access check applies the real {@link FarmAction} role table. The farm clock is fixed at
 * 27/11/2026 10:00 (UTC+7) unless a test sets another day. Vaccine LMLM Aftovax (id 51) has a 21-day withdrawal.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VaccinationCommandServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final long FARM_ID = 901L;
    private static final String KEY = "idem-1";

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock CattleRepository cattleRepository;
    @Mock HerdExitRepository exits;
    @Mock IdempotencyCommandService idempotency;
    @Mock AuditService audit;
    @Mock RecordRevisionRepository revisionRepository;

    private VaccinationCommandService service;
    private CattleStateService state;
    private Farm farm;
    private FarmRole role = FarmRole.MANAGER;
    private final Map<FarmRole, AppUser> users = new HashMap<>();
    private final Map<Long, Vaccine> vaccines = new HashMap<>();
    private final Map<Long, Cattle> cattleById = new HashMap<>();
    private final Map<Long, Pen> pens = new HashMap<>();
    private final List<PenAssignment> placements = new ArrayList<>();
    private final List<VaccinationSchedule> schedules = new ArrayList<>();
    private final List<ScheduledDose> doses = new ArrayList<>();
    private final List<Vaccination> vaccinations = new ArrayList<>();
    private final List<RecordRevision> savedRevisions = new ArrayList<>();
    private final Map<Long, LocalDate> entryDates = new HashMap<>();
    private final Map<Long, ExitType> pendingExit = new HashMap<>();
    private LocalDate treatmentWithdrawal;
    private long nextId = 300L;
    private FakeJpql jpql;

    @BeforeEach
    void setUp() {
        build(NOW);
        farm = new Farm();
        farm.setId(FARM_ID);
        user(FarmRole.OWNER, 30L, "Owner Hoa");
        user(FarmRole.MANAGER, 31L, "Manager Lan");
        user(FarmRole.TECHNICIAN, 32L, "Technician Minh");
        vaccine(51L, "LMLM Aftovax", true, "21");
        vaccine(52L, "Tụ huyết trùng", true, "0");
        vaccine(53L, "Vắc-xin ngưng", false, "0");
        pen(11L, "A-01");
        pen(12L, "B-01");

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
        when(exits.findFirstByCattleIdAndStatus(anyLong(), eq(ExitLineStatus.PENDING))).thenAnswer(inv -> {
            ExitType type = pendingExit.get(inv.<Long>getArgument(0));
            if (type == null) {
                return Optional.empty();
            }
            HerdExitVoucher voucher = new HerdExitVoucher();
            voucher.setExitType(type);
            voucher.setExitDate(LocalDate.of(2026, 11, 26));
            HerdExit line = new HerdExit();
            line.setVoucher(voucher);
            return Optional.of(line);
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
            if (entity instanceof VaccinationSchedule s) {
                schedules.add(s);
            } else if (entity instanceof ScheduledDose d) {
                doses.add(d);
            } else if (entity instanceof Vaccination v) {
                vaccinations.add(v);
            }
            return null;
        }).when(em).persist(any());

        jpql = new FakeJpql(em)
            .on("from VaccinationSchedule s where s.farm.id=:farm order by", p -> schedules.stream()
                .filter(s -> s.getFarm().getId().equals(p.get("farm"))).sorted(Comparator.comparing(VaccinationSchedule::getId).reversed()).toList())
            .on("from VaccinationSchedule s where s.id=:id and s.farm.id=:farm", p -> schedules.stream()
                .filter(s -> s.getId().equals(p.get("id")) && s.getFarm().getId().equals(p.get("farm"))).toList())
            .on("count(x) from VaccinationSchedule x", p -> List.of(schedules.stream()
                .filter(s -> !s.getId().equals(p.get("id")) && "ACTIVE".equals(s.getStatus()) && s.getScheduleName().equalsIgnoreCase((String) p.get("name"))).count()))
            .on("count(s) from VaccinationSchedule s", p -> List.of(schedules.stream()
                .filter(s -> "ACTIVE".equals(s.getStatus()) && s.getScheduleName().equalsIgnoreCase((String) p.get("name"))).count()))
            .on("from Vaccine v where v.id=:id", p -> Optional.ofNullable(vaccines.get((Long) p.get("id"))).stream().toList())
            .on("count(distinct d.cattle.id) from ScheduledDose", p -> List.of(dosesOf((Long) p.get("id")).stream().map(d -> d.getCattle().getId()).distinct().count()))
            .on("count(d) from ScheduledDose d where d.schedule.id=:id and d.status=:planned", p -> List.of(dosesOf((Long) p.get("id")).stream()
                .filter(d -> "PLANNED".equals(d.getStatus())).count()))
            .on("count(d) from ScheduledDose d where d.schedule.id=:schedule", p -> List.of(dosesOf((Long) p.get("schedule")).stream()
                .filter(d -> d.getCattle().getId().equals(p.get("cattle")) && d.getDoseNo().equals(p.get("no")) && "PLANNED".equals(d.getStatus())).count()))
            .on("from ScheduledDose d where d.cattle.id=:id", p -> List.of(0L))
            .on("from ScheduledDose d where d.schedule.id=:id and d.status=:planned", p -> dosesOf((Long) p.get("id")).stream()
                .filter(d -> "PLANNED".equals(d.getStatus())).toList())
            .on("from ScheduledDose d where d.schedule.id=:id order by d.dueDate", p -> dosesOf((Long) p.get("id")).stream()
                .sorted(Comparator.comparing(ScheduledDose::getDueDate).thenComparing(d -> d.getCattle().getDisplayCode()).thenComparing(ScheduledDose::getDoseNo)).toList())
            .on("from ScheduledDose d where d.schedule.id=:id order by d.cattle.id", p -> dosesOf((Long) p.get("id")).stream()
                .sorted(Comparator.comparing((ScheduledDose d) -> d.getCattle().getId()).thenComparing(ScheduledDose::getDoseNo).thenComparing(ScheduledDose::getId)).toList())
            .on("from ScheduledDose d where d.id=:id", p -> doses.stream()
                .filter(d -> d.getId().equals(p.get("id")) && d.getSchedule().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from Cattle c where c.farm.id=:farm and c.herdStatus=:status", p -> cattleById.values().stream()
                .filter(c -> c.getFarm().getId().equals(p.get("farm")) && c.getHerdStatus() == p.get("status")).sorted(Comparator.comparing(Cattle::getId)).toList())
            .on("from PenAssignment p where p.farm.id=:farm", p -> placements.stream().filter(a -> {
                LocalDate day = (LocalDate) p.get("day");
                return !a.getFromDate().isAfter(day) && (a.getToDate() == null || !a.getToDate().isBefore(day));
            }).toList())
            .on("count(c) from Cattle c where c.id=:id", p -> List.of(Optional.ofNullable(cattleById.get((Long) p.get("id")))
                .filter(c -> c.getFarm().getId().equals(p.get("farm"))).stream().count()))
            .on("select c.id, c.displayCode from Cattle c", p -> ((Collection<?>) p.get("ids")).stream()
                .map(id -> cattleById.get((Long) id)).filter(Objects::nonNull).map(c -> new Object[] { c.getId(), c.getDisplayCode() }).toList())
            .on("select p.id, p.code from Pen p", p -> ((Collection<?>) p.get("ids")).stream()
                .map(id -> pens.get((Long) id)).filter(Objects::nonNull).map(pen -> new Object[] { pen.getId(), pen.getCode() }).toList())
            .on("from HerdEntry e", p -> Optional.ofNullable(entryDates.get((Long) p.get("cattle"))).stream().toList())
            .on("from Vaccination v where v.id=:id", p -> vaccinations.stream()
                .filter(v -> v.getId().equals(p.get("id")) && v.getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from HealthCase h", p -> List.of(0L))
            .on("max(t.withdrawalEndDate) from Treatment", p -> Collections.singletonList(treatmentWithdrawal))
            .on("max(v.withdrawalEndDate) from Vaccination", p -> Collections.singletonList(vaccinations.stream()
                .filter(v -> v.getCattle().getId().equals(p.get("id")) && "VALID".equals(v.getStatus()) && !"HISTORICAL".equals(v.getSource()))
                .map(Vaccination::getWithdrawalEndDate).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null)))
            .on("from PregnancyEpisode p", p -> List.of())
            .on("from ReproductionEvent e", p -> List.of())
            .on("max(c.birthTime) from CalvingEvent", p -> Collections.singletonList(null))
            .on("max(u.occurredTime) from PregnancyUpdate", p -> Collections.singletonList(null));
    }

    /** (Re)builds the service on a farm clock at {@code now}. */
    private void build(Instant now) {
        FarmClock clock = new FarmClock(Clock.fixed(now, ZoneOffset.UTC));
        state = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(state, "em", em);
        service = new VaccinationCommandService(access, new CattleGuardService(exits, cattleRepository, clock), idempotency, audit, clock,
            new RecordRevisionService(revisionRepository, clock), state);
        ReflectionTestUtils.setField(service, "em", em);
    }

    // ------------------------------------------------------------------ fixtures

    private void user(FarmRole r, long id, String name) {
        AppUser u = new AppUser();
        u.setId(id);
        u.setFullName(name);
        users.put(r, u);
    }

    private Vaccine vaccine(long id, String name, boolean available, String withdrawal) {
        Vaccine v = new Vaccine();
        v.setId(id);
        v.setName(name);
        v.setAvailable(available);
        v.setWithdrawalInfo(withdrawal);
        v.setDose("2 ml");
        v.setRoute("INTRAMUSCULAR");
        v.setFarm(farm);
        vaccines.put(id, v);
        return v;
    }

    private void pen(long id, String code) {
        Pen p = new Pen();
        p.setId(id);
        p.setCode(code);
        p.setName("Chuồng " + code);
        pens.put(id, p);
    }

    private Cattle cattle(long id, String code, PurposeType purpose, Long penId) {
        ProductionPurpose p = new ProductionPurpose();
        p.setPurposeType(purpose);
        Cattle c = new Cattle();
        c.setId(id);
        c.setDisplayCode(code);
        c.setFarm(farm);
        c.setPurpose(p);
        c.setSex(purpose == PurposeType.BREEDING ? Sex.FEMALE : Sex.MALE);
        c.setLifeStage(LifeStage.ADULT);
        c.setHerdStatus(HerdStatus.ACTIVE);
        cattleById.put(id, c);
        entryDates.put(id, LocalDate.of(2026, 6, 1));
        if (penId != null) {
            PenAssignment a = new PenAssignment();
            a.setCattle(c);
            a.setPen(pens.get(penId));
            a.setFarm(farm);
            a.setFromDate(LocalDate.of(2026, 6, 1));
            placements.add(a);
        }
        return c;
    }

    private Cattle cattle(long id, String code) {
        return cattle(id, code, PurposeType.FATTENING, 11L);
    }

    private VaccinationSchedule schedule(String name, long vaccineId, LocalDate start, int doseCount, int interval, Integer booster, String status) {
        VaccinationSchedule s = new VaccinationSchedule();
        ReflectionTestUtils.setField(s, "id", nextId++);
        s.setFarm(farm);
        s.setScheduleName(name);
        s.setVaccine(vaccines.get(vaccineId));
        s.setFirstDueDate(start);
        s.setDoseCount(doseCount);
        s.setIntervalDays(interval);
        s.setBoosterIntervalMonths(booster);
        s.setStatus(status);
        s.setTargetGroup("INDIVIDUALS");
        s.setVersion(1);
        schedules.add(s);
        return s;
    }

    private ScheduledDose dose(VaccinationSchedule s, Cattle c, int no, LocalDate due, String status) {
        ScheduledDose d = new ScheduledDose();
        ReflectionTestUtils.setField(d, "id", nextId++);
        d.setSchedule(s);
        d.setCattle(c);
        d.setDoseNo(no);
        d.setDueDate(due);
        d.setStatus(status);
        doses.add(d);
        return d;
    }

    private List<ScheduledDose> dosesOf(Long scheduleId) {
        return doses.stream().filter(d -> d.getSchedule().getId().equals(scheduleId)).toList();
    }

    private List<ScheduledDose> dosesOf(VaccinationSchedule s, Cattle c) {
        return doses.stream().filter(d -> d.getSchedule() == s && d.getCattle() == c).sorted(Comparator.comparing(ScheduledDose::getDoseNo)).toList();
    }

    private Vaccination stored(Cattle c, long vaccineId, LocalDate day, int withdrawalDays, ScheduledDose closes) {
        Vaccination v = new Vaccination();
        ReflectionTestUtils.setField(v, "id", nextId++);
        v.setCattle(c);
        v.setVaccine(vaccines.get(vaccineId));
        v.setVaccineNameSnapshot(vaccines.get(vaccineId).getName());
        v.setSource("ON_FARM");
        v.setVaccinationDate(day);
        v.setAdministeredAt(day.atTime(8, 0).toInstant(ZoneOffset.ofHours(7)));
        v.setDose("2 ml");
        v.setRoute("INTRAMUSCULAR");
        v.setVaccinator("Manager Lan");
        v.setWithdrawalDays(withdrawalDays);
        v.setWithdrawalEndDate(withdrawalDays > 0 ? day.plusDays(withdrawalDays) : null);
        v.setVersion(1);
        if (closes != null) {
            closes.setStatus("DONE");
            closes.setVaccination(v);
            v.setScheduledDose(closes);
        }
        vaccinations.add(v);
        return v;
    }

    private static Instant at(int year, int month, int day, int hour) {
        return LocalDate.of(year, month, day).atTime(hour, 0).toInstant(ZoneOffset.ofHours(7));
    }

    private static CareDtos.CreateVaccinationSchedule create(String name, Long vaccineId, LocalDate start, Integer doseCount, Integer interval, Integer booster,
                                                             List<Long> cattleIds) {
        return new CareDtos.CreateVaccinationSchedule(name, vaccineId, start, doseCount, interval, booster, cattleIds);
    }

    private CareDtos.CreateVaccinationSchedule createFor(List<Long> cattleIds) {
        return create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, null, cattleIds);
    }

    private static CareDtos.EditVaccinationSchedule edit(Integer version, Integer interval, Integer doseCount, CareDtos.ScheduleTarget target) {
        return new CareDtos.EditVaccinationSchedule(version, null, null, null, interval, null, doseCount, null, target);
    }

    private static CareDtos.ScheduleTarget only(Long... cattleIds) {
        return new CareDtos.ScheduleTarget(List.of(), List.of(), List.of(), List.of(cattleIds), List.of());
    }

    private static CareDtos.RecordVaccinations onFarm(long vaccineId, Instant at, Integer withdrawalDays, List<CareDtos.VaccinationAnimal> animals) {
        return new CareDtos.RecordVaccinations(vaccineId, "ON_FARM", null, at, null, null, null, withdrawalDays, null, animals);
    }

    private static CareDtos.VaccinationAnimal animal(Cattle c, ScheduledDose d) {
        return new CareDtos.VaccinationAnimal(c.getId(), d == null ? null : d.getId(), d == null ? null : d.getVersion());
    }

    private static CareDtos.CorrectVaccination correction(Integer version, Integer withdrawalDays, String reason) {
        return new CareDtos.CorrectVaccination(version, null, null, null, null, null, null, null, reason, withdrawalDays);
    }

    private static DomainException domainError(Runnable call) {
        DomainException error = catchThrowableOfType(DomainException.class, call::run);
        assertThat(error).as("the call should be rejected with a DomainException").isNotNull();
        return error;
    }

    private void assertNoVaccinationSaved() {
        verify(em, never()).persist(any(Vaccination.class));
    }

    private static Object snapshot(String json, String key) {
        return JsonSupport.fromJson(json, Map.class).get(key);
    }

    // ================================================================== UC-FE09-01 schedules

    @Test
    void tc0921AScheduleWithNoPlannedDoseIsShownAsCompleted() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, null, "ACTIVE");
        stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));

        List<CareDtos.VaccinationScheduleView> views = service.schedules(FARM_ID);

        assertThat(views).singleElement().satisfies(v -> {
            assertThat(v.completed()).isTrue();
            assertThat(v.status()).isEqualTo("ACTIVE");
            assertThat(v.doses()).singleElement().satisfies(d -> assertThat(d.status()).isEqualTo("DONE"));
        });
    }

    @Test
    void tcTuan090101SchedulesAreListedNewestFirstWithTheirDosesByDueDate() {
        Cattle a = cattle(1001L, "BO-1001");
        Cattle b = cattle(1002L, "BO-1002");
        VaccinationSchedule older = schedule("Tụ huyết trùng 2026", 52L, LocalDate.of(2026, 12, 5), 1, 21, null, "ACTIVE");
        dose(older, a, 1, LocalDate.of(2026, 12, 5), "PLANNED");
        VaccinationSchedule newer = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, null, "ACTIVE");
        dose(newer, b, 2, LocalDate.of(2026, 12, 22), "PLANNED");
        dose(newer, a, 1, LocalDate.of(2026, 12, 1), "PLANNED");
        dose(newer, b, 1, LocalDate.of(2026, 12, 1), "PLANNED");

        List<CareDtos.VaccinationScheduleView> views = service.schedules(FARM_ID);

        assertThat(views).extracting(CareDtos.VaccinationScheduleView::name).containsExactly("LMLM 2026", "Tụ huyết trùng 2026");
        assertThat(views.get(0).doses()).extracting(d -> d.cattleCode() + "#" + d.doseNo()).containsExactly("BO-1001#1", "BO-1002#1", "BO-1002#2");
        assertThat(views.get(0).vaccineName()).isEqualTo("LMLM Aftovax");
        assertThat(views.get(0).completed()).isFalse();
    }

    @Test
    void tcTuan090102AStoppedScheduleIsNotCompletedAndShowsItsReason() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "STOPPED");
        s.setStopReason("Hết vắc-xin");
        dose(s, c, 1, LocalDate.of(2026, 12, 1), "CANCELLED");

        CareDtos.VaccinationScheduleView view = service.schedules(FARM_ID).get(0);

        assertThat(view.completed()).isFalse();
        assertThat(view.status()).isEqualTo("STOPPED");
        assertThat(view.stopReason()).isEqualTo("Hết vắc-xin");
    }

    @Test
    void tcTuan090103ATechnicianCanViewTheSchedules() {
        role = FarmRole.TECHNICIAN;
        schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        assertThat(service.schedules(FARM_ID)).hasSize(1);
        assertThat(FarmAction.VIEW_HEALTH.allows(FarmRole.TECHNICIAN)).isTrue();
    }

    @Test
    void tcTuan090104AUserWithoutFarmAccessIsRefused() {
        role = null;

        DomainException error = domainError(() -> service.schedules(FARM_ID));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(jpql.executed()).isEmpty();
    }

    @Test
    void tcTuan090105TheStoredTargetIsShownWithPenAndCattleCodes() {
        cattle(1001L, "BO-1001");
        cattle(1002L, "BO-1002");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");
        s.setTargetCriteria(JsonSupport.toJson(new CareDtos.ScheduleTarget(List.of(11L), List.of("FATTENING"), List.of(), List.of(1002L), List.of(1001L))));

        CareDtos.ScheduleTargetView target = service.schedules(FARM_ID).get(0).target();

        assertThat(target.penCodes()).containsExactly("A-01");
        assertThat(target.herdGroups()).containsExactly("FATTENING");
        assertThat(target.cattleCodes()).containsExactly("BO-1002");
        assertThat(target.excludedCattleCodes()).containsExactly("BO-1001");
    }

    @Test
    void tcTuan090106AScheduleWithoutAnyDoseCountsAsCompleted() {
        schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        CareDtos.VaccinationScheduleView view = service.schedules(FARM_ID).get(0);

        assertThat(view.doses()).isEmpty();
        assertThat(view.completed()).isTrue();
    }

    @Test
    void tcTuan090107AFarmWithoutSchedulesGetsAnEmptyList() {
        assertThat(service.schedules(FARM_ID)).isEmpty();
    }

    // ================================================================== UC-FE09-02 createSchedule

    @Test
    void tc0901ANameOf101CharactersIsInvalid() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("x".repeat(101), 51L, LocalDate.of(2026, 12, 1), 2, 21, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "name");
        assertThat(schedules).isEmpty();
    }

    @Test
    void tc0901ZeroDosesIsInvalid() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 0, 21, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "doseCount");
    }

    @Test
    void tc0901ElevenDosesIsInvalid() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 11, 21, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "doseCount");
    }

    @Test
    void tc0901AnIntervalOfZeroDaysIsInvalid() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 0, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "intervalDays");
    }

    @Test
    void tc0901AnIntervalOf366DaysIsInvalid() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 366, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "intervalDays");
    }

    @Test
    void tc0901ABoosterAfter61MonthsIsInvalid() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, 61, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "boosterIntervalMonths");
    }

    @Test
    void tc0902TwoDosesWithoutAnIntervalIsMissingAField() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, null, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "intervalDays");
        assertThat(schedules).isEmpty();
    }

    @Test
    void tc0903ANameUsedByAnActiveScheduleIsRejected() {
        cattle(1001L, "BO-1001");
        schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, null, "ACTIVE");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, createFor(List.of(1001L))));

        assertThat(error.getCode()).isEqualTo("MSG-FE09-10");
        assertThat(schedules).hasSize(1);
    }

    @Test
    void tc0903TheNameOfAStoppedScheduleCanBeReused() {
        cattle(1001L, "BO-1001");
        schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, null, "STOPPED");

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY, createFor(List.of(1001L)));

        assertThat(result.name()).isEqualTo("LMLM 2026");
        assertThat(schedules).hasSize(2);
    }

    @Test
    void tc0904PenAndHerdGroupAreCombinedWithAnd() {
        for (long i = 0; i < 10; i++) {
            cattle(1001L + i, "BO-10" + (i + 1), i < 4 ? PurposeType.FATTENING : PurposeType.BREEDING, 11L);
        }
        cattle(1101L, "BO-1101", PurposeType.FATTENING, 12L);
        CareDtos.CreateVaccinationSchedule request = new CareDtos.CreateVaccinationSchedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null,
            List.of(), List.of(11L), List.of("FATTENING"), List.of(), List.of());

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY, request);

        assertThat(result.targetCount()).isEqualTo(4);
        assertThat(doses).extracting(d -> d.getCattle().getId()).containsExactly(1001L, 1002L, 1003L, 1004L);
    }

    @Test
    void tc0905ATargetMatchingNoCattleIsRejected() {
        cattle(1001L, "BO-1001", PurposeType.BREEDING, 11L);
        CareDtos.CreateVaccinationSchedule request = new CareDtos.CreateVaccinationSchedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null,
            List.of(), List.of(11L), List.of("FATTENING"), List.of(), List.of());

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, request));

        assertThat(error.getCode()).isEqualTo("MSG-FE09-07");
        assertThat(schedules).isEmpty();
    }

    @Test
    void tc0906FourCattleAndTwoDosesGiveEightPlannedDoses() {
        build(Instant.parse("2026-10-30T03:00:00Z"));
        for (long i = 0; i < 4; i++) {
            cattle(1001L + i, "BO-100" + (i + 1));
        }

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY,
            create("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 21, null, List.of(1001L, 1002L, 1003L, 1004L)));

        assertThat(result.plannedDoseCount()).isEqualTo(8);
        assertThat(doses).hasSize(8).allSatisfy(d -> assertThat(d.getStatus()).isEqualTo("PLANNED"));
        assertThat(doses).filteredOn(d -> d.getDoseNo() == 1).extracting(ScheduledDose::getDueDate).containsOnly(LocalDate.of(2026, 11, 1));
        assertThat(doses).filteredOn(d -> d.getDoseNo() == 2).extracting(ScheduledDose::getDueDate).containsOnly(LocalDate.of(2026, 11, 22));
    }

    @Test
    void tc0928ATechnicianCannotCreateASchedule() {
        role = FarmRole.TECHNICIAN;
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, createFor(List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(schedules).isEmpty();
    }

    @Test
    void tc0931TheOwnerCreatesASchedule() {
        role = FarmRole.OWNER;
        cattle(1001L, "BO-1001");

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY, createFor(List.of(1001L)));

        assertThat(result.status()).isEqualTo("ACTIVE");
        ArgumentCaptor<FarmContext> actor = ArgumentCaptor.forClass(FarmContext.class);
        verify(audit).log(actor.capture(), eq("VACCINATION_SCHEDULE_CREATE"), eq("VaccinationSchedule"), anyLong(), any());
        assertThat(actor.getValue().user().getFullName()).isEqualTo("Owner Hoa");
    }

    @Test
    void tcTuan090201ASingleDoseScheduleNeedsNoInterval() {
        cattle(1001L, "BO-1001");

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, null, null, List.of(1001L)));

        assertThat(result.plannedDoseCount()).isEqualTo(1);
    }

    @Test
    void tcTuan090202ADiscontinuedVaccineIsRejected() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 53L, LocalDate.of(2026, 12, 1), 1, 21, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE18_08);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(schedules).isEmpty();
    }

    @Test
    void tcTuan090203AnUnknownVaccineIsNotFound() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 99L, LocalDate.of(2026, 12, 1), 1, 21, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
    }

    @Test
    void tcTuan090204AStartDateInThePastIsRejected() {
        cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, create("LMLM 2026", 51L, LocalDate.of(2026, 11, 26), 1, 21, null, List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "firstDueDate");
    }

    @Test
    void tcTuan090205TheLimitValuesAreAccepted() {
        cattle(1001L, "BO-1001");

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY, create("x".repeat(100), 51L, LocalDate.of(2026, 11, 27), 10, 365, 60, List.of(1001L)));

        assertThat(result.plannedDoseCount()).isEqualTo(10);
        assertThat(doses).filteredOn(d -> d.getDoseNo() == 10).extracting(ScheduledDose::getDueDate).containsExactly(LocalDate.of(2026, 11, 27).plusDays(9L * 365));
        assertThat(schedules.get(0).getBoosterIntervalMonths()).isEqualTo(60);
    }

    @Test
    void tcTuan090206AnExitedCattleCannotBeTargeted() {
        Cattle c = cattle(1001L, "BO-1001");
        c.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, createFor(List.of(1001L))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(schedules).isEmpty();
    }

    @Test
    void tcTuan090207AnExcludedCattleGetsNoDose() {
        cattle(1001L, "BO-1001");
        cattle(1002L, "BO-1002");
        CareDtos.CreateVaccinationSchedule request = new CareDtos.CreateVaccinationSchedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null,
            List.of(), List.of(11L), List.of(), List.of(), List.of(1002L));

        CareDtos.VaccinationScheduleResult result = service.createSchedule(FARM_ID, KEY, request);

        assertThat(result.targetCount()).isEqualTo(1);
        assertThat(doses).extracting(d -> d.getCattle().getId()).containsExactly(1001L);
    }

    @Test
    void tcTuan090208AnUnknownHerdGroupIsInvalid() {
        cattle(1001L, "BO-1001");
        CareDtos.CreateVaccinationSchedule request = new CareDtos.CreateVaccinationSchedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null,
            List.of(), List.of(), List.of("PETS"), List.of(), List.of());

        DomainException error = domainError(() -> service.createSchedule(FARM_ID, KEY, request));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "herdGroups");
    }

    // ================================================================== UC-FE09-03 editSchedule

    @Test
    void tc0908ANewIntervalMovesTheSecondDoseWhenNoneIsGiven() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, null, "ACTIVE");
        dose(s, c, 1, LocalDate.of(2026, 12, 1), "PLANNED");
        ScheduledDose second = dose(s, c, 2, LocalDate.of(2026, 12, 22), "PLANNED");

        service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, 28, null, null));

        assertThat(s.getIntervalDays()).isEqualTo(28);
        assertThat(second.getDueDate()).isEqualTo(LocalDate.of(2026, 12, 29));
    }

    @Test
    void tc0908TheIntervalIsLockedOnceADoseIsGiven() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 21, null, "ACTIVE");
        List<ScheduledDose> seconds = new ArrayList<>();
        for (long i = 0; i < 4; i++) {
            Cattle c = cattle(1001L + i, "BO-100" + (i + 1));
            stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));
            seconds.add(dose(s, c, 2, LocalDate.of(2026, 11, 22), "PLANNED"));
        }

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, 28, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "interval_locked_after_done");
        assertThat(s.getIntervalDays()).isEqualTo(21);
        assertThat(seconds).extracting(ScheduledDose::getDueDate).containsOnly(LocalDate.of(2026, 11, 22));
    }

    @Test
    void tc0909ARemovedCattleLosesItsOpenDoseAndKeepsTheGivenOne() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 21, null, "ACTIVE");
        List<Cattle> herd = new ArrayList<>();
        for (long i = 0; i < 4; i++) {
            Cattle c = cattle(1001L + i, "BO-100" + (i + 1));
            herd.add(c);
            stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));
            dose(s, c, 2, LocalDate.of(2026, 11, 22), "PLANNED");
        }

        CareDtos.VaccinationScheduleResult result = service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, null, null, only(1001L, 1002L, 1003L)));

        assertThat(dosesOf(s, herd.get(3))).extracting(ScheduledDose::getStatus).containsExactly("DONE", "CANCELLED");
        assertThat(dosesOf(s, herd.get(0))).extracting(ScheduledDose::getStatus).containsExactly("DONE", "PLANNED");
        assertThat(result.targetCount()).isEqualTo(3);
        assertThat(result.plannedDoseCount()).isEqualTo(3);
    }

    @Test
    void tc0921ACompletedScheduleCannotBeEdited() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, null, "ACTIVE");
        stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, 28, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "schedule_completed");
    }

    @Test
    void tc0922ACattleAddedToAStartedScheduleIsDueToday() {
        build(Instant.parse("2026-11-23T03:00:00Z"));
        Cattle first = cattle(1001L, "BO-1001");
        cattle(1002L, "BO-1002");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 10, 1), 1, 21, null, "ACTIVE");
        dose(s, first, 1, LocalDate.of(2026, 10, 1), "PLANNED");

        service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, null, null, only(1001L, 1002L)));

        assertThat(doses).filteredOn(d -> d.getCattle().getId() == 1002L).singleElement().satisfies(d -> {
            assertThat(d.getDueDate()).isEqualTo(LocalDate.of(2026, 11, 23));
            assertThat(d.getStatus()).isEqualTo("PLANNED");
        });
    }

    @Test
    void tcTuan090301AStaleVersionIsAConflict() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, null, "ACTIVE");
        dose(s, c, 1, LocalDate.of(2026, 12, 1), "PLANNED");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY, edit(0, 28, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(s.getIntervalDays()).isEqualTo(21);
    }

    @Test
    void tcTuan090302AStoppedScheduleCannotBeEdited() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, null, "STOPPED");
        dose(s, c, 1, LocalDate.of(2026, 12, 1), "CANCELLED");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, 28, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(s.getIntervalDays()).isEqualTo(21);
    }

    @Test
    void tcTuan090303TheVaccineIsLockedOnceADoseIsGiven() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 21, null, "ACTIVE");
        stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));
        dose(s, c, 2, LocalDate.of(2026, 11, 22), "PLANNED");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY,
            new CareDtos.EditVaccinationSchedule(1, null, 52L, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "vaccine_change_after_done");
        assertThat(s.getVaccine().getId()).isEqualTo(51L);
    }

    @Test
    void tcTuan090304TheStartDateIsLockedOnceADoseIsGiven() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 21, null, "ACTIVE");
        stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));
        dose(s, c, 2, LocalDate.of(2026, 11, 22), "PLANNED");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY,
            new CareDtos.EditVaccinationSchedule(1, null, null, LocalDate.of(2026, 12, 5), null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "start_date_locked_after_done");
    }

    @Test
    void tcTuan090305TheDoseCountCannotDropBelowAGivenDose() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 3, 7, null, "ACTIVE");
        dose(s, c, 1, LocalDate.of(2026, 11, 1), "DONE");
        stored(c, 51L, LocalDate.of(2026, 11, 8), 21, dose(s, c, 2, LocalDate.of(2026, 11, 8), "PLANNED"));
        dose(s, c, 3, LocalDate.of(2026, 11, 15), "PLANNED");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, null, 1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "dose_count_below_done");
    }

    @Test
    void tcTuan090306AMoreDosesAddPlannedDosesForEveryTarget() {
        Cattle a = cattle(1001L, "BO-1001");
        Cattle b = cattle(1002L, "BO-1002");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");
        dose(s, a, 1, LocalDate.of(2026, 12, 1), "PLANNED");
        dose(s, b, 1, LocalDate.of(2026, 12, 1), "PLANNED");

        CareDtos.VaccinationScheduleResult result = service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, null, 2, null));

        assertThat(dosesOf(s, a)).extracting(ScheduledDose::getDueDate).containsExactly(LocalDate.of(2026, 12, 1), LocalDate.of(2026, 12, 22));
        assertThat(dosesOf(s, b)).hasSize(2);
        assertThat(result.plannedDoseCount()).isEqualTo(4);
    }

    @Test
    void tcTuan090307RenamingToAnActiveScheduleNameIsRejected() {
        Cattle c = cattle(1001L, "BO-1001");
        schedule("Tụ huyết trùng 2026", 52L, LocalDate.of(2026, 12, 5), 1, 21, null, "ACTIVE");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");
        dose(s, c, 1, LocalDate.of(2026, 12, 1), "PLANNED");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY,
            new CareDtos.EditVaccinationSchedule(1, "tụ huyết trùng 2026", null, null, null, null)));

        assertThat(error.getCode()).isEqualTo("MSG-FE09-10");
        assertThat(s.getScheduleName()).isEqualTo("LMLM 2026");
    }

    @Test
    void tcTuan090308ATechnicianCannotEditASchedule() {
        role = FarmRole.TECHNICIAN;
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 2, 21, null, "ACTIVE");

        DomainException error = domainError(() -> service.editSchedule(FARM_ID, s.getId(), KEY, edit(1, 28, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(s.getIntervalDays()).isEqualTo(21);
    }

    @Test
    void tcTuan090309AnUnknownScheduleIsNotFound() {
        DomainException error = domainError(() -> service.editSchedule(FARM_ID, 999L, KEY, edit(1, 28, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(error.getParams()).containsEntry("scheduleId", 999L);
    }

    @Test
    void tcTuan090310RemovingTheBoosterCancelsItsOpenDose() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, 6, "ACTIVE");
        stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));
        ScheduledDose booster = dose(s, c, 2, LocalDate.of(2027, 5, 1), "PLANNED");
        dose(s, cattle(1002L, "BO-1002"), 1, LocalDate.of(2026, 11, 1), "PLANNED");

        service.editSchedule(FARM_ID, s.getId(), KEY, new CareDtos.EditVaccinationSchedule(1, null, null, null, null, null, null, true, null));

        assertThat(booster.getStatus()).isEqualTo("CANCELLED");
        assertThat(s.getBoosterIntervalMonths()).isNull();
    }

    // ================================================================== UC-FE09-03 stopSchedule

    @Test
    void tc0910StoppingCancelsThePlannedDosesAndKeepsTheGivenOnes() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 21, null, "ACTIVE");
        for (long i = 0; i < 4; i++) {
            Cattle c = cattle(1001L + i, "BO-100" + (i + 1));
            stored(c, 51L, LocalDate.of(2026, 11, 1), 21, dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED"));
            dose(s, c, 2, LocalDate.of(2026, 11, 22), "PLANNED");
        }

        CareDtos.VaccinationScheduleResult result = service.stopSchedule(FARM_ID, s.getId(), KEY, 1, "Đổi sang vắc-xin khác");

        assertThat(result.status()).isEqualTo("STOPPED");
        assertThat(s.getStopReason()).isEqualTo("Đổi sang vắc-xin khác");
        assertThat(doses).filteredOn(d -> d.getDoseNo() == 2).extracting(ScheduledDose::getStatus).containsOnly("CANCELLED");
        assertThat(doses).filteredOn(d -> d.getDoseNo() == 1).extracting(ScheduledDose::getStatus).containsOnly("DONE");
        assertThat(result.targetCount()).isEqualTo(4);
        verify(audit).log(any(FarmContext.class), eq("VACCINATION_SCHEDULE_STOP"), eq("VaccinationSchedule"), eq(s.getId()),
            eq(Map.of("cancelledDoses", 4, "reason", "Đổi sang vắc-xin khác")));
    }

    @Test
    void tcTuan090311AStopWithoutAReasonIsRejected() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");
        ScheduledDose d = dose(s, cattle(1001L, "BO-1001"), 1, LocalDate.of(2026, 12, 1), "PLANNED");

        DomainException error = domainError(() -> service.stopSchedule(FARM_ID, s.getId(), KEY, 1, "   "));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "reason");
        assertThat(s.getStatus()).isEqualTo("ACTIVE");
        assertThat(d.getStatus()).isEqualTo("PLANNED");
    }

    @Test
    void tcTuan090312AReasonOf501CharactersIsRejected() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        DomainException error = domainError(() -> service.stopSchedule(FARM_ID, s.getId(), KEY, 1, "x".repeat(501)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(s.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void tcTuan090313AReasonOf500CharactersIsAccepted() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        service.stopSchedule(FARM_ID, s.getId(), KEY, 1, "x".repeat(500));

        assertThat(s.getStatus()).isEqualTo("STOPPED");
    }

    @Test
    void tcTuan090314AStaleVersionIsAConflict() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        DomainException error = domainError(() -> service.stopSchedule(FARM_ID, s.getId(), KEY, 0, "Hết vắc-xin"));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(s.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void tcTuan090315StoppingAStoppedScheduleChangesNothing() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "STOPPED");
        s.setStopReason("Lần đầu");

        CareDtos.VaccinationScheduleResult result = service.stopSchedule(FARM_ID, s.getId(), KEY, 1, "Lần hai");

        assertThat(result.status()).isEqualTo("STOPPED");
        assertThat(s.getStopReason()).isEqualTo("Lần đầu");
        verify(audit, never()).log(any(FarmContext.class), anyString(), anyString(), anyLong(), any());
    }

    @Test
    void tcTuan090316ATechnicianCannotStopASchedule() {
        role = FarmRole.TECHNICIAN;
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        DomainException error = domainError(() -> service.stopSchedule(FARM_ID, s.getId(), KEY, 1, "Hết vắc-xin"));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(s.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void tcTuan090317AnUnknownScheduleIsNotFound() {
        DomainException error = domainError(() -> service.stopSchedule(FARM_ID, 999L, KEY, 1, "Hết vắc-xin"));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
    }

    @Test
    void tcTuan090318AStopWithoutAnExpectedVersionIsAConflict() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 12, 1), 1, 21, null, "ACTIVE");

        DomainException error = domainError(() -> service.stopSchedule(FARM_ID, s.getId(), KEY, null, "Hết vắc-xin"));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "expected_version_required");
    }

    // ================================================================== UC-FE09-04 record

    @Test
    void tc0911TheLastDoseOfABoosterScheduleCreatesTheBoosterDose() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, 6, "ACTIVE");
        ScheduledDose first = dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 1, 8), null, List.of(animal(c, first))));

        assertThat(first.getStatus()).isEqualTo("DONE");
        assertThat(dosesOf(s, c)).hasSize(2).last().satisfies(b -> {
            assertThat(b.getDoseNo()).isEqualTo(2);
            assertThat(b.getDueDate()).isEqualTo(LocalDate.of(2027, 5, 1));
            assertThat(b.getStatus()).isEqualTo("PLANNED");
        });
    }

    @Test
    void tc0912AStoppedScheduleCreatesNoBoosterDose() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, 6, "STOPPED");
        ScheduledDose first = dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 1, 8), null, List.of(animal(c, first))));

        assertThat(dosesOf(s, c)).singleElement().satisfies(d -> assertThat(d.getStatus()).isEqualTo("DONE"));
    }

    @Test
    void tc0913AnOnFarmVaccinationWithoutABatchNumberIsSaved() {
        Cattle c = cattle(1001L, "BO-1001");

        CareDtos.VaccinationBatchResult result = service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(c, null))));

        assertThat(result.vaccinatedCount()).isEqualTo(1);
        assertThat(vaccinations).singleElement().satisfies(v -> {
            assertThat(v.getBatchNo()).isNull();
            assertThat(v.getSource()).isEqualTo("ON_FARM");
        });
    }

    @Test
    void tc0914AHistoricalVaccinationWithOnlyAMonthClosesNoDoseAndHasNoWithdrawal() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 1, 21, null, "ACTIVE");
        ScheduledDose open = dose(s, c, 1, LocalDate.of(2026, 11, 1), "PLANNED");

        service.record(FARM_ID, KEY, new CareDtos.RecordVaccinations(51L, "HISTORICAL", LocalDate.of(2026, 8, 1), null, null, null, null, null, null,
            List.of(animal(c, open))));

        assertThat(vaccinations).singleElement().satisfies(v -> {
            assertThat(v.getVaccinationDate()).isEqualTo(LocalDate.of(2026, 8, 1));
            assertThat(v.getAdministeredAt()).isNull();
            assertThat(v.getScheduledDose()).isNull();
            assertThat(v.getWithdrawalDays()).isNull();
            assertThat(v.getWithdrawalEndDate()).isNull();
        });
        assertThat(open.getStatus()).isEqualTo("PLANNED");
    }

    @Test
    void tc0915FiveSelectedCattleGetFiveRecordsAndFiveDoneDoses() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 20), 2, 21, null, "ACTIVE");
        List<CareDtos.VaccinationAnimal> animals = new ArrayList<>();
        for (long i = 0; i < 5; i++) {
            Cattle c = cattle(1001L + i, "BO-100" + (i + 1));
            animals.add(animal(c, dose(s, c, 1, LocalDate.of(2026, 11, 20), "PLANNED")));
        }

        CareDtos.VaccinationBatchResult result = service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, animals));

        assertThat(result.vaccinatedCount()).isEqualTo(5);
        assertThat(result.vaccinationIds()).hasSize(5);
        assertThat(vaccinations).hasSize(5);
        assertThat(doses).extracting(ScheduledDose::getStatus).containsOnly("DONE");
        assertThat(result.skipped()).isEmpty();
    }

    @Test
    void tc0916AnErrorOnTheThirdCattleSavesNothing() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 20), 1, 21, null, "ACTIVE");
        List<CareDtos.VaccinationAnimal> animals = new ArrayList<>();
        for (long i = 0; i < 5; i++) {
            Cattle c = cattle(1001L + i, "BO-100" + (i + 1));
            animals.add(animal(c, dose(s, c, 1, LocalDate.of(2026, 11, 20), "PLANNED")));
        }
        pendingExit.put(1003L, ExitType.DEATH);

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, animals)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_17);
        assertNoVaccinationSaved();
        assertThat(doses).extracting(ScheduledDose::getStatus).containsOnly("PLANNED");
    }

    @Test
    void tc0917ACattleWhoseDoseIsAlreadyGivenIsSkipped() {
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 20), 2, 21, null, "ACTIVE");
        List<CareDtos.VaccinationAnimal> animals = new ArrayList<>();
        for (long i = 0; i < 5; i++) {
            Cattle c = cattle(1001L + i, "BO-100" + (i + 1));
            animals.add(animal(c, dose(s, c, 1, LocalDate.of(2026, 11, 20), i == 2 ? "DONE" : "PLANNED")));
        }

        CareDtos.VaccinationBatchResult result = service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, animals));

        assertThat(result.vaccinatedCount()).isEqualTo(4);
        assertThat(result.skipped()).singleElement().satisfies(skip -> {
            assertThat(skip.cattleCode()).isEqualTo("BO-1003");
            assertThat(skip.messageCode()).isEqualTo(MessageCodes.FE09_09);
            assertThat(skip.doseNo()).isEqualTo(1);
        });
    }

    @Test
    void tc0918ARecordFromTheProfileClosesThePlannedDoseOfTheSameVaccine() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 20), 2, 21, null, "ACTIVE");
        ScheduledDose planned = dose(s, c, 1, LocalDate.of(2026, 11, 20), "PLANNED");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 21, 8), null, List.of(animal(c, planned))));

        assertThat(planned.getStatus()).isEqualTo("DONE");
        assertThat(vaccinations).singleElement().satisfies(v -> assertThat(v.getScheduledDose()).isSameAs(planned));
        assertThat(planned.getVaccination()).isSameAs(vaccinations.get(0));
    }

    @Test
    void tc0919A21DayWithdrawalFrom01NovEndsOn22Nov() {
        Cattle c = cattle(1001L, "BO-1001");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 1, 8), 21, List.of(animal(c, null))));

        assertThat(vaccinations).singleElement().satisfies(v -> {
            assertThat(v.getWithdrawalDays()).isEqualTo(21);
            assertThat(v.getWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 11, 22));
        });
    }

    @Test
    void tc0920TheCattleWithdrawalEndIsTheLatestOfTreatmentAndVaccination() {
        Cattle c = cattle(1001L, "BO-1001");
        treatmentWithdrawal = LocalDate.of(2026, 11, 30);

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 1, 8), 21, List.of(animal(c, null))));

        assertThat(vaccinations.get(0).getWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 11, 22));
        assertThat(state.state(c).get("withdrawalEndDate")).isEqualTo(LocalDate.of(2026, 11, 30));
    }

    @Test
    void tc0928ATechnicianCannotRecordAVaccination() {
        role = FarmRole.TECHNICIAN;
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_HEALTH.allows(FarmRole.TECHNICIAN)).isFalse();
        assertNoVaccinationSaved();
    }

    @Test
    void tc0930TheVaccineNameIsStoredAsASnapshot() {
        Cattle c = cattle(1001L, "BO-1001");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(c, null))));
        vaccines.get(51L).setName("LMLM Aftovax mới");

        assertThat(vaccinations.get(0).getVaccineNameSnapshot()).isEqualTo("LMLM Aftovax");
    }

    @Test
    void tc0931TheOwnerRecordsOneCattleAndABatch() {
        role = FarmRole.OWNER;
        Cattle a = cattle(1001L, "BO-1001");
        Cattle b = cattle(1002L, "BO-1002");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(a, null))));
        CareDtos.VaccinationBatchResult batch = service.record(FARM_ID, "idem-2", onFarm(52L, at(2026, 11, 21, 8), null, List.of(animal(a, null), animal(b, null))));

        assertThat(batch.vaccinatedCount()).isEqualTo(2);
        assertThat(vaccinations).hasSize(3).extracting(Vaccination::getVaccinator).containsOnly("Owner Hoa");
    }

    @Test
    void tcTuan090401AHistoricalVaccinationBeforeTheHerdEntryIsAccepted() {
        Cattle c = cattle(1001L, "BO-1001");

        CareDtos.VaccinationBatchResult result = service.record(FARM_ID, KEY, new CareDtos.RecordVaccinations(51L, "HISTORICAL", LocalDate.of(2026, 3, 1), null,
            null, null, null, null, null, List.of(animal(c, null))));

        assertThat(result.vaccinatedCount()).isEqualTo(1);
        assertThat(vaccinations).singleElement().satisfies(v -> assertThat(v.getVaccinationDate()).isEqualTo(LocalDate.of(2026, 3, 1)));
    }

    @Test
    void tcTuan090402AnOnFarmVaccinationBeforeTheHerdEntryIsRejected() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 5, 31, 8), null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_15);
        assertThat(error.getParams()).containsEntry("date", LocalDate.of(2026, 6, 1));
        assertNoVaccinationSaved();
    }

    @Test
    void tcTuan090403AVaccinationInTheFutureIsRejected() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 27, 11), null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
        assertNoVaccinationSaved();
    }

    @Test
    void tcTuan090404ADiscontinuedVaccineIsRejected() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(53L, at(2026, 11, 20, 8), null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE18_08);
        assertNoVaccinationSaved();
    }

    @Test
    void tcTuan090405AnExitedCattleIsSkippedAndTheOthersAreRecorded() {
        Cattle a = cattle(1001L, "BO-1001");
        Cattle b = cattle(1002L, "BO-1002");
        b.setHerdStatus(HerdStatus.EXITED);

        CareDtos.VaccinationBatchResult result = service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(a, null), animal(b, null))));

        assertThat(result.vaccinatedCount()).isEqualTo(1);
        assertThat(result.skipped()).singleElement().satisfies(skip -> {
            assertThat(skip.cattleCode()).isEqualTo("BO-1002");
            assertThat(skip.messageCode()).isEqualTo(MessageCodes.COM_13);
        });
    }

    @Test
    void tcTuan090406ADoseRangeIsNotAValidDose() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, new CareDtos.RecordVaccinations(51L, "ON_FARM", null, at(2026, 11, 20, 8), null,
            "1-2 ml", null, null, null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "dose");
    }

    @Test
    void tcTuan090407ThePlainOtherRouteNeedsADescription() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, new CareDtos.RecordVaccinations(51L, "ON_FARM", null, at(2026, 11, 20, 8), null,
            null, "OTHER", null, null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "routeOther");
    }

    @Test
    void tcTuan090408AWithdrawalOf366DaysIsInvalid() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), 366, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "withdrawalDays");
    }

    @Test
    void tcTuan090409TheWithdrawalDefaultsToTheVaccineCatalogue() {
        Cattle c = cattle(1001L, "BO-1001");

        service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(c, null))));

        assertThat(vaccinations).singleElement().satisfies(v -> {
            assertThat(v.getWithdrawalDays()).isEqualTo(21);
            assertThat(v.getWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 11));
            assertThat(v.getDose()).isEqualTo("2 ml");
            assertThat(v.getRoute()).isEqualTo("INTRAMUSCULAR");
            assertThat(v.getVaccinator()).isEqualTo("Manager Lan");
        });
    }

    @Test
    void tcTuan090410AStaleDoseVersionIsAConflict() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 20), 1, 21, null, "ACTIVE");
        ScheduledDose d = dose(s, c, 1, LocalDate.of(2026, 11, 20), "PLANNED");
        d.setVersion(3);

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null,
            List.of(new CareDtos.VaccinationAnimal(c.getId(), d.getId(), 2)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertNoVaccinationSaved();
    }

    @Test
    void tcTuan090411ADoseOfAnotherVaccineCannotBeClosed() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("Tụ huyết trùng 2026", 52L, LocalDate.of(2026, 11, 20), 1, 21, null, "ACTIVE");
        ScheduledDose d = dose(s, c, 1, LocalDate.of(2026, 11, 20), "PLANNED");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(c, d)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "scheduledDoseId");
        assertThat(d.getStatus()).isEqualTo("PLANNED");
    }

    @Test
    void tcTuan090412AnEmptyBatchIsRejected() {
        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "animals");
    }

    @Test
    void tcTuan090413TheSameCattleTwiceInABatchIsRejected() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, onFarm(51L, at(2026, 11, 20, 8), null, List.of(animal(c, null), animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "animals");
    }

    @Test
    void tcTuan090414ABatchNumberOf51CharactersIsRejected() {
        Cattle c = cattle(1001L, "BO-1001");

        DomainException error = domainError(() -> service.record(FARM_ID, KEY, new CareDtos.RecordVaccinations(51L, "ON_FARM", null, at(2026, 11, 20, 8),
            "x".repeat(51), null, null, null, null, List.of(animal(c, null)))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "batchNo");
    }

    // ================================================================== UC-FE09-06 correct

    @Test
    void tc0927ANewWithdrawalPeriodKeepsTheOldOneInTheRevision() {
        Cattle c = cattle(1001L, "BO-1001");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 1), 21, null);

        CareDtos.VaccinationResult result = service.correct(FARM_ID, record.getId(), KEY, correction(1, 30, null));

        assertThat(result.withdrawalDays()).isEqualTo(30);
        assertThat(result.withdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(result.cattleWithdrawalEndDate()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(result.corrected()).isTrue();
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("CORRECT");
            assertThat(r.getReason()).isNull();
            assertThat(snapshot(r.getBeforeSnapshot(), "withdrawalDays")).isEqualTo(21);
            assertThat(snapshot(r.getAfterSnapshot(), "withdrawalDays")).isEqualTo(30);
        });
    }

    @Test
    void tc0931TheOwnerCorrectsAVaccinationRecord() {
        role = FarmRole.OWNER;
        Cattle c = cattle(1001L, "BO-1001");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 1), 21, null);

        service.correct(FARM_ID, record.getId(), KEY, new CareDtos.CorrectVaccination(1, null, null, null, null, "3 ml", null, null, "Ghi nhầm liều"));

        assertThat(record.getDose()).isEqualTo("3 ml");
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa");
            assertThat(r.getReason()).isEqualTo("Ghi nhầm liều");
            assertThat(snapshot(r.getBeforeSnapshot(), "dose")).isEqualTo("2 ml");
        });
    }

    @Test
    void tcTuan090601ANoteOf501CharactersIsRejected() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY, correction(1, 30, "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "reason");
        assertThat(record.getWithdrawalDays()).isEqualTo(21);
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan090602AStaleVersionIsAConflict() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY, correction(0, 30, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(record.getWithdrawalDays()).isEqualTo(21);
    }

    @Test
    void tcTuan090603AVoidedRecordCannotBeCorrected() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);
        record.setStatus("VOIDED");

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY, correction(1, 30, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan090604ACorrectedTimeInTheFutureIsRejected() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY,
            new CareDtos.CorrectVaccination(1, null, null, at(2026, 11, 28, 8), null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
        assertThat(record.getVaccinationDate()).isEqualTo(LocalDate.of(2026, 11, 1));
    }

    @Test
    void tcTuan090605AHistoricalRecordTakesNoWithdrawal() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 8, 1), 0, null);
        record.setSource("HISTORICAL");

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY, correction(1, 21, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "withdrawalDays");
    }

    @Test
    void tcTuan090606ChangingTheVaccineUpdatesTheNameSnapshot() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);

        service.correct(FARM_ID, record.getId(), KEY, new CareDtos.CorrectVaccination(1, 52L, null, null, null, null, null, null, null));

        assertThat(record.getVaccine().getId()).isEqualTo(52L);
        assertThat(record.getVaccineNameSnapshot()).isEqualTo("Tụ huyết trùng");
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(snapshot(r.getBeforeSnapshot(), "vaccineName")).isEqualTo("LMLM Aftovax"));
    }

    @Test
    void tcTuan090607ADiscontinuedVaccineCannotBeChosen() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY,
            new CareDtos.CorrectVaccination(1, 53L, null, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE18_08);
        assertThat(record.getVaccine().getId()).isEqualTo(51L);
    }

    @Test
    void tcTuan090608ARecordOfAnExitedCattleCannotBeCorrected() {
        Cattle c = cattle(1001L, "BO-1001");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 1), 21, null);
        c.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY, correction(1, 30, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
    }

    @Test
    void tcTuan090609ATechnicianCannotCorrect() {
        role = FarmRole.TECHNICIAN;
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 1), 21, null);

        DomainException error = domainError(() -> service.correct(FARM_ID, record.getId(), KEY, correction(1, 30, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(record.getWithdrawalDays()).isEqualTo(21);
    }

    @Test
    void tcTuan090610AnUnknownRecordIsNotFound() {
        DomainException error = domainError(() -> service.correct(FARM_ID, 999L, KEY, correction(1, 30, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(error.getParams()).containsEntry("vaccinationId", 999L);
    }

    @Test
    void tcTuan090611AZeroWithdrawalClearsTheEndDate() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 20), 21, null);

        CareDtos.VaccinationResult result = service.correct(FARM_ID, record.getId(), KEY, correction(1, 0, null));

        assertThat(result.withdrawalEndDate()).isNull();
        assertThat(result.cattleWithdrawalEndDate()).isNull();
    }

    // ================================================================== UC-FE09-06 voidRecord

    @Test
    void tc0924DeletingAnOnFarmRecordReopensItsDose() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 7, null, "ACTIVE");
        dose(s, c, 1, LocalDate.of(2026, 11, 1), "DONE");
        ScheduledDose second = dose(s, c, 2, LocalDate.of(2026, 11, 8), "PLANNED");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 20), 21, second);

        CareDtos.VaccinationResult result = service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(second.getStatus()).isEqualTo("PLANNED");
        assertThat(second.getVaccination()).isNull();
        assertThat(record.getScheduledDose()).isNull();
        assertThat(result.cattleWithdrawalEndDate()).isNull();
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("VOID");
            assertThat(snapshot(r.getBeforeSnapshot(), "status")).isEqualTo("VALID");
        });
    }

    @Test
    void tc0925DeletingARecordOfAStoppedScheduleCancelsItsDose() {
        Cattle c = cattle(1001L, "BO-1001");
        VaccinationSchedule s = schedule("LMLM 2026", 51L, LocalDate.of(2026, 11, 1), 2, 7, null, "STOPPED");
        ScheduledDose second = dose(s, c, 2, LocalDate.of(2026, 11, 8), "PLANNED");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 8), 21, second);

        service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null));

        assertThat(second.getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void tc0926TheReactionCaseKeepsItsLinkToTheDeletedRecord() {
        Cattle c = cattle(1001L, "BO-1001");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 20), 21, null);
        HealthObservation reaction = new HealthObservation();
        reaction.setVaccination(record);

        service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null));

        assertThat(reaction.getVaccination()).isSameAs(record);
        assertThat(reaction.getVaccination().getStatus()).isEqualTo("VOIDED");
        verify(em, never()).remove(any());
    }

    @Test
    void tc0931TheOwnerDeletesAVaccinationRecord() {
        role = FarmRole.OWNER;
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 20), 21, null);

        service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null));

        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa"));
    }

    @Test
    void tcTuan090612AStaleVersionIsAConflict() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 20), 21, null);

        DomainException error = domainError(() -> service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(0, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan090613AVoidedRecordCannotBeDeletedAgain() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 20), 21, null);
        record.setStatus("VOIDED");

        DomainException error = domainError(() -> service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan090614ADeleteNoteOf501CharactersIsRejected() {
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 20), 21, null);

        DomainException error = domainError(() -> service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan090615ATechnicianCannotDelete() {
        role = FarmRole.TECHNICIAN;
        Vaccination record = stored(cattle(1001L, "BO-1001"), 51L, LocalDate.of(2026, 11, 20), 21, null);

        DomainException error = domainError(() -> service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan090616ARecordOfAnExitedCattleCannotBeDeleted() {
        Cattle c = cattle(1001L, "BO-1001");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 20), 21, null);
        c.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(record.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan090617ARecordOfACattleOnAPendingDeathVoucherCanBeDeleted() {
        Cattle c = cattle(1001L, "BO-1001");
        Vaccination record = stored(c, 51L, LocalDate.of(2026, 11, 20), 21, null);
        pendingExit.put(c.getId(), ExitType.DEATH);

        CareDtos.VaccinationResult result = service.voidRecord(FARM_ID, record.getId(), KEY, new CareDtos.VoidRecord(1, "Ghi nhầm bò"));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(record.getStatusReason()).isEqualTo("Ghi nhầm bò");
    }
}
