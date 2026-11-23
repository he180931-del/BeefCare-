package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-16 A1: canOpen / canCorrect follow the source permission and herd-status guard (R-16-06 … R-16-08). */
@ServiceIntegrationTest
@Transactional
class CattleTimelineServiceTest extends DomainTestSupport {

    @Autowired
    CattleTimelineService timeline;

    private Farm farm;
    private Cattle cow;
    private Growth weighing;

    static Stream<Arguments> exitStates() {
        return Stream.of(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.TECHNICIAN)
            .flatMap(role -> Stream.of(ExitLineStatus.values()).map(status -> Arguments.of(role, status)));
    }

    @ParameterizedTest
    @MethodSource("exitStates")
    void onlyOccurredExitsAreVisibleAndVoidsRequireTheToggle(FarmRole role, ExitLineStatus status) {
        AppUser actor = memberWithRole(farm, role);
        HerdExitVoucher voucher = exitVoucher(farm, actor, partner(farm, actor, false, true), 1000, 0, ExitVoucherStatus.DRAFT);
        voucher.setConfirmedAt(Instant.parse("2026-10-26T03:00:00Z"));
        voucher.setConfirmedBy(actor);
        voucher.setCloseReason("Hủy phiếu bị ghi trùng");
        HerdExit line = exitLine(voucher, cow, 1, status);
        actAs(actor);
        for (boolean show : List.of(false, true)) {
            List<CattleTimelineService.Event> exits = timeline.timeline(farm.getId(), cow.getId(), "ENTRY_EXIT", show);
            boolean visible = status == ExitLineStatus.CONFIRMED || (status == ExitLineStatus.VOIDED && show);
            assertThat(exits).hasSize(visible ? 1 : 0);
            if (!visible) continue;
            CattleTimelineService.Event event = exits.get(0);
            assertThat(event.occurredAt()).isEqualTo(Instant.parse("2026-10-25T17:00:00Z"));
            assertThat(event.recordedAt()).isEqualTo(voucher.getConfirmedAt());
            assertThat(event.recorder()).isEqualTo(actor.getFullName());
            assertThat(event.canCorrect()).isFalse();
            if (status == ExitLineStatus.VOIDED) assertThat(event.values()).containsEntry("reason", voucher.getCloseReason());
            if (role == FarmRole.TECHNICIAN) {
                assertThat(event.sourceId()).isNull();
                assertThat(event.canOpen()).isFalse();
                assertThat(event.values()).containsOnlyKeys("exitType", "date", "reason");
            } else {
                assertThat(event.sourceId()).isEqualTo(line.getId());
                assertThat(event.values()).containsEntry("voucherCode", voucher.getCode());
            }
        }
    }

    @Test
    void missingExitConfirmationMetadataStaysNull() {
        AppUser actor = memberWithRole(farm, FarmRole.OWNER);
        exitLine(exitVoucher(farm, actor, partner(farm, actor, false, true), 1000, 0, ExitVoucherStatus.CONFIRMED), cow, 1, ExitLineStatus.CONFIRMED);
        actAs(actor);
        var event = timeline.timeline(farm.getId(), cow.getId(), "ENTRY_EXIT", false).get(0);
        assertThat(event.recorder()).isNull();
        assertThat(event.recordedAt()).isNull();
    }

    @Test
    void careUsesObservationRecorderAndEarliestScopedTreatmentAuditIncludingIdTieBreak() {
        AppUser creator = memberWithRole(farm, FarmRole.MANAGER);
        AppUser editor = memberWithRole(farm, FarmRole.OWNER);
        HealthCase health = new HealthCase();
        health.setCattle(cow); health.setOpenedDate(TODAY); health.setStatus("OPEN"); save(health);
        HealthObservation observation = new HealthObservation();
        observation.setHealthCase(health); observation.setObservedTime(clock.instant()); observation.setEntryTime(clock.instant());
        observation.setUpdatedAt(clock.instant()); observation.setSignsProgress("Đang theo dõi"); observation.setRecorder(creator); save(observation);
        Treatment first = treatment(health);
        Treatment second = treatment(health);
        Treatment unaudited = treatment(health);
        Treatment anonymous = treatment(health);
        audit(first, creator, farm, "HEALTH_TREATMENT", clock.instant());
        audit(first, editor, farm, "HEALTH_TREATMENT", clock.instant());
        audit(first, editor, farm, "HEALTH_TREATMENT", clock.instant().plusSeconds(1));
        audit(second, editor, farm, "HEALTH_TREATMENT", clock.instant());
        audit(second, creator, farm(), "HEALTH_TREATMENT", clock.instant().minusSeconds(2));
        audit(second, creator, farm, "HEALTH_TREATMENT_CORRECT", clock.instant().minusSeconds(2));
        audit(anonymous, null, farm, "HEALTH_TREATMENT", clock.instant());
        audit(anonymous, creator, farm, "HEALTH_TREATMENT", clock.instant().plusSeconds(1));
        actAs(editor);
        var statistics = em.getEntityManagerFactory().unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        List<CattleTimelineService.Event> events;
        try {
            statistics.setStatisticsEnabled(true);
            statistics.clear();
            events = timeline.timeline(farm.getId(), cow.getId(), "HEALTH", false);
            assertThat(java.util.Arrays.stream(statistics.getQueries()).filter(query -> query.contains("a.targetType='Treatment'")))
                .singleElement().satisfies(query -> assertThat(statistics.getQueryStatistics(query).getExecutionCount()).isEqualTo(1));
        } finally {
            statistics.setStatisticsEnabled(enabled);
        }
        assertThat(events).filteredOn(e -> "HEALTH_OBSERVATION".equals(e.type())).extracting(CattleTimelineService.Event::recorder).containsExactly(creator.getFullName());
        assertThat(events).filteredOn(e -> first.getId().equals(e.sourceId())).extracting(CattleTimelineService.Event::recorder).containsExactly(creator.getFullName());
        assertThat(events).filteredOn(e -> second.getId().equals(e.sourceId())).extracting(CattleTimelineService.Event::recorder).containsExactly(editor.getFullName());
        assertThat(events).filteredOn(e -> unaudited.getId().equals(e.sourceId())).extracting(CattleTimelineService.Event::recorder).containsExactly((String) null);
        assertThat(events).filteredOn(e -> anonymous.getId().equals(e.sourceId())).extracting(CattleTimelineService.Event::recorder).containsExactly((String) null);
        observation.setRecorder(null);
        assertThat(timeline.timeline(farm.getId(), cow.getId(), "HEALTH", false)).filteredOn(e -> "HEALTH_OBSERVATION".equals(e.type()))
            .extracting(CattleTimelineService.Event::recorder).containsExactly((String) null);
    }

    private Treatment treatment(HealthCase health) {
        Treatment t = new Treatment(); t.setHealthCase(health); t.setTreatmentTime(clock.instant()); t.setEntryTime(clock.instant());
        t.setUpdatedAt(clock.instant()); t.setTreatmentDetail("Điều trị"); t.setDose("1 ml"); t.setRoute("IM");
        t.setWithdrawalPeriod("0"); t.setResult("PENDING"); return save(t);
    }

    private void audit(Treatment treatment, AppUser actor, Farm scope, String action, Instant time) {
        AuditLog a = new AuditLog(); a.setFarm(scope); a.setActor(actor); a.setAction(action); a.setTargetType("Treatment");
        a.setTargetId(treatment.getId()); a.setLoggedAt(time); save(a);
    }

    static Stream<Arguments> vaccinationSnapshots() {
        return Stream.of(
            Arguments.of(Map.of("administeredAt", "2026-10-01T03:00:00Z"), "2026-10-01T03:00:00Z"),
            Arguments.of(Map.of("vaccinationDate", "2026-10-01"), "2026-09-30T17:00:00Z"),
            Arguments.of(Map.of("administeredAt", "bad", "vaccinationDate", "2026-10-01"), "2026-09-30T17:00:00Z"),
            Arguments.of(Map.of("administeredAt", "bad", "vaccinationDate", "bad"), "2026-10-03T03:00:00Z"),
            Arguments.of(Map.of(), "2026-10-03T03:00:00Z")
        );
    }

    @ParameterizedTest
    @MethodSource("vaccinationSnapshots")
    void vaccinationRevisionKeepsItsOwnTimeAndCurrentRecordKeepsWithdrawalDays(Map<String, Object> snapshot, String expected) {
        AppUser actor = memberWithRole(farm, FarmRole.MANAGER);
        Vaccine vaccine = new Vaccine(); vaccine.setFarm(farm); vaccine.setCode("VAC" + next()); vaccine.setName("Vắc-xin B");
        vaccine.setDiseasePrevented("LMLM"); vaccine.setWithdrawalInfo("21"); vaccine.setAvailable(true); save(vaccine);
        Vaccination v = new Vaccination(); v.setCattle(cow); v.setVaccine(vaccine); v.setVaccinationDate(TODAY);
        v.setAdministeredAt(Instant.parse("2026-10-03T03:00:00Z")); v.setEntryTime(clock.instant()); v.setSource("ON_FARM");
        v.setDose("1 ml"); v.setVaccinator("Người tiêm"); v.setWithdrawalDays(21); save(v);
        RecordRevision r = new RecordRevision(); r.setFarm(farm); r.setSourceType("Vaccination"); r.setSourceId(v.getId());
        r.setAction("CORRECT"); r.setActor(actor); r.setChangedAt(clock.instant()); r.setBeforeSnapshot(JsonSupport.toJson(snapshot)); save(r);
        actAs(actor);
        var events = timeline.timeline(farm.getId(), cow.getId(), "VACCINATION", true);
        assertThat(events).filteredOn(e -> "REVISION".equals(e.type())).extracting(CattleTimelineService.Event::occurredAt).containsExactly(Instant.parse(expected));
        assertThat(events).filteredOn(e -> "VACCINATION_RECORD".equals(e.type())).extracting(e -> e.values().get("withdrawalDays")).containsExactly(21);
    }

    @BeforeEach
    void setUp() {
        farm = farm();
        cow = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
        weighing = weight(cow, TODAY.minusDays(3), "320");
    }

    private CattleTimelineService.Event growthEvent() {
        return timeline.timeline(farm.getId(), cow.getId(), "GROWTH", true).stream()
            .filter(e -> "GROWTH_ASSESSMENT".equals(e.type())).findFirst().orElseThrow();
    }

    @Test
    void tc1609ManagerMayCorrectAValidGrowthRecordAndGetsItsId() {
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        CattleTimelineService.Event e = growthEvent();
        assertThat(e.canCorrect()).isTrue();
        assertThat(e.canOpen()).isTrue();
        assertThat(e.sourceId()).isEqualTo(weighing.getId());
    }

    @Test
    void tc1610TechnicianSeesTheRecordButCannotCorrectIt() {
        actAs(memberWithRole(farm, FarmRole.TECHNICIAN));
        assertThat(growthEvent().canCorrect()).isFalse();
        assertThat(growthEvent().canOpen()).isTrue();
    }

    /** D41 (TC-16-17): the Owner corrects from the timeline like a Manager. */
    @Test
    void tc1617OwnerMayCorrectAValidGrowthRecord() {
        actAs(memberWithRole(farm, FarmRole.OWNER));
        CattleTimelineService.Event e = growthEvent();
        assertThat(e.canCorrect()).isTrue();
        assertThat(e.sourceId()).isEqualTo(weighing.getId());
    }

    @Test
    void anExcludedRecordIsNeverCorrectable() {
        weighing.setStatus("EXCLUDED");
        em.flush();
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        assertThat(growthEvent().canCorrect()).isFalse();
        // and it is hidden unless corrections are shown (R-16-04)
        assertThat(timeline.timeline(farm.getId(), cow.getId(), "GROWTH", false)).isEmpty();
    }

    @Test
    void tc1612ExitedCattleKeepTheirHistoryReadOnly() {
        cow.setHerdStatus(HerdStatus.EXITED);
        em.flush();
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        CattleTimelineService.Event e = growthEvent();
        assertThat(e.canOpen()).isTrue();
        assertThat(e.canCorrect()).isFalse();
    }

    @Test
    void tc1613CattleOfAnotherFarmIsNotFound() {
        Farm other = farm();
        actAs(memberWithRole(other, FarmRole.MANAGER));
        assertThatThrownBy(() -> timeline.timeline(other.getId(), cow.getId(), null, false))
            .isInstanceOfSatisfying(DomainException.class, ex -> assertThat(ex.getCode()).isEqualTo(MessageCodes.COM_08));
    }
}
