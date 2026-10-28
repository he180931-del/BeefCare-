package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.repository.NotificationRepository;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock NotificationRepository repository;
    @Mock FarmAccessService access;
    @Mock FarmClock clock;
    @Mock NotificationTargetAccessService targetAccess;
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

    @Test void inboxIsScopedToCurrentRecipient(){
        AppUser recipient=new AppUser();recipient.setId(9L);when(access.currentActiveUser()).thenReturn(recipient);
        Notification n=new Notification();n.setId(1L);n.setRecipient(recipient);n.setTargetType("FARM");n.setTargetId(1L);
        when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(n));when(targetAccess.canOpen(recipient,n)).thenReturn(true);
        assertThat(service.mine()).isEmpty();verify(repository).findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L);
    }

    @Test void inboxHidesTargetWhenAuthorizationWasRevoked(){
        AppUser recipient=new AppUser();recipient.setId(9L);Notification n=new Notification();n.setTargetType("FARM");n.setTargetId(7L);
        when(access.currentActiveUser()).thenReturn(recipient);when(repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(9L)).thenReturn(List.of(n));when(targetAccess.canOpen(recipient,n)).thenReturn(false);
        assertThat(service.mine()).isEmpty();
    }
}
