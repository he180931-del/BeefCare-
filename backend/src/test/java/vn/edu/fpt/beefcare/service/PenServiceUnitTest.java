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
import vn.edu.fpt.beefcare.service.dto.PenCriteriaDTO;
import vn.edu.fpt.beefcare.service.dto.PenDTO;
import vn.edu.fpt.beefcare.service.dto.PenListDTO;
import vn.edu.fpt.beefcare.service.dto.PenRequest;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE04-01 View Pens and Occupancy
 * ({@link PenService#list}) and UC-FE04-02 Manage Pen ({@link PenService#update}). Repositories are mocks; the
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
}
