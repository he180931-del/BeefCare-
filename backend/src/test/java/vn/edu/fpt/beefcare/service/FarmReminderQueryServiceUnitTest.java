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
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.ReminderRepository;

class FarmReminderQueryServiceUnitTest {

    @Test
    void tc1414HighlightsRem09WhenItIsFourDaysOld() {
        long farmId = 1414L;
        long outcomeId = 14901L;
        Instant now = Instant.parse("2026-11-21T12:00:00Z");
        Farm farm = new Farm();
        farm.setId(farmId);
        FarmAccessService access = mock(FarmAccessService.class);
        ReminderRepository reminders = mock(ReminderRepository.class);
        FeedManagementService feedManagement = mock(FeedManagementService.class);
        EntityManager em = mock(EntityManager.class);
        FarmReminderQueryService service = new FarmReminderQueryService(
            access, reminders, feedManagement, new FarmClock(Clock.fixed(now, Clock.systemUTC().getZone())), em, new ObjectMapper()
        );
        when(access.require(farmId, FarmAction.VIEW_CATTLE)).thenReturn(new FarmContext(farm, (AppUser) null, FarmRole.OWNER));
        when(feedManagement.feedReminders(farmId)).thenReturn(List.of());

        Reminder reminder = new Reminder();
        reminder.setId(141401L);
        reminder.setRuleType("REM-09");
        reminder.setSourceRecord("CALF:1");
        reminder.setSourceType("CALF_OUTCOME");
        reminder.setSourceId("CALF_OUTCOME:" + outcomeId);
        reminder.setDueTime(now.minus(4, ChronoUnit.DAYS));
        reminder.setStatus("OPEN");
        when(reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farmId)).thenReturn(List.of(reminder));

        Cattle dam = new Cattle();
        dam.setId(14140L);
        dam.setFarm(farm);
        CalvingEvent calving = new CalvingEvent();
        calving.setDam(dam);
        calving.setBirthTime(reminder.getDueTime());
        CalfOutcome outcome = new CalfOutcome();
        outcome.setId(outcomeId);
        outcome.setCalfNo(1);
        outcome.setCalving(calving);

        TypedQuery<CalfOutcome> outcomeQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(CalfOutcome.class))).thenReturn(outcomeQuery);
        when(outcomeQuery.setParameter("id", outcomeId)).thenReturn(outcomeQuery);
        when(outcomeQuery.setParameter("farm", farmId)).thenReturn(outcomeQuery);
        when(outcomeQuery.setMaxResults(1)).thenReturn(outcomeQuery);
        when(outcomeQuery.getResultList()).thenReturn(List.of(outcome));

        TypedQuery<FarmParameterVersion> parameterQuery = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(FarmParameterVersion.class))).thenReturn(parameterQuery);
        when(parameterQuery.setParameter(eq("farm"), eq(farmId))).thenReturn(parameterQuery);
        when(parameterQuery.setParameter(eq("date"), org.mockito.ArgumentMatchers.any())).thenReturn(parameterQuery);
        when(parameterQuery.setMaxResults(1)).thenReturn(parameterQuery);
        when(parameterQuery.getResultList()).thenReturn(List.of());

        var shown = service.mine(farmId);

        assertThat(shown).singleElement().satisfies(view -> {
            assertThat(view.ruleType()).isEqualTo("REM-09");
            assertThat(view.urgency()).isEqualTo("OVERDUE");
            assertThat(view.highlighted()).isTrue();
        });
    }
}
