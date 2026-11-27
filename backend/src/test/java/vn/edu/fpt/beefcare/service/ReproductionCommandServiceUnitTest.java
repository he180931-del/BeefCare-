package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static vn.edu.fpt.beefcare.service.ReproductionWorld.FARM_ID;
import static vn.edu.fpt.beefcare.service.ReproductionWorld.at;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.PregnancyUpdate;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of FE-11 and FE-12 commands: UC-FE11-02
 * Record Estrus Event ({@link ReproductionCommandService#recordEstrus}), UC-FE11-03 Record Breeding Event
 * ({@link ReproductionCommandService#recordBreeding}), UC-FE11-04 Correct or Void Estrus and Breeding Record
 * ({@link ReproductionCommandService#correctEvent}, {@link ReproductionCommandService#voidEvent}), UC-FE12-01 Record
 * Pregnancy Check Result ({@link ReproductionCommandService#recordPregnancyCheck}), UC-FE12-02 Update Pregnancy Status
 * ({@link ReproductionCommandService#updatePregnancy}), UC-FE12-03 Record Calving Event and Outcome
 * ({@link ReproductionCommandService#recordCalving}) and UC-FE12-04 Correct or Void Pregnancy and Calving Record
 * (pregnancy check {@code correctEvent} / {@code voidEvent}, {@link ReproductionCommandService#voidCalving},
 * {@link ReproductionCommandService#correctCalf}, {@link ReproductionCommandService#voidPregnancyUpdate}). The farm lives
 * in memory ({@link ReproductionWorld}); the cattle guard, the record revision service and the reproductive state
 * derivation (GBR-54/55) are the real classes; reminders, calf registration and calf reminders are mocks; the idempotency
 * wrapper runs the command; the farm access check applies the real {@link FarmAction} role table. Farm parameters:
 * gestation 283 days, breeding window 8-12 h, minimum age 13 months. The farm clock is fixed at 27/11/2026 10:00 (UTC+7)
 * unless a test sets another day. Cow BO-6001 (ADULT, BREEDING, born 01/01/2023, 300 kg) is the subject.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReproductionCommandServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final String KEY = "idem-1";

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock CattleRepository cattleRepository;
    @Mock HerdExitRepository exits;
    @Mock IdempotencyCommandService idempotency;
    @Mock AuditService audit;
    @Mock RecordRevisionRepository revisionRepository;
    @Mock PendingCalfService pendingCalves;
    @Mock EntryReminderService entryReminders;
    @Mock ReproductionReminderService reminders;

    private ReproductionWorld world;
    private ReproductionCommandService service;
    private FarmRole role = FarmRole.MANAGER;
    private Cattle cow;
    private final java.util.List<RecordRevision> savedRevisions = new java.util.ArrayList<>();

    @BeforeEach
    void setUp() {
        world = new ReproductionWorld(em);
        build(NOW);
        cow = world.cow(6001L, "BO-6001", PurposeType.BREEDING, LocalDate.of(2023, 1, 1));
        world.animal(6101L, "BO-6101", Sex.MALE, PurposeType.SIRE);
        world.animal(6102L, "BO-6102", Sex.MALE, PurposeType.SIRE);

        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenAnswer(inv -> {
            FarmAction action = inv.getArgument(1);
            if (role == null || !action.allows(role)) {
                throw DomainException.forbidden(MessageCodes.COM_01);
            }
            return new FarmContext(world.farm, world.users.get(role), role);
        });
        when(idempotency.execute(anyLong(), any(FarmAction.class), anyString(), anyString(), any(), any(Class.class), any(Supplier.class)))
            .thenAnswer(inv -> inv.<Supplier<?>>getArgument(6).get());
        when(cattleRepository.lockByIdAndFarmId(anyLong(), anyLong())).thenAnswer(inv -> Optional.ofNullable(world.cattle.get(inv.<Long>getArgument(1)))
            .filter(c -> c.getFarm().getId().equals(inv.getArgument(0))));
        when(exits.findFirstByCattleIdAndStatus(anyLong(), eq(ExitLineStatus.PENDING))).thenReturn(Optional.empty());
        when(revisionRepository.save(any(RecordRevision.class))).thenAnswer(inv -> {
            RecordRevision r = inv.getArgument(0);
            r.setId(800L + savedRevisions.size());
            savedRevisions.add(r);
            return r;
        });
        when(pendingCalves.registerCalfNow(anyLong(), anyLong(), anyLong(), anyLong()))
            .thenAnswer(inv -> new EntryDtos.RegisteredCalf(91L, "PN-2611-009", 6900L, "BO-6900", "BO-6001", null));
    }

    private void build(Instant now) {
        FarmClock clock = new FarmClock(Clock.fixed(now, ZoneOffset.UTC));
        CattleStateService state = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(state, "em", em);
        service = new ReproductionCommandService(access, new CattleGuardService(exits, cattleRepository, clock), idempotency, audit,
            new RecordRevisionService(revisionRepository, clock), clock, pendingCalves, entryReminders, state, reminders);
        ReflectionTestUtils.setField(service, "em", em);
    }

    // ------------------------------------------------------------------ requests

    private static ReproductionDtos.EstrusCommand estrus(Instant at, Boolean confirm) {
        return new ReproductionDtos.EstrusCommand(1, at, null, null, List.of("STANDING", "MUCUS"), null, null, confirm);
    }

    private static ReproductionDtos.BreedingCommand breeding(Instant at, Long linkedEstrusId) {
        return new ReproductionDtos.BreedingCommand(1, at, null, "AI", "EXTERNAL", null, null, "Red Angus", "RA-01", null, null, null, linkedEstrusId, null, null);
    }

    private static ReproductionDtos.BreedingCommand naturalWith(Instant at, Long sireId) {
        return new ReproductionDtos.BreedingCommand(1, at, null, "NATURAL", "INTERNAL", sireId, null, null, null, null, null, null, null, null, null);
    }

    private static ReproductionDtos.PregnancyCheckCommand check(Instant at, String result, Long breedingId, Integer months) {
        return new ReproductionDtos.PregnancyCheckCommand(1, breedingId, at, null, result, "ULTRASOUND", months, null, null, null);
    }

    private static ReproductionDtos.CalfCommand calf(String outcome, String sex, String kg, String basis, String tag, Long penId, String registration) {
        return new ReproductionDtos.CalfCommand(outcome, sex, kg == null ? null : new BigDecimal(kg), basis, tag, penId, null, registration, null);
    }

    private static ReproductionDtos.CalfCommand liveDraft() {
        return calf("LIVE", "FEMALE", "28", "MEASURED", null, 11L, "DRAFT");
    }

    private ReproductionDtos.CalvingCommand calving(Instant at, Boolean noTracked, ReproductionDtos.CalfCommand... calves) {
        return new ReproductionDtos.CalvingCommand(cow.getId(), 1, null, null, noTracked, at, null, null, null, "NORMAL", "GOOD", false, List.of(calves));
    }

    private static ReproductionDtos.CorrectEvent move(Integer version, Instant at, String reason) {
        return new ReproductionDtos.CorrectEvent(version, reason, at, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, null, null, null);
    }

    private static ReproductionDtos.CorrectEvent result(Integer version, String result, Integer months) {
        return new ReproductionDtos.CorrectEvent(version, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            null, null, null, result, months, null, null);
    }

    private static ReproductionDtos.CorrectEvent sire(Integer version, Long sireId) {
        return new ReproductionDtos.CorrectEvent(version, null, null, null, null, null, null, null, null, "INTERNAL", sireId, null, null, null, null, null, null,
            null, null, null, null, null, null, null);
    }

    private static ReproductionDtos.CorrectCalf calfOutcome(Integer version, String outcome, String kg, String basis, String tag) {
        return new ReproductionDtos.CorrectCalf(version, null, outcome, null, kg == null ? null : new BigDecimal(kg), basis, null, tag, null, null, null);
    }

    private static DomainException domainError(Runnable call) {
        DomainException error = catchThrowableOfType(DomainException.class, call::run);
        assertThat(error).as("the call should be rejected with a DomainException").isNotNull();
        return error;
    }

    private ReproductionEvent persisted(String type) {
        return world.events.stream().filter(e -> type.equals(e.getType())).reduce((a, b) -> b).orElseThrow();
    }

    /** An OPEN pregnancy of the cow confirmed on 01/11/2026 from a breeding of 05/10/2026. */
    private PregnancyEpisode openPregnancy() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 10, 5, 8, 0), null);
        ReproductionEvent confirmed = world.check(cow, at(2026, 11, 1, 9, 0), "PREGNANT", bred);
        return world.pregnancy(cow, confirmed, bred, "OPEN");
    }

    // ================================================================== UC-FE11-02 recordEstrus

    @Test
    void tc1103AMaleCannotHaveAnEstrus() {
        Cattle bull = world.cattle.get(6101L);

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, bull.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_11);
        assertThat(error.getParams()).containsEntry("reason", "NOT_FEMALE");
        assertThat(world.events).isEmpty();
    }

    @Test
    void tc1104AnEstrusAt0630GivesTheWindow1430To1830() {
        ReproductionDtos.EventResult result = service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null));

        assertThat(result.window().from()).isEqualTo(at(2026, 11, 27, 14, 30));
        assertThat(result.window().to()).isEqualTo(at(2026, 11, 27, 18, 30));
        assertThat(result.reproStatus()).isEqualTo("IN_ESTRUS");
        verify(reminders).estrusRecorded(cow, persisted("ESTRUS"));
    }

    @Test
    void tc1106AnEstrusWithin12HoursNeedsConfirmation() {
        world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 26, 15, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_03);
        assertThat(error.getParams()).containsEntry("time", "26/11/2026 06:00").containsEntry("cattle_code", "BO-6001");
        assertThat(world.events).hasSize(1);
    }

    @Test
    void tc1106AConfirmedNearbyEstrusIsSaved() {
        world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 26, 15, 0), true));

        assertThat(world.events).hasSize(2);
    }

    @Test
    void tc1107APregnantCowTakesNoEstrus() {
        openPregnancy();

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_05);
        assertThat(world.events).noneMatch(e -> "ESTRUS".equals(e.getType()));
    }

    @Test
    void tc1111ANewEstrusAfterABreedingPutsTheCowInEstrus() {
        world.breeding(cow, at(2026, 11, 20, 8, 0), null);

        ReproductionDtos.EventResult result = service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 26, 15, 0), null));

        assertThat(result.reproStatus()).isEqualTo("IN_ESTRUS");
    }

    @Test
    void tc1120ATechnicianCannotRecordAnEstrus() {
        role = FarmRole.TECHNICIAN;

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(FarmAction.MANAGE_REPRODUCTION.allows(FarmRole.TECHNICIAN)).isFalse();
    }

    @Test
    void tc1125TheOwnerRecordsAnEstrus() {
        role = FarmRole.OWNER;

        service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null));

        assertThat(persisted("ESTRUS").getRecordedBy().getFullName()).isEqualTo("Owner Hoa");
        assertThat(persisted("ESTRUS").getObserverUser().getFullName()).isEqualTo("Owner Hoa");
    }

    @Test
    void tcTuan110201AMissingObservationTimeIsRequired() {
        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "observedAt");
    }

    @Test
    void tcTuan110202AnEstrusInTheFutureIsRejected() {
        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 11, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_07);
    }

    @Test
    void tcTuan110203AnEstrusBeforeTheHerdEntryIsRejected() {
        world.entryDate = LocalDate.of(2026, 11, 1);

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 10, 31, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_15);
    }

    @Test
    void tcTuan110204AnUnknownSignIsInvalid() {
        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY,
            new ReproductionDtos.EstrusCommand(1, at(2026, 11, 27, 6, 30), null, null, List.of("SNEEZING"), null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "signs");
    }

    @Test
    void tcTuan110205ADescriptionOf1001CharactersIsInvalid() {
        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY,
            new ReproductionDtos.EstrusCommand(1, at(2026, 11, 27, 6, 30), null, null, null, "x".repeat(1001), null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "description");
    }

    @Test
    void tcTuan110206MissingWindowParametersAreReported() {
        world.parameters = null;

        ReproductionDtos.EventResult result = service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null));

        assertThat(result.window()).isNull();
        assertThat(result.parameterMissing()).isEqualTo("BREEDING_WINDOW_START_HOURS");
    }

    @Test
    void tcTuan110207AnExternalObserverIsKeptByName() {
        service.recordEstrus(FARM_ID, cow.getId(), KEY, new ReproductionDtos.EstrusCommand(1, at(2026, 11, 27, 6, 30), null, "Anh Ba (hàng xóm)", null, null, null, null));

        assertThat(persisted("ESTRUS").getObserver()).isEqualTo("Anh Ba (hàng xóm)");
        assertThat(persisted("ESTRUS").getObserverUser()).isNull();
    }

    @Test
    void tcTuan110208AStaleCattleVersionIsAConflict() {
        cow.setVersion(2);

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(world.events).isEmpty();
    }

    @Test
    void tcTuan110209AFatteningCowIsNotTracked() {
        cow.getPurpose().setPurposeType(PurposeType.FATTENING);

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_11);
        assertThat(error.getParams()).containsEntry("reason", "PURPOSE");
    }

    @Test
    void tcTuan110210AnExitedCowTakesNoEstrus() {
        cow.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.recordEstrus(FARM_ID, cow.getId(), KEY, estrus(at(2026, 11, 27, 6, 30), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
    }

    // ================================================================== UC-FE11-03 recordBreeding

    @Test
    void tc1107APregnantCowTakesNoBreeding() {
        openPregnancy();

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 27, 8, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_05);
    }

    @Test
    void tc1108ABreedingBeforeItsLinkedEstrusIsRejected() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 30));

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 5, 0), estrus.getId())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_10);
        assertThat(error.getParams()).containsEntry("time", "26/11/2026 06:30").containsEntry("field", "bredAt");
        assertThat(world.events).hasSize(1);
    }

    @Test
    void tc1109ABreedingWithoutARecentEstrusCreatesNoEstrus() {
        ReproductionDtos.EventResult result = service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 8, 0), null));

        assertThat(world.events).singleElement().satisfies(e -> {
            assertThat(e.getType()).isEqualTo("BREEDING");
            assertThat(e.getLinkedEvent()).isNull();
        });
        assertThat(result.reproStatus()).isEqualTo("BRED");
    }

    @Test
    void tc1110ABreedingOn01NovGivesATentativeCalvingOn11Aug2027() {
        service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 1, 8, 0), null));

        ReproductionEvent saved = persisted("BREEDING");
        assertThat(saved.getTentativeExpectedCalvingDate()).isEqualTo(LocalDate.of(2027, 8, 11));
        verify(reminders).breedingRecorded(cow, saved);
    }

    @Test
    void tc1112ASecondServiceOnTheSameEstrusUsesTheLatestTime() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));
        world.breeding(cow, at(2026, 11, 26, 8, 0), estrus);

        ReproductionDtos.EventResult result = service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 16, 0), estrus.getId()));

        assertThat(world.events).filteredOn(e -> "BREEDING".equals(e.getType())).hasSize(2);
        assertThat(persisted("BREEDING").getEventTime()).isEqualTo(at(2026, 11, 26, 16, 0));
        assertThat(result.tentativeCalvingDate()).isEqualTo(LocalDate.of(2026, 11, 26).plusDays(283));
    }

    @Test
    void tc1113TheCowItselfCannotBeTheSire() {
        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, naturalWith(at(2026, 11, 26, 8, 0), cow.getId())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_04);
        assertThat(error.getParams()).containsEntry("field", "sireCattleId");
    }

    @Test
    void tc1113AnotherCowCannotBeTheSire() {
        world.cow(6002L, "BO-6002", PurposeType.BREEDING, LocalDate.of(2023, 1, 1));

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, naturalWith(at(2026, 11, 26, 8, 0), 6002L)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_04);
    }

    @Test
    void tc1113ABullOfAnotherFarmCannotBeTheSire() {
        Cattle foreign = world.animal(6201L, "BO-6201", Sex.MALE, PurposeType.SIRE);
        Farm other = new Farm();
        other.setId(971L);
        foreign.setFarm(other);

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, naturalWith(at(2026, 11, 26, 8, 0), 6201L)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_04);
        assertThat(world.events).isEmpty();
    }

    @Test
    void tc1114AnUnderageCowIsWarnedButTheBreedingIsSaved() {
        cow.setBirthDate(LocalDate.of(2025, 12, 27));
        cow.setLifeStage(LifeStage.YOUNG_STOCK);

        ReproductionDtos.EventResult result = service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 8, 0), null));

        assertThat(result.eligibilityWarning().code()).isEqualTo(MessageCodes.FE11_09);
        assertThat(result.eligibilityWarning().conditions()).containsExactly("MINIMUM_AGE");
        assertThat(world.events).hasSize(1);
    }

    @Test
    void tc1116WithoutAGestationParameterNoDateIsProjected() {
        world.gestation = null;

        ReproductionDtos.EventResult result = service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 8, 0), null));

        assertThat(result.tentativeCalvingDate()).isNull();
        assertThat(result.parameterMissing()).isEqualTo("GESTATION_LENGTH_DAYS");
        assertThat(world.events).hasSize(1);
    }

    @Test
    void tc1120ATechnicianCannotRecordABreeding() {
        role = FarmRole.TECHNICIAN;

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 8, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(world.events).isEmpty();
    }

    @Test
    void tc1125TheOwnerRecordsABreedingWithAFarmBull() {
        role = FarmRole.OWNER;

        service.recordBreeding(FARM_ID, cow.getId(), KEY, naturalWith(at(2026, 11, 26, 8, 0), 6101L));

        ReproductionEvent saved = persisted("BREEDING");
        assertThat(saved.getSire().getDisplayCode()).isEqualTo("BO-6101");
        assertThat(saved.getRecordedBy().getFullName()).isEqualTo("Owner Hoa");
    }

    @Test
    void tcTuan110301ALinkedEstrusOlderThan72HoursIsRejected() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 22, 6, 0));

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 25, 7, 0), estrus.getId())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(error.getParams()).containsEntry("reason", "linked_estrus_older_than_72_hours");
    }

    @Test
    void tcTuan110302AnExternalSireNeedsABreed() {
        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY,
            new ReproductionDtos.BreedingCommand(1, at(2026, 11, 26, 8, 0), null, "AI", "EXTERNAL", null, null, " ", null, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "sireBreed");
    }

    @Test
    void tcTuan110303AMissingMethodIsRequired() {
        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY,
            new ReproductionDtos.BreedingCommand(1, at(2026, 11, 26, 8, 0), null, null, "EXTERNAL", null, null, "Red Angus", null, null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "method");
    }

    @Test
    void tcTuan110304ASemenCodeOf51CharactersIsInvalid() {
        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY,
            new ReproductionDtos.BreedingCommand(1, at(2026, 11, 26, 8, 0), null, "AI", "EXTERNAL", null, null, "Red Angus", "x".repeat(51), null, null, null, null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "semenCode");
    }

    @Test
    void tcTuan110305AnUnlinkedBreedingWithin12HoursNeedsConfirmation() {
        world.breeding(cow, at(2026, 11, 26, 8, 0), null);

        DomainException error = domainError(() -> service.recordBreeding(FARM_ID, cow.getId(), KEY, breeding(at(2026, 11, 26, 16, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_03);
        assertThat(error.getParams()).containsEntry("type", "BREEDING");
    }

    // ================================================================== UC-FE11-04 correctEvent

    @Test
    void tc1118MovingABreedingKeepsTheOldTimeAndRecomputesTheDate() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);

        ReproductionDtos.EventResult result = service.correctEvent(FARM_ID, bred.getId(), KEY, move(1, at(2026, 11, 21, 8, 0), "Ghi nhầm ngày"));

        assertThat(result.tentativeCalvingDate()).isEqualTo(LocalDate.of(2026, 11, 21).plusDays(283));
        assertThat(bred.getCorrected()).isTrue();
        assertThat(savedRevisions).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("CORRECT");
            assertThat(r.getReason()).isEqualTo("Ghi nhầm ngày");
            assertThat(JsonSupport.fromJson(r.getBeforeSnapshot(), Map.class).get("eventTime")).isEqualTo(at(2026, 11, 20, 8, 0).toString());
        });
        verify(reminders).eventCorrected(cow, bred, null);
    }

    @Test
    void tc1119TheSireCanBeChangedFromOneBullToAnother() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);
        bred.setSireSource("INTERNAL");
        bred.setSire(world.cattle.get(6101L));

        service.correctEvent(FARM_ID, bred.getId(), KEY, sire(1, 6102L));

        assertThat(bred.getSire().getDisplayCode()).isEqualTo("BO-6102");
        assertThat(savedRevisions).singleElement().satisfies(r ->
            assertThat(JsonSupport.fromJson(r.getBeforeSnapshot(), Map.class).get("sireId")).isEqualTo(6101));
    }

    @Test
    void tc1125TheOwnerCorrectsAnEstrus() {
        role = FarmRole.OWNER;
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        service.correctEvent(FARM_ID, estrus.getId(), KEY, move(1, at(2026, 11, 26, 7, 0), null));

        assertThat(estrus.getEventTime()).isEqualTo(at(2026, 11, 26, 7, 0));
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa"));
    }

    @Test
    void tcTuan110401AnEstrusCannotMoveAfterItsLinkedBreeding() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));
        world.breeding(cow, at(2026, 11, 26, 14, 0), estrus);

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, estrus.getId(), KEY, move(1, at(2026, 11, 26, 15, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat((String) error.getParams().get("records")).startsWith("phối giống 26/11/2026");
        assertThat(estrus.getEventTime()).isEqualTo(at(2026, 11, 26, 6, 0));
    }

    @Test
    void tcTuan110402ABreedingCannotMoveBeforeItsLinkedEstrus() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 26, 14, 0), estrus);

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, bred.getId(), KEY, move(1, at(2026, 11, 26, 5, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_10);
        assertThat(bred.getEventTime()).isEqualTo(at(2026, 11, 26, 14, 0));
    }

    @Test
    void tcTuan110403ANoteOf501CharactersIsInvalid() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, estrus.getId(), KEY, move(1, at(2026, 11, 26, 7, 0), "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "reason");
    }

    @Test
    void tcTuan110404AStaleVersionIsAConflict() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, estrus.getId(), KEY, move(0, at(2026, 11, 26, 7, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(estrus.getEventTime()).isEqualTo(at(2026, 11, 26, 6, 0));
    }

    @Test
    void tcTuan110405AVoidedEventCannotBeCorrected() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));
        estrus.setStatus("VOIDED");

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, estrus.getId(), KEY, move(1, at(2026, 11, 26, 7, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
    }

    @Test
    void tcTuan110406TheSireOfABreedingWithARegisteredCalfIsFrozen() {
        ReproductionEvent bred = world.breeding(cow, at(2025, 11, 1, 8, 0), null);
        PregnancyEpisode episode = world.pregnancy(cow, world.check(cow, at(2025, 12, 1, 8, 0), "PREGNANT", bred), bred, "OPEN");
        CalvingEvent calved = world.calving(cow, episode, at(2026, 8, 11, 6, 0));
        world.calf(calved, 1, "LIVE", "REGISTERED");

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, bred.getId(), KEY, sire(1, 6101L)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat((String) error.getParams().get("records")).contains("bê đã đăng ký");
    }

    @Test
    void tcTuan110407ATechnicianCannotCorrect() {
        role = FarmRole.TECHNICIAN;
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, estrus.getId(), KEY, move(1, at(2026, 11, 26, 7, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
    }

    @Test
    void tcTuan110408AnUnknownEventIsNotFound() {
        DomainException error = domainError(() -> service.correctEvent(FARM_ID, 999L, KEY, move(1, at(2026, 11, 26, 7, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(error.getParams()).containsEntry("eventId", 999L);
    }

    // ================================================================== UC-FE11-04 voidEvent

    @Test
    void tc1117ABreedingWithAPregnancyCheckCannotBeVoided() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 10, 5, 8, 0), null);
        world.check(cow, at(2026, 11, 1, 9, 0), "PREGNANT", bred);

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, bred.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat((String) error.getParams().get("records")).isEqualTo("khám thai 01/11/2026");
        assertThat(bred.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan110409AnEstrusLinkedByABreedingCannotBeVoided() {
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));
        world.breeding(cow, at(2026, 11, 26, 14, 0), estrus);

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, estrus.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat(estrus.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan110410ABreedingWithoutDependentsIsVoidedWithARevision() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);

        ReproductionDtos.EventResult result = service.voidEvent(FARM_ID, bred.getId(), KEY, new ReproductionDtos.VoidRecord(1, "Ghi nhầm bò"));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(result.reproStatus()).isEqualTo("AWAITING_BREEDING");
        assertThat(bred.getStatusReason()).isEqualTo("Ghi nhầm bò");
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getAction()).isEqualTo("VOID"));
        verify(reminders).eventVoided(cow, bred);
    }

    @Test
    void tcTuan110411AStaleVersionIsAConflict() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, bred.getId(), KEY, new ReproductionDtos.VoidRecord(0, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(bred.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan110412AVoidedEventCannotBeVoidedAgain() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);
        bred.setStatus("VOIDED");

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, bred.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(savedRevisions).isEmpty();
    }

    @Test
    void tcTuan110413ATechnicianCannotVoid() {
        role = FarmRole.TECHNICIAN;
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, bred.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
    }

    @Test
    void tcTuan110414AnEventOfAnExitedCowCannotBeVoided() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 20, 8, 0), null);
        cow.setHerdStatus(HerdStatus.EXITED);

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, bred.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(bred.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tc1125TheOwnerVoidsAnEstrus() {
        role = FarmRole.OWNER;
        ReproductionEvent estrus = world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 0));

        service.voidEvent(FARM_ID, estrus.getId(), KEY, new ReproductionDtos.VoidRecord(1, null));

        assertThat(estrus.getStatus()).isEqualTo("VOIDED");
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getActor().getFullName()).isEqualTo("Owner Hoa"));
    }

    // ================================================================== UC-FE12-01 recordPregnancyCheck

    @Test
    void tc1201APregnantCheckLinkedToTheBreedingConfirmsTheCalvingDate() {
        build(Instant.parse("2026-11-30T03:00:00Z"));
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 1, 8, 0), null);

        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 29, 9, 0), "PREGNANT", bred.getId(), null));

        assertThat(result.episode().expectedDate()).isEqualTo(LocalDate.of(2027, 8, 11));
        assertThat(result.episode().basis()).isEqualTo("CONFIRMED");
        assertThat(world.episodes).singleElement().satisfies(p -> assertThat(p.getStatus()).isEqualTo("OPEN"));
        assertThat(result.reproStatus()).isEqualTo("PREGNANT");
        verify(reminders).pregnancyCheckRecorded(cow, persisted("PREGNANCY_CHECK"), world.episodes.get(0));
    }

    @Test
    void tc1202APregnancyOfABoughtCowIsEstimatedFromTheMonths() {
        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, 4));

        assertThat(result.episode().expectedDate()).isEqualTo(LocalDate.of(2026, 11, 1).plusDays(283 - 120));
        assertThat(result.episode().expectedDate()).isEqualTo(LocalDate.of(2027, 4, 13));
        assertThat(result.episode().basis()).isEqualTo("ESTIMATED");
    }

    @Test
    void tc1203APregnancyWithoutBreedingOrMonthsHasNoDate() {
        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, null));

        assertThat(result.episode().expectedDate()).isNull();
        assertThat(result.episode().notice()).isEqualTo(MessageCodes.FE12_11);
        assertThat(world.episodes).singleElement().satisfies(p -> assertThat(p.getStatus()).isEqualTo("OPEN"));
    }

    @Test
    void tc1204ANotPregnantCheckReturnsTheCowToAwaitingBreeding() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 1, 8, 0), null);

        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 26, 9, 0), "NOT_PREGNANT", bred.getId(), null));

        assertThat(result.reproStatus()).isEqualTo("AWAITING_BREEDING");
        assertThat(result.episode()).isNull();
        assertThat(world.episodes).isEmpty();
    }

    @Test
    void tc1205AnInconclusiveCheckKeepsTheCowBred() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 10, 5, 8, 0), null);

        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "INCONCLUSIVE", bred.getId(), null));

        assertThat(result.reproStatus()).isEqualTo("BRED");
        assertThat(world.episodes).isEmpty();
        verify(reminders).pregnancyCheckRecorded(cow, persisted("PREGNANCY_CHECK"), null);
    }

    @Test
    void tc1206ASecondPregnantCheckConfirmsTheOpenPregnancy() {
        PregnancyEpisode open = openPregnancy();

        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY,
            check(at(2026, 11, 26, 9, 0), "PREGNANT", open.getLinkedBreeding().getId(), null));

        assertThat(result.episode().episodeId()).isEqualTo(open.getId());
        assertThat(world.episodes).hasSize(1);
    }

    @Test
    void tc1207ACheckLinkedToAnotherBreedingContradictsTheOpenPregnancy() {
        openPregnancy();
        ReproductionEvent other = world.breeding(cow, at(2026, 10, 25, 8, 0), null);

        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 26, 9, 0), "PREGNANT", other.getId(), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_02);
        assertThat(world.episodes).hasSize(1);
    }

    @Test
    void tc1208ACheckBeforeItsLinkedBreedingIsRejected() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 11, 1, 8, 0), null);

        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 10, 31, 9, 0), "PREGNANT", bred.getId(), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_10);
        assertThat(error.getParams()).containsEntry("field", "checkedAt");
    }

    @Test
    void tc1226ATechnicianCannotRecordACheck() {
        role = FarmRole.TECHNICIAN;

        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, 4)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(world.events).isEmpty();
    }

    @Test
    void tc1227TheOwnerRecordsACheck() {
        role = FarmRole.OWNER;

        service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, 4));

        assertThat(persisted("PREGNANCY_CHECK").getRecordedBy().getFullName()).isEqualTo("Owner Hoa");
    }

    @Test
    void tcTuan120101ANotPregnantCheckContradictsAnOpenPregnancy() {
        openPregnancy();

        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 26, 9, 0), "NOT_PREGNANT", null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_02);
    }

    @Test
    void tcTuan120102MonthsOnANotPregnantResultAreInvalid() {
        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "NOT_PREGNANT", null, 3)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "estimatedMonths");
    }

    @Test
    void tcTuan120103TenMonthsIsInvalid() {
        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, 10)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "estimatedMonths");
    }

    @Test
    void tcTuan120104AMissingResultIsRequired() {
        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), " ", null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "result");
    }

    @Test
    void tcTuan120105APregnantCheckOlderThanALaterCalvingIsRejected() {
        world.calving(cow, null, at(2026, 11, 10, 6, 0));

        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, 6)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_02);
        assertThat(world.episodes).isEmpty();
    }

    @Test
    void tcTuan120106AMaleCannotBeChecked() {
        DomainException error = domainError(() -> service.recordPregnancyCheck(FARM_ID, 6101L, KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_11);
    }

    @Test
    void tcTuan120107WithoutAGestationParameterThePregnancyHasNoDate() {
        world.gestation = null;
        ReproductionEvent bred = world.breeding(cow, at(2026, 10, 5, 8, 0), null);

        ReproductionDtos.EventResult result = service.recordPregnancyCheck(FARM_ID, cow.getId(), KEY, check(at(2026, 11, 1, 9, 0), "PREGNANT", bred.getId(), null));

        assertThat(result.parameterMissing()).isEqualTo("GESTATION_LENGTH_DAYS");
        assertThat(result.episode().expectedDate()).isNull();
    }

    // ================================================================== UC-FE12-02 updatePregnancy

    @Test
    void tc1209ALossClosesThePregnancyAndCreatesNoCalf() {
        PregnancyEpisode episode = openPregnancy();

        ReproductionDtos.PregnancyUpdateResult result = service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "LOSS", at(2026, 11, 20, 8, 0), null, "Sẩy thai tháng thứ 2", null));

        assertThat(result.episodeStatus()).isEqualTo("LOST");
        assertThat(episode.getCloseReason()).isEqualTo("PREGNANCY_LOSS");
        assertThat(episode.getClosedDate()).isEqualTo(LocalDate.of(2026, 11, 20));
        assertThat(result.reproStatus()).isEqualTo("AWAITING_BREEDING");
        assertThat(world.calves).isEmpty();
        assertThat(world.calvings).isEmpty();
        verify(reminders).pregnancyLost(episode);
    }

    @Test
    void tc1210ACalvedPregnancyTakesNoUpdate() {
        PregnancyEpisode episode = openPregnancy();
        world.calving(cow, episode, at(2026, 11, 20, 6, 0));

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 11, 26, 8, 0), null, "Theo dõi", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_12);
        assertThat(world.updates).isEmpty();
    }

    @Test
    void tc1227TheOwnerRecordsAnUpdate() {
        role = FarmRole.OWNER;
        PregnancyEpisode episode = openPregnancy();

        service.updatePregnancy(FARM_ID, episode.getId(), KEY, new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 11, 26, 8, 0), null, "Bụng to", null));

        assertThat(world.updates).singleElement().satisfies(u -> assertThat(u.getRecordedBy().getFullName()).isEqualTo("Owner Hoa"));
    }

    @Test
    void tcTuan120201AnUpdateBeforeTheConfirmingCheckIsRejected() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 10, 31, 8, 0), null, "Theo dõi", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_10);
        assertThat(error.getParams()).containsEntry("field", "occurredAt");
    }

    @Test
    void tcTuan120202MissingDetailsAreRequired() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 11, 26, 8, 0), null, " ", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "details");
    }

    @Test
    void tcTuan120203DetailsOf1001CharactersAreInvalid() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 11, 26, 8, 0), null, "x".repeat(1001), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
    }

    @Test
    void tcTuan120204OnlyAComplicationLinksAHealthCase() {
        PregnancyEpisode episode = openPregnancy();
        HealthCase hc = world.openCase(cow);

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 11, 26, 8, 0), null, "Theo dõi", hc.getId())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "healthCaseId");
    }

    @Test
    void tcTuan120205AComplicationIsLinkedToTheCowsCase() {
        PregnancyEpisode episode = openPregnancy();
        HealthCase hc = world.openCase(cow);

        service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "COMPLICATION", at(2026, 11, 26, 8, 0), null, "Ra máu", hc.getId()));

        assertThat(world.updates).singleElement().satisfies(u -> {
            assertThat(u.getHealthCase()).isSameAs(hc);
            assertThat(u.getType()).isEqualTo("COMPLICATION");
        });
        assertThat(episode.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tcTuan120206AnUnknownTypeIsInvalid() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "BIRTH", at(2026, 11, 26, 8, 0), null, "Đẻ", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "type");
    }

    @Test
    void tcTuan120207AStaleEpisodeVersionIsAConflict() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(0, "LOSS", at(2026, 11, 20, 8, 0), null, "Sẩy", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(episode.getStatus()).isEqualTo("OPEN");
    }

    @Test
    void tcTuan120208ATechnicianCannotRecordAnUpdate() {
        role = FarmRole.TECHNICIAN;
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.updatePregnancy(FARM_ID, episode.getId(), KEY,
            new ReproductionDtos.PregnancyUpdateCommand(1, "OBSERVATION", at(2026, 11, 26, 8, 0), null, "Theo dõi", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
    }

    // ================================================================== UC-FE12-03 recordCalving

    @Test
    void tc1211ACalvingWithoutACalfIsRejected() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_06);
        assertThat(world.calvings).isEmpty();
    }

    @Test
    void tc1212ABirthWeightOf0Point5KgIsRejected() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null,
            calf("LIVE", "FEMALE", "0.5", "MEASURED", null, 11L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_07);
        assertThat(error.getParams()).containsEntry("field", "calves[0].birthWeightKg");
    }

    @Test
    void tc1212ABirthWeightOf80Point1KgIsRejected() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null,
            calf("LIVE", "FEMALE", "80.1", "MEASURED", null, 11L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_07);
    }

    @Test
    void tc1212AWeightWithoutABasisIsRejected() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null,
            calf("LIVE", "FEMALE", "25", null, null, 11L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_07);
        assertThat(world.calvings).isEmpty();
    }

    @Test
    void tc1213ALiveCalfCannotHaveAnUnknownSex() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null,
            calf("LIVE", "UNKNOWN", null, null, null, 11L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "calves[0].sex");
    }

    @Test
    void tc1214ATagUsedByAnotherCattleIsRejected() {
        world.cattle.get(6101L).setEarTagNumber("VN-7788");

        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null,
            calf("LIVE", "FEMALE", null, null, "vn-7788", 11L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_08);
        assertThat(error.getParams()).containsEntry("tag_code", "vn-7788");
    }

    @Test
    void tc1215ADraftCalfAndARegisteredCalfCloseThePregnancy() {
        PregnancyEpisode episode = openPregnancy();

        ReproductionDtos.CalvingResult result = service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), null,
            liveDraft(), calf("LIVE", "MALE", "30", "ESTIMATED", null, 11L, "REGISTER_NOW")));

        assertThat(episode.getStatus()).isEqualTo("CALVED");
        assertThat(result.episodeId()).isEqualTo(episode.getId());
        assertThat(result.calves()).extracting(ReproductionDtos.CalfResult::cattleCode).containsExactly(null, "BO-6900");
        CalfOutcome registered = world.calves.get(1);
        verify(pendingCalves).registerCalfNow(FARM_ID, registered.getId(), 11L, 61L);
        verify(entryReminders).raiseCalfReminder(world.calves.get(0), cow);
        verify(reminders).calvingRecorded(cow, world.calvings.get(0).getId(), at(2026, 11, 26, 6, 0));
        assertThat(result.damStatus()).isEqualTo("POST_CALVING");
    }

    @Test
    void tc1216ARegistrationIntoAFullPenStopsTheCalving() {
        when(pendingCalves.registerCalfNow(anyLong(), anyLong(), anyLong(), anyLong()))
            .thenThrow(DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", "A-01"));

        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            calf("LIVE", "MALE", null, null, null, 11L, "REGISTER_NOW"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE04_05);
        verify(entryReminders, never()).raiseCalfReminder(any(), any());
    }

    @Test
    void tc1217ACalvingWithoutATrackedPregnancyCreatesNoEarlierEvent() {
        ReproductionDtos.CalvingResult result = service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true, liveDraft()));

        assertThat(result.episodeId()).isNull();
        assertThat(world.calvings).singleElement().satisfies(c -> assertThat(c.getEpisode()).isNull());
        assertThat(world.events).isEmpty();
        assertThat(world.episodes).isEmpty();
    }

    @Test
    void tc1219ASecondCalvingWithin30DaysIsRejected() {
        world.calving(cow, null, at(2026, 11, 1, 6, 0));

        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 15, 6, 0), true, liveDraft())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_12);
        assertThat(error.getParams()).containsEntry("dam_code", "BO-6001");
        assertThat(world.calvings).hasSize(1);
    }

    @Test
    void tc1226ATechnicianCannotRecordACalving() {
        role = FarmRole.TECHNICIAN;

        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true, liveDraft())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(world.calvings).isEmpty();
    }

    @Test
    void tc1227TheOwnerRecordsACalving() {
        role = FarmRole.OWNER;

        service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true, liveDraft()));

        assertThat(world.calvings).singleElement().satisfies(c -> assertThat(c.getRecordedBy().getFullName()).isEqualTo("Owner Hoa"));
    }

    @Test
    void tcTuan120301FiveCalvesAreTooMany() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            liveDraft(), liveDraft(), liveDraft(), liveDraft(), liveDraft())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "calves");
    }

    @Test
    void tcTuan120302AStillbornCalfOfUnknownSexNeedsNoRegistration() {
        ReproductionDtos.CalvingResult result = service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            calf("STILLBORN", "UNKNOWN", null, null, null, null, null)));

        assertThat(result.calves()).singleElement().satisfies(c -> assertThat(c.registration()).isEqualTo("NOT_REQUIRED"));
        verify(entryReminders, never()).raiseCalfReminder(any(), any());
    }

    @Test
    void tcTuan120303ACalfRegisteredNowNeedsASex() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            calf("LIVE", null, null, null, null, 11L, "REGISTER_NOW"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "calves[0].sex");
    }

    @Test
    void tcTuan120304TheSameTagTwiceInOneCalvingIsRejected() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            calf("LIVE", "FEMALE", null, null, "VN-9001", 11L, "DRAFT"), calf("LIVE", "MALE", null, null, "vn-9001", 11L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_08);
        assertThat(error.getParams()).containsEntry("field", "calves[1].tagCode");
    }

    @Test
    void tcTuan120305ABirthBeforeTheConfirmingCheckIsRejected() {
        openPregnancy();

        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 10, 31, 6, 0), null, liveDraft())));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_10);
        assertThat(error.getParams()).containsEntry("field", "birthAt");
    }

    @Test
    void tcTuan120306ALiveCalfNeedsAPen() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            calf("LIVE", "FEMALE", null, null, null, null, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(error.getParams()).containsEntry("field", "calves[0].penId");
    }

    @Test
    void tcTuan120307AnInactivePenIsRejected() {
        DomainException error = domainError(() -> service.recordCalving(FARM_ID, KEY, calving(at(2026, 11, 26, 6, 0), true,
            calf("LIVE", "FEMALE", null, null, null, 12L, "DRAFT"))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE04_05);
        assertThat(error.getParams()).containsEntry("pen_code", "B-01");
    }

    // ================================================================== UC-FE12-04 correctEvent (pregnancy check)

    @Test
    void tc1220ACheckThatLedToACalvingCannotBecomeNotPregnant() {
        PregnancyEpisode episode = openPregnancy();
        world.calving(cow, episode, at(2026, 11, 20, 6, 0));

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, episode.getConfirmingCheck().getId(), KEY, result(1, "NOT_PREGNANT", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat((String) error.getParams().get("records")).isEqualTo("lần đẻ 20/11/2026");
        assertThat(episode.getConfirmingCheck().getResult()).isEqualTo("PREGNANT");
    }

    @Test
    void tcTuan120401AnUnusedPregnantCheckCorrectedToNotPregnantVoidsThePregnancy() {
        PregnancyEpisode episode = openPregnancy();

        ReproductionDtos.EventResult result = service.correctEvent(FARM_ID, episode.getConfirmingCheck().getId(), KEY, result(1, "NOT_PREGNANT", null));

        assertThat(result.result()).isEqualTo("NOT_PREGNANT");
        assertThat(episode.getStatus()).isEqualTo("VOIDED");
        assertThat(episode.getCloseReason()).isEqualTo("CONFIRMING_CHECK_CORRECTED");
    }

    @Test
    void tcTuan120402CorrectedMonthsReEstimateTheCalvingDate() {
        ReproductionEvent confirmed = world.check(cow, at(2026, 11, 1, 9, 0), "PREGNANT", null);
        confirmed.setEstMonthsPregnant(4);
        PregnancyEpisode episode = world.pregnancy(cow, confirmed, null, "OPEN");

        service.correctEvent(FARM_ID, confirmed.getId(), KEY, result(1, null, 5));

        assertThat(episode.getExpectedCalvingDate()).isEqualTo(LocalDate.of(2026, 11, 1).plusDays(283 - 150));
        assertThat(episode.getExpectedBasis()).isEqualTo("ESTIMATED");
    }

    @Test
    void tcTuan120403AStaleCheckVersionIsAConflict() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.correctEvent(FARM_ID, episode.getConfirmingCheck().getId(), KEY, result(0, "NOT_PREGNANT", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(episode.getStatus()).isEqualTo("OPEN");
    }

    // ================================================================== UC-FE12-04 voidEvent (pregnancy check)

    @Test
    void tc1220ACheckThatLedToACalvingCannotBeVoided() {
        PregnancyEpisode episode = openPregnancy();
        world.calving(cow, episode, at(2026, 11, 20, 6, 0));

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, episode.getConfirmingCheck().getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat(episode.getConfirmingCheck().getStatus()).isEqualTo("VALID");
    }

    @Test
    void tc1221VoidingTheOnlyPregnantCheckVoidsThePregnancy() {
        PregnancyEpisode episode = openPregnancy();

        ReproductionDtos.EventResult result = service.voidEvent(FARM_ID, episode.getConfirmingCheck().getId(), KEY, new ReproductionDtos.VoidRecord(1, null));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(episode.getStatus()).isEqualTo("VOIDED");
        assertThat(episode.getCloseReason()).isEqualTo("CONFIRMING_CHECK_VOIDED");
        assertThat(result.reproStatus()).isEqualTo("BRED");
    }

    @Test
    void tcTuan120404AnInconclusiveCheckIsVoided() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 10, 5, 8, 0), null);
        ReproductionEvent inconclusive = world.check(cow, at(2026, 11, 1, 9, 0), "INCONCLUSIVE", bred);

        service.voidEvent(FARM_ID, inconclusive.getId(), KEY, new ReproductionDtos.VoidRecord(1, "Khám nhầm bò"));

        assertThat(inconclusive.getStatus()).isEqualTo("VOIDED");
        assertThat(world.episodes).isEmpty();
    }

    @Test
    void tcTuan120405AVoidNoteOf501CharactersIsInvalid() {
        PregnancyEpisode episode = openPregnancy();

        DomainException error = domainError(() -> service.voidEvent(FARM_ID, episode.getConfirmingCheck().getId(), KEY, new ReproductionDtos.VoidRecord(1, "x".repeat(501))));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(episode.getStatus()).isEqualTo("OPEN");
    }

    // ================================================================== UC-FE12-04 voidCalving

    @Test
    void tc1222ACalvingWithARegisteredCalfCannotBeVoided() {
        CalvingEvent calved = world.calving(cow, openPregnancy(), at(2026, 11, 20, 6, 0));
        world.calf(calved, 1, "LIVE", "REGISTERED");

        DomainException error = domainError(() -> service.voidCalving(FARM_ID, calved.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat(calved.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tc1223VoidingACalvingWithTwoDraftCalvesVoidsThemAndReopensThePregnancy() {
        PregnancyEpisode episode = openPregnancy();
        CalvingEvent calved = world.calving(cow, episode, at(2026, 11, 20, 6, 0));
        CalfOutcome first = world.calf(calved, 1, "LIVE", "PENDING_CONFIRMATION");
        CalfOutcome second = world.calf(calved, 2, "LIVE", "PENDING_CONFIRMATION");

        ReproductionDtos.CalvingResult result = service.voidCalving(FARM_ID, calved.getId(), KEY, new ReproductionDtos.VoidRecord(1, "Ghi nhầm bò mẹ"));

        assertThat(result.status()).isEqualTo("VOIDED");
        assertThat(List.of(first.getStatus(), second.getStatus())).containsOnly("VOIDED");
        verify(entryReminders).cancelCalfReminder(first);
        verify(entryReminders).cancelCalfReminder(second);
        assertThat(episode.getStatus()).isEqualTo("OPEN");
        verify(reminders).calvingVoided(cow, calved.getId(), episode);
        assertThat(savedRevisions).hasSize(3);
    }

    @Test
    void tcTuan120406ACalvingFollowedByABreedingCannotBeVoided() {
        CalvingEvent calved = world.calving(cow, openPregnancy(), at(2026, 11, 5, 6, 0));
        world.calf(calved, 1, "LIVE", "PENDING_CONFIRMATION");
        world.breeding(cow, at(2026, 11, 25, 8, 0), null);

        DomainException error = domainError(() -> service.voidCalving(FARM_ID, calved.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat((String) error.getParams().get("records")).isEqualTo("phối giống 25/11/2026");
    }

    @Test
    void tcTuan120407AStaleCalvingVersionIsAConflict() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));

        DomainException error = domainError(() -> service.voidCalving(FARM_ID, calved.getId(), KEY, new ReproductionDtos.VoidRecord(0, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
    }

    @Test
    void tcTuan120408ATechnicianCannotVoidACalving() {
        role = FarmRole.TECHNICIAN;
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));

        DomainException error = domainError(() -> service.voidCalving(FARM_ID, calved.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(calved.getStatus()).isEqualTo("VALID");
    }

    // ================================================================== UC-FE12-04 correctCalf

    @Test
    void tc1224ARegisteredCalfCannotBecomeStillborn() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));
        CalfOutcome registered = world.calf(calved, 1, "LIVE", "REGISTERED");

        DomainException error = domainError(() -> service.correctCalf(FARM_ID, registered.getId(), KEY, calfOutcome(1, "STILLBORN", null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE11_07);
        assertThat(registered.getOutcome()).isEqualTo("LIVE");
    }

    @Test
    void tcTuan120409ADraftCalfCorrectedToStillbornNeedsNoRegistration() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));
        CalfOutcome draft = world.calf(calved, 1, "LIVE", "PENDING_CONFIRMATION");

        ReproductionDtos.CalfResult result = service.correctCalf(FARM_ID, draft.getId(), KEY, calfOutcome(1, "STILLBORN", null, null, null));

        assertThat(result.outcome()).isEqualTo("STILLBORN");
        assertThat(result.registration()).isEqualTo("NOT_REQUIRED");
        verify(entryReminders).cancelCalfReminder(draft);
    }

    @Test
    void tcTuan120410ACalfThatDiedBeforeRegistrationStaysLive() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));
        CalfOutcome died = world.calf(calved, 1, "LIVE", "DIED_BEFORE_REGISTRATION");

        DomainException error = domainError(() -> service.correctCalf(FARM_ID, died.getId(), KEY, calfOutcome(1, "STILLBORN", null, null, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "outcome");
    }

    @Test
    void tcTuan120411ACorrectedWeightOf81KgIsRejected() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));
        CalfOutcome draft = world.calf(calved, 1, "LIVE", "PENDING_CONFIRMATION");

        DomainException error = domainError(() -> service.correctCalf(FARM_ID, draft.getId(), KEY, calfOutcome(1, null, "81", "MEASURED", null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_07);
    }

    @Test
    void tcTuan120412ACorrectedTagUsedByAnotherCattleIsRejected() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 20, 6, 0));
        CalfOutcome draft = world.calf(calved, 1, "LIVE", "PENDING_CONFIRMATION");

        DomainException error = domainError(() -> service.correctCalf(FARM_ID, draft.getId(), KEY, calfOutcome(1, null, null, null, "BO-6101")));

        assertThat(error.getCode()).isEqualTo(MessageCodes.FE12_08);
        assertThat(draft.getTagCode()).isNull();
    }

    // ================================================================== UC-FE12-04 voidPregnancyUpdate

    @Test
    void tc1225VoidingALossDoesNotReopenItWhenANewerPregnancyExists() {
        PregnancyEpisode lost = openPregnancy();
        lost.setStatus("LOST");
        PregnancyUpdate loss = world.update(lost, "LOSS", at(2026, 11, 5, 8, 0));
        ReproductionEvent rebred = world.breeding(cow, at(2026, 11, 10, 8, 0), null);
        world.pregnancy(cow, world.check(cow, at(2026, 11, 25, 8, 0), "PREGNANT", rebred), rebred, "OPEN");

        service.voidPregnancyUpdate(FARM_ID, loss.getId(), KEY, new ReproductionDtos.VoidRecord(1, null));

        assertThat(loss.getStatus()).isEqualTo("VOIDED");
        assertThat(lost.getStatus()).isEqualTo("LOST");
        verify(reminders, never()).pregnancyLossVoided(any());
    }

    @Test
    void tcTuan120413VoidingTheOnlyLossReopensThePregnancy() {
        PregnancyEpisode lost = openPregnancy();
        lost.setStatus("LOST");
        PregnancyUpdate loss = world.update(lost, "LOSS", at(2026, 11, 5, 8, 0));

        ReproductionDtos.PregnancyUpdateResult result = service.voidPregnancyUpdate(FARM_ID, loss.getId(), KEY, new ReproductionDtos.VoidRecord(1, "Nhầm"));

        assertThat(result.episodeStatus()).isEqualTo("OPEN");
        assertThat(result.reproStatus()).isEqualTo("PREGNANT");
        verify(reminders).pregnancyLossVoided(lost);
    }

    @Test
    void tcTuan120414AnObservationIsVoidedWithoutTouchingThePregnancy() {
        PregnancyEpisode episode = openPregnancy();
        PregnancyUpdate note = world.update(episode, "OBSERVATION", at(2026, 11, 10, 8, 0));

        service.voidPregnancyUpdate(FARM_ID, note.getId(), KEY, new ReproductionDtos.VoidRecord(1, null));

        assertThat(note.getStatus()).isEqualTo("VOIDED");
        assertThat(episode.getStatus()).isEqualTo("OPEN");
        assertThat(savedRevisions).singleElement().satisfies(r -> assertThat(r.getAction()).isEqualTo("VOID"));
    }

    @Test
    void tcTuan120415AStaleUpdateVersionIsAConflict() {
        PregnancyUpdate note = world.update(openPregnancy(), "OBSERVATION", at(2026, 11, 10, 8, 0));

        DomainException error = domainError(() -> service.voidPregnancyUpdate(FARM_ID, note.getId(), KEY, new ReproductionDtos.VoidRecord(0, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(note.getStatus()).isEqualTo("VALID");
    }

    @Test
    void tcTuan120416AVoidedUpdateCannotBeVoidedAgain() {
        PregnancyUpdate note = world.update(openPregnancy(), "OBSERVATION", at(2026, 11, 10, 8, 0));
        note.setStatus("VOIDED");

        DomainException error = domainError(() -> service.voidPregnancyUpdate(FARM_ID, note.getId(), KEY, new ReproductionDtos.VoidRecord(1, null)));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05);
        verify(audit, never()).log(any(FarmContext.class), anyString(), anyString(), anyLong(), any());
        verify(audit, times(0)).log(any(FarmContext.class), eq("PREGNANCY_UPDATE_VOID"), anyString(), anyLong(), any());
    }
}
