package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.repository.PregnancyEpisodeRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.service.dto.PenAvailabilityRequest;
import vn.edu.fpt.beefcare.service.dto.PenCriteriaDTO;
import vn.edu.fpt.beefcare.service.dto.PenDTO;
import vn.edu.fpt.beefcare.service.dto.PenListDTO;
import vn.edu.fpt.beefcare.service.dto.PenRequest;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE04-01 View Pens and Occupancy
 * ({@link PenService#list}) and UC-FE04-02 Manage Pen ({@link PenService#update}, {@link PenService#create}, {@link PenService#changeAvailability}). Repositories are mocks; the
 * occupancy helper is the real {@link PenOccupancyService} over the mocked repositories. The farm clock is fixed at
 * 27/11/2026 10:00 (UTC+7).
 */
@ExtendWith(MockitoExtension.class)
class PenServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-27T03:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final long FARM_ID = 501L;
    private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

    @Mock FarmAccessService access;
    @Mock PenRepository pens;
    @Mock PenCriteriaVersionRepository criteria;
    @Mock PenAssignmentRepository assignments;
    @Mock ReceptionCriteriaService receptionCriteria;
    @Mock CattleGuardService cattleGuard;
    @Mock PregnancyEpisodeRepository pregnancies;
    @Mock ReminderRepository reminders;
    @Mock AuditService audit;
    @Mock OutboxService outbox;

    private PenService service;
    private Farm farm;
    private AppUser manager;

    @BeforeEach
    void setUp() {
        service = new PenService(access, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), pens, criteria, assignments,
            new PenOccupancyService(pens, assignments), receptionCriteria, cattleGuard, pregnancies, reminders, audit, outbox);
        farm = new Farm();
        farm.setId(FARM_ID);
        farm.setName("Trai Ba Vi");
        manager = new AppUser();
        manager.setId(31L);
        manager.setFullName("Nguyen Thanh An");
    }

    private Pen pen(long id, String code, String name, int capacity, ActiveStatus status) {
        Pen pen = new Pen();
        pen.setId(id);
        pen.setFarm(farm);
        pen.setCode(code);
        pen.setName(name);
        pen.setCapacity(capacity);
        pen.setStatus(status);
        pen.setStatusEffectiveDate(LocalDate.of(2026, 10, 1));
        pen.setVersion(4);
        return pen;
    }

    private PenCriteriaVersion version(Pen pen, int no, Set<PurposeType> purposes, Set<LifeStage> stages, Sex sex, Integer age, String weight) {
        PenCriteriaVersion v = new PenCriteriaVersion();
        v.setId(900L + pen.getId() * 10 + no);
        v.setFarm(farm);
        v.setPen(pen);
        v.setVersionNo(no);
        v.setPurposeTypes(purposes);
        v.setLifeStages(stages);
        v.setSex(sex);
        v.setMinAgeMonths(age);
        v.setMinWeightKg(weight == null ? null : new BigDecimal(weight));
        v.setEffectiveFrom(LocalDate.of(2026, 10, 1));
        v.setChangedBy(manager);
        return v;
    }

    private void viewer(FarmRole role) {
        when(access.require(FARM_ID, FarmAction.VIEW_PENS)).thenReturn(new FarmContext(farm, manager, role));
    }

    private void headcounts(Map<Long, Integer> counts) {
        when(assignments.countOpenGroupedByPen(anyCollection())).thenAnswer(inv -> {
            Collection<Long> ids = inv.getArgument(0);
            List<Object[]> rows = new ArrayList<>();
            ids.forEach(id -> {
                if (counts.containsKey(id)) {
                    rows.add(new Object[] { id, (long) counts.get(id) });
                }
            });
            return rows;
        });
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        DomainException e = (DomainException) thrown;
        assertThat(e.getStatus()).isEqualTo(status);
        assertThat(e.getCode()).isEqualTo(code);
    }

    // ------------------------------------------------------------------ UC-FE04-01 list()

    private List<Pen> fourPens() {
        return List.of(
            pen(11L, "A-01", "Chuong vo beo 1", 20, ActiveStatus.ACTIVE),
            pen(12L, "A-02", "Chuong be cai", 10, ActiveStatus.ACTIVE),
            pen(13L, "B-01", "Chuong cach ly", 5, ActiveStatus.ACTIVE),
            pen(14L, "Z-09", "Chuong cu", 10, ActiveStatus.INACTIVE)
        );
    }

    @Test
    void tc0425TheHeaderCountsEveryPenButOnlyTheActivePlaces() {
        viewer(FarmRole.OWNER);
        when(pens.findAllByFarmIdOrderByCodeAsc(FARM_ID)).thenReturn(fourPens());
        headcounts(Map.of(11L, 10, 12L, 5, 14L, 3));
        when(criteria.findAllByPenIdIn(anyCollection())).thenReturn(List.of());

        PenListDTO list = service.list(FARM_ID, null, null);

        assertThat(list.penCount()).isEqualTo(4);
        assertThat(list.usedPlaces()).isEqualTo(15);
        assertThat(list.totalPlaces()).isEqualTo(35);
        assertThat(list.pens()).extracting(PenDTO::code).containsExactly("A-01", "A-02", "B-01", "Z-09");
        assertThat(list.pens()).extracting(PenDTO::headcount).containsExactly(10, 5, 0, 3);
        assertThat(list.pens()).extracting(PenDTO::freePlaces).containsExactly(10, 5, 5, 7);
    }

    @Test
    void tcAnnt040101TheStatusFilterNarrowsTheRowsButNotTheActiveHeader() {
        viewer(FarmRole.TECHNICIAN);
        when(pens.findAllByFarmIdOrderByCodeAsc(FARM_ID)).thenReturn(fourPens());
        headcounts(Map.of(11L, 10, 12L, 5, 14L, 3));
        when(criteria.findAllByPenIdIn(anyCollection())).thenReturn(List.of());

        PenListDTO list = service.list(FARM_ID, ActiveStatus.INACTIVE, null);

        assertThat(list.pens()).extracting(PenDTO::code).containsExactly("Z-09");
        assertThat(list.penCount()).isEqualTo(1);
        assertThat(list.usedPlaces()).isEqualTo(15);
        assertThat(list.totalPlaces()).isEqualTo(35);
    }

    @Test
    void tcAnnt040102TheSearchTrimsAndIgnoresCaseOnCodeAndName() {
        viewer(FarmRole.MANAGER);
        when(pens.findAllByFarmIdOrderByCodeAsc(FARM_ID)).thenReturn(fourPens());
        headcounts(Map.of());
        when(criteria.findAllByPenIdIn(anyCollection())).thenReturn(List.of());

        assertThat(service.list(FARM_ID, null, "  a-0 ").pens()).extracting(PenDTO::code).containsExactly("A-01", "A-02");
        assertThat(service.list(FARM_ID, null, "CACH LY").pens()).extracting(PenDTO::code).containsExactly("B-01");
        assertThat(service.list(FARM_ID, null, "khong co").pens()).isEmpty();
    }

    @Test
    void tcAnnt040103AFullPenHasNoFreePlaceAndTheLatestCriteriaVersionIsSummarised() {
        viewer(FarmRole.OWNER);
        Pen full = pen(11L, "A-01", "Chuong vo beo 1", 10, ActiveStatus.ACTIVE);
        Pen open = pen(12L, "A-02", "Chuong be cai", 10, ActiveStatus.ACTIVE);
        when(pens.findAllByFarmIdOrderByCodeAsc(FARM_ID)).thenReturn(List.of(full, open));
        headcounts(Map.of(11L, 10));
        when(criteria.findAllByPenIdIn(anyCollection())).thenReturn(List.of(
            version(full, 1, null, null, Sex.MALE, null, null),
            version(full, 2, EnumSet.of(PurposeType.FATTENING, PurposeType.BREEDING), EnumSet.of(LifeStage.ADULT), Sex.FEMALE, 12, "250.0")
        ));

        PenListDTO list = service.list(FARM_ID, null, null);

        PenDTO a01 = list.pens().get(0);
        assertThat(a01.freePlaces()).isZero();
        assertThat(a01.full()).isTrue();
        assertThat(a01.currentCriteria().versionNo()).isEqualTo(2);
        assertThat(a01.acceptsSummary()).isEqualTo("BREEDING/FATTENING | ADULT | FEMALE | age >= 12 months | weight >= 250 kg");
        assertThat(list.pens().get(1).acceptsSummary()).isEqualTo("All");
        assertThat(list.pens().get(1).full()).isFalse();
    }

    @Test
    void tcAnnt040104AFarmWithoutPensReturnsAnEmptyListAndZeroPlaces() {
        viewer(FarmRole.OWNER);
        when(pens.findAllByFarmIdOrderByCodeAsc(FARM_ID)).thenReturn(List.of());

        PenListDTO list = service.list(FARM_ID, null, null);

        assertThat(list.pens()).isEmpty();
        assertThat(list.penCount()).isZero();
        assertThat(list.usedPlaces()).isZero();
        assertThat(list.totalPlaces()).isZero();
        verify(assignments, never()).countOpenGroupedByPen(any());
        verify(criteria, never()).findAllByPenIdIn(any());
    }

    @Test
    void tcAnnt040105ACallerWithoutAccessToTheFarmReadsNothing() {
        when(access.require(FARM_ID, FarmAction.VIEW_PENS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> service.list(FARM_ID, null, null));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verifyNoInteractions(pens, assignments, criteria);
    }

    // ------------------------------------------------------------------ UC-FE04-02 update()

    private Pen editable;

    private void editableA01(int headcount, PenCriteriaVersion current) {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        editable = pen(11L, "A-01", "Chuong vo beo 1", 40, ActiveStatus.ACTIVE);
        when(pens.findByIdAndFarmId(11L, FARM_ID)).thenReturn(Optional.of(editable));
        when(pens.lockAllByFarmIdAndIdIn(eq(FARM_ID), anyList())).thenReturn(List.of(editable));
        lenient().when(assignments.countByPenIdAndToDateIsNull(11L)).thenReturn((long) headcount);
        lenient().when(criteria.findFirstByPenIdOrderByVersionNoDesc(11L)).thenReturn(Optional.ofNullable(current));
        lenient().when(criteria.findAllByPenIdOrderByVersionNoDesc(11L)).thenReturn(current == null ? List.of() : List.of(current));
        lenient().when(assignments.findAllByPenIdAndToDateIsNull(11L)).thenReturn(List.of());
        lenient().when(pens.saveAndFlush(any(Pen.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(criteria.saveAndFlush(any(PenCriteriaVersion.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static PenRequest request(String code, int capacity, PenCriteriaDTO c, Integer expectedVersion) {
        return new PenRequest(code, "  Chuong vo beo 1  ", capacity, "  ", c, null, expectedVersion);
    }

    @Test
    void tc0404CapacityEqualToTheHeadcountIsAccepted() {
        editableA01(30, null);

        PenDTO saved = service.update(FARM_ID, 11L, request("A-01", 30, null, 4));

        assertThat(saved.capacity()).isEqualTo(30);
        assertThat(saved.headcount()).isEqualTo(30);
        assertThat(saved.full()).isTrue();
        assertThat(saved.name()).isEqualTo("Chuong vo beo 1");
        assertThat(saved.description()).isNull();
        assertThat(saved.message().code()).isEqualTo(MessageCodes.FE04_01);
        verify(audit).log(any(FarmContext.class), eq(PenService.ACTION_UPDATE), eq("Pen"), eq(11L), anyMap());
        verify(outbox).enqueue(eq(FARM_ID), eq("PEN_UPDATED"), eq("Pen"), eq(11L), anyMap());
    }

    @Test
    void tc0404CapacityBelowTheHeadcountIsRejectedWithTheMinimum() {
        editableA01(30, null);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 11L, request("A-01", 29, null, 4)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_03);
        assertThat(((DomainException) thrown).getParams()).containsEntry("min_capacity", 30).containsEntry("headcount", 30);
        verify(pens, never()).saveAndFlush(any());
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tc0402RenamingToTheCodeOfAnotherPenIsRejected() {
        editableA01(3, null);
        when(pens.existsByFarmIdAndCodeIgnoreCase(FARM_ID, "C-01")).thenReturn(true);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 11L, request(" C-01 ", 20, null, 4)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_02);
        assertThat(((DomainException) thrown).getParams()).containsEntry("pen_code", "C-01");
        verify(pens, never()).saveAndFlush(any());
    }

    @Test
    void tcAnnt040201ChangingOnlyTheLetterCaseOfTheOwnCodeSkipsTheDuplicateCheck() {
        editableA01(3, null);

        PenDTO saved = service.update(FARM_ID, 11L, request("a-01", 20, null, 4));

        assertThat(saved.code()).isEqualTo("a-01");
        verify(pens, never()).existsByFarmIdAndCodeIgnoreCase(anyLong(), anyString());
    }

    @Test
    void tcAnnt040202AUniqueIndexRaceIsReportedAsADuplicateCode() {
        editableA01(3, null);
        when(pens.existsByFarmIdAndCodeIgnoreCase(FARM_ID, "C-02")).thenReturn(false);
        when(pens.saveAndFlush(any(Pen.class))).thenThrow(new DataIntegrityViolationException("ux_pen_farm_code"));

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 11L, request("C-02", 20, null, 4)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_02);
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tc0407ChangedCriteriaBecomeVersionTwoFromTodayAndTheCattleStayWhereTheyAre() {
        PenCriteriaVersion v1 = version(pen(11L, "A-01", "x", 40, ActiveStatus.ACTIVE), 1, null, null, Sex.MALE, null, null);
        editableA01(10, v1);
        PenCriteriaDTO changed = new PenCriteriaDTO(Set.of(PurposeType.FATTENING), null, Sex.MALE, 12, new BigDecimal("250"));

        service.update(FARM_ID, 11L, request("A-01", 40, changed, 4));

        ArgumentCaptor<PenCriteriaVersion> saved = ArgumentCaptor.forClass(PenCriteriaVersion.class);
        verify(criteria).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getVersionNo()).isEqualTo(2);
        assertThat(saved.getValue().getEffectiveFrom()).isEqualTo(TODAY);
        assertThat(saved.getValue().getPurposeTypes()).containsExactly(PurposeType.FATTENING);
        assertThat(saved.getValue().getMinAgeMonths()).isEqualTo(12);
        assertThat(saved.getValue().getChangedBy()).isSameAs(manager);
        verify(assignments, never()).saveAndFlush(any());
        verify(assignments, never()).saveAll(any());
    }

    @Test
    void tcAnnt040203UnchangedCriteriaKeepTheCurrentVersion() {
        PenCriteriaVersion v1 = version(pen(11L, "A-01", "x", 40, ActiveStatus.ACTIVE), 1, null, null, Sex.MALE, 12, "250.00");
        editableA01(10, v1);

        service.update(FARM_ID, 11L, request("A-01", 40, new PenCriteriaDTO(Set.of(), null, Sex.MALE, 12, new BigDecimal("250")), 4));

        verify(criteria, never()).saveAndFlush(any());
    }

    @Test
    void tcAnnt040204AMissingExpectedVersionIsAConflict() {
        editableA01(3, null);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 11L, request("A-01", 20, null, null)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("reason", "expected_version_required");
        verify(pens, never()).saveAndFlush(any());
    }

    @Test
    void tcAnnt040205AStaleExpectedVersionIsAConflict() {
        editableA01(3, null);

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 11L, request("A-01", 20, null, 3)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("expected", 3).containsEntry("actual", 4);
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tcAnnt040206APenOfAnotherFarmIsNotFound() {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenReturn(new FarmContext(farm, manager, FarmRole.OWNER));
        when(pens.findByIdAndFarmId(77L, FARM_ID)).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 77L, request("A-01", 20, null, 4)));

        assertDomain(thrown, HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        verify(pens, never()).lockAllByFarmIdAndIdIn(anyLong(), any());
    }

    @Test
    void tc0423ATechnicianCannotEditAPen() {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> service.update(FARM_ID, 11L, request("A-01", 20, null, 4)));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_PENS.name()).isEqualTo("MANAGE_PENS");
        verifyNoInteractions(pens, criteria, audit, outbox);
    }

    private static Set<String> invalidFields(Object request) {
        Set<ConstraintViolation<Object>> violations = VALIDATOR.validate(request);
        return violations.stream().map(v -> v.getPropertyPath().toString()).collect(java.util.stream.Collectors.toSet());
    }

    @Test
    void tc0401ThePenCodeIsRequiredUpToTwentyLettersDigitsOrHyphens() {
        assertThat(invalidFields(request("", 10, null, 4))).contains("code");
        assertThat(invalidFields(request("C-01-ABCDEFGHIJKLMNOP", 10, null, 4))).contains("code");
        assertThat(invalidFields(request("C 01", 10, null, 4))).contains("code");
        assertThat(invalidFields(request("C_01", 10, null, 4))).contains("code");
        assertThat(invalidFields(request("C-01", 10, null, 4))).isEmpty();
        assertThat(invalidFields(request("C-01-ABCDEFGHIJKLMNO", 10, null, 4))).isEmpty();
    }

    @Test
    void tc0403CapacityMustBeBetweenOneAnd9999() {
        assertThat(invalidFields(request("C-01", 0, null, 4))).contains("capacity");
        assertThat(invalidFields(request("C-01", 1, null, 4))).isEmpty();
        assertThat(invalidFields(request("C-01", 9999, null, 4))).isEmpty();
        assertThat(invalidFields(request("C-01", 10000, null, 4))).contains("capacity");
    }

    @Test
    void tc0405MinimumAgeAndWeightCriteriaStayWithinTheirLimits() {
        assertThat(invalidFields(request("C-01", 10, new PenCriteriaDTO(null, null, null, 241, null), 4))).contains("criteria.minAgeMonths");
        assertThat(invalidFields(request("C-01", 10, new PenCriteriaDTO(null, null, null, null, BigDecimal.ZERO), 4))).contains("criteria.minWeightKg");
        assertThat(invalidFields(request("C-01", 10, new PenCriteriaDTO(null, null, null, null, new BigDecimal("1501")), 4))).contains("criteria.minWeightKg");
        assertThat(invalidFields(request("C-01", 10, new PenCriteriaDTO(null, null, null, 240, new BigDecimal("1500")), 4))).isEmpty();
        assertThat(invalidFields(request("C-01", 10, new PenCriteriaDTO(null, null, null, 0, BigDecimal.ONE), 4))).isEmpty();
    }

    // ------------------------------------------------------------------ UC-FE04-02 create()

    private final List<PenCriteriaVersion> savedVersions = new ArrayList<>();

    private void creatable(FarmRole role) {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenReturn(new FarmContext(farm, manager, role));
        lenient().when(pens.saveAndFlush(any(Pen.class))).thenAnswer(inv -> {
            Pen p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(15L);
                p.setVersion(0);
            }
            return p;
        });
        lenient().when(criteria.saveAndFlush(any(PenCriteriaVersion.class))).thenAnswer(inv -> {
            PenCriteriaVersion v = inv.getArgument(0);
            v.setId(950L + savedVersions.size());
            savedVersions.add(v);
            return v;
        });
        lenient().when(criteria.findAllByPenIdOrderByVersionNoDesc(15L)).thenAnswer(inv -> List.copyOf(savedVersions));
        lenient().when(assignments.findAllByPenIdAndToDateIsNull(15L)).thenReturn(List.of());
    }

    private static PenRequest newPen(String code, String description, PenCriteriaDTO c, ActiveStatus initialStatus) {
        return new PenRequest(code, "  Chuong cach ly 2  ", 12, description, c, initialStatus, null);
    }

    @Test
    void tcAnnt040207ANewPenIsActiveFromTodayWithCriteriaVersionOne() {
        creatable(FarmRole.MANAGER);
        when(pens.existsByFarmIdAndCodeIgnoreCase(FARM_ID, "C-02")).thenReturn(false);
        PenCriteriaDTO c = new PenCriteriaDTO(Set.of(PurposeType.FATTENING), Set.of(LifeStage.ADULT), Sex.MALE, 12, new BigDecimal("250"));

        PenDTO created = service.create(FARM_ID, newPen("  C-02 ", "  Gan kho thuc an  ", c, null));

        ArgumentCaptor<Pen> pen = ArgumentCaptor.forClass(Pen.class);
        verify(pens).saveAndFlush(pen.capture());
        assertThat(pen.getValue().getFarm()).isSameAs(farm);
        assertThat(pen.getValue().getCreatedBy()).isSameAs(manager);
        assertThat(created.id()).isEqualTo(15L);
        assertThat(created.code()).isEqualTo("C-02");
        assertThat(created.name()).isEqualTo("Chuong cach ly 2");
        assertThat(created.description()).isEqualTo("Gan kho thuc an");
        assertThat(created.status()).isEqualTo(ActiveStatus.ACTIVE);
        assertThat(created.statusEffectiveDate()).isEqualTo(TODAY);
        assertThat(created.headcount()).isZero();
        assertThat(created.freePlaces()).isEqualTo(12);
        assertThat(created.full()).isFalse();
        assertThat(savedVersions).hasSize(1);
        PenCriteriaVersion v1 = savedVersions.get(0);
        assertThat(v1.getVersionNo()).isEqualTo(1);
        assertThat(v1.getEffectiveFrom()).isEqualTo(TODAY);
        assertThat(v1.getChangedBy()).isSameAs(manager);
        assertThat(v1.getCreatedAt()).isEqualTo(NOW);
        assertThat(created.acceptsSummary()).isEqualTo("FATTENING | ADULT | MALE | age >= 12 months | weight >= 250 kg");
        assertThat(created.criteriaVersions()).hasSize(1);
        assertThat(created.cattle()).isEmpty();
        assertThat(created.message().code()).isEqualTo(MessageCodes.FE04_01);
        assertThat(created.message().params()).containsEntry("pen_code", "C-02");
        verify(audit).log(any(FarmContext.class), eq(PenService.ACTION_CREATE), eq("Pen"), eq(15L), anyMap());
        verify(outbox).enqueue(eq(FARM_ID), eq("PEN_CREATED"), eq("Pen"), eq(15L), anyMap());
    }

    @Test
    void tcAnnt040208ANewPenWithoutCriteriaAcceptsAllAndABlankDescriptionIsNull() {
        creatable(FarmRole.OWNER);

        PenDTO created = service.create(FARM_ID, newPen("C-03", "   ", null, null));

        assertThat(created.description()).isNull();
        assertThat(savedVersions).singleElement().satisfies(v -> {
            assertThat(v.getVersionNo()).isEqualTo(1);
            assertThat(v.getPurposeTypes()).isNull();
            assertThat(v.getLifeStages()).isNull();
            assertThat(v.getSex()).isNull();
            assertThat(v.getMinAgeMonths()).isNull();
            assertThat(v.getMinWeightKg()).isNull();
        });
        assertThat(created.acceptsSummary()).isEqualTo("All");
    }

    @Test
    void tcAnnt040209ANewPenCanStartInactive() {
        creatable(FarmRole.MANAGER);

        PenDTO created = service.create(FARM_ID, newPen("C-04", null, null, ActiveStatus.INACTIVE));

        assertThat(created.status()).isEqualTo(ActiveStatus.INACTIVE);
        assertThat(created.statusEffectiveDate()).isEqualTo(TODAY);
    }

    @Test
    void tc0402CreatingACodeThatAlreadyExistsInTheFarmIsRejected() {
        creatable(FarmRole.MANAGER);
        when(pens.existsByFarmIdAndCodeIgnoreCase(FARM_ID, "C-01")).thenReturn(true);

        Throwable thrown = catchThrowable(() -> service.create(FARM_ID, newPen(" C-01 ", null, null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_02);
        assertThat(((DomainException) thrown).getParams()).containsEntry("pen_code", "C-01");
        verify(pens, never()).saveAndFlush(any());
        verify(criteria, never()).saveAndFlush(any());
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tcAnnt040210AUniqueIndexRaceOnCreateIsReportedAsADuplicateCode() {
        creatable(FarmRole.MANAGER);
        when(pens.saveAndFlush(any(Pen.class))).thenThrow(new DataIntegrityViolationException("ux_pen_farm_code"));

        Throwable thrown = catchThrowable(() -> service.create(FARM_ID, newPen("C-05", null, null, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE04_02);
        verify(criteria, never()).saveAndFlush(any());
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tc0423ATechnicianCannotCreateAPen() {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> service.create(FARM_ID, newPen("C-06", null, null, null)));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verifyNoInteractions(pens, criteria, audit, outbox);
    }

    @Test
    void tcAnnt040211TheNameIsRequiredUpToOneHundredCharactersAndTheDescriptionUpTo500() {
        assertThat(invalidFields(new PenRequest("C-07", "  ", 10, null, null, null, null))).contains("name");
        assertThat(invalidFields(new PenRequest("C-07", "N".repeat(101), 10, null, null, null, null))).contains("name");
        assertThat(invalidFields(new PenRequest("C-07", "N".repeat(100), 10, "D".repeat(500), null, null, null))).isEmpty();
        assertThat(invalidFields(new PenRequest("C-07", "Chuong", 10, "D".repeat(501), null, null, null))).contains("description");
        assertThat(invalidFields(new PenRequest("C-07", "Chuong", null, null, null, null, null))).contains("capacity");
    }

    // ------------------------------------------------------------------ UC-FE04-02 changeAvailability()

    private static PenAvailabilityRequest availability(ActiveStatus status, LocalDate effective, String reason, Integer expectedVersion) {
        return new PenAvailabilityRequest(status, effective, reason, expectedVersion);
    }

    @Test
    void tc0408StoppingAPenKeepsTheTenCattleInIt() {
        editableA01(10, null);

        PenDTO stopped = service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.INACTIVE, TODAY.minusDays(1), "  Sua mai chuong  ", 4));

        assertThat(stopped.status()).isEqualTo(ActiveStatus.INACTIVE);
        assertThat(stopped.statusEffectiveDate()).isEqualTo(TODAY.minusDays(1));
        assertThat(stopped.statusReason()).isEqualTo("Sua mai chuong");
        assertThat(stopped.headcount()).isEqualTo(10);
        assertThat(stopped.message().code()).isEqualTo(MessageCodes.FE04_04);
        assertThat(stopped.message().params()).containsEntry("pen_code", "A-01").containsEntry("status", ActiveStatus.INACTIVE);
        verify(pens).saveAndFlush(editable);
        verify(assignments, never()).saveAndFlush(any());
        verify(assignments, never()).saveAll(any());
        verify(audit).log(any(FarmContext.class), eq(PenService.ACTION_AVAILABILITY), eq("Pen"), eq(11L), anyMap());
        verify(outbox).enqueue(eq(FARM_ID), eq("PEN_AVAILABILITY_CHANGED"), eq("Pen"), eq(11L), anyMap());
    }

    @Test
    void tcAnnt040212AStoppedPenCanBeResumedToday() {
        editableA01(0, null);
        editable.setStatus(ActiveStatus.INACTIVE);

        PenDTO resumed = service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.ACTIVE, TODAY, "Sua xong", 4));

        assertThat(resumed.status()).isEqualTo(ActiveStatus.ACTIVE);
        assertThat(resumed.statusEffectiveDate()).isEqualTo(TODAY);
        assertThat(resumed.statusReason()).isEqualTo("Sua xong");
    }

    @Test
    void tc0409AnEffectiveDateInTheFutureIsRejected() {
        editableA01(10, null);

        Throwable thrown = catchThrowable(() -> service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.INACTIVE, TODAY.plusDays(1), "Sua mai", 4)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.COM_07);
        assertThat(editable.getStatus()).isEqualTo(ActiveStatus.ACTIVE);
        verify(pens, never()).saveAndFlush(any());
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tc0409ABlankReasonIsRequired() {
        editableA01(10, null);

        Throwable thrown = catchThrowable(() -> service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.INACTIVE, TODAY, "   ", 4)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "reason");
        verify(pens, never()).saveAndFlush(any());
    }

    @Test
    void tcAnnt040213TheSameStatusAgainIsAConflict() {
        editableA01(10, null);

        Throwable thrown = catchThrowable(() -> service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.ACTIVE, TODAY, "Mo lai", 4)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("pen_code", "A-01").containsEntry("status", ActiveStatus.ACTIVE);
        verifyNoInteractions(audit, outbox);
    }

    @Test
    void tcAnnt040214AStaleExpectedVersionOnStopIsAConflict() {
        editableA01(10, null);

        Throwable thrown = catchThrowable(() -> service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.INACTIVE, TODAY, "Sua mai", 3)));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("expected", 3).containsEntry("actual", 4);
        verify(pens, never()).saveAndFlush(any());
    }

    @Test
    void tcAnnt040215StoppingAPenOfAnotherFarmIsNotFound() {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenReturn(new FarmContext(farm, manager, FarmRole.OWNER));
        when(pens.findByIdAndFarmId(77L, FARM_ID)).thenReturn(Optional.empty());

        Throwable thrown = catchThrowable(() -> service.changeAvailability(FARM_ID, 77L, availability(ActiveStatus.INACTIVE, TODAY, "Sua mai", 4)));

        assertDomain(thrown, HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        verify(pens, never()).lockAllByFarmIdAndIdIn(anyLong(), any());
    }

    @Test
    void tc0423ATechnicianCannotStopAPen() {
        when(access.require(FARM_ID, FarmAction.MANAGE_PENS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        Throwable thrown = catchThrowable(() -> service.changeAvailability(FARM_ID, 11L, availability(ActiveStatus.INACTIVE, TODAY, "Sua mai", 4)));

        assertDomain(thrown, HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verifyNoInteractions(pens, audit, outbox);
    }

    @Test
    void tcAnnt040216StatusDateAndReasonAreRequiredAndTheReasonIsAtMost500Characters() {
        assertThat(invalidFields(availability(null, TODAY, "Sua", 4))).contains("status");
        assertThat(invalidFields(availability(ActiveStatus.INACTIVE, null, "Sua", 4))).contains("effectiveDate");
        assertThat(invalidFields(availability(ActiveStatus.INACTIVE, TODAY, "", 4))).contains("reason");
        assertThat(invalidFields(availability(ActiveStatus.INACTIVE, TODAY, "R".repeat(501), 4))).contains("reason");
        assertThat(invalidFields(availability(ActiveStatus.INACTIVE, TODAY, "R".repeat(500), 4))).isEmpty();
    }
}
