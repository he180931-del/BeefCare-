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
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;

@ExtendWith(MockitoExtension.class)
class AnnouncementNotificationOutboxHandlerTest {
    @Mock EntityManager entityManager;
    @Mock AnnouncementVersionRepository versions;
    @Mock AnnouncementRecipientRepository recipients;
    @Mock FarmMembershipRepository memberships;
    @Mock NotificationService notifications;

    private AnnouncementNotificationOutboxHandler handler;
    private OutboxEvent event;
    private AnnouncementVersion version;
    private Farm farm;
    private FarmMembership recipientMembership;
    private AppUser recipient;

    @BeforeEach
    void setUp() {
        handler = new AnnouncementNotificationOutboxHandler(
            new ObjectMapper(), entityManager, versions, recipients, memberships, notifications
        );

        farm = new Farm();
        farm.setId(7L);
        farm.setName("Trại An Bình");
        farm.setServiceStatus("ACTIVE");

        FarmAnnouncement announcement = new FarmAnnouncement();
        announcement.setId(21L);
        announcement.setFarm(farm);

        version = new AnnouncementVersion();
        version.setId(12L);
        version.setAnnouncement(announcement);
        version.setVersionNo(2);
        version.setTitle("Lịch tiêm phòng tháng 11");

        recipient = new AppUser();
        recipient.setId(33L);
        recipient.setAccountStatus("ACTIVE");

        recipientMembership = new FarmMembership();
        recipientMembership.setId(44L);
        recipientMembership.setFarm(farm);
        recipientMembership.setUser(recipient);
        recipientMembership.setRole("TECHNICIAN");
        recipientMembership.setStatus("ACTIVE");

        AnnouncementRecipient delivery = new AnnouncementRecipient();
        delivery.setVersion(version);
        delivery.setMembership(recipientMembership);

        event = new OutboxEvent();
        ReflectionTestUtils.setField(event, "id", 91L);
        event.setFarmId(7L);
        event.setEventType("ANNOUNCEMENT_CORRECTED");
        event.setAggregateType("AnnouncementVersion");
        event.setAggregateId("12");
        event.setPayloadJson("{\"announcementId\":21,\"versionId\":12,\"recipientCount\":1}");

        when(versions.findById(12L)).thenReturn(Optional.of(version));
        when(recipients.findSnapshotByVersion_Id(12L)).thenReturn(List.of(delivery));
    }

    @Test
    void announcesOnlyThePersistedVersionSnapshotAndKeepsTheEventIdAsRetryKey() throws Exception {
        when(memberships.lockByIdAndFarmId(44L, 7L)).thenReturn(Optional.of(recipientMembership));
        assertThat(handler.supports("ANNOUNCEMENT_PUBLISHED")).isTrue();
        assertThat(handler.supports("ANNOUNCEMENT_CORRECTED")).isTrue();
        assertThat(handler.supports("SUPPORT_UPDATED")).isFalse();

        handler.handle(event);
        handler.handle(event);

        verify(entityManager, times(2)).refresh(recipientMembership, LockModeType.PESSIMISTIC_WRITE);
        verify(notifications, times(2)).notify(
            eq(recipient),
            eq("ANNOUNCEMENT"),
            eq("ANNOUNCEMENT_VERSION"),
            eq(12L),
            eq("Lịch tiêm phòng tháng 11"),
            eq("Trại Trại An Bình · Đính chính · phiên bản 2"),
            eq("JOB07:ANNOUNCEMENT:91")
        );
    }

    @Test
    void skipsMembershipsThatHaveLostCurrentFarmAccessOrHavePlatformRoles() throws Exception {
        when(memberships.lockByIdAndFarmId(44L, 7L)).thenReturn(Optional.of(recipientMembership));
        recipientMembership.setStatus("INACTIVE");
        handler.handle(event);
        verify(notifications, never()).notify(any(), anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());

        recipientMembership.setStatus("ACTIVE");
        PlatformStaffAccess platformAccess = new PlatformStaffAccess();
        platformAccess.setStatus("ACTIVE");
        recipient.setPlatformStaffAccess(platformAccess);
        handler.handle(event);

        recipient.setPlatformStaffAccess(null);
        recipientMembership.setRole("OWNER");
        handler.handle(event);
        verify(notifications, never()).notify(any(), anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void propagatesDeliveryFailuresSoTheOutboxCanRetry() {
        when(memberships.lockByIdAndFarmId(44L, 7L)).thenThrow(new IllegalStateException("membership store unavailable"));
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(IllegalStateException.class);
        verify(notifications, never()).notify(any(), anyString(), anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void rejectsOutboxSnapshotPayloadThatDoesNotMatchPersistedDeliveryRows() {
        event.setPayloadJson("{\"announcementId\":21,\"versionId\":12,\"recipientCount\":2}");
        assertThatThrownBy(() -> handler.handle(event)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(memberships, notifications);
    }
}
