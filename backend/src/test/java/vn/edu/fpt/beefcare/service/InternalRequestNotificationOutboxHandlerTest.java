package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.InternalRequestRepository;

@ExtendWith(MockitoExtension.class)
class InternalRequestNotificationOutboxHandlerTest {
    @Mock EntityManager entityManager;
    @Mock InternalRequestRepository requests;
    @Mock NotificationTargetAccessService targetAccess;
    @Mock NotificationService notifications;

    private InternalRequestNotificationOutboxHandler handler;
    private OutboxEvent event;
    private InternalRequest request;
    private SupportTicket ticket;
    private AppUser recipient;

    @BeforeEach
    void setUp() {
        handler=new InternalRequestNotificationOutboxHandler(new ObjectMapper(),entityManager,requests,targetAccess,notifications);
        recipient=new AppUser();recipient.setId(44L);recipient.setAccountStatus("ACTIVE");
        ticket=new SupportTicket();ticket.setId(77L);
        request=new InternalRequest();request.setId(12L);request.setCode("IR-0012");request.setState("OPEN");request.setTargetRole("PM");request.setRecipient(recipient);request.setVersion(3);request.setTicket(ticket);
        event=new OutboxEvent();ReflectionTestUtils.setField(event,"id",91L);event.setEventType(InternalRequestNotificationOutboxHandler.EVENT_TYPE);
        event.setAggregateType("InternalRequest");event.setAggregateId("12");event.setPayloadJson("{\"recipientId\":44,\"action\":\"CREATED\",\"requestVersion\":3}");
    }

    private void stubRequestAndTicket() {
        when(requests.findById(12L)).thenReturn(Optional.of(request));
        when(entityManager.find(SupportTicket.class,77L,LockModeType.PESSIMISTIC_WRITE)).thenReturn(ticket);
    }

    private void stubCurrentRecipientAccess() {
        when(targetAccess.canOpenInternalRequest(recipient,12L)).thenReturn(true);
    }

    @Test
    void retriesUseTheOutboxEventIdAsRecipientDeduplicationKey() throws Exception {
        stubRequestAndTicket();
        stubCurrentRecipientAccess();
        assertThat(handler.supports(InternalRequestNotificationOutboxHandler.EVENT_TYPE)).isTrue();
        assertThat(handler.supports("SUPPORT_UPDATED")).isFalse();

        handler.handle(event);
        handler.handle(event);

        verify(notifications,times(2)).notify(recipient,"SUPPORT","INTERNAL_REQUEST",12L,
            "Bạn có yêu cầu nội bộ mới IR-0012","Trạng thái: OPEN","JOB07:INTERNAL_REQUEST:91");
    }

    @Test
    void reassignmentBeforeDispatchDoesNotSendTheOldRecipientsNotice() throws Exception {
        stubRequestAndTicket();
        AppUser newRecipient=new AppUser();newRecipient.setId(55L);newRecipient.setAccountStatus("ACTIVE");
        request.setRecipient(newRecipient);

        handler.handle(event);

        verifyNoInteractions(targetAccess,notifications);
    }

    @Test
    void revokedCurrentPlatformAccessClosesTheEventWithoutCreatingANotice() throws Exception {
        stubRequestAndTicket();
        when(targetAccess.canOpenInternalRequest(recipient,12L)).thenReturn(false);

        handler.handle(event);

        verify(notifications,never()).notify(any(),anyString(),anyString(),anyLong(),anyString(),anyString(),anyString());
    }

    @Test
    void staleCreateEventIsSkippedAfterTheRequestIsCancelled() throws Exception {
        stubRequestAndTicket();
        request.setState("CANCELLED");

        handler.handle(event);

        verifyNoInteractions(targetAccess,notifications);
    }

    @Test
    void eventForAnOlderRequestVersionIsSkippedEvenWhenTheRecipientMatchesAgain() throws Exception {
        stubRequestAndTicket();
        request.setVersion(5);

        handler.handle(event);

        verifyNoInteractions(targetAccess,notifications);
    }

    @Test
    void notificationFailurePropagatesSoOutboxCanRetry() {
        stubRequestAndTicket();
        stubCurrentRecipientAccess();
        doThrow(new IllegalStateException("notification store unavailable")).when(notifications)
            .notify(any(),anyString(),anyString(),anyLong(),anyString(),anyString(),anyString());

        assertThatThrownBy(()->handler.handle(event)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsPayloadWithoutTheRecipientVersionSnapshot() {
        event.setPayloadJson("{\"recipientId\":44,\"action\":\"CREATED\"}");

        assertThatThrownBy(()->handler.handle(event)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(requests,targetAccess,notifications);
    }
}
