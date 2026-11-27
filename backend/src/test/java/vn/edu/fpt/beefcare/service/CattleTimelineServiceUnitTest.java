package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.PregnancyUpdate;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ReplacementReason;

/**
 * Unit tests (Mockito, no Spring context, no database) for {@link CattleTimelineService#timeline}, the main function of
 * UC-FE16-01 View Cattle Activity Timeline. Each JPQL query returns the rows of its entity type from an in-memory map;
 * the service is a read-only projection, so the tests also check that it never writes. Dates are in UTC+7.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CattleTimelineServiceUnitTest {

    private static final long FARM_ID = 501L;

    @Mock EntityManager em;
    @Mock FarmAccessService access;

    private CattleTimelineService service;
    private Farm farm;
    private Cattle cow;
    private AppUser an;
    private final Map<Class<?>, List<Object>> rows = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new CattleTimelineService(em, access);
        farm = new Farm();
        farm.setId(FARM_ID);
        an = new AppUser();
        an.setId(31L);
        an.setFullName("Nguyen Thanh An");
        cow = new Cattle();
        cow.setId(101L);
        cow.setFarm(farm);
        cow.setDisplayCode("BO-0101");
        cow.setHerdStatus(HerdStatus.ACTIVE);
        when(em.find(Cattle.class, 101L)).thenReturn(cow);
        viewer(FarmRole.MANAGER);
        when(em.createQuery(anyString(), any(Class.class))).thenAnswer(inv -> query(rows.getOrDefault(inv.<Class<?>>getArgument(1), List.of())));
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> query(List<?> result) {
        TypedQuery<T> q = mock(TypedQuery.class, RETURNS_SELF);
        when(q.getResultList()).thenReturn((List<T>) result);
        return q;
    }

    private void viewer(FarmRole role) {
        when(access.require(FARM_ID, FarmAction.VIEW_CATTLE)).thenReturn(new FarmContext(farm, an, role));
    }

    private void add(Object row) {
        rows.computeIfAbsent(row.getClass(), k -> new ArrayList<>()).add(row);
    }

    private static Instant at(String date) {
        return LocalDate.parse(date).atStartOfDay(FarmTimeZones.OFFSET).toInstant();
    }

    private Growth growth(long id, String checkDate, String recorded, String weight, String status, boolean corrected) {
        Growth g = new Growth();
        g.setId(id);
        g.setCattle(cow);
        g.setCheckDate(LocalDate.parse(checkDate));
        g.setEntryTime(at(recorded).plusSeconds(3600));
        g.setWeightKg(new BigDecimal(weight));
        g.setStatus(status);
        g.setCorrected(corrected);
        g.setMeasuredBy(an);
        add(g);
        return g;
    }

    private Vaccination vaccination(long id, String date, String recorded, String status) {
        Vaccination v = new Vaccination();
        v.setId(id);
        v.setCattle(cow);
        v.setVaccinationDate(LocalDate.parse(date));
        v.setEntryTime(at(recorded).plusSeconds(7200));
        v.setVaccineNameSnapshot("LMLM");
        v.setVaccinator("Tran Thu Y");
        v.setStatus(status);
        add(v);
        return v;
    }

    private PenAssignment placement(long id, String from) {
        Pen pen = new Pen();
        pen.setId(11L);
        pen.setCode("A-01");
        PenAssignment p = new PenAssignment();
        p.setId(id);
        p.setCattle(cow);
        p.setPen(pen);
        p.setFromDate(LocalDate.parse(from));
        p.setSource(AssignmentSource.MOVE);
        p.setRecordedAt(at(from).plusSeconds(600));
        p.setMovedBy(an);
        add(p);
        return p;
    }

    private List<CattleTimelineService.Event> timeline(String category, boolean showCorrections) {
        return service.timeline(FARM_ID, 101L, category, showCorrections);
    }

    private static CattleTimelineService.Event only(List<CattleTimelineService.Event> events, String type) {
        return events.stream().filter(e -> e.type().equals(type)).findFirst().orElseThrow();
    }

    @Test
    void tc1601EventsOfEverySourceComeNewestFirstWithBothTimesAndTheRecorder() {
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);
        vaccination(2L, "2026-10-12", "2026-10-12", "VALID");
        placement(3L, "2026-10-20");

        List<CattleTimelineService.Event> events = timeline(null, false);

        assertThat(events).extracting(CattleTimelineService.Event::type).containsExactly("PEN_ASSIGNMENT", "VACCINATION_RECORD", "GROWTH_ASSESSMENT");
        assertThat(events).allSatisfy(e -> {
            assertThat(e.occurredAt()).isNotNull();
            assertThat(e.recordedAt()).isNotNull();
        });
        assertThat(only(events, "GROWTH_ASSESSMENT").recorder()).isEqualTo("Nguyen Thanh An");
        assertThat(only(events, "VACCINATION_RECORD").recorder()).isEqualTo("Tran Thu Y");
        assertThat(only(events, "PEN_ASSIGNMENT").values()).containsEntry("penCode", "A-01");
    }

    @Test
    void tc1602TheOrderFollowsWhenTheEventHappenedNotWhenItWasRecorded() {
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);
        vaccination(2L, "2026-10-03", "2026-10-03", "VALID");

        List<CattleTimelineService.Event> events = timeline(null, false);

        assertThat(events).extracting(CattleTimelineService.Event::type).containsExactly("VACCINATION_RECORD", "GROWTH_ASSESSMENT");
        assertThat(events.get(1).occurredAt()).isEqualTo(at("2026-10-01"));
        assertThat(events.get(1).recordedAt()).isAfter(events.get(0).recordedAt());
    }

    @Test
    void tc1603ACorrectedWeighingShowsTheNewValueAndIsMarkedCorrected() {
        growth(1L, "2026-10-01", "2026-10-05", "324", "VALID", true);

        CattleTimelineService.Event event = only(timeline(null, false), "GROWTH_ASSESSMENT");

        assertThat(event.values()).containsEntry("weightKg", new BigDecimal("324"));
        assertThat(event.corrected()).isTrue();
    }

    @Test
    void tc1604ExcludedAndVoidedRecordsAreHiddenUnlessCorrectionsAreShown() {
        Growth outlier = growth(1L, "2026-10-01", "2026-10-05", "900", "EXCLUDED", false);
        outlier.setCorrectionReason("Can sai, ngoai le");
        Vaccination voided = vaccination(2L, "2026-10-03", "2026-10-03", "VOIDED");
        voided.setStatusReason("Ghi nham bo");

        assertThat(timeline(null, false)).isEmpty();
        List<CattleTimelineService.Event> shown = timeline(null, true);
        assertThat(only(shown, "GROWTH_ASSESSMENT").status()).isEqualTo("EXCLUDED");
        assertThat(only(shown, "GROWTH_ASSESSMENT").values()).containsEntry("reason", "Can sai, ngoai le");
        assertThat(only(shown, "VACCINATION_RECORD").values()).containsEntry("reason", "Ghi nham bo");
        assertThat(shown).allSatisfy(e -> assertThat(e.canCorrect()).isFalse());
    }

    @Test
    void tc1605PlannedDosesAndRemindersAreNotEvents() {
        ScheduledDose planned = new ScheduledDose();
        planned.setStatus("PLANNED");
        add(planned);
        Reminder rem01 = new Reminder();
        rem01.setRuleType("REM-01");
        add(rem01);

        assertThat(timeline(null, false)).isEmpty();
        verify(em, never()).createQuery(anyString(), eq(ScheduledDose.class));
        verify(em, never()).createQuery(anyString(), eq(Reminder.class));
    }

    @Test
    void tc1606TheReproductionChipKeepsOnlyReproductionEvents() {
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);
        ReproductionEvent breeding = new ReproductionEvent();
        breeding.setId(4L);
        breeding.setType("BREEDING");
        breeding.setEventTime(at("2026-10-10"));
        breeding.setStatus("VALID");
        add(breeding);
        PregnancyEpisode episode = new PregnancyEpisode();
        episode.setId(9L);
        PregnancyUpdate update = new PregnancyUpdate();
        update.setId(5L);
        update.setEpisode(episode);
        update.setOccurredTime(at("2026-11-01"));
        update.setStatus("VALID");
        add(update);
        CalvingEvent calving = new CalvingEvent();
        calving.setId(6L);
        calving.setDam(cow);
        calving.setBirthTime(at("2026-11-20"));
        calving.setStatus("VALID");
        add(calving);

        List<CattleTimelineService.Event> events = timeline("REPRODUCTION", false);

        assertThat(events).extracting(CattleTimelineService.Event::type).containsExactly("CALVING_EVENT", "PREGNANCY_UPDATE", "BREEDING");
        assertThat(events).allSatisfy(e -> assertThat(e.category()).isEqualTo("REPRODUCTION"));
    }

    private HerdExit confirmedExit() {
        HerdExitVoucher voucher = new HerdExitVoucher();
        voucher.setId(71L);
        voucher.setCode("PX-2611-004");
        voucher.setExitType(ExitType.SALE);
        voucher.setExitDate(LocalDate.parse("2026-11-20"));
        voucher.setConfirmedAt(at("2026-11-20").plusSeconds(3600));
        voucher.setConfirmedBy(an);
        voucher.setCattleAmount(31_500_000L);
        HerdExit line = new HerdExit();
        line.setId(601L);
        line.setVoucher(voucher);
        line.setCattle(cow);
        line.setStatus(ExitLineStatus.CONFIRMED);
        add(line);
        return line;
    }

    @Test
    void tc1607ATechnicianSeesTheExitWithoutVoucherOrMoney() {
        viewer(FarmRole.TECHNICIAN);
        confirmedExit();

        CattleTimelineService.Event exit = only(timeline(null, false), "HERD_EXIT");

        assertThat(exit.values()).containsEntry("exitType", ExitType.SALE).containsKey("date");
        assertThat(exit.values()).doesNotContainKeys("voucherId", "voucherCode", "amount", "buyer");
        assertThat(exit.sourceId()).isNull();
        assertThat(exit.canOpen()).isFalse();
    }

    @Test
    void tc1608ATechnicianCannotOpenTheEntryVoucherFromTheTimeline() {
        viewer(FarmRole.TECHNICIAN);
        HerdEntryVoucher voucher = new HerdEntryVoucher();
        voucher.setId(81L);
        voucher.setCode("PN-2611-001");
        voucher.setCreatedBy(an);
        HerdEntry entry = new HerdEntry();
        entry.setId(91L);
        entry.setVoucher(voucher);
        entry.setCattle(cow);
        entry.setEntryDate(LocalDate.parse("2026-11-05"));
        entry.setStatus(EntryLineStatus.VALID);
        add(entry);

        CattleTimelineService.Event event = only(timeline(null, false), "HERD_ENTRY");

        assertThat(event.canOpen()).isFalse();
        assertThat(event.sourceId()).isNull();
        assertThat(event.values()).doesNotContainKeys("voucherId", "voucherCode");
        viewer(FarmRole.MANAGER);
        CattleTimelineService.Event managerView = only(timeline(null, false), "HERD_ENTRY");
        assertThat(managerView.canOpen()).isTrue();
        assertThat(managerView.values()).containsEntry("voucherCode", "PN-2611-001");
    }

    @Test
    void tc1609AManagerCanCorrectAWeighingFromTheTimeline() {
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);

        assertThat(only(timeline(null, false), "GROWTH_ASSESSMENT").canCorrect()).isTrue();
    }

    @Test
    void tc1610ATechnicianCannotCorrectFromTheTimeline() {
        viewer(FarmRole.TECHNICIAN);
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);
        vaccination(2L, "2026-10-03", "2026-10-03", "VALID");

        assertThat(timeline(null, true)).allSatisfy(e -> assertThat(e.canCorrect()).isFalse());
    }

    @Test
    void tc1617TheOwnerCanCorrectWeighingVaccinationAndReproductionButNotAPenMove() {
        viewer(FarmRole.OWNER);
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);
        vaccination(2L, "2026-10-03", "2026-10-03", "VALID");
        ReproductionEvent estrus = new ReproductionEvent();
        estrus.setId(4L);
        estrus.setType("ESTRUS");
        estrus.setEventTime(at("2026-10-08"));
        estrus.setStatus("VALID");
        add(estrus);
        placement(3L, "2026-10-20");

        List<CattleTimelineService.Event> events = timeline(null, false);

        assertThat(only(events, "GROWTH_ASSESSMENT").canCorrect()).isTrue();
        assertThat(only(events, "VACCINATION_RECORD").canCorrect()).isTrue();
        assertThat(only(events, "ESTRUS").canCorrect()).isTrue();
        assertThat(only(events, "PEN_ASSIGNMENT").canCorrect()).isFalse();
    }

    @Test
    void tc1612AnExitedCattleShowsItsWholeHistoryReadOnly() {
        cow.setHerdStatus(HerdStatus.EXITED);
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);
        vaccination(2L, "2026-10-03", "2026-10-03", "VALID");
        confirmedExit();

        List<CattleTimelineService.Event> events = timeline(null, false);

        assertThat(events).extracting(CattleTimelineService.Event::type).containsExactly("HERD_EXIT", "VACCINATION_RECORD", "GROWTH_ASSESSMENT");
        assertThat(events).allSatisfy(e -> assertThat(e.canCorrect()).isFalse());
    }

    @Test
    void tc1613ACattleOfAnotherFarmIsNotFound() {
        Farm other = new Farm();
        other.setId(999L);
        cow.setFarm(other);

        Throwable thrown = catchThrowable(() -> timeline(null, false));

        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(MessageCodes.COM_08);
        verify(em, never()).createQuery(anyString(), any(Class.class));
    }

    @Test
    void tcAnnt160101AnUnknownCattleIsNotFound() {
        when(em.find(Cattle.class, 101L)).thenReturn(null);

        Throwable thrown = catchThrowable(() -> timeline(null, false));

        assertThat(((DomainException) thrown).getCode()).isEqualTo(MessageCodes.COM_08);
    }

    @Test
    void tc1614ReadingTheTimelineTwiceWritesNothing() {
        growth(1L, "2026-10-01", "2026-10-05", "320", "VALID", false);

        List<CattleTimelineService.Event> first = timeline(null, true);
        List<CattleTimelineService.Event> second = timeline(null, true);

        assertThat(second).isEqualTo(first);
        verify(em, never()).persist(any());
        verify(em, never()).merge(any());
        verify(em, never()).remove(any());
        verify(em, never()).flush();
    }

    @Test
    void tc1615AReplacedQrTagIsAnIdentificationEventWithItsReason() {
        CattleQrTag q1 = new CattleQrTag();
        q1.setId(601L);
        q1.setCattle(cow);
        q1.setTagCode("Q1");
        q1.setStatus(QrTagStatus.REPLACED);
        q1.setReplacementReason(ReplacementReason.LOST);
        q1.setIssuedAt(at("2026-10-10"));
        q1.setIssuedBy(an);
        add(q1);

        List<CattleTimelineService.Event> events = timeline("IDENTIFICATION_QR", false);

        assertThat(events).singleElement().satisfies(e -> {
            assertThat(e.type()).isEqualTo("QR_ISSUED");
            assertThat(e.status()).isEqualTo("REPLACED");
            assertThat(e.values()).containsEntry("tagCode", "Q1").containsEntry("reason", ReplacementReason.LOST);
        });
    }

    @Test
    void tc1616ADateOnlyEventStartsAtMidnightInUtcPlusSeven() {
        growth(1L, "2026-12-01", "2026-12-01", "320", "VALID", false);

        CattleTimelineService.Event event = only(timeline(null, false), "GROWTH_ASSESSMENT");

        assertThat(event.occurredAt()).isEqualTo(Instant.parse("2026-11-30T17:00:00Z"));
    }

    @Test
    void tcAnnt160102ShowingCorrectionsAddsEachRevisionWithItsOriginalValues() {
        growth(1L, "2026-10-01", "2026-10-05", "324", "VALID", true);
        RecordRevision revision = new RecordRevision();
        revision.setId(555L);
        revision.setSourceType("GROWTH_ASSESSMENT");
        revision.setSourceId(1L);
        revision.setAction("CORRECT");
        revision.setReason("Can lai");
        revision.setActor(an);
        revision.setChangedAt(at("2026-10-06"));
        revision.setBeforeSnapshot("{\"weightKg\":342,\"measuredAt\":\"2026-10-01T02:00:00Z\"}");
        add(revision);

        List<CattleTimelineService.Event> events = timeline(null, true);

        CattleTimelineService.Event rev = only(events, "REVISION");
        assertThat(rev.values()).containsKey("original");
        @SuppressWarnings("unchecked")
        Map<String, Object> original = (Map<String, Object>) rev.values().get("original");
        assertThat(original).containsEntry("weightKg", 342);
        assertThat(rev.occurredAt()).isEqualTo(Instant.parse("2026-10-01T02:00:00Z"));
        assertThat(rev.correction()).containsEntry("reason", "Can lai").containsEntry("sourceId", 1L);
        assertThat(rev.canOpen()).isFalse();
        assertThat(rev.canCorrect()).isFalse();
        assertThat(timeline(null, false)).extracting(CattleTimelineService.Event::type).doesNotContain("REVISION");
    }

    @Test
    void tcAnnt160103AViewerWithoutAccessToTheFarmReadsNothing() {
        when(access.require(FARM_ID, FarmAction.VIEW_CATTLE)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> timeline(null, false));

        assertThat(((DomainException) thrown).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(em);
    }
}
