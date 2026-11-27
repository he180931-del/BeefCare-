package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static vn.edu.fpt.beefcare.service.ReproductionWorld.FARM_ID;
import static vn.edu.fpt.beefcare.service.ReproductionWorld.at;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main function of UC-FE11-01 View Reproduction Status and
 * History, which D88 merged with the old UC-FE12-01 View Pregnancy and Calving Records: {@link ReproductionReadService#profile}
 * (SCR-39). The farm lives in memory ({@link ReproductionWorld}); the reproductive state, eligibility and parameters come
 * from the real {@link CattleStateService}; the entry declaration lookup is a mock with no declared pregnancy; the farm
 * access check applies the real {@link FarmAction} role table. Farm parameters: gestation 283 days, breeding window
 * 8-12 h, minimum age 13 months and weight 230 kg, post-calving 45 days, estrus cycle 21 days, check after 28 days,
 * calving lead 30 days. The farm clock is fixed at 27/11/2026 10:00 (UTC+7) unless a test sets another day.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReproductionReadServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock EntryDeclarationReadService declarations;

    private ReproductionWorld world;
    private ReproductionReadService service;
    private FarmRole role = FarmRole.MANAGER;
    private Cattle cow;

    @BeforeEach
    void setUp() {
        world = new ReproductionWorld(em);
        build(NOW);
        cow = world.cow(6001L, "BO-6001", PurposeType.BREEDING, LocalDate.of(2023, 1, 1));
        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenAnswer(inv -> {
            FarmAction action = inv.getArgument(1);
            if (role == null || !action.allows(role)) {
                throw DomainException.forbidden(MessageCodes.COM_01);
            }
            return new FarmContext(world.farm, world.users.get(role), role);
        });
        when(declarations.pendingPregnancy(eq(FARM_ID), anyLong())).thenReturn(Optional.empty());
    }

    private void build(Instant now) {
        FarmClock clock = new FarmClock(Clock.fixed(now, ZoneOffset.UTC));
        CattleStateService state = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(state, "em", em);
        service = new ReproductionReadService(access, clock, state, declarations);
        ReflectionTestUtils.setField(service, "em", em);
    }

    private ReproductionDtos.Profile profile() {
        return service.profile(FARM_ID, cow.getId(), null, null, null);
    }

    private static DomainException domainError(Runnable call) {
        DomainException error = catchThrowableOfType(DomainException.class, call::run);
        assertThat(error).as("the call should be rejected with a DomainException").isNotNull();
        return error;
    }

    // ================================================================== UC-FE11-01 profile

    @Test
    void tc1101ACowWithoutEventsAwaitsBreeding() {
        ReproductionDtos.Profile p = profile();

        assertThat(p.applicable()).isTrue();
        assertThat(p.status()).isEqualTo("AWAITING_BREEDING");
        assertThat(p.allowedActions()).containsExactly("ESTRUS", "BREEDING");
        assertThat(p.canManage()).isTrue();
    }

    @Test
    void tc1102AFatteningCowIsNotTrackedButKeepsTheOtherActions() {
        cow.getPurpose().setPurposeType(PurposeType.FATTENING);

        ReproductionDtos.Profile p = profile();

        assertThat(p.applicable()).isFalse();
        assertThat(p.notApplicableReason()).isEqualTo("PURPOSE");
        assertThat(p.status()).isNull();
        assertThat(p.allowedActions()).isEmpty();
        assertThat(p.otherActions()).containsExactly("PREGNANCY_CHECK", "CALVING");
    }

    @Test
    void tc1105AnEstrusOlderThan24HoursWithoutBreedingReturnsToAwaiting() {
        world.event(cow, "ESTRUS", at(2026, 11, 26, 6, 30));

        ReproductionDtos.Profile p = profile();

        assertThat(p.status()).isEqualTo("AWAITING_BREEDING");
        assertThat(p.window()).isNull();
    }

    @Test
    void tc1115AnOpenHealthCaseFailsTheBreedingConditions() {
        world.openCase(cow);

        ReproductionDtos.Profile p = profile();

        assertThat(p.eligibility().met()).isFalse();
        assertThat(p.eligibility().criteria()).filteredOn(c -> c.name().equals("OPEN_HEALTH_CASE")).singleElement()
            .satisfies(c -> assertThat(c.met()).isFalse());
    }

    @Test
    void tc1122FiveServicesAndThreePregnanciesAreShownAsConceptions() {
        for (int month = 1; month <= 5; month++) {
            ReproductionEvent bred = world.breeding(cow, at(2024, month * 2, 1, 8, 0), null);
            if (month <= 3) {
                world.pregnancy(cow, world.check(cow, at(2024, month * 2, 28, 8, 0), "PREGNANT", bred), bred, "LOST");
            }
        }

        ReproductionDtos.Indicators indicators = profile().indicators();

        assertThat(indicators.conceptions()).isEqualTo(3);
        assertThat(indicators.services()).isEqualTo(5);
    }

    @Test
    void tc1123A111DaysOpenCowIsOverdueForConception() {
        build(Instant.parse("2026-10-20T03:00:00Z"));
        world.calving(cow, null, at(2026, 7, 1, 6, 0));

        ReproductionDtos.Indicators indicators = profile().indicators();

        assertThat(indicators.daysSinceCalving()).isEqualTo(111L);
        assertThat(indicators.overdue()).isTrue();
    }

    @Test
    void tcTuan110101ARecentEstrusShowsTheBreedingWindow() {
        world.event(cow, "ESTRUS", at(2026, 11, 27, 6, 30));

        ReproductionDtos.Profile p = profile();

        assertThat(p.status()).isEqualTo("IN_ESTRUS");
        assertThat(p.window().configured()).isTrue();
        assertThat(p.window().from()).isEqualTo(at(2026, 11, 27, 14, 30));
        assertThat(p.window().to()).isEqualTo(at(2026, 11, 27, 18, 30));
    }

    @Test
    void tcTuan110102WithoutWindowParametersTheWindowIsNotConfigured() {
        world.parameters = null;
        world.event(cow, "ESTRUS", at(2026, 11, 27, 6, 30));

        ReproductionDtos.Profile p = profile();

        assertThat(p.window().configured()).isFalse();
        assertThat(p.window().from()).isNull();
    }

    @Test
    void tcTuan110103ABredCowShowsItsLatestBreedingAndTheCheckDate() {
        world.breeding(cow, at(2026, 11, 20, 8, 0), null);

        ReproductionDtos.Profile p = profile();

        assertThat(p.status()).isEqualTo("BRED");
        assertThat(p.allowedActions()).containsExactly("ESTRUS", "PREGNANCY_CHECK", "CALVING");
        assertThat(p.latestBreeding().checkFrom()).isEqualTo(LocalDate.of(2026, 12, 18));
        assertThat(p.latestBreeding().tentativeCalvingDate()).isEqualTo(LocalDate.of(2026, 11, 20).plusDays(283));
        assertThat(p.eligibility()).isNull();
    }

    @Test
    void tcTuan110104APregnantCowShowsTheCurrentPregnancyDueSoon() {
        ReproductionEvent bred = world.breeding(cow, at(2026, 2, 20, 8, 0), null);
        ReproductionEvent confirmed = world.check(cow, at(2026, 3, 25, 8, 0), "PREGNANT", bred);
        PregnancyEpisode episode = world.pregnancy(cow, confirmed, bred, "OPEN");

        ReproductionDtos.Profile p = profile();

        assertThat(p.status()).isEqualTo("PREGNANT");
        assertThat(p.statusSince()).isEqualTo(at(2026, 3, 25, 8, 0));
        assertThat(p.allowedActions()).containsExactly("PREGNANCY_CHECK", "PREGNANCY_UPDATE", "CALVING");
        assertThat(p.currentPregnancy().episodeId()).isEqualTo(episode.getId());
        assertThat(p.currentPregnancy().expectedDate()).isEqualTo(LocalDate.of(2026, 11, 30));
        assertThat(p.currentPregnancy().dueSoon()).isTrue();
        assertThat(p.currentPregnancy().daysPregnant()).isEqualTo(280L);
    }

    @Test
    void tcTuan110105TheTimelineFiltersByTypeNewestFirst() {
        world.event(cow, "ESTRUS", at(2026, 10, 1, 6, 0));
        world.breeding(cow, at(2026, 10, 1, 14, 0), null);
        world.event(cow, "ESTRUS", at(2026, 10, 22, 6, 0));

        ReproductionDtos.Profile p = service.profile(FARM_ID, cow.getId(), "estrus", null, null);

        assertThat(p.timeline()).extracting(ReproductionDtos.TimelineRow::at).containsExactly(at(2026, 10, 22, 6, 0), at(2026, 10, 1, 6, 0));
        assertThat(p.timeline()).extracting(ReproductionDtos.TimelineRow::kind).containsOnly("ESTRUS");
    }

    @Test
    void tcTuan110106AVoidedEventShowsItsReason() {
        ReproductionEvent voided = world.event(cow, "ESTRUS", at(2026, 10, 1, 6, 0));
        voided.setStatus("VOIDED");
        voided.setStatusReason("Ghi nhầm bò");

        ReproductionDtos.TimelineRow row = profile().timeline().get(0);

        assertThat(row.status()).isEqualTo("VOIDED");
        assertThat(row.voidReason()).isEqualTo("Ghi nhầm bò");
    }

    @Test
    void tcTuan110107ATechnicianSeesTheProfileWithoutRecordingRights() {
        role = FarmRole.TECHNICIAN;
        world.event(cow, "ESTRUS", at(2026, 10, 1, 6, 0));

        ReproductionDtos.Profile p = profile();

        assertThat(p.canManage()).isFalse();
        assertThat(p.timeline()).hasSize(1);
        assertThat(FarmAction.VIEW_REPRODUCTION.allows(FarmRole.TECHNICIAN)).isTrue();
    }

    @Test
    void tcTuan110108AnUnknownCattleIsNotFound() {
        DomainException error = domainError(() -> service.profile(FARM_ID, 9999L, null, null, null));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void tcTuan110109AUserWithoutFarmAccessIsRefused() {
        role = null;

        DomainException error = domainError(this::profile);

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(world.jpql.executed()).isEmpty();
    }

    @Test
    void tcTuan110110ACowWithoutAValidWeighingFailsTheWeightCondition() {
        world.weights.remove(cow.getId());

        ReproductionDtos.Profile p = profile();

        assertThat(p.eligibility().criteria()).filteredOn(c -> c.name().equals("MINIMUM_WEIGHT")).singleElement().satisfies(c -> {
            assertThat(c.met()).isFalse();
            assertThat(c.value()).isEqualTo(CattleStateService.NO_WEIGHING);
        });
        assertThat(p.latestWeight()).isNull();
    }

    @Test
    void tcTuan110111ServicesAreCountedSinceTheLastCalvingAndParityAddsTheDeclaredCalvings() {
        cow.setDeclaredParity(2);
        world.breeding(cow, at(2025, 10, 1, 8, 0), null);
        world.calving(cow, null, at(2026, 7, 10, 6, 0));
        world.breeding(cow, at(2026, 10, 1, 8, 0), null);
        world.breeding(cow, at(2026, 10, 22, 8, 0), null);

        ReproductionDtos.Profile p = profile();

        assertThat(p.servicesInCycle()).isEqualTo(2);
        assertThat(p.parity()).isEqualTo(3);
        assertThat(p.lastCalving().at()).isEqualTo(at(2026, 7, 10, 6, 0));
    }

    @Test
    void tcTuan110112ARecentCalvingShowsPostCalvingAndTheRecoveryCondition() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 11, 1, 6, 0));

        ReproductionDtos.Profile p = profile();

        assertThat(p.status()).isEqualTo("POST_CALVING");
        assertThat(p.statusSince()).isEqualTo(calved.getBirthTime());
        assertThat(p.eligibility().criteria()).filteredOn(c -> c.name().equals("POSTPARTUM_INTERVAL")).singleElement().satisfies(c -> {
            assertThat(c.met()).isFalse();
            assertThat(c.value()).isEqualTo("26");
        });
    }

    @Test
    void tcTuan110113TheCalvingHistoryListsEachCalf() {
        CalvingEvent calved = world.calving(cow, null, at(2026, 7, 10, 6, 0));
        world.calf(calved, 1, "LIVE", "PENDING_CONFIRMATION");
        world.calf(calved, 2, "STILLBORN", "NOT_REQUIRED");

        ReproductionDtos.Profile p = profile();

        assertThat(p.calvings()).singleElement().satisfies(row -> {
            assertThat(row.calvingId()).isEqualTo(calved.getId());
            assertThat(row.calves()).extracting(ReproductionDtos.CalfRow::outcome).containsExactly("LIVE", "STILLBORN");
        });
        assertThat(p.timeline()).extracting(ReproductionDtos.TimelineRow::kind).containsExactly("CALVING");
    }
}
