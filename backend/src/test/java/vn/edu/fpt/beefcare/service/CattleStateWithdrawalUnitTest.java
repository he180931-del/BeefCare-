package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;

class CattleStateWithdrawalUnitTest {

    @Test
    void tc0920UsesLaterTreatmentWithdrawalDateOverVaccinationWithdrawalDate() {
        long cattleId = 920L;
        Farm farm = new Farm();
        farm.setId(9L);

        Cattle cattle = new Cattle();
        cattle.setId(cattleId);
        cattle.setFarm(farm);
        cattle.setSex(null);

        FarmClock clock = new FarmClock(
            Clock.fixed(Instant.parse("2026-11-01T12:00:00Z"), ZoneOffset.UTC)
        );
        CattleStateService service = new CattleStateService(clock, new ObjectMapper());
        EntityManager em = mock(EntityManager.class);
        ReflectionTestUtils.setField(service, "em", em);

        TypedQuery<Long> countQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Long.class))).thenReturn(countQuery);
        when(countQuery.setParameter("id", cattleId)).thenReturn(countQuery);
        when(countQuery.getSingleResult()).thenReturn(0L);

        TypedQuery<LocalDate> dateQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(LocalDate.class))).thenReturn(dateQuery);
        when(dateQuery.setParameter("id", cattleId)).thenReturn(dateQuery);
        when(dateQuery.getSingleResult())
            .thenReturn(LocalDate.of(2026, 11, 30))
            .thenReturn(LocalDate.of(2026, 11, 22));

        TypedQuery<PregnancyEpisode> pregnancyQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(PregnancyEpisode.class))).thenReturn(pregnancyQuery);
        when(pregnancyQuery.setParameter("id", cattleId)).thenReturn(pregnancyQuery);
        when(pregnancyQuery.setMaxResults(1)).thenReturn(pregnancyQuery);
        when(pregnancyQuery.getResultList()).thenReturn(List.of());

        TypedQuery<ReproductionEvent> reproductionQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(ReproductionEvent.class))).thenReturn(reproductionQuery);
        when(reproductionQuery.setParameter("id", cattleId)).thenReturn(reproductionQuery);
        when(reproductionQuery.setMaxResults(1)).thenReturn(reproductionQuery);
        when(reproductionQuery.getResultList()).thenReturn(List.of());

        TypedQuery<Instant> instantQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Instant.class))).thenReturn(instantQuery);
        when(instantQuery.setParameter("id", cattleId)).thenReturn(instantQuery);
        when(instantQuery.getSingleResult()).thenReturn(null);

        TypedQuery<FarmParameterVersion> parameterQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(FarmParameterVersion.class))).thenReturn(parameterQuery);
        when(parameterQuery.setParameter("farm", farm.getId())).thenReturn(parameterQuery);
        when(parameterQuery.setParameter(eq("date"), eq(LocalDate.of(2026, 11, 1))))
            .thenReturn(parameterQuery);
        when(parameterQuery.setMaxResults(1)).thenReturn(parameterQuery);
        when(parameterQuery.getResultList()).thenReturn(List.of());

        var state = service.state(cattle);

        assertThat(state).containsEntry("withdrawalEndDate", LocalDate.of(2026, 11, 30));
        assertThat(state).containsEntry("reproductiveStatus", "NOT_APPLICABLE");
    }
}
