package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

class GrowthAssessmentServiceUnitTest {

    @Test
    void tc0806PersistsScaleMeasurementsAsMeasuredWeight() {
        long farmId = 806L;
        long cattleId = 8060L;
        Instant measuredAt = Instant.parse("2026-11-05T05:00:00Z");
        Farm farm = new Farm();
        farm.setId(farmId);
        AppUser user = new AppUser();
        FarmContext context = new FarmContext(farm, user, FarmRole.MANAGER);
        Cattle cattle = new Cattle();
        cattle.setId(cattleId);
        cattle.setFarm(farm);

        EntityManager em = mock(EntityManager.class);
        FarmAccessService access = mock(FarmAccessService.class);
        CattleGuardService guard = mock(CattleGuardService.class);
        when(access.require(farmId, FarmAction.MANAGE_GROWTH)).thenReturn(context);
        when(guard.lockWritable(farmId, cattleId)).thenReturn(cattle);

        @SuppressWarnings("unchecked")
        TypedQuery<LocalDate> entryQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(LocalDate.class))).thenReturn(entryQuery);
        when(entryQuery.setParameter("c", cattleId)).thenReturn(entryQuery);
        when(entryQuery.setMaxResults(1)).thenReturn(entryQuery);
        when(entryQuery.getResultStream()).thenReturn(java.util.stream.Stream.empty());

        @SuppressWarnings("unchecked")
        TypedQuery<Growth> recentQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Growth.class))).thenReturn(recentQuery);
        when(recentQuery.setParameter("c", cattleId)).thenReturn(recentQuery);
        when(recentQuery.setParameter("id", -1L)).thenReturn(recentQuery);
        when(recentQuery.setParameter("start", LocalDate.of(2026, 10, 6))).thenReturn(recentQuery);
        when(recentQuery.setParameter("end", LocalDate.of(2026, 11, 5))).thenReturn(recentQuery);
        when(recentQuery.setMaxResults(1)).thenReturn(recentQuery);
        when(recentQuery.getResultList()).thenReturn(List.of());

        GrowthAssessmentService service = new GrowthAssessmentService(
            em, access, guard,
            new FarmClock(Clock.fixed(measuredAt, ZoneId.of("Asia/Ho_Chi_Minh"))),
            mock(AuditService.class), mock(RecordRevisionService.class), mock(OutboxService.class)
        );
        GrowthDtos.Measurement request = new GrowthDtos.Measurement(
            measuredAt, null, "SCALE", new BigDecimal("340.0"), null, null, null, null, false
        );

        GrowthDtos.Record result = service.record(farmId, cattleId, request);

        ArgumentCaptor<Growth> saved = ArgumentCaptor.forClass(Growth.class);
        verify(em).persist(saved.capture());
        assertThat(saved.getValue().getWeightType()).isEqualTo("MEASURED");
        assertThat(saved.getValue().getMethod()).isEqualTo("SCALE");
        assertThat(result.basis()).isEqualTo("MEASURED");
        assertThat(result.weightKg()).isEqualByComparingTo("340.0");
    }

    @Test
    void tc0809PrefersMeasuredWeightOverALaterEstimatedReading() {
        long farmId = 809L;
        long cattleId = 8090L;
        LocalDate today = LocalDate.of(2026, 11, 5);
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        Farm farm = new Farm();
        farm.setId(farmId);
        ProductionPurpose purpose = new ProductionPurpose();
        purpose.setPurposeType(PurposeType.BREEDING);
        Cattle cattle = new Cattle();
        cattle.setId(cattleId);
        cattle.setFarm(farm);
        cattle.setPurpose(purpose);

        Growth measured = growth(1L, cattle, LocalDate.of(2026, 11, 1), "320", "MEASURED");
        Growth estimated = growth(2L, cattle, LocalDate.of(2026, 11, 5), "330", "ESTIMATED");
        EntityManager em = mock(EntityManager.class);
        FarmClock clock = mock(FarmClock.class);
        GrowthAssessmentService service = new GrowthAssessmentService(
            em, mock(FarmAccessService.class), mock(CattleGuardService.class), clock,
            mock(AuditService.class), mock(RecordRevisionService.class), mock(OutboxService.class)
        );
        when(clock.today()).thenReturn(today);
        when(clock.zone()).thenReturn(zone);

        @SuppressWarnings("unchecked")
        TypedQuery<Growth> growthQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Growth.class))).thenReturn(growthQuery);
        when(growthQuery.setParameter("c", cattleId)).thenReturn(growthQuery);
        when(growthQuery.getResultList()).thenReturn(List.of(measured, estimated));

        @SuppressWarnings("unchecked")
        TypedQuery<LocalDate> entryQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(LocalDate.class))).thenReturn(entryQuery);
        when(entryQuery.setParameter("c", cattleId)).thenReturn(entryQuery);
        when(entryQuery.setMaxResults(1)).thenReturn(entryQuery);
        when(entryQuery.getResultStream()).thenReturn(java.util.stream.Stream.empty());

        @SuppressWarnings("unchecked")
        TypedQuery<FarmParameterVersion> parameterQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(FarmParameterVersion.class))).thenReturn(parameterQuery);
        when(parameterQuery.setParameter("f", farmId)).thenReturn(parameterQuery);
        when(parameterQuery.setParameter("d", today)).thenReturn(parameterQuery);
        when(parameterQuery.setMaxResults(1)).thenReturn(parameterQuery);
        when(parameterQuery.getResultList()).thenReturn(List.of());

        var summary = service.summary(cattle, 90);

        assertThat(summary.currentWeight().weightKg()).isEqualByComparingTo("320");
        assertThat(summary.currentWeight().basis()).isEqualTo("MEASURED");
    }

    private static Growth growth(long id, Cattle cattle, LocalDate day, String kg, String basis) {
        Growth growth = new Growth();
        ReflectionTestUtils.setField(growth, "id", id);
        growth.setCattle(cattle);
        growth.setCheckDate(day);
        growth.setEntryTime(day.atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        growth.setMethod("MEASURED".equals(basis) ? "SCALE" : "TAPE");
        growth.setWeightKg(new BigDecimal(kg));
        growth.setWeightType(basis);
        growth.setStatus("VALID");
        return growth;
    }
}
