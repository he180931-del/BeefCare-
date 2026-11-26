package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.lang.reflect.Constructor;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

class FarmDashboardServiceUnitTest {
    private EntityManager em;
    private FarmDashboardService service;

    @BeforeEach
    void setUp() {
        em = mock(EntityManager.class);
        service = new FarmDashboardService(em, mock(FarmAccessService.class), mock(FarmClock.class), new ObjectMapper());
    }

    @Test
    void tc1504WeanedCalfTakesPriorityOverSirePurpose() {
        Cattle bull = new Cattle();
        bull.setSex(Sex.MALE);
        bull.setLifeStage(LifeStage.WEANED_CALF);
        ProductionPurpose sire = new ProductionPurpose();
        sire.setPurposeType(PurposeType.SIRE);
        bull.setPurpose(sire);

        String group = ReflectionTestUtils.invokeMethod(service, "herdGroup", bull);

        assertThat(group).isEqualTo("CALVES");
    }

    @Test
    void tc1503ClassifiesTenCattleOnceUsingTheHerdGroupPriorityRules() {
        List<Cattle> herd = List.of(
            cattle(15031L, Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING),
            cattle(15032L, Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING),
            cattle(15033L, Sex.MALE, LifeStage.WEANED_CALF, PurposeType.SIRE),
            cattle(15034L, Sex.FEMALE, LifeStage.UNWEANED_CALF, PurposeType.BREEDING),
            cattle(15035L, Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING),
            cattle(15036L, Sex.FEMALE, LifeStage.ADULT, PurposeType.FATTENING),
            cattle(15037L, Sex.FEMALE, LifeStage.YOUNG_STOCK, PurposeType.BREEDING),
            cattle(15038L, Sex.MALE, LifeStage.YOUNG_STOCK, null),
            cattle(15039L, Sex.MALE, LifeStage.ADULT, PurposeType.SIRE),
            cattle(15040L, Sex.FEMALE, LifeStage.ADULT, null)
        );

        Map<String, Long> counts = herd.stream()
            .map(c -> (String) ReflectionTestUtils.invokeMethod(service, "herdGroup", c))
            .collect(java.util.stream.Collectors.groupingBy(group -> group, java.util.stream.Collectors.counting()));

        assertThat(counts.values()).hasSize(6);
        assertThat(counts.values().stream().mapToLong(Long::longValue).sum()).isEqualTo(10);
        assertThat(counts).containsExactlyInAnyOrderEntriesOf(Map.of(
            "BREEDING_FEMALES", 2L,
            "CALVES", 2L,
            "FATTENING", 2L,
            "YOUNG_STOCK", 2L,
            "BREEDING_BULLS", 1L,
            "OTHER", 1L
        ));
    }

    @Test
    void tc1509OneHundredTwentyDaysPostCalvingExceedsTheDefaultOneHundredEightDayThreshold() throws Exception {
        long farmId = 1509L;
        long cattleId = 15090L;
        LocalDate today = LocalDate.of(2026, 11, 21);
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        Cattle cow = cattle(cattleId, Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING);
        cow.setDisplayCode("C-1509");
        CalvingEvent calving = new CalvingEvent();
        calving.setDam(cow);
        calving.setBirthTime(today.minusDays(120).atStartOfDay(zone).toInstant());

        TypedQuery<CalvingEvent> calvings = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(CalvingEvent.class))).thenReturn(calvings);
        when(calvings.setParameter("farm", farmId)).thenReturn(calvings);
        when(calvings.setParameter("until", today.plusDays(1).atStartOfDay(zone).toInstant())).thenReturn(calvings);
        when(calvings.getResultList()).thenReturn(List.of(calving));

        TypedQuery<ReproductionEvent> checks = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(ReproductionEvent.class))).thenReturn(checks);
        when(checks.setParameter("farm", farmId)).thenReturn(checks);
        when(checks.setParameter("from", today.minusYears(1).atStartOfDay(zone).toInstant())).thenReturn(checks);
        when(checks.setParameter("until", today.plusDays(1).atStartOfDay(zone).toInstant())).thenReturn(checks);
        when(checks.getResultList()).thenReturn(List.of());

        Class<?> stateType = Class.forName(FarmDashboardService.class.getName() + "$DashboardCattleState");
        Constructor<?> stateConstructor = stateType.getDeclaredConstructor(String.class, LocalDate.class, String.class, LocalDate.class);
        stateConstructor.setAccessible(true);
        Object notPregnant = stateConstructor.newInstance("HEALTHY", null, "NOT_PREGNANT", null);
        Map<Long, Object> states = Map.of(cattleId, notPregnant);

        @SuppressWarnings("unchecked")
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(
            service, "reproductionAtGlance", farmId, today, List.of(cow), states, Map.of(), zone
        );

        assertThat(result).containsEntry("overdueCount", 1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> overdue = (List<Map<String, Object>>) result.get("overdueFemales");
        assertThat(overdue).singleElement().satisfies(row -> {
            assertThat(row).containsEntry("cattleId", cattleId).containsEntry("daysSinceCalving", 120L);
        });
    }

    @Test
    void tc1506DashboardAdgForOctoberWeightsIsOneKgPerDay() {
        long cattleId = 1506L;
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = LocalDate.of(2026, 10, 31);
        Cattle cow = new Cattle();
        ReflectionTestUtils.setField(cow, "id", cattleId);
        TypedQuery<Growth> growthQuery = mock(TypedQuery.class);
        TypedQuery<vn.edu.fpt.beefcare.domain.PenAssignment> assignmentQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Growth.class))).thenReturn(growthQuery);
        when(growthQuery.setParameter("ids", Set.of(cattleId))).thenReturn(growthQuery);
        when(growthQuery.setParameter("from", from)).thenReturn(growthQuery);
        when(growthQuery.setParameter("to", to)).thenReturn(growthQuery);
        when(growthQuery.getResultList()).thenReturn(List.of(
            growth(1L, cow, from, "300"),
            growth(2L, cow, to, "330")));
        when(em.createQuery(anyString(), eq(vn.edu.fpt.beefcare.domain.PenAssignment.class))).thenReturn(assignmentQuery);
        when(assignmentQuery.setParameter("ids", Set.of(cattleId))).thenReturn(assignmentQuery);
        when(assignmentQuery.setParameter("from", from)).thenReturn(assignmentQuery);
        when(assignmentQuery.setParameter("to", to)).thenReturn(assignmentQuery);
        when(assignmentQuery.getResultList()).thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(service, "averageDailyGain", List.of(cow), from, to);

        assertThat(result).containsEntry("sampleCount", 1).containsEntry("averageKgPerDay", new BigDecimal("1.000"));
    }

    @Test
    void tc1505SuppressesDashboardAdgWhenValidWeightsAreOnlyTenDaysApart() {
        long cattleId = 1505L;
        LocalDate from = LocalDate.of(2026, 10, 1);
        LocalDate to = from.plusDays(10);
        Cattle cow = new Cattle();
        ReflectionTestUtils.setField(cow, "id", cattleId);
        TypedQuery<Growth> growthQuery = mock(TypedQuery.class);
        TypedQuery<vn.edu.fpt.beefcare.domain.PenAssignment> assignmentQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Growth.class))).thenReturn(growthQuery);
        when(growthQuery.setParameter("ids", Set.of(cattleId))).thenReturn(growthQuery);
        when(growthQuery.setParameter("from", from)).thenReturn(growthQuery);
        when(growthQuery.setParameter("to", to)).thenReturn(growthQuery);
        when(growthQuery.getResultList()).thenReturn(List.of(
            growth(1L, cow, from, "300"),
            growth(2L, cow, to, "310")));
        when(em.createQuery(anyString(), eq(vn.edu.fpt.beefcare.domain.PenAssignment.class))).thenReturn(assignmentQuery);
        when(assignmentQuery.setParameter("ids", Set.of(cattleId))).thenReturn(assignmentQuery);
        when(assignmentQuery.setParameter("from", from)).thenReturn(assignmentQuery);
        when(assignmentQuery.setParameter("to", to)).thenReturn(assignmentQuery);
        when(assignmentQuery.getResultList()).thenReturn(List.of());

        @SuppressWarnings("unchecked")
        Map<String, Object> result = ReflectionTestUtils.invokeMethod(service, "averageDailyGain", List.of(cow), from, to);

        assertThat(result).containsEntry("sampleCount", 0);
        assertThat(result.get("averageKgPerDay")).isNull();
    }

    private static Growth growth(long id, Cattle cattle, LocalDate day, String kg) {
        Growth growth = new Growth();
        ReflectionTestUtils.setField(growth, "id", id);
        growth.setCattle(cattle);
        growth.setCheckDate(day);
        growth.setWeightKg(new BigDecimal(kg));
        growth.setStatus("VALID");
        return growth;
    }

    private static Cattle cattle(long id, Sex sex, LifeStage stage, PurposeType purposeType) {
        Cattle cattle = new Cattle();
        ReflectionTestUtils.setField(cattle, "id", id);
        cattle.setSex(sex);
        cattle.setLifeStage(stage);
        if (purposeType != null) {
            ProductionPurpose purpose = new ProductionPurpose();
            purpose.setPurposeType(purposeType);
            cattle.setPurpose(purpose);
        }
        return cattle;
    }
}
