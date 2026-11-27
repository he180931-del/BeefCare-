package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE18-02 Manage Vaccine Catalogue
 * ({@link CareCatalogueCommandService#saveVaccine}) and UC-FE18-03 Manage Medicine Catalogue
 * ({@link CareCatalogueCommandService#saveMedicine}). The idempotency wrapper is a mock that runs the command; the JPQL
 * queries return the counts and ids set by each test.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CareCatalogueCommandServiceUnitTest {

    private static final long FARM_ID = 501L;

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock IdempotencyCommandService idempotency;
    @Mock AuditService audit;
    @Mock CatalogueReferenceService references;

    private CareCatalogueCommandService service;
    private Farm farm;
    private final Map<String, Long> counts = new LinkedHashMap<>();
    private final Map<String, List<Long>> ids = new LinkedHashMap<>();
    private final List<Object> persisted = new ArrayList<>();
    private Vaccine storedVaccine;
    private Medicine storedMedicine;

    @BeforeEach
    void setUp() {
        service = new CareCatalogueCommandService(access, idempotency, audit, references);
        ReflectionTestUtils.setField(service, "em", em);
        farm = new Farm();
        farm.setId(FARM_ID);
        AppUser manager = new AppUser();
        manager.setId(31L);
        when(access.require(FARM_ID, FarmAction.MANAGE_CARE_CATALOGUES)).thenReturn(new FarmContext(farm, manager, FarmRole.MANAGER));
        when(idempotency.execute(anyLong(), any(FarmAction.class), anyString(), any(), any(), any(Class.class), any(Supplier.class)))
            .thenAnswer(inv -> inv.<Supplier<?>>getArgument(6).get());
        counts.put("count(v) from Vaccine v", 0L);
        counts.put("count(m) from Medicine m", 0L);
        ids.put("from VaccinationSchedule s", List.of());
        ids.put("from Vaccination v", List.of());
        ids.put("from Treatment t", List.of());
        when(em.createQuery(anyString(), eq(Long.class))).thenAnswer(inv -> longQuery(inv.getArgument(0)));
        when(em.createQuery(anyString(), eq(Vaccine.class))).thenAnswer(inv -> rows(storedVaccine));
        when(em.createQuery(anyString(), eq(Medicine.class))).thenAnswer(inv -> rows(storedMedicine));
        when(references.auditedSchedules(anyLong(), anyLong())).thenReturn(Set.of());
        when(references.revisedSources(anyLong(), anyString(), anyString(), anyLong())).thenReturn(Set.of());
        doAnswer(inv -> {
            Object entity = inv.getArgument(0);
            if (entity instanceof Vaccine v && v.getId() == null) {
                v.setId(51L);
            } else if (entity instanceof Medicine m && m.getId() == null) {
                m.setId(52L);
            }
            persisted.add(entity);
            return null;
        }).when(em).persist(any());
    }

    @SuppressWarnings("unchecked")
    private TypedQuery<Long> longQuery(String jpql) {
        TypedQuery<Long> query = mock(TypedQuery.class, RETURNS_SELF);
        String countKey = counts.keySet().stream().filter(jpql::contains).findFirst().orElse(null);
        when(query.getSingleResult()).thenReturn(countKey == null ? 0L : counts.get(countKey));
        String idKey = ids.keySet().stream().filter(jpql::contains).findFirst().orElse(null);
        when(query.getResultList()).thenReturn(idKey == null ? List.of() : ids.get(idKey));
        return query;
    }

    @SuppressWarnings("unchecked")
    private static <T> TypedQuery<T> rows(T row) {
        TypedQuery<T> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getResultStream()).thenAnswer(inv -> row == null ? java.util.stream.Stream.empty() : java.util.stream.Stream.of(row));
        return query;
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    // ------------------------------------------------------------------ UC-FE18-02 saveVaccine()

    private static CareDtos.VaccineCommand vaccine(String code, Integer withdrawal, Integer booster, Boolean available, Integer version) {
        return new CareDtos.VaccineCommand(version, code, "  Vac-xin LMLM  ", "Lo mom long mong", null, null, null, withdrawal, booster, available);
    }

    private Vaccine stored(String code) {
        storedVaccine = new Vaccine();
        storedVaccine.setId(51L);
        storedVaccine.setFarm(farm);
        storedVaccine.setCode(code);
        storedVaccine.setName("Vac-xin LMLM");
        storedVaccine.setDiseasePrevented("Lo mom long mong");
        storedVaccine.setWithdrawalInfo("0");
        storedVaccine.setAvailable(true);
        storedVaccine.setVersion(3);
        return storedVaccine;
    }

    @Test
    void tc1812AVaccineWithoutDoseOrRouteIsSavedAndFlaggedToCompleteFromTheLabel() {
        CareDtos.CatalogueItem item = service.saveVaccine(FARM_ID, null, "key-1", vaccine("VX-LMLM", null, null, null, null));

        assertThat(persisted).singleElement().isInstanceOfSatisfying(Vaccine.class, v -> {
            assertThat(v.getFarm()).isSameAs(farm);
            assertThat(v.getName()).isEqualTo("Vac-xin LMLM");
            assertThat(v.getWithdrawalInfo()).isEqualTo("0");
            assertThat(v.getAvailable()).isTrue();
        });
        assertThat(item.completeFromLabel()).isTrue();
        assertThat(item.withdrawalDays()).isZero();
        verify(idempotency).execute(eq(FARM_ID), eq(FarmAction.MANAGE_CARE_CATALOGUES), eq("VACCINE_CREATE"), eq("key-1"), any(), any(Class.class),
            any(Supplier.class));
        verify(audit).log(any(FarmContext.class), eq("VACCINE_CREATE"), eq("Vaccine"), eq(51L), any());
    }

    @Test
    void tc1813ABoosterOf731DaysOrAWithdrawalOf366DaysIsRejected() {
        Throwable booster = catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("VX-LMLM", 0, 731, true, null)));
        Throwable withdrawal = catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("VX-LMLM", 366, 180, true, null)));

        assertDomain(booster, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) booster).getParams()).containsEntry("field", "boosterInterval");
        assertThat(((DomainException) withdrawal).getParams()).containsEntry("field", "withdrawalDays");
        assertThat(persisted).isEmpty();

        service.saveVaccine(FARM_ID, null, null, vaccine("VX-LMLM", 365, 730, true, null));
        assertThat(persisted).hasSize(1);
    }

    @Test
    void tc1802AVaccineCodeFollowsTheBreedCodeRule() {
        assertDomain(catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("vx-lmlm", 0, null, true, null))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("V", 0, null, true, null))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("V".repeat(21), 0, null, true, null))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);
        assertThat(persisted).isEmpty();
    }

    @Test
    void tcAnnt180201ADuplicateVaccineCodeIsRejected() {
        counts.put("count(v) from Vaccine v", 1L);

        Throwable thrown = catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("VX-LMLM", 0, null, true, null)));

        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_02);
        assertThat(persisted).isEmpty();
    }

    @Test
    void tcAnnt180202TheCodeOfAVaccineInUseCannotChangeButALegacyCodeCanBeKept() {
        stored("vx-cu");
        ids.put("from VaccinationSchedule s", List.of(81L));

        Throwable changed = catchThrowable(() -> service.saveVaccine(FARM_ID, 51L, null, vaccine("VX-MOI", 0, null, true, 3)));
        assertDomain(changed, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);

        CareDtos.CatalogueItem kept = service.saveVaccine(FARM_ID, 51L, null, vaccine("vx-cu", 7, null, true, 3));
        assertThat(kept.code()).isEqualTo("vx-cu");
        assertThat(kept.scheduleCount()).isEqualTo(1);
        assertThat(kept.referencedCount()).isEqualTo(1);
    }

    @Test
    void tcAnnt180203AVaccineCanBeStoppedAndUsedAgain() {
        Vaccine v = stored("VX-LMLM");

        CareDtos.CatalogueItem stopped = service.saveVaccine(FARM_ID, 51L, null, vaccine("VX-LMLM", 0, null, false, 3));
        assertThat(v.getAvailable()).isFalse();
        assertThat(stopped.available()).isFalse();
        verify(audit).log(any(FarmContext.class), eq("VACCINE_UPDATE"), eq("Vaccine"), eq(51L), any());

        service.saveVaccine(FARM_ID, 51L, null, vaccine("VX-LMLM", 0, null, true, 3));
        assertThat(v.getAvailable()).isTrue();
        assertThat(v.getId()).isEqualTo(51L);
    }

    @Test
    void tcAnnt180204AStaleVersionOrAVaccineOfAnotherFarmIsRejected() {
        stored("VX-LMLM");
        assertDomain(catchThrowable(() -> service.saveVaccine(FARM_ID, 51L, null, vaccine("VX-LMLM", 0, null, true, 2))), HttpStatus.CONFLICT,
            MessageCodes.COM_05);

        storedVaccine = null;
        assertDomain(catchThrowable(() -> service.saveVaccine(FARM_ID, 99L, null, vaccine("VX-LMLM", 0, null, true, 1))), HttpStatus.NOT_FOUND,
            MessageCodes.COM_08);
        verifyNoInteractions(audit);
    }

    @Test
    void tcAnnt180205TheNameAndPreventedDiseaseAreRequired() {
        Throwable noDisease = catchThrowable(() ->
            service.saveVaccine(FARM_ID, null, null, new CareDtos.VaccineCommand(null, "VX-LMLM", "LMLM", " ", null, null, null, 0, null, true)));
        Throwable noName = catchThrowable(() ->
            service.saveVaccine(FARM_ID, null, null, new CareDtos.VaccineCommand(null, "VX-LMLM", null, "LMLM", null, null, null, 0, null, true)));

        assertDomain(noDisease, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) noDisease).getParams()).containsEntry("field", "diseasePrevented");
        assertThat(((DomainException) noName).getParams()).containsEntry("field", "name");
        assertThat(persisted).isEmpty();
    }

    @Test
    void tc1801ATechnicianCannotSaveAVaccine() {
        when(access.require(FARM_ID, FarmAction.MANAGE_CARE_CATALOGUES)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> service.saveVaccine(FARM_ID, null, null, vaccine("VX-LMLM", 0, null, true, null))), HttpStatus.FORBIDDEN,
            MessageCodes.COM_01);
        assertThat(FarmAction.MANAGE_CARE_CATALOGUES.allows(FarmRole.TECHNICIAN)).isFalse();
        verifyNoInteractions(em, audit);
    }

    // ------------------------------------------------------------------ UC-FE18-03 saveMedicine()

    private static CareDtos.MedicineCommand medicine(String code, Integer withdrawal, String description, Boolean available, Integer version) {
        return new CareDtos.MedicineCommand(version, code, "Oxytetracycline 10%", description, "1 ml / 10 kg", "Tiem bap", withdrawal, available);
    }

    private Medicine storedMedicine(String code) {
        storedMedicine = new Medicine();
        storedMedicine.setId(52L);
        storedMedicine.setFarm(farm);
        storedMedicine.setCode(code);
        storedMedicine.setName("Oxytetracycline 10%");
        storedMedicine.setWithdrawalDays(28);
        storedMedicine.setAvailable(true);
        storedMedicine.setVersion(2);
        return storedMedicine;
    }

    @Test
    void tcAnnt180301ANewMedicineKeepsItsWithdrawalPeriod() {
        CareDtos.CatalogueItem item = service.saveMedicine(FARM_ID, null, "key-2", medicine("OXY-10", 28, null, null, null));

        assertThat(persisted).singleElement().isInstanceOfSatisfying(Medicine.class, m -> {
            assertThat(m.getWithdrawalDays()).isEqualTo(28);
            assertThat(m.getWithdrawalInfo()).isEqualTo("28");
            assertThat(m.getAvailable()).isTrue();
        });
        assertThat(item.withdrawalDays()).isEqualTo(28);
        assertThat(item.recordCount()).isZero();
        verify(idempotency).execute(eq(FARM_ID), eq(FarmAction.MANAGE_CARE_CATALOGUES), eq("MEDICINE_CREATE"), eq("key-2"), any(), any(Class.class),
            any(Supplier.class));
    }

    @Test
    void tc1814AMedicineWithoutAWithdrawalPeriodIsRejected() {
        Throwable thrown = catchThrowable(() -> service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", null, null, true, null)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "withdrawalDays");
        assertThat(persisted).isEmpty();
    }

    @Test
    void tcAnnt180302TheWithdrawalPeriodIsFromZeroTo365Days() {
        assertDomain(catchThrowable(() -> service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", -1, null, true, null))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);
        assertDomain(catchThrowable(() -> service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", 366, null, true, null))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);
        assertThat(persisted).isEmpty();

        service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", 0, null, true, null));
        service.saveMedicine(FARM_ID, null, null, medicine("OXY-20", 365, null, true, null));
        assertThat(persisted).hasSize(2);
    }

    @Test
    void tcAnnt180303TheCodeOfAMedicineUsedInTreatmentsCannotChange() {
        storedMedicine("OXY-10");
        ids.put("from Treatment t", List.of(71L, 72L));

        assertDomain(catchThrowable(() -> service.saveMedicine(FARM_ID, 52L, null, medicine("OXY-11", 28, null, true, 2))), HttpStatus.BAD_REQUEST,
            MessageCodes.COM_10);

        CareDtos.CatalogueItem item = service.saveMedicine(FARM_ID, 52L, null, medicine("OXY-10", 21, null, false, 2));
        assertThat(item.recordCount()).isEqualTo(2);
        assertThat(item.available()).isFalse();
        assertThat(item.withdrawalDays()).isEqualTo(21);
    }

    @Test
    void tcAnnt180304ADuplicateMedicineCodeIsRejected() {
        counts.put("count(m) from Medicine m", 1L);

        assertDomain(catchThrowable(() -> service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", 28, null, true, null))),
            HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_02);
        assertThat(persisted).isEmpty();
    }

    @Test
    void tcAnnt180305ADescriptionOver500CharactersIsRejected() {
        Throwable thrown = catchThrowable(() -> service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", 28, "D".repeat(501), true, null)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "description");
        service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", 28, "D".repeat(500), true, null));
        assertThat(persisted).hasSize(1);
    }

    @Test
    void tcAnnt180306AStaleMedicineVersionIsAConflict() {
        storedMedicine("OXY-10");

        assertDomain(catchThrowable(() -> service.saveMedicine(FARM_ID, 52L, null, medicine("OXY-10", 28, null, true, 1))), HttpStatus.CONFLICT,
            MessageCodes.COM_05);
        verifyNoInteractions(audit);
    }

    @Test
    void tc1801ATechnicianCannotSaveAMedicine() {
        when(access.require(FARM_ID, FarmAction.MANAGE_CARE_CATALOGUES)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> service.saveMedicine(FARM_ID, null, null, medicine("OXY-10", 28, null, true, null))), HttpStatus.FORBIDDEN,
            MessageCodes.COM_01);
        verifyNoInteractions(em, audit);
    }
}
