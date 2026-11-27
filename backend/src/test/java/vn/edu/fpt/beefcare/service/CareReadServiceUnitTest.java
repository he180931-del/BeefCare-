package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HealthObservation;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.Treatment;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the read functions of UC-FE09-05 View Vaccination History
 * ({@link CareReadService#vaccinationHistory}) and UC-FE10-01 View Health Cases and Treatment History
 * ({@link CareReadService#healthCases}). Vaccinations, health cases, opening observations, treatments, pen placements
 * and revisions live in memory behind {@link FakeJpql}, which applies the farm, period and status conditions written in
 * the queries (the tests also check that the service writes them); the farm access check applies the real
 * {@link FarmAction} role table. The farm clock is fixed at 27/11/2026 10:00 (UTC+7).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CareReadServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final long FARM_ID = 960L;

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock CattleStateService state;

    private CareReadService service;
    private FakeJpql jpql;
    private Farm farm;
    private Breed brahman;
    private FarmRole role = FarmRole.MANAGER;
    private final List<Cattle> herd = new ArrayList<>();
    private final List<PenAssignment> placements = new ArrayList<>();
    private final List<Vaccination> vaccinations = new ArrayList<>();
    private final List<HealthObservation> observations = new ArrayList<>();
    private final List<HealthCase> cases = new ArrayList<>();
    private final List<Treatment> treatments = new ArrayList<>();
    private final List<RecordRevision> revisions = new ArrayList<>();
    private long nextId = 4000L;

    @BeforeEach
    void setUp() {
        service = new CareReadService(access, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), state);
        ReflectionTestUtils.setField(service, "em", em);
        farm = new Farm();
        farm.setId(FARM_ID);
        brahman = new Breed();
        brahman.setName("Brahman");
        when(access.require(eq(FARM_ID), any(FarmAction.class))).thenAnswer(inv -> {
            FarmAction action = inv.getArgument(1);
            if (role == null || !action.allows(role)) {
                throw DomainException.forbidden(MessageCodes.COM_01);
            }
            AppUser user = new AppUser();
            user.setId(31L);
            return new FarmContext(farm, user, role);
        });

        jpql = new FakeJpql(em)
            .on("from Vaccination v join fetch v.cattle c", p -> vaccinations.stream()
                .filter(v -> v.getCattle().getFarm().getId().equals(p.get("farm")))
                .filter(v -> !v.getVaccinationDate().isBefore((LocalDate) p.get("from")) && !v.getVaccinationDate().isAfter((LocalDate) p.get("to")))
                .filter(v -> !"VOIDED".equals(v.getStatus()))
                .sorted(Comparator.comparing(Vaccination::getVaccinationDate).thenComparing(Vaccination::getId).reversed()).toList())
            .on("from PenAssignment p join fetch p.pen", p -> placements)
            .on("from HealthObservation o where o.vaccination.id=:id", p -> observations.stream()
                .filter(o -> o.getVaccination() != null && o.getVaccination().getId().equals(p.get("id")) && "VALID".equals(o.getStatus())).toList())
            .on("from RecordRevision r", p -> revisions.stream().filter(r -> ((Collection<?>) p.get("ids")).contains(r.getSourceId())).toList())
            .on("from HealthCase h join fetch h.cattle c", p -> cases.stream().filter(h -> h.getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from HealthObservation o where o.healthCase.cattle.farm.id=:farm and o.opening=true", p -> observations.stream()
                .filter(o -> Boolean.TRUE.equals(o.getOpening())).map(o -> new Object[] { o.getHealthCase().getId(), o.getObservedTime(), o.getSignsProgress(), o.getId() }).toList())
            .on("from Treatment t where t.healthCase.cattle.farm.id=:farm", p -> treatments.stream().filter(t -> "VALID".equals(t.getStatus()))
                .collect(Collectors.groupingBy(t -> t.getHealthCase().getId(), Collectors.counting())).entrySet().stream()
                .map(e -> new Object[] { e.getKey(), e.getValue() }).toList());
    }

    // ------------------------------------------------------------------ fixtures

    private Cattle cattle(String code, String earTag, long penId) {
        Cattle c = new Cattle();
        c.setId(nextId++);
        c.setDisplayCode(code);
        c.setEarTagNumber(earTag);
        c.setFarm(farm);
        c.setBreed(brahman);
        c.setSex(Sex.MALE);
        herd.add(c);
        Pen pen = new Pen();
        pen.setId(penId);
        pen.setCode(penId == 11L ? "A-01" : "B-01");
        pen.setName("Chuồng " + pen.getCode());
        PenAssignment a = new PenAssignment();
        a.setCattle(c);
        a.setPen(pen);
        placements.add(a);
        return c;
    }

    private Vaccine vaccine(long id, String name) {
        Vaccine v = new Vaccine();
        v.setId(id);
        v.setName(name);
        return v;
    }

    private Vaccination vaccination(Cattle c, Vaccine v, LocalDate day, String source, String status) {
        Vaccination record = new Vaccination();
        record.setId(nextId++);
        record.setCattle(c);
        record.setVaccine(v);
        record.setVaccineNameSnapshot(v == null ? null : v.getName());
        record.setVaccinationDate(day);
        record.setAdministeredAt("ON_FARM".equals(source) ? day.atTime(8, 0).toInstant(ZoneOffset.ofHours(7)) : null);
        record.setSource(source);
        record.setStatus(status);
        record.setWithdrawalDays("ON_FARM".equals(source) ? 21 : null);
        record.setWithdrawalEndDate("ON_FARM".equals(source) ? day.plusDays(21) : null);
        vaccinations.add(record);
        return record;
    }

    private HealthCase healthCase(Cattle c, String code, String status, LocalDate opened, String severity) {
        HealthCase h = new HealthCase();
        h.setId(nextId++);
        h.setCattle(c);
        h.setCaseCode(code);
        h.setStatus(status);
        h.setOpenedDate(opened);
        h.setSeverity(severity);
        if ("CLOSED".equals(status)) {
            h.setOutcome("RECOVERED");
            h.setClosedDate(opened.plusDays(5));
        }
        cases.add(h);
        HealthObservation opening = new HealthObservation();
        opening.setId(nextId++);
        opening.setHealthCase(h);
        opening.setOpening(true);
        opening.setObservedTime(opened.atTime(8, 0).toInstant(ZoneOffset.ofHours(7)));
        opening.setSignsProgress("Sốt " + code);
        observations.add(opening);
        return h;
    }

    private static DomainException domainError(Runnable call) {
        DomainException error = catchThrowableOfType(DomainException.class, call::run);
        assertThat(error).as("the call should be rejected with a DomainException").isNotNull();
        return error;
    }

    private List<CareDtos.VaccinationHistoryRow> history() {
        return service.vaccinationHistory(FARM_ID, null, null, null, null, null, null);
    }

    private CareDtos.HealthCasePage casesOn(String tab) {
        return service.healthCases(FARM_ID, tab, null, null, null, null, null, null, null, null, null);
    }

    // ================================================================== UC-FE09-05 vaccinationHistory

    @Test
    void tc0924ADeletedVaccinationIsLeftOutOfTheHistory() {
        Cattle c = cattle("BO-3001", "VN-01", 11L);
        Vaccine lmlm = vaccine(51L, "LMLM Aftovax");
        Vaccination kept = vaccination(c, lmlm, LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");
        vaccination(c, lmlm, LocalDate.of(2026, 11, 21), "ON_FARM", "VOIDED");

        List<CareDtos.VaccinationHistoryRow> rows = history();

        assertThat(rows).extracting(CareDtos.VaccinationHistoryRow::id).containsExactly(kept.getId());
        assertThat(jpql.executed()).anySatisfy(q -> assertThat(q).contains("from Vaccination v").contains("upper(v.status)<>'VOIDED'"));
    }

    @Test
    void tc0926TheReactionCaseIsShownOnTheVaccinationRow() {
        Cattle c = cattle("BO-3001", "VN-01", 11L);
        Vaccination record = vaccination(c, vaccine(51L, "LMLM Aftovax"), LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");
        HealthCase reaction = healthCase(c, "HC-0007", "OPEN", LocalDate.of(2026, 11, 21), "MILD");
        HealthObservation link = observations.get(observations.size() - 1);
        link.setVaccination(record);

        CareDtos.VaccinationHistoryRow row = history().get(0);

        assertThat(row.reactionCaseId()).isEqualTo(reaction.getId());
        assertThat(row.reactionCaseCode()).isEqualTo("HC-0007");
    }

    @Test
    void tc0930TheHistoryShowsTheNameStoredAtRecordingTime() {
        Cattle c = cattle("BO-3001", "VN-01", 11L);
        Vaccine lmlm = vaccine(51L, "LMLM Aftovax");
        vaccination(c, lmlm, LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");
        lmlm.setName("LMLM Aftovax (mới)");

        assertThat(history().get(0).vaccineName()).isEqualTo("LMLM Aftovax");
    }

    @Test
    void tcTuan090501TheDefaultPeriodIsTheLastThreeMonths() {
        history();

        Map<String, Object> params = jpql.lastParams("from Vaccination v join fetch v.cattle c");
        assertThat(params).containsEntry("from", TODAY.minusMonths(3)).containsEntry("to", TODAY).containsEntry("farm", FARM_ID);
    }

    @Test
    void tcTuan090502ASearchMatchesTheDisplayCodeOrTheEarTag() {
        Vaccine lmlm = vaccine(51L, "LMLM Aftovax");
        vaccination(cattle("BO-3001", "VN-0101", 11L), lmlm, LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");
        vaccination(cattle("BO-3002", "VN-0202", 11L), lmlm, LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");

        assertThat(service.vaccinationHistory(FARM_ID, " bo-3001 ", null, null, null, null, null)).extracting(CareDtos.VaccinationHistoryRow::cattleCode)
            .containsExactly("BO-3001");
        assertThat(service.vaccinationHistory(FARM_ID, "0202", null, null, null, null, null)).extracting(CareDtos.VaccinationHistoryRow::cattleCode)
            .containsExactly("BO-3002");
    }

    @Test
    void tcTuan090503TheVaccineSourceAndCattleFiltersCombine() {
        Cattle a = cattle("BO-3001", "VN-01", 11L);
        Cattle b = cattle("BO-3002", "VN-02", 11L);
        Vaccine lmlm = vaccine(51L, "LMLM Aftovax");
        Vaccine thtr = vaccine(52L, "Tụ huyết trùng");
        Vaccination wanted = vaccination(a, lmlm, LocalDate.of(2026, 11, 20), "HISTORICAL", "VALID");
        vaccination(a, lmlm, LocalDate.of(2026, 11, 21), "ON_FARM", "VALID");
        vaccination(a, thtr, LocalDate.of(2026, 11, 20), "HISTORICAL", "VALID");
        vaccination(b, lmlm, LocalDate.of(2026, 11, 20), "HISTORICAL", "VALID");

        List<CareDtos.VaccinationHistoryRow> rows = service.vaccinationHistory(FARM_ID, null, 51L, "historical", null, null, a.getId());

        assertThat(rows).extracting(CareDtos.VaccinationHistoryRow::id).containsExactly(wanted.getId());
    }

    @Test
    void tcTuan090504AnUnknownSourceIsInvalid() {
        DomainException error = domainError(() -> service.vaccinationHistory(FARM_ID, null, null, "IMPORTED", null, null, null));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "source");
    }

    @Test
    void tcTuan090505APeriodEndingBeforeItStartsIsInvalid() {
        DomainException error = domainError(() -> service.vaccinationHistory(FARM_ID, null, null, null, LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 19), null));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "period");
    }

    @Test
    void tcTuan090506EachRowCarriesItsRevisionsAndThePen() {
        Cattle c = cattle("BO-3001", "VN-01", 11L);
        Vaccination record = vaccination(c, vaccine(51L, "LMLM Aftovax"), LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");
        record.setCorrected(true);
        RecordRevision r = new RecordRevision();
        r.setId(901L);
        r.setSourceType("Vaccination");
        r.setSourceId(record.getId());
        r.setAction("CORRECT");
        r.setChangedAt(NOW);
        r.setBeforeSnapshot("{\"withdrawalDays\":14}");
        revisions.add(r);

        CareDtos.VaccinationHistoryRow row = history().get(0);

        assertThat(row.corrected()).isTrue();
        assertThat(row.penCode()).isEqualTo("A-01");
        assertThat(row.revisions()).singleElement().satisfies(rev -> {
            assertThat(rev.action()).isEqualTo("CORRECT");
            assertThat(rev.before()).containsEntry("withdrawalDays", 14);
        });
    }

    @Test
    void tcTuan090507AFreeTextHistoricalDoseShowsItsNameAndNoWithdrawal() {
        Cattle c = cattle("BO-3001", "VN-01", 11L);
        Vaccination record = vaccination(c, null, LocalDate.of(2026, 10, 1), "HISTORICAL", "VALID");
        record.setVaccineNameSnapshot("Vắc-xin ở trại cũ");

        CareDtos.VaccinationHistoryRow row = history().get(0);

        assertThat(row.vaccineId()).isNull();
        assertThat(row.vaccineName()).isEqualTo("Vắc-xin ở trại cũ");
        assertThat(row.withdrawalDays()).isNull();
        assertThat(row.withdrawalEndDate()).isNull();
    }

    @Test
    void tcTuan090508ATechnicianCanViewTheHistory() {
        role = FarmRole.TECHNICIAN;
        vaccination(cattle("BO-3001", "VN-01", 11L), vaccine(51L, "LMLM Aftovax"), LocalDate.of(2026, 11, 20), "ON_FARM", "VALID");

        assertThat(history()).hasSize(1);
        assertThat(FarmAction.VIEW_HEALTH.allows(FarmRole.TECHNICIAN)).isTrue();
    }

    @Test
    void tcTuan090509AUserWithoutFarmAccessIsRefused() {
        role = null;

        DomainException error = domainError(this::history);

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(jpql.executed()).isEmpty();
    }

    // ================================================================== UC-FE10-01 healthCases

    private void sixCases() {
        Cattle a = cattle("BO-3001", "VN-01", 11L);
        Cattle b = cattle("BO-3002", "VN-02", 12L);
        healthCase(a, "HC-0001", "OPEN", LocalDate.of(2026, 9, 1), "SEVERE");
        healthCase(a, "HC-0002", "OPEN", LocalDate.of(2026, 11, 20), "MILD");
        healthCase(b, "HC-0003", "OPEN", LocalDate.of(2026, 11, 25), "MODERATE");
        healthCase(b, "HC-0004", "CHRONIC", LocalDate.of(2026, 8, 15), "MILD");
        healthCase(a, "HC-0005", "CLOSED", LocalDate.of(2026, 10, 2), "MILD");
        healthCase(b, "HC-0006", "CLOSED", LocalDate.of(2026, 10, 10), "MODERATE");
    }

    @Test
    void tc1026TheOpenTabShowsEveryOpenCaseWhateverThePeriod() {
        sixCases();

        CareDtos.HealthCasePage page = casesOn("OPEN");

        assertThat(page.items()).extracting(CareDtos.HealthCaseRow::caseCode).containsExactly("HC-0003", "HC-0002", "HC-0001");
        assertThat(page.total()).isEqualTo(3);
    }

    @Test
    void tcTuan100101WithoutATabTheOpenCasesAreShown() {
        sixCases();

        assertThat(casesOn(null).items()).extracting(CareDtos.HealthCaseRow::status).containsOnly("OPEN");
    }

    @Test
    void tcTuan100102TheTabCountsUseTheSameFilters() {
        sixCases();

        Map<String, Long> counts = casesOn("OPEN").counts();

        assertThat(counts).containsEntry("open", 3L).containsEntry("chronic", 1L).containsEntry("closed", 0L).containsEntry("all", 4L)
            .containsEntry("severe", 1L).containsEntry("mild", 2L).containsEntry("moderate", 1L);
    }

    @Test
    void tcTuan100103TheClosedTabKeepsOnlyCasesOpenedInThePeriod() {
        sixCases();

        CareDtos.HealthCasePage page = service.healthCases(FARM_ID, "CLOSED", null, null, null, LocalDate.of(2026, 10, 5), LocalDate.of(2026, 11, 27),
            null, null, null, null);

        assertThat(page.items()).extracting(CareDtos.HealthCaseRow::caseCode).containsExactly("HC-0006");
        assertThat(page.items().get(0).dayN()).isNull();
        assertThat(page.items().get(0).outcome()).isEqualTo("RECOVERED");
    }

    @Test
    void tcTuan100104TheDefaultPeriodIsTheLast30Days() {
        sixCases();

        assertThat(casesOn("CLOSED").items()).isEmpty();
        assertThat(casesOn("ALL").items()).extracting(CareDtos.HealthCaseRow::caseCode).containsExactlyInAnyOrder("HC-0001", "HC-0002", "HC-0003", "HC-0004");
    }

    @Test
    void tcTuan100105SearchSeverityAndPenFiltersCombine() {
        sixCases();

        CareDtos.HealthCasePage bySearch = service.healthCases(FARM_ID, "ALL", "hc-0002", null, null, null, null, null, null, null, null);
        CareDtos.HealthCasePage bySeverityAndPen = service.healthCases(FARM_ID, "ALL", null, "mild", 12L, null, null, null, null, null, null);

        assertThat(bySearch.items()).extracting(CareDtos.HealthCaseRow::caseCode).containsExactly("HC-0002");
        assertThat(bySeverityAndPen.items()).extracting(CareDtos.HealthCaseRow::caseCode).containsExactly("HC-0004");
    }

    @Test
    void tcTuan100106SortingByCaseCodeAndPaging() {
        sixCases();

        CareDtos.HealthCasePage page = service.healthCases(FARM_ID, "ALL", null, null, null, null, null, 1, 2, "caseCode", "asc");

        assertThat(page.items()).extracting(CareDtos.HealthCaseRow::caseCode).containsExactly("HC-0003", "HC-0004");
        assertThat(page.total()).isEqualTo(4);
        assertThat(page.page()).isEqualTo(1);
        assertThat(page.size()).isEqualTo(2);
    }

    @Test
    void tcTuan100107DayNCountsTheOpeningDayAsDayOne() {
        Cattle a = cattle("BO-3001", "VN-01", 11L);
        healthCase(a, "HC-0001", "OPEN", LocalDate.of(2026, 11, 25), "MILD");

        CareDtos.HealthCaseRow row = casesOn("OPEN").items().get(0);

        assertThat(row.dayN()).isEqualTo(3);
        assertThat(row.signs()).isEqualTo("Sốt HC-0001");
        assertThat(row.penCode()).isEqualTo("A-01");
        assertThat(row.breed()).isEqualTo("Brahman");
    }

    @Test
    void tcTuan100108TreatmentsAreCountedPerCase() {
        Cattle a = cattle("BO-3001", "VN-01", 11L);
        HealthCase h = healthCase(a, "HC-0001", "OPEN", LocalDate.of(2026, 11, 20), "MILD");
        for (String status : List.of("VALID", "VALID", "VOIDED")) {
            Treatment t = new Treatment();
            t.setHealthCase(h);
            t.setStatus(status);
            treatments.add(t);
        }

        CareDtos.HealthCasePage page = casesOn("OPEN");

        assertThat(page.items().get(0).treatmentCount()).isEqualTo(2L);
        assertThat(page.counts()).containsEntry("treating", 1L);
    }

    @Test
    void tcTuan100109AnUnknownTabIsInvalid() {
        DomainException error = domainError(() -> casesOn("PENDING"));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "tab");
    }

    @Test
    void tcTuan100110AnUnknownSortIsInvalid() {
        DomainException error = domainError(() -> service.healthCases(FARM_ID, "ALL", null, null, null, null, null, null, null, "severity", null));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "sort");
    }

    @Test
    void tcTuan100111APeriodEndingBeforeItStartsIsInvalid() {
        DomainException error = domainError(() -> service.healthCases(FARM_ID, "CLOSED", null, null, null, LocalDate.of(2026, 11, 20), LocalDate.of(2026, 11, 1),
            null, null, null, null));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
        assertThat(error.getParams()).containsEntry("field", "period");
    }

    @Test
    void tcTuan100112ATechnicianCanViewTheCases() {
        role = FarmRole.TECHNICIAN;
        sixCases();

        assertThat(casesOn("OPEN").items()).hasSize(3);
    }

    @Test
    void tcTuan100113AUserWithoutFarmAccessIsRefused() {
        role = null;

        DomainException error = domainError(() -> casesOn("OPEN"));

        assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(jpql.executed()).isEmpty();
    }
}
