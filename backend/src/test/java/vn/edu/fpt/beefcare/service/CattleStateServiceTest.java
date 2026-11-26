package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.assertj.core.api.InstanceOfAssertFactories;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

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
        FarmClock clock = new FarmClock(Clock.fixed(Instant.parse("2026-10-28T04:00:00Z"), ZoneOffset.UTC));
        CattleStateService service = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(service, "em", em);
        Farm farm = new Farm(); farm.setId(12L); farm.setTimeZone("Asia/Ho_Chi_Minh");
        Cattle cattle = new Cattle(); cattle.setId(35L); cattle.setFarm(farm);

        var state = service.state(cattle);

        assertThat(state).containsEntry("healthState", "HEALTHY")
            .containsEntry("withdrawalEndDate", null)
            .containsEntry("suspectedContagious", false)
            .containsEntry("vaccinationOverdue", 0)
            .containsEntry("reproductiveStatus", "NOT_APPLICABLE")
            .containsEntry("expectedCalvingDate", null)
            .containsEntry("expectedBasis", null)
            .containsEntry("breedingEligible", null)
            .containsEntry("failedBreedingConditions", List.of());
    }

    @Test
    void tc1105ReturnsToAwaitingBreedingAtTheExact24HourEstrusBoundary() {
        long cattleId = 1105L;
        // 06:30 in Asia/Ho_Chi_Minh, exactly 24 hours after yesterday's 06:30 estrus.
        Instant now = Instant.parse("2026-11-01T23:30:00Z");
        Cattle cattle = new Cattle();
        cattle.setId(cattleId);
        cattle.setSex(Sex.FEMALE);
        cattle.setLifeStage(LifeStage.ADULT);
        ProductionPurpose purpose = new ProductionPurpose();
        purpose.setPurposeType(PurposeType.BREEDING);
        cattle.setPurpose(purpose);

        ReproductionEvent estrus = new ReproductionEvent();
        estrus.setType("ESTRUS");
        estrus.setStatus("VALID");
        estrus.setEventTime(now.minusSeconds(24 * 60 * 60L));
        estrus.setCattle(cattle);

        EntityManager em = mock(EntityManager.class);
        @SuppressWarnings("unchecked")
        TypedQuery<ReproductionEvent> eventQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(ReproductionEvent.class))).thenReturn(eventQuery);
        when(eventQuery.setParameter("id", cattleId)).thenReturn(eventQuery);
        when(eventQuery.setMaxResults(1)).thenReturn(eventQuery);
        when(eventQuery.getResultList()).thenReturn(List.of(estrus));

        @SuppressWarnings("unchecked")
        TypedQuery<CalvingEvent> calvingQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(CalvingEvent.class))).thenReturn(calvingQuery);
        when(calvingQuery.setParameter("id", cattleId)).thenReturn(calvingQuery);
        when(calvingQuery.setMaxResults(1)).thenReturn(calvingQuery);
        when(calvingQuery.getResultStream()).thenReturn(Stream.empty());

        @SuppressWarnings("unchecked")
        TypedQuery<Instant> pregnancyUpdateQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Instant.class))).thenReturn(pregnancyUpdateQuery);
        when(pregnancyUpdateQuery.setParameter("id", cattleId)).thenReturn(pregnancyUpdateQuery);
        when(pregnancyUpdateQuery.getSingleResult()).thenReturn(null);

        CattleStateService service = new CattleStateService(
            new FarmClock(Clock.fixed(now, ZoneOffset.UTC)), new ObjectMapper()
        );
        ReflectionTestUtils.setField(service, "em", em);

        String actual = ReflectionTestUtils.invokeMethod(
            service, "reproductiveStatus", cattle, null, LocalDate.of(2026, 11, 2)
        );

        assertThat(actual).isEqualTo("AWAITING_BREEDING");
    }

    /** SCR-19 #21: chỉ đếm mũi PLANNED của lịch ACTIVE đã qua hạn; không đụng tới các chỉ số khác. */
    @Test
    void countsOverdueScheduledDosesOfTheCattle() {
        List<String> executed = new ArrayList<>();
        EntityManager em = mock(EntityManager.class);
        when(em.createQuery(anyString(), any(Class.class))).thenAnswer(invocation -> {
            String jpql = invocation.getArgument(0);
            executed.add(jpql);
            Object single = jpql.contains("ScheduledDose") ? Long.valueOf(2L) : jpql.contains("count(") ? Long.valueOf(0L) : null;
            @SuppressWarnings("unchecked") TypedQuery<Object> query = mock(TypedQuery.class);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getSingleResult()).thenReturn(single);
            when(query.getResultList()).thenReturn(List.of());
            when(query.getResultStream()).thenReturn(Stream.empty());
            return query;
        });
        FarmClock clock = new FarmClock(Clock.fixed(Instant.parse("2026-10-28T04:00:00Z"), ZoneOffset.UTC));
        CattleStateService service = new CattleStateService(clock, new ObjectMapper());
        ReflectionTestUtils.setField(service, "em", em);
        Farm farm = new Farm(); farm.setId(12L); farm.setTimeZone("Asia/Ho_Chi_Minh");
        Cattle cattle = new Cattle(); cattle.setId(35L); cattle.setFarm(farm);

        assertThat(service.state(cattle)).containsEntry("vaccinationOverdue", 2).containsEntry("healthState", "HEALTHY");
        assertThat(executed)
            .filteredOn(jpql -> jpql.contains("ScheduledDose"))
            .singleElement(InstanceOfAssertFactories.STRING)
            .contains("upper(d.status)='PLANNED'")
            .contains("upper(d.schedule.status)='ACTIVE'")
            .contains("d.dueDate<:today");
    }
}
