package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.repository.NotificationRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock NotificationRepository repository;
    @Mock FarmAccessService access;
    @Mock FarmClock clock;
    @Mock NotificationTargetAccessService targetAccess;
    @Mock PaymentRepository payments;
    @InjectMocks NotificationService service;

    @Test void notifyDeduplicatesByRecipientAndEventWithoutStoringTicketBody(){
        AppUser recipient=new AppUser(); recipient.setId(44L);
        when(repository.findByEventKeyAndRecipient_Id("ticket-4-reply-1",44L)).thenReturn(Optional.empty());
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        when(repository.saveAndFlush(any())).thenAnswer(inv->{Notification n=inv.getArgument(0);n.setId(3L);return n;});
        Notification first=service.notify(recipient,"SUPPORT","SUPPORT_TICKET",4L,"Support replied","Open ticket TK-4","ticket-4-reply-1");
        assertThat(first.getSummary()).doesNotContain("full private message");
        verify(repository).saveAndFlush(any(Notification.class));
    }

    @Test void retryReturnsTheExistingRecipientEventRowWithoutInsertingAnother(){
        AppUser recipient=new AppUser();recipient.setId(44L);
        Notification existing=new Notification();existing.setId(8L);existing.setRecipient(recipient);existing.setEventKey("JOB07:ANNOUNCEMENT:91");
        when(repository.findByEventKeyAndRecipient_Id("JOB07:ANNOUNCEMENT:91",44L)).thenReturn(Optional.of(existing));

        Notification result=service.notify(recipient,"ANNOUNCEMENT","ANNOUNCEMENT_VERSION",12L,"Title","Farm context","JOB07:ANNOUNCEMENT:91");

        assertThat(result).isSameAs(existing);
        verify(repository,never()).saveAndFlush(any(Notification.class));
    }

    @Test void inboxIsScopedToCurrentRecipient(){
        AppUser recipient=new AppUser();recipient.setId(9L);when(access.currentActiveUser()).thenReturn(recipient);
        Notification n=new Notification();n.setId(1L);n.setRecipient(recipient);n.setTargetType("FARM");n.setTargetId(1L);
        when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(n));when(targetAccess.canOpen(recipient,n)).thenReturn(true);
        assertThat(service.mine()).extracting(NotificationService.NotificationView::id).containsExactly(1L);verify(repository).findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L);
    }

    @Test void paymentNotificationsExposeTheFarmOfEachPayment(){
        AppUser recipient=new AppUser();recipient.setId(9L);when(access.currentActiveUser()).thenReturn(recipient);
        Notification first=new Notification();first.setId(1L);first.setRecipient(recipient);first.setTargetType("PAYMENT");first.setTargetId(101L);
        Notification second=new Notification();second.setId(2L);second.setRecipient(recipient);second.setTargetType("PAYMENT");second.setTargetId(202L);
        PaymentRepository.RequestFarm firstTarget=mock(PaymentRepository.RequestFarm.class);
        PaymentRepository.RequestFarm secondTarget=mock(PaymentRepository.RequestFarm.class);
        when(firstTarget.getFarmId()).thenReturn(11L);when(secondTarget.getFarmId()).thenReturn(22L);
        when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(first,second));
        when(targetAccess.canOpen(recipient,first)).thenReturn(true);when(targetAccess.canOpen(recipient,second)).thenReturn(true);
        when(payments.findRequestFarmById(101L)).thenReturn(Optional.of(firstTarget));
        when(payments.findRequestFarmById(202L)).thenReturn(Optional.of(secondTarget));

        assertThat(service.mine()).extracting(NotificationService.NotificationView::farmId).containsExactly(11L,22L);
        verify(payments).findRequestFarmById(101L);verify(payments).findRequestFarmById(202L);
    }

    @Test void inboxHidesTargetWhenAuthorizationWasRevoked(){
        AppUser recipient=new AppUser();recipient.setId(9L);Notification n=new Notification();n.setTargetType("FARM");n.setTargetId(7L);
        when(access.currentActiveUser()).thenReturn(recipient);when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(n));when(targetAccess.canOpen(recipient,n)).thenReturn(false);
        assertThat(service.mine()).isEmpty();
    }

    @Test void markingOneNotificationReadRechecksCurrentTargetAccess(){
        AppUser recipient=new AppUser();recipient.setId(9L);Notification n=new Notification();n.setTargetType("ANNOUNCEMENT_VERSION");n.setTargetId(12L);
        when(access.currentActiveUser()).thenReturn(recipient);when(repository.findByIdAndRecipient_Id(5L,9L)).thenReturn(Optional.of(n));
        when(targetAccess.canOpen(recipient,n)).thenReturn(false);

        assertThatThrownBy(()->service.markRead(5L)).isInstanceOf(DomainException.class);
        verify(repository,never()).save(n);
    }

    @Test void reassignedInternalRequestNoticeReturnsFe20_19OnlyToItsStillAuthorizedFormerRecipient(){
        AppUser recipient=new AppUser();recipient.setId(9L);
        AppUser currentRecipient=new AppUser();currentRecipient.setId(10L);
        Notification notice=new Notification();notice.setId(5L);notice.setTargetType("INTERNAL_REQUEST");notice.setTargetId(81L);
        InternalRequest request=new InternalRequest();request.setId(81L);request.setRecipient(currentRecipient);request.setTargetRole("PM");
        when(access.currentActiveUser()).thenReturn(recipient);
        when(repository.findByIdAndRecipient_Id(5L,9L)).thenReturn(Optional.of(notice));
        when(targetAccess.lockInternalRequestsForRead(List.of(81L))).thenReturn(Map.of(81L,request));
        when(targetAccess.hasActiveInternalRequestRole(recipient)).thenReturn(true);

        assertThatThrownBy(()->service.markRead(5L)).isInstanceOfSatisfying(DomainException.class,error -> {
            assertThat(error.getCode()).isEqualTo(MessageCodes.FE20_19);
            assertThat(error.getStatus().value()).isEqualTo(404);
        });

        InOrder order=inOrder(targetAccess);
        order.verify(targetAccess).lockInternalRequestsForRead(List.of(81L));
        order.verify(targetAccess).hasActiveInternalRequestRole(recipient);
        verify(targetAccess,never()).canOpenInternalRequest(recipient,request);
        verify(targetAccess,never()).canOpen(recipient,notice);
        verify(repository,never()).save(notice);
    }

    @Test void reassignedInternalRequestNoticeStaysHiddenAfterTheFormerRecipientsRoleIsRevoked(){
        AppUser recipient=new AppUser();recipient.setId(9L);
        AppUser currentRecipient=new AppUser();currentRecipient.setId(10L);
        Notification notice=new Notification();notice.setId(5L);notice.setTargetType("INTERNAL_REQUEST");notice.setTargetId(81L);
        InternalRequest request=new InternalRequest();request.setId(81L);request.setRecipient(currentRecipient);request.setTargetRole("PM");
        when(access.currentActiveUser()).thenReturn(recipient);
        when(repository.findByIdAndRecipient_Id(5L,9L)).thenReturn(Optional.of(notice));
        when(targetAccess.lockInternalRequestsForRead(List.of(81L))).thenReturn(Map.of(81L,request));
        when(targetAccess.hasActiveInternalRequestRole(recipient)).thenReturn(false);

        assertThatThrownBy(()->service.markRead(5L)).isInstanceOfSatisfying(DomainException.class,error -> {
            assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
            assertThat(error.getStatus().value()).isEqualTo(404);
        });
        verify(repository,never()).save(notice);
    }

    @Test void missingInternalRequestTargetRemainsHidden(){
        AppUser recipient=new AppUser();recipient.setId(9L);
        Notification notice=new Notification();notice.setId(5L);notice.setTargetType("INTERNAL_REQUEST");notice.setTargetId(81L);
        when(access.currentActiveUser()).thenReturn(recipient);
        when(repository.findByIdAndRecipient_Id(5L,9L)).thenReturn(Optional.of(notice));
        when(targetAccess.lockInternalRequestsForRead(List.of(81L))).thenReturn(Map.of());

        assertThatThrownBy(()->service.markRead(5L)).isInstanceOfSatisfying(DomainException.class,error -> {
            assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
            assertThat(error.getStatus().value()).isEqualTo(404);
        });
        verify(targetAccess,never()).hasActiveInternalRequestRole(recipient);
        verify(repository,never()).save(notice);
    }

    @Test void notificationNotOwnedByActorDoesNotInspectItsTarget(){
        AppUser recipient=new AppUser();recipient.setId(9L);
        when(access.currentActiveUser()).thenReturn(recipient);
        when(repository.findByIdAndRecipient_Id(5L,9L)).thenReturn(Optional.empty());

        assertThatThrownBy(()->service.markRead(5L)).isInstanceOfSatisfying(DomainException.class,error -> {
            assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
            assertThat(error.getStatus().value()).isEqualTo(404);
        });
        verifyNoInteractions(targetAccess);
    }

    @Test void markAllReadCountsOnlyNotificationsWhoseTargetsAreStillAccessible(){
        AppUser recipient=new AppUser();recipient.setId(9L);
        Notification accessible=new Notification();accessible.setId(1L);accessible.setReadTime(null);
        Notification revoked=new Notification();revoked.setId(2L);revoked.setReadTime(null);
        when(access.currentActiveUser()).thenReturn(recipient);
        when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(accessible,revoked));
        when(targetAccess.canOpen(recipient,accessible)).thenReturn(true);
        when(targetAccess.canOpen(recipient,revoked)).thenReturn(false);
        when(clock.now()).thenReturn(Instant.parse("2026-11-15T10:00:00Z"));

        assertThat(service.markAllAsRead()).isEqualTo(1);
        assertThat(accessible.getReadTime()).isEqualTo(Instant.parse("2026-11-15T10:00:00Z"));
        assertThat(revoked.getReadTime()).isNull();
        verify(repository).saveAll(List.of(accessible));
    }

    @Test void markAllLocksEveryInternalRequestBeforeCountingOnlyCurrentRecipients(){
        AppUser recipient=new AppUser();recipient.setId(9L);
        Notification assigned=new Notification();assigned.setId(1L);assigned.setTargetType("INTERNAL_REQUEST");assigned.setTargetId(81L);
        Notification reassigned=new Notification();reassigned.setId(2L);reassigned.setTargetType("INTERNAL_REQUEST");reassigned.setTargetId(82L);
        InternalRequest current=new InternalRequest();current.setId(81L);
        InternalRequest stale=new InternalRequest();stale.setId(82L);
        when(access.currentActiveUser()).thenReturn(recipient);
        when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(assigned,reassigned));
        when(targetAccess.lockInternalRequestsForRead(List.of(81L,82L))).thenReturn(Map.of(81L,current,82L,stale));
        when(targetAccess.canOpenInternalRequest(recipient,current)).thenReturn(true);
        when(targetAccess.canOpenInternalRequest(recipient,stale)).thenReturn(false);
        when(clock.now()).thenReturn(Instant.parse("2026-11-15T10:00:00Z"));

        assertThat(service.markAllAsRead()).isEqualTo(1);

        InOrder order=inOrder(targetAccess);
        order.verify(targetAccess).lockInternalRequestsForRead(List.of(81L,82L));
        order.verify(targetAccess).canOpenInternalRequest(recipient,current);
        order.verify(targetAccess).canOpenInternalRequest(recipient,stale);
        assertThat(assigned.getReadTime()).isEqualTo(Instant.parse("2026-11-15T10:00:00Z"));
        assertThat(reassigned.getReadTime()).isNull();
        verify(repository).saveAll(List.of(assigned));
        verify(targetAccess,never()).canOpen(recipient,assigned);
        verify(targetAccess,never()).canOpen(recipient,reassigned);
    }
}
