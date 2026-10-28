package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import com.fasterxml.jackson.databind.ObjectMapper;

class CattleStateServiceTest {

    @Test
    void derivesHealthyAndNotApplicableWithoutPersistingState() {
        EntityManager em = mock(EntityManager.class);
        when(em.createQuery(anyString(), any(Class.class))).thenAnswer(invocation -> {
            String jpql = invocation.getArgument(0);
            @SuppressWarnings("unchecked") TypedQuery<Object> query = mock(TypedQuery.class);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getSingleResult()).thenReturn(jpql.contains("count(") ? 0L : null);
            when(query.getResultList()).thenReturn(List.of());
            when(query.getResultStream()).thenReturn(Stream.empty());
            return query;
        });
        FarmClock clock = new FarmClock(Clock.fixed(Instant.parse("2026-10-28T04:00:00Z"), ZoneOffset.UTC), "Asia/Ho_Chi_Minh");
        CattleStateService service = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(service, "em", em);
        Farm farm = new Farm(); farm.setId(12L); farm.setTimeZone("Asia/Ho_Chi_Minh");
        Cattle cattle = new Cattle(); cattle.setId(35L); cattle.setFarm(farm);

        var state = service.state(cattle);

        assertThat(state).containsEntry("healthState", "HEALTHY")
            .containsEntry("withdrawalEndDate", null)
            .containsEntry("suspectedContagious", false)
            .containsEntry("reproductiveStatus", "NOT_APPLICABLE")
            .containsEntry("expectedCalvingDate", null)
            .containsEntry("expectedBasis", null)
            .containsEntry("breedingEligible", null)
            .containsEntry("failedBreedingConditions", List.of());
    }
}
