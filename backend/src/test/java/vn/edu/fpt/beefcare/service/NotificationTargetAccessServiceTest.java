package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.*;

@ExtendWith(MockitoExtension.class)
class NotificationTargetAccessServiceTest {
    @Mock FarmAccessService farmAccess;
    @Mock PlatformAccessService platformAccess;
    @Mock SupportTicketRepository tickets;
    @Mock InternalRequestRepository requests;
    @Mock FeedReceiptRepository feedReceipts;
    @Mock FeedItemRepository feeds;
    @Mock FeedingRecordRepository feedingRecords;
    @Mock PaymentRepository payments;
    @InjectMocks NotificationTargetAccessService service;

    @Test void supportTicketNotificationAllowsRequesterAndAnyActiveCs() {
        AppUser requester=user(1L), unrelated=user(3L), cs=user(2L);
        SupportTicket ticket=new SupportTicket();ticket.setRequester(requester); // Queue notices are open to active CS before assignment.
        when(tickets.findById(7L)).thenReturn(Optional.of(ticket));
        assertThat(service.canOpen(requester,notification("SUPPORT_TICKET",7L))).isTrue();
        doThrow(DomainException.forbidden(MessageCodes.COM_01)).when(platformAccess).requireRole(PlatformRole.CS);
        assertThat(service.canOpen(unrelated,notification("SUPPORT_TICKET",7L))).isFalse();
        doReturn(null).when(platformAccess).requireRole(PlatformRole.CS);
        assertThat(service.canOpen(cs,notification("SUPPORT_TICKET",7L))).isTrue();
        verify(platformAccess,times(2)).requireRole(PlatformRole.CS);
    }

    @Test void internalRequestRechecksRecipientAndCurrentTargetRole() {
        AppUser recipient=user(11L), other=user(12L);
        InternalRequest request=new InternalRequest();request.setRecipient(recipient);request.setTargetRole("PM");
        when(requests.findById(9L)).thenReturn(Optional.of(request));
        when(platformAccess.requireRole(PlatformRole.PM)).thenReturn(null);
        assertThat(service.canOpen(recipient,notification("INTERNAL_REQUEST",9L))).isTrue();
        assertThat(service.canOpen(other,notification("INTERNAL_REQUEST",9L))).isFalse();
        verify(platformAccess).requireRole(PlatformRole.PM);
    }

    private static Notification notification(String type,Long id){Notification n=new Notification();n.setTargetType(type);n.setTargetId(id);return n;}
    private static AppUser user(Long id){AppUser u=new AppUser();u.setId(id);return u;}
}
