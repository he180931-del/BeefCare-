package vn.edu.fpt.beefcare.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.repository.OutboxEventRepository;

class OutboxServiceTest {

    @Test
    void supportedEventIsNotStarvedByEarlierUnhandledBacklog() throws Exception {
        OutboxEventRepository repository = mock(OutboxEventRepository.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        OutboxEventHandler reminderHandler = handlerFor("FARM_REMINDER_SOURCE_CHANGED");
        OutboxEvent candidate = event(901L, "FARM_REMINDER_SOURCE_CHANGED");
        when(repository.findDueEventTypes(any())).thenReturn(List.of("FARM_COMMAND_COMMITTED", "FARM_REMINDER_SOURCE_CHANGED"));
        when(repository.findDueByEventTypeIn(eq(List.of("FARM_REMINDER_SOURCE_CHANGED")), any(Instant.class), any(Pageable.class)))
            .thenReturn(List.of(candidate));
        when(repository.claim(eq(901L), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(repository.findById(901L)).thenReturn(Optional.of(candidate));

        new OutboxService(repository, new ObjectMapper(), List.of(reminderHandler), transactions).dispatchDueEvents();

        verify(repository).findDueByEventTypeIn(eq(List.of("FARM_REMINDER_SOURCE_CHANGED")), any(Instant.class), any(Pageable.class));
        verify(repository, never()).findDue(any(Instant.class), any(Pageable.class));
        verify(reminderHandler).handle(candidate);
    }

    @Test
    void duplicateHandlersStillLeaveEventRetryableWithoutCallingEitherHandler() throws Exception {
        OutboxEventRepository repository = mock(OutboxEventRepository.class);
        PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
        when(transactions.getTransaction(any(TransactionDefinition.class))).thenReturn(new SimpleTransactionStatus());
        OutboxEventHandler first = handlerFor("FARM_REMINDER_SOURCE_CHANGED");
        OutboxEventHandler second = handlerFor("FARM_REMINDER_SOURCE_CHANGED");
        OutboxEvent candidate = event(902L, "FARM_REMINDER_SOURCE_CHANGED");
        when(repository.findDueEventTypes(any())).thenReturn(List.of("FARM_REMINDER_SOURCE_CHANGED"));
        when(repository.findDueByEventTypeIn(eq(List.of("FARM_REMINDER_SOURCE_CHANGED")), any(Instant.class), any(Pageable.class)))
            .thenReturn(List.of(candidate));
        when(repository.findById(902L)).thenReturn(Optional.of(candidate));

        new OutboxService(repository, new ObjectMapper(), List.of(first, second), transactions).dispatchDueEvents();

        verify(repository).findById(902L);
        verify(candidate).setLastError("IllegalStateException");
        verify(candidate).setAvailableAt(any(Instant.class));
        verify(repository, never()).claim(eq(902L), any(Instant.class), any(Instant.class));
        verify(first, never()).handle(any());
        verify(second, never()).handle(any());
    }

    private static OutboxEventHandler handlerFor(String supportedType) {
        OutboxEventHandler handler = mock(OutboxEventHandler.class);
        when(handler.supports(supportedType)).thenReturn(true);
        return handler;
    }

    private static OutboxEvent event(Long id, String type) {
        OutboxEvent event = mock(OutboxEvent.class);
        when(event.getId()).thenReturn(id);
        when(event.getEventType()).thenReturn(type);
        return event;
    }
}
