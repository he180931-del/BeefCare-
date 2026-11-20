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
import org.mockito.InOrder;
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
class InternalRequestCompletionNotificationOutboxHandlerTest {
    @Mock EntityManager entityManager;
    @Mock InternalRequestRepository requests;
    @Mock SupportTicketNotificationRecipientResolver notificationRecipients;
    @Mock NotificationTargetAccessService targetAccess;
    @Mock NotificationService notifications;

    private InternalRequestCompletionNotificationOutboxHandler handler;
    private OutboxEvent event;
    private InternalRequest request;
    private SupportTicket ticket;
    private AppUser cs;

    @BeforeEach
    void setUp() {
        handler=new InternalRequestCompletionNotificationOutboxHandler(new ObjectMapper(),entityManager,requests,notificationRecipients,targetAccess,notifications);
        cs=new AppUser();cs.setId(44L);cs.setAccountStatus("ACTIVE");
        ticket=new SupportTicket();ticket.setId(77L);ticket.setAssignedCs(cs);
        request=new InternalRequest();request.setId(12L);request.setCode("IR-0012");request.setState("DONE");request.setTicket(ticket);request.setVersion(4);
        event=new OutboxEvent();ReflectionTestUtils.setField(event,"id",92L);event.setEventType(InternalRequestCompletionNotificationOutboxHandler.EVENT_TYPE);
        event.setAggregateType("InternalRequest");event.setAggregateId("12");event.setPayloadJson("{\"action\":\"COMPLETED\",\"requestVersion\":4,\"ticketId\":77}");
    }

    private void stubCurrentTicket() {
        when(requests.findById(12L)).thenReturn(Optional.of(request));
        when(entityManager.find(SupportTicket.class,77L,LockModeType.PESSIMISTIC_WRITE)).thenReturn(ticket);
    }

    private void stubCurrentCsRecipients() {
        when(notificationRecipients.currentCsRecipients(ticket)).thenAnswer(invocation -> List.of(ticket.getAssignedCs()));
    }

    @Test
    void resolvesCurrentCsRecipientsAndKeepsRetryKeyStable() throws Exception {
        stubCurrentTicket();
        stubCurrentCsRecipients();
        when(targetAccess.canOpenSupportTicket(cs,77L)).thenReturn(true);
        assertThat(handler.supports(InternalRequestCompletionNotificationOutboxHandler.EVENT_TYPE)).isTrue();
        assertThat(handler.supports("SUPPORT_UPDATED")).isFalse();

        handler.handle(event);
        handler.handle(event);

        verify(notificationRecipients,times(2)).currentCsRecipients(ticket);
        verify(notifications,times(2)).notify(cs,"SUPPORT","SUPPORT_TICKET",77L,
            "Yêu cầu nội bộ IR-0012 đã có kết quả","Trạng thái yêu cầu: DONE","JOB07:INTERNAL_REQUEST_COMPLETED:92");
    }

    @Test
    void refreshesLockedTicketBeforeResolvingCurrentCsAfterHandover() throws Exception {
        stubCurrentTicket();
        stubCurrentCsRecipients();
        AppUser nextCs = new AppUser(); nextCs.setId(45L); nextCs.setAccountStatus("ACTIVE");
        doAnswer(invocation -> { ticket.setAssignedCs(nextCs); return null; })
            .when(entityManager).refresh(ticket,LockModeType.PESSIMISTIC_WRITE);
        when(targetAccess.canOpenSupportTicket(nextCs,77L)).thenReturn(true);

        handler.handle(event);

        InOrder order = inOrder(entityManager);
        order.verify(entityManager).find(SupportTicket.class,77L,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(ticket,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).lock(request,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(request);
        verify(notificationRecipients).currentCsRecipients(ticket);
        verify(notifications).notify(nextCs,"SUPPORT","SUPPORT_TICKET",77L,
            "Yêu cầu nội bộ IR-0012 đã có kết quả","Trạng thái yêu cầu: DONE","JOB07:INTERNAL_REQUEST_COMPLETED:92");
        verify(notifications,never()).notify(cs,"SUPPORT","SUPPORT_TICKET",77L,
            "Yêu cầu nội bộ IR-0012 đã có kết quả","Trạng thái yêu cầu: DONE","JOB07:INTERNAL_REQUEST_COMPLETED:92");
    }

    @Test
    void skipsCsWhoLostCurrentAccessBeforeDelivery() throws Exception {
        stubCurrentTicket();
        stubCurrentCsRecipients();
        when(targetAccess.canOpenSupportTicket(cs,77L)).thenReturn(false);

        handler.handle(event);

        verify(notifications,never()).notify(any(),anyString(),anyString(),anyLong(),anyString(),anyString(),anyString());
    }

    @Test
    void propagatesNotificationFailuresForIndependentOutboxRetry() {
        stubCurrentTicket();
        stubCurrentCsRecipients();
        when(targetAccess.canOpenSupportTicket(cs,77L)).thenReturn(true);
        doThrow(new IllegalStateException("notification store unavailable")).when(notifications)
            .notify(any(),anyString(),anyString(),anyLong(),anyString(),anyString(),anyString());

        assertThatThrownBy(()->handler.handle(event)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void rejectsMismatchedTicketSnapshot() {
        stubCurrentTicket();
        event.setPayloadJson("{\"action\":\"COMPLETED\",\"requestVersion\":4,\"ticketId\":78}");

        assertThatThrownBy(()->handler.handle(event)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(targetAccess,notifications);
    }

    @Test
    void skipsCompletionEventWhenRequestVersionHasMoved() throws Exception {
        stubCurrentTicket();
        request.setVersion(5);

        handler.handle(event);

        verifyNoInteractions(targetAccess,notifications);
    }
}
