package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.PlatformFarmService.FarmOverview;
import vn.edu.fpt.beefcare.service.PlatformFarmService.FarmServicePage;
import vn.edu.fpt.beefcare.service.PlatformFarmService.ServiceChange;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE02-04 and UC-FE02-05:
 * {@link PlatformFarmService#overview} and {@link PlatformFarmService#suspend}.
 */
@ExtendWith(MockitoExtension.class)
class PlatformFarmServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");

    @Mock PlatformAccessService access;
    @Mock FarmRepository farms;
    @Mock AuditService audit;
    @Mock NotificationService notifications;
    @Mock FarmServiceFacts facts;

    private PlatformFarmService service;
    private AppUser pm;
    private AppUser owner;

    @BeforeEach
    void setUp() {
        service = new PlatformFarmService(access, farms, audit, notifications, facts);
        pm = user(5L, "Platform Manager", "pm@beefcare.test");
        owner = user(11L, "Nguyen Van Duc", "owner@beefcare.test");
    }

    private static AppUser user(long id, String name, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setFullName(name);
        user.setEmail(email);
        return user;
    }

    private static Farm farm(long id, String name, String status) {
        Farm farm = new Farm();
        farm.setId(id);
        farm.setName(name);
        farm.setServiceStatus(status);
        farm.setVersion(4);
        return farm;
    }

    private void signedInAsPm() {
        when(access.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(pm, null, PlatformRole.PM));
    }

    // ------------------------------------------------------------------ UC-FE02-04 overview()

    @SuppressWarnings("unchecked")
    private void farmsFound(Farm... rows) {
        when(farms.findAll(any(Specification.class))).thenReturn(List.of(rows));
    }

    @Test
    void tc0232TilesCountEveryFarmByStatusWithTheActivePercentage() {
        signedInAsPm();
        farmsFound();
        when(facts.farmsByStatus()).thenReturn(Map.of("ACTIVE", 6L, "EXPIRED", 2L, "PENDING_PAYMENT", 1L, "SUSPENDED", 1L));

        var tiles = service.overview(null, null, null, 0, 20).tiles();

        assertThat(tiles.total()).isEqualTo(10);
        assertThat(tiles.active()).isEqualTo(6);
        assertThat(tiles.activePercent()).isEqualTo(60);
        assertThat(tiles.pendingPayment()).isEqualTo(1);
        assertThat(tiles.expired()).isEqualTo(2);
        assertThat(tiles.suspended()).isEqualTo(1);
    }

    @Test
    void tcDuc020401WithoutAnyFarmTheActivePercentageIsZero() {
        signedInAsPm();
        farmsFound();
        when(facts.farmsByStatus()).thenReturn(Map.of());

        FarmServicePage page = service.overview(null, null, null, 0, 20);

        assertThat(page.tiles().total()).isZero();
        assertThat(page.tiles().activePercent()).isZero();
        assertThat(page.items()).isEmpty();
        assertThat(page.total()).isZero();
    }

    @Test
    void tcDuc020402RowsCarryTheOwnerLatestEndCattleCountAndTheSuspensionDateOfSuspendedFarms() {
        signedInAsPm();
        Farm active = farm(1L, "Trai A", "ACTIVE");
        Farm suspended = farm(2L, "Trai B", "SUSPENDED");
        farmsFound(active, suspended);
        Instant end = Instant.parse("2027-01-31T16:59:59Z");
        Instant suspendedAt = Instant.parse("2026-11-20T02:00:00Z");
        when(facts.owners(List.of(1L, 2L))).thenReturn(Map.of(1L, owner));
        when(facts.latestEnd(List.of(1L, 2L))).thenReturn(Map.of(1L, end));
        when(facts.activeCattle(List.of(1L, 2L))).thenReturn(Map.of(1L, 30L));
        when(facts.lastSuspension(List.of(2L))).thenReturn(Map.of(2L, new FarmServiceFacts.Suspension(suspendedAt, "PM", "Vi pham")));

        List<FarmOverview> rows = service.overview(null, null, null, 0, 20).items();

        assertThat(rows.get(0)).isEqualTo(new FarmOverview(1L, "Trai A", 11L, "Nguyen Van Duc", "owner@beefcare.test", "ACTIVE", end, false, null, 30L, 4));
        assertThat(rows.get(1).suspended()).isTrue();
        assertThat(rows.get(1).suspendedAt()).isEqualTo(suspendedAt);
        assertThat(rows.get(1).ownerEmail()).isNull();
        assertThat(rows.get(1).activeCattle()).isZero();
    }

    @Test
    void tcDuc020403TheDefaultOrderIsTheFarmNameIgnoringCase() {
        signedInAsPm();
        farmsFound(farm(1L, "trai c", "ACTIVE"), farm(2L, "Trai A", "ACTIVE"), farm(3L, "trai b", "ACTIVE"));

        assertThat(service.overview(null, null, null, 0, 20).items()).extracting(FarmOverview::farmId).containsExactly(2L, 3L, 1L);
    }

    @Test
    void tcDuc020404CoverageEndDescendingPutsFarmsWithoutAnEndLast() {
        signedInAsPm();
        farmsFound(farm(1L, "A", "PENDING_PAYMENT"), farm(2L, "B", "ACTIVE"), farm(3L, "C", "EXPIRED"));
        when(facts.latestEnd(List.of(1L, 2L, 3L))).thenReturn(Map.of(2L, Instant.parse("2027-01-01T00:00:00Z"), 3L, Instant.parse("2026-10-01T00:00:00Z")));

        assertThat(service.overview(null, null, "-coverageEnd", 0, 20).items()).extracting(FarmOverview::farmId).containsExactly(2L, 3L, 1L);
        assertThat(service.overview(null, null, "coverageEnd", 0, 20).items()).extracting(FarmOverview::farmId).containsExactly(3L, 2L, 1L);
    }

    @Test
    void tcDuc020405AnUnknownSortKeyIsRejectedWithMsgCom10BeforeTheFarmsAreRead() {
        signedInAsPm();

        assertThatThrownBy(() -> service.overview(null, null, "owner", 0, 20))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "sort");
            });
        verifyNoInteractions(farms);
    }

    @Test
    void tcDuc020406PagesAreClampedToOneThroughOneHundredRowsAndAPagePastTheEndIsEmpty() {
        signedInAsPm();
        Farm[] many = new Farm[105];
        for (int i = 0; i < many.length; i++) many[i] = farm(i + 1L, String.format("Trai %03d", i + 1), "ACTIVE");
        farmsFound(many);

        assertThat(service.overview(null, null, null, 0, 500).items()).hasSize(100);
        assertThat(service.overview(null, null, null, 0, 0).items()).hasSize(1);
        FarmServicePage past = service.overview(null, null, null, 9, 20);
        assertThat(past.items()).isEmpty();
        assertThat(past.total()).isEqualTo(105);
    }

    @Test
    void tc0230CustomerSupportOrSystemAdministratorCannotOpenTheOverview() {
        when(access.requireRole(PlatformRole.PM)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.overview(null, null, null, 0, 20))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(farms, facts);
    }

    // ------------------------------------------------------------------ UC-FE02-05 suspend()

    private Farm locked(String status) {
        Farm farm = farm(21L, "Trai Ba Vi", status);
        when(farms.lockById(21L)).thenReturn(Optional.of(farm));
        return farm;
    }

    private void ownerAndClock() {
        lenient().when(facts.owners(List.of(21L))).thenReturn(Map.of(21L, owner));
        lenient().when(facts.now()).thenReturn(NOW);
    }

    @Test
    void tc0220SuspendingAnActiveFarmStoresSuspendedWithAuditHistoryAndNotifiesTheOwner() {
        signedInAsPm();
        Farm farm = locked("ACTIVE");
        ownerAndClock();

        FarmOverview row = service.suspend(21L, new ServiceChange("  Vi pham dieu khoan  ", 4));

        assertThat(farm.getServiceStatus()).isEqualTo("SUSPENDED");
        assertThat(row.serviceStatus()).isEqualTo("SUSPENDED");
        assertThat(row.suspended()).isTrue();
        verify(farms).saveAndFlush(farm);
        verify(audit).logAt(farm, pm, "FARM_SERVICE_SUSPEND", "Farm", 21L,
            Map.of("statusBefore", "ACTIVE", "statusAfter", "SUSPENDED", "reason", "Vi pham dieu khoan"), NOW);
        ArgumentCaptor<String> summary = ArgumentCaptor.forClass(String.class);
        verify(notifications).notify(eq(owner), eq("service"), eq("Farm"), eq(21L), any(), summary.capture(), eq("FARM_SERVICE_SUSPEND:21:4"));
        assertThat(summary.getValue()).contains("Trai Ba Vi").contains("Tạm ngưng").endsWith("Vi pham dieu khoan");
    }

    @Test
    void tc0226APendingPaymentFarmCanAlsoBeSuspended() {
        signedInAsPm();
        Farm farm = locked("PENDING_PAYMENT");
        ownerAndClock();

        service.suspend(21L, new ServiceChange("Gian lan", 4));

        assertThat(farm.getServiceStatus()).isEqualTo("SUSPENDED");
        verify(audit).logAt(eq(farm), eq(pm), eq("FARM_SERVICE_SUSPEND"), eq("Farm"), eq(21L),
            eq(Map.of("statusBefore", "PENDING_PAYMENT", "statusAfter", "SUSPENDED", "reason", "Gian lan")), eq(NOW));
    }

    @Test
    void tc0227AFarmThatIsAlreadySuspendedGetsMsgFe0209AndNoNewHistoryEntry() {
        signedInAsPm();
        locked("SUSPENDED");

        assertThatThrownBy(() -> service.suspend(21L, new ServiceChange("Lan hai", 4)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE02_09);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                assertThat(error.getParams()).containsEntry("status", "SUSPENDED");
            });
        verify(farms, never()).saveAndFlush(any());
        verifyNoInteractions(audit, notifications);
    }

    @Test
    void tc0228ABlankReasonGetsMsgCom06AndA501CharacterReasonGetsMsgCom10() {
        signedInAsPm();

        assertThatThrownBy(() -> service.suspend(21L, new ServiceChange("   ", 4)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
                assertThat(error.getParams()).containsEntry("field", "reason");
            });
        assertThatThrownBy(() -> service.suspend(21L, new ServiceChange("R".repeat(501), 4)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10));
        verifyNoInteractions(farms, audit, notifications);
    }

    @Test
    void tcDuc020501AReasonOfExactlyFiveHundredCharactersIsAccepted() {
        signedInAsPm();
        Farm farm = locked("ACTIVE");
        ownerAndClock();

        service.suspend(21L, new ServiceChange("R".repeat(500), 4));

        assertThat(farm.getServiceStatus()).isEqualTo("SUSPENDED");
    }

    @Test
    void tcDuc020502AnOutdatedOrMissingVersionGetsMsgCom05AndTheFarmIsNotSaved() {
        signedInAsPm();
        Farm farm = locked("ACTIVE");

        assertThatThrownBy(() -> service.suspend(21L, new ServiceChange("Vi pham", 3)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05));
        assertThatThrownBy(() -> service.suspend(21L, new ServiceChange("Vi pham", null)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("reason", "expected_version_required"));
        assertThat(farm.getServiceStatus()).isEqualTo("ACTIVE");
        verify(farms, never()).saveAndFlush(any());
        verifyNoInteractions(audit, notifications);
    }

    @Test
    void tcDuc020503AnUnknownFarmGetsMsgCom08() {
        signedInAsPm();
        when(farms.lockById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.suspend(99L, new ServiceChange("Vi pham", 4)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
            });
        verifyNoInteractions(audit, notifications);
    }

    @Test
    void tc0230OnlyThePlatformManagerCanSuspendAFarm() {
        when(access.requireRole(PlatformRole.PM)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.suspend(21L, new ServiceChange("Vi pham", 4)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(farms, audit, notifications);
    }

    @Test
    void tcDuc020504AFarmWithoutAnActiveOwnerIsSuspendedWithoutANotification() {
        signedInAsPm();
        Farm farm = locked("EXPIRED");
        when(facts.owners(anyCollection())).thenReturn(Map.of());

        service.suspend(21L, new ServiceChange("Vi pham", 4));

        assertThat(farm.getServiceStatus()).isEqualTo("SUSPENDED");
        verify(audit).logAt(any(), any(), eq("FARM_SERVICE_SUSPEND"), any(), any(), any(), any());
        verifyNoInteractions(notifications);
    }

    @Test
    void tcDuc020505ALongNotificationSummaryIsCutToFiveHundredCharactersWithAnEllipsis() {
        signedInAsPm();
        locked("ACTIVE");
        ownerAndClock();

        service.suspend(21L, new ServiceChange("R".repeat(500), 4));

        ArgumentCaptor<String> summary = ArgumentCaptor.forClass(String.class);
        verify(notifications).notify(any(), any(), any(), any(), any(), summary.capture(), any());
        assertThat(summary.getValue()).hasSize(500).endsWith("…");
    }
}
