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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.ReminderParameter;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/**
 * Unit tests (Mockito, no Spring context, no database) for {@link FarmParameterCommandService#create}, the main
 * function of UC-FE18-05 Configure Farm State and Reminder References: an immutable parameter version merged over the
 * version in force, with range and ordering rules (MSG-FE18-06). The farm clock is fixed at 27/11/2026 10:00 (UTC+7);
 * the farm's latest version is v4, in force since 01/10/2026.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FarmParameterCommandServiceUnitTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final long FARM_ID = 501L;
    private static final ObjectMapper JSON = JsonMapper.builder().addModule(new JavaTimeModule()).build();
    private static final String V4_VALUES = "{\"WEANING_AGE_MONTHS\":7,\"YOUNG_STOCK_AGE_MONTHS\":12,\"ADULT_AGE_MONTHS\":24,"
        + "\"WEIGHING_INTERVAL_DAYS\":30,\"BREEDING_WINDOW_START_HOURS\":12,\"BREEDING_WINDOW_END_HOURS\":18,"
        + "\"TARGET_FINISHING_WEIGHT_KG\":450,\"GESTATION_LENGTH_DAYS\":283,\"BCS_SCALE\":\"1-5:0.5\"}";

    @Mock EntityManager em;
    @Mock FarmAccessService access;
    @Mock IdempotencyCommandService idempotency;
    @Mock AuditService audit;
    @Mock ReminderReconciliationService reminders;

    private FarmParameterCommandService service;
    private Farm farm;
    private AppUser owner;
    private List<FarmParameterVersion> versions = new ArrayList<>();
    private final List<FarmParameterVersion> snapshots = new ArrayList<>();
    private final List<ReminderParameter> legacy = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new FarmParameterCommandService(access, idempotency, audit, new FarmClock(Clock.fixed(Instant.parse("2026-11-27T03:00:00Z"), ZoneOffset.UTC)),
            JSON, reminders);
        ReflectionTestUtils.setField(service, "em", em);
        farm = new Farm();
        farm.setId(FARM_ID);
        owner = new AppUser();
        owner.setId(31L);
        owner.setFullName("Nguyen Thanh An");
        when(access.require(FARM_ID, FarmAction.MANAGE_CARE_CATALOGUES)).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
        when(idempotency.execute(anyLong(), any(FarmAction.class), anyString(), any(), any(), any(Class.class), any(Supplier.class)))
            .thenAnswer(inv -> inv.<Supplier<?>>getArgument(6).get());
        when(em.find(Farm.class, FARM_ID, LockModeType.PESSIMISTIC_WRITE)).thenReturn(farm);
        when(em.createQuery(anyString(), eq(FarmParameterVersion.class))).thenAnswer(inv -> versionQuery());
        doAnswer(inv -> {
            Object entity = inv.getArgument(0);
            if (entity instanceof FarmParameterVersion v) {
                v.setId(800L + v.getVersionNo());
                snapshots.add(v);
            } else if (entity instanceof ReminderParameter r) {
                legacy.add(r);
            }
            return null;
        }).when(em).persist(any());
        FarmParameterVersion v4 = new FarmParameterVersion();
        v4.setId(804L);
        v4.setFarm(farm);
        v4.setVersionNo(4);
        v4.setGestationLengthDays(283);
        v4.setEffectiveFrom(LocalDate.of(2026, 10, 1));
        v4.setParameterValues(V4_VALUES);
        versions.add(v4);
    }

    @SuppressWarnings("unchecked")
    private TypedQuery<FarmParameterVersion> versionQuery() {
        TypedQuery<FarmParameterVersion> query = mock(TypedQuery.class, RETURNS_SELF);
        when(query.getResultList()).thenAnswer(inv -> versions);
        return query;
    }

    private CareDtos.ParameterVersionResult save(Map<String, Object> parameters, Integer gestation, LocalDate effective, String note, Integer base) {
        return service.create(FARM_ID, "key-p", new CareDtos.ParameterVersionCommand(parameters, gestation, effective, note, base));
    }

    private CareDtos.ParameterVersionResult save(Map<String, Object> parameters) {
        return save(parameters, null, null, "Theo khuyen cao thu y", 4);
    }

    private static Map<String, Object> one(String name, Object value) {
        Map<String, Object> map = new HashMap<>();
        map.put(name, value);
        return map;
    }

    private static void assertDomain(Throwable thrown, HttpStatus status, String code) {
        assertThat(thrown).isInstanceOf(DomainException.class);
        assertThat(((DomainException) thrown).getStatus()).isEqualTo(status);
        assertThat(((DomainException) thrown).getCode()).isEqualTo(code);
    }

    private static void assertRange(Throwable thrown, String parameter, int min, int max) {
        assertDomain(thrown, HttpStatus.UNPROCESSABLE_ENTITY, MessageCodes.FE18_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("parameter", parameter).containsEntry("min", min).containsEntry("max", max);
    }

    private void assertNothingSaved() {
        assertThat(snapshots).isEmpty();
        assertThat(legacy).isEmpty();
        verifyNoInteractions(audit, reminders);
    }

    @Test
    void tc1823AChangeEffectiveTodayBecomesTheNextVersionAndRecomputesReminders() {
        CareDtos.ParameterVersionResult result = save(one("WEIGHING_INTERVAL_DAYS", 45), null, TODAY, "  Theo khuyen cao thu y  ", 4);

        assertThat(snapshots).singleElement().satisfies(v -> {
            assertThat(v.getVersionNo()).isEqualTo(5);
            assertThat(v.getEffectiveFrom()).isEqualTo(TODAY);
            assertThat(v.getSourceNote()).isEqualTo("Theo khuyen cao thu y");
            assertThat(v.getChangedBy()).isSameAs(owner);
        });
        assertThat(result.parameters()).containsEntry("WEIGHING_INTERVAL_DAYS", 45).containsEntry("WEANING_AGE_MONTHS", 7)
            .containsEntry("TARGET_FINISHING_WEIGHT_KG", 450);
        assertThat(result.versionNo()).isEqualTo(5);
        assertThat(result.scheduled()).isFalse();
        assertThat(result.savedBy()).isEqualTo("Nguyen Thanh An");
        assertThat(legacy).hasSize(result.parameters().size()).allSatisfy(r -> assertThat(r.getVersionNo()).isEqualTo(5));
        verify(reminders).reconcileFarm(FARM_ID);
        verify(audit).log(any(FarmContext.class), eq("FARM_PARAMETER_VERSION"), eq("FarmParameterVersion"), eq(805L), any());
    }

    @Test
    void tc1824AFutureVersionIsScheduledAndLeavesCurrentRemindersAlone() {
        CareDtos.ParameterVersionResult result = save(one("WEIGHING_INTERVAL_DAYS", 45), null, LocalDate.of(2026, 12, 1), "Ap dung tu thang 12", 4);

        assertThat(result.scheduled()).isTrue();
        assertThat(result.effectiveFrom()).isEqualTo(LocalDate.of(2026, 12, 1));
        assertThat(legacy).isEmpty();
        verify(reminders, never()).reconcileFarm(anyLong());
    }

    @Test
    void tc1825ClearingTheTargetFinishingWeightRemovesIt() {
        CareDtos.ParameterVersionResult result = save(one("TARGET_FINISHING_WEIGHT_KG", null));

        assertThat(result.parameters()).doesNotContainKey("TARGET_FINISHING_WEIGHT_KG");
        assertThat(snapshots.get(0).getParameterValues()).doesNotContain("TARGET_FINISHING_WEIGHT_KG");
    }

    @Test
    void tc1818AWeaningAgeOf13MonthsIsOutOfRange() {
        assertRange(catchThrowable(() -> save(one("WEANING_AGE_MONTHS", 13))), "WEANING_AGE_MONTHS", 3, 12);
        assertRange(catchThrowable(() -> save(one("WEANING_AGE_MONTHS", 2))), "WEANING_AGE_MONTHS", 3, 12);
        assertNothingSaved();

        assertThat(save(one("WEANING_AGE_MONTHS", 3)).parameters()).containsEntry("WEANING_AGE_MONTHS", 3);
    }

    @Test
    void tc1819StageAgesMustStrictlyIncrease() {
        Map<String, Object> same = new HashMap<>();
        same.put("WEANING_AGE_MONTHS", 12);
        same.put("YOUNG_STOCK_AGE_MONTHS", 12);

        assertRange(catchThrowable(() -> save(same)), "YOUNG_STOCK_AGE_MONTHS", 13, 24);
        Map<String, Object> adultBeforeYoung = new HashMap<>();
        adultBeforeYoung.put("YOUNG_STOCK_AGE_MONTHS", 20);
        adultBeforeYoung.put("ADULT_AGE_MONTHS", 18);
        assertRange(catchThrowable(() -> save(adultBeforeYoung)), "ADULT_AGE_MONTHS", 21, 48);
        assertNothingSaved();
    }

    @Test
    void tc1820TheBreedingWindowMustEndAfterItStarts() {
        Map<String, Object> window = new HashMap<>();
        window.put("BREEDING_WINDOW_START_HOURS", 12);
        window.put("BREEDING_WINDOW_END_HOURS", 10);

        assertRange(catchThrowable(() -> save(window)), "BREEDING_WINDOW_END_HOURS", 13, 36);
        assertNothingSaved();
    }

    @Test
    void tc1821TheSourceNoteIsRequired() {
        Throwable thrown = catchThrowable(() -> save(one("WEIGHING_INTERVAL_DAYS", 45), null, null, "  ", 4));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_06);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "sourceNote");
        assertNothingSaved();
    }

    @Test
    void tc1822AVersionCannotStartYesterday() {
        Throwable thrown = catchThrowable(() -> save(one("WEIGHING_INTERVAL_DAYS", 45), null, TODAY.minusDays(1), "Sua lai", 4));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "effectiveFrom");
        assertNothingSaved();
    }

    @Test
    void tc1826SavingFromAnOlderVersionIsAConflict() {
        Throwable thrown = catchThrowable(() -> save(one("WEIGHING_INTERVAL_DAYS", 45), null, null, "Sua tu v3", 3));

        assertDomain(thrown, HttpStatus.CONFLICT, MessageCodes.COM_05);
        assertThat(((DomainException) thrown).getParams()).containsEntry("versionNo", 4);
        assertNothingSaved();
    }

    @Test
    void tcAnnt180501AnUnknownParameterIsRejected() {
        Throwable thrown = catchThrowable(() -> save(one("MILKING_INTERVAL_DAYS", 1)));

        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "parameters.MILKING_INTERVAL_DAYS");
        assertNothingSaved();
    }

    @Test
    void tcAnnt180502TheBcsScaleIsOneOfTheTwoSupportedScales() {
        Throwable thrown = catchThrowable(() -> save(one("BCS_SCALE", "1-10")));
        assertDomain(thrown, HttpStatus.BAD_REQUEST, MessageCodes.COM_10);
        assertThat(((DomainException) thrown).getParams()).containsEntry("field", "parameters.BCS_SCALE");
        assertNothingSaved();

        assertThat(save(one("BCS_SCALE", "1-9:1")).parameters()).containsEntry("BCS_SCALE", "1-9:1");
    }

    @Test
    void tcAnnt180503TheGestationLengthIsFrom270To300Days() {
        assertRange(catchThrowable(() -> save(Map.of(), 301, null, "Giong lai", 4)), "GESTATION_LENGTH_DAYS", 270, 300);
        assertRange(catchThrowable(() -> save(Map.of(), 269, null, "Giong lai", 4)), "GESTATION_LENGTH_DAYS", 270, 300);
        assertNothingSaved();

        CareDtos.ParameterVersionResult result = save(Map.of(), 270, null, "Giong lai", 4);
        assertThat(result.gestationLengthDays()).isEqualTo(270);
        assertThat(result.parameters()).containsEntry("GESTATION_LENGTH_DAYS", 270);
    }

    @Test
    void tcAnnt180504ADecimalBreedingWeightBelow100KgIsOutOfRange() {
        assertRange(catchThrowable(() -> save(one("MIN_BREEDING_WEIGHT_KG", 99.5))), "MIN_BREEDING_WEIGHT_KG", 100, 600);
        assertNothingSaved();

        assertThat(save(one("MIN_BREEDING_WEIGHT_KG", 100.0)).parameters()).containsEntry("MIN_BREEDING_WEIGHT_KG", 100.0);
    }

    @Test
    void tcAnnt180505TheFirstVersionOfAFarmStartsAtOneWithTheDefaultGestation() {
        versions = new ArrayList<>();

        CareDtos.ParameterVersionResult result = save(one("WEIGHING_INTERVAL_DAYS", 30), null, null, "Khoi tao", null);

        assertThat(result.versionNo()).isEqualTo(1);
        assertThat(result.gestationLengthDays()).isEqualTo(283);
        assertThat(result.parameters()).containsOnlyKeys("WEIGHING_INTERVAL_DAYS", "GESTATION_LENGTH_DAYS");
    }

    @Test
    void tcAnnt180506AnUnknownFarmIsNotFound() {
        when(em.find(Farm.class, FARM_ID, LockModeType.PESSIMISTIC_WRITE)).thenReturn(null);

        assertDomain(catchThrowable(() -> save(one("WEIGHING_INTERVAL_DAYS", 45))), HttpStatus.NOT_FOUND, MessageCodes.COM_08);
        assertNothingSaved();
    }

    @Test
    void tc1801ATechnicianCannotSaveParameters() {
        when(access.require(FARM_ID, FarmAction.MANAGE_CARE_CATALOGUES)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertDomain(catchThrowable(() -> save(one("WEIGHING_INTERVAL_DAYS", 45))), HttpStatus.FORBIDDEN, MessageCodes.COM_01);
        verify(idempotency).execute(eq(FARM_ID), eq(FarmAction.MANAGE_CARE_CATALOGUES), eq("FARM_PARAMETER_VERSION_CREATE"), eq("key-p"), any(),
            any(Class.class), any(Supplier.class));
        verifyNoInteractions(em, audit, reminders);
    }
}
