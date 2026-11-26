package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.repository.FeedItemRepository;
import vn.edu.fpt.beefcare.repository.FeedReceiptRepository;
import vn.edu.fpt.beefcare.repository.FeedingRecordRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.InternalRequestRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.SupportTicketRepository;

@ExtendWith(MockitoExtension.class)
class NotificationTargetAccessServiceTest {
    @Mock EntityManager entityManager;
    @Mock FarmAccessService farmAccess;
    @Mock PlatformAccessService platformAccess;
    @Mock SupportTicketRepository tickets;
    @Mock InternalRequestRepository requests;
    @Mock FeedReceiptRepository feedReceipts;
    @Mock FeedItemRepository feeds;
    @Mock FeedingRecordRepository feedingRecords;
    @Mock PaymentRepository payments;
    @Mock AnnouncementVersionRepository announcementVersions;
    @Mock AnnouncementRecipientRepository announcementRecipients;
    @Mock FarmMembershipRepository memberships;
    @Mock PlatformStaffAccessRepository platformStaffAccesses;

    private NotificationTargetAccessService service;
    private AppUser actor;
    private Farm farm;
    private AnnouncementVersion version;
    private FarmMembership membership;
    private Notification notification;

    @BeforeEach
    void setUp() {
        service = new NotificationTargetAccessService(
            entityManager, farmAccess, platformAccess, tickets, requests, feedReceipts, feeds, feedingRecords, payments,
            announcementVersions, announcementRecipients, memberships, platformStaffAccesses
        );

        farm = new Farm();
        farm.setId(17L);
        farm.setServiceStatus("ACTIVE");

        FarmAnnouncement announcement = new FarmAnnouncement();
        announcement.setId(19L);
        announcement.setFarm(farm);

        version = new AnnouncementVersion();
        version.setId(23L);
        version.setAnnouncement(announcement);

        actor = new AppUser();
        actor.setId(29L);
        actor.setAccountStatus("ACTIVE");

        membership = new FarmMembership();
        membership.setId(31L);
        membership.setFarm(farm);
        membership.setUser(actor);
        membership.setRole("TECHNICIAN");
        membership.setStatus("ACTIVE");

        notification = new Notification();
        notification.setTargetType("ANNOUNCEMENT_VERSION");
        notification.setTargetId(23L);

    }

    private void stubAnnouncementRecipientAccess() {
        when(announcementVersions.findById(23L)).thenReturn(Optional.of(version));
        when(farmAccess.require(17L, FarmAction.VIEW_ANNOUNCEMENTS))
            .thenReturn(new FarmContext(farm, actor, FarmRole.TECHNICIAN));
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(17L, 29L, "ACTIVE"))
            .thenReturn(Optional.of(membership));
    }

    @Test
    void announcementVersionRequiresCurrentFarmAccessAndItsExactRecipientSnapshot() {
        stubAnnouncementRecipientAccess();
        when(announcementRecipients.existsByVersion_IdAndMembership_Id(23L, 31L)).thenReturn(true);
        assertThat(service.canOpen(actor, notification)).isTrue();

        when(announcementRecipients.existsByVersion_IdAndMembership_Id(23L, 31L)).thenReturn(false);
        assertThat(service.canOpen(actor, notification)).isFalse();
        verify(announcementRecipients, times(2)).existsByVersion_IdAndMembership_Id(23L, 31L);
    }

    @Test
    void announcementTargetIsHiddenFromActivePlatformStaffEvenWithFarmMembership() {
        stubAnnouncementRecipientAccess();
        PlatformStaffAccess platformStaff = new PlatformStaffAccess();
        platformStaff.setStatus("ACTIVE");
        platformStaff.setRole(PlatformRole.PM.name());
        actor.setPlatformStaffAccess(platformStaff);

        assertThat(service.canOpen(actor, notification)).isFalse();
        verify(announcementRecipients, never()).existsByVersion_IdAndMembership_Id(anyLong(), anyLong());
    }

    @Test
    void announcementTargetRequiresAValidFe07RecipientRole() {
        stubAnnouncementRecipientAccess();
        membership.setRole("OWNER");

        assertThat(service.canOpen(actor, notification)).isFalse();
        verify(announcementRecipients, never()).existsByVersion_IdAndMembership_Id(anyLong(), anyLong());
    }

    @Test
    void internalRequestTargetRequiresTheNamedRecipientAndTheirCurrentActivePlatformRole() {
        InternalRequest request=new InternalRequest();request.setId(41L);request.setRecipient(actor);request.setTargetRole("PM");
        notification.setTargetType("INTERNAL_REQUEST");notification.setTargetId(41L);
        PlatformStaffAccess staffAccess=new PlatformStaffAccess();staffAccess.setUser(actor);staffAccess.setRole("PM");staffAccess.setStatus("ACTIVE");
        when(requests.findById(41L)).thenReturn(Optional.of(request));
        when(platformStaffAccesses.findOneByUserIdAndStatusIgnoreCase(29L,"ACTIVE")).thenReturn(Optional.of(staffAccess));

        assertThat(service.canOpen(actor,notification)).isTrue();

        AppUser other=new AppUser();other.setId(30L);other.setAccountStatus("ACTIVE");
        assertThat(service.canOpen(other,notification)).isFalse();
        actor.setAccountStatus("SUSPENDED");
        assertThat(service.canOpen(actor,notification)).isFalse();
        actor.setAccountStatus("ACTIVE");staffAccess.setRole("SA");
        assertThat(service.canOpen(actor,notification)).isFalse();
        staffAccess.setRole("PM");staffAccess.setStatus("INACTIVE");
        when(platformStaffAccesses.findOneByUserIdAndStatusIgnoreCase(29L,"ACTIVE")).thenReturn(Optional.empty());
        assertThat(service.canOpen(actor,notification)).isFalse();
    }

    @Test
    void reassignmentDisclosureRequiresAnActivePmOrSaAccountAndRole() {
        PlatformStaffAccess staffAccess=new PlatformStaffAccess();staffAccess.setUser(actor);staffAccess.setRole("PM");staffAccess.setStatus("ACTIVE");
        when(platformStaffAccesses.findOneByUserIdAndStatusIgnoreCase(29L,"ACTIVE")).thenReturn(Optional.of(staffAccess));

        assertThat(service.hasActiveInternalRequestRole(actor)).isTrue();

        staffAccess.setRole("CS");
        assertThat(service.hasActiveInternalRequestRole(actor)).isFalse();
        staffAccess.setRole("SA");actor.setAccountStatus("SUSPENDED");
        assertThat(service.hasActiveInternalRequestRole(actor)).isFalse();
        actor.setAccountStatus("ACTIVE");staffAccess.setUser(null);
        assertThat(service.hasActiveInternalRequestRole(actor)).isFalse();
    }

    @Test
    void readLocksTheTicketBeforeRefreshingTheCurrentRequestAssignment() {
        SupportTicket ticket = new SupportTicket();
        ticket.setId(7L);
        InternalRequest request = new InternalRequest();
        request.setId(41L);
        request.setTicket(ticket);
        when(entityManager.find(InternalRequest.class,41L)).thenReturn(request);
        when(entityManager.find(SupportTicket.class,7L)).thenReturn(ticket);

        assertThat(service.lockInternalRequestsForRead(java.util.List.of(41L))).containsEntry(41L,request);

        InOrder order = inOrder(entityManager);
        order.verify(entityManager).find(InternalRequest.class,41L);
        order.verify(entityManager).find(SupportTicket.class,7L);
        order.verify(entityManager).refresh(ticket,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(request,LockModeType.PESSIMISTIC_WRITE);
        order.verifyNoMoreInteractions();
    }

    @Test
    void readAllLocksTicketsAscendingThenRequestsByTicketAndRequestId() {
        SupportTicket ticket4 = new SupportTicket(); ticket4.setId(4L);
        SupportTicket ticket10 = new SupportTicket(); ticket10.setId(10L);
        InternalRequest request20 = internalRequest(20L,ticket4);
        InternalRequest request21 = internalRequest(21L,ticket4);
        InternalRequest request30 = internalRequest(30L,ticket10);
        when(entityManager.find(InternalRequest.class,20L)).thenReturn(request20);
        when(entityManager.find(InternalRequest.class,21L)).thenReturn(request21);
        when(entityManager.find(InternalRequest.class,30L)).thenReturn(request30);
        when(entityManager.find(SupportTicket.class,4L)).thenReturn(ticket4);
        when(entityManager.find(SupportTicket.class,10L)).thenReturn(ticket10);

        assertThat(service.lockInternalRequestsForRead(java.util.List.of(30L,21L,20L,20L)))
            .containsEntry(20L,request20).containsEntry(21L,request21).containsEntry(30L,request30);

        InOrder order = inOrder(entityManager);
        order.verify(entityManager).find(InternalRequest.class,20L);
        order.verify(entityManager).find(InternalRequest.class,21L);
        order.verify(entityManager).find(InternalRequest.class,30L);
        order.verify(entityManager).find(SupportTicket.class,4L);
        order.verify(entityManager).refresh(ticket4,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).find(SupportTicket.class,10L);
        order.verify(entityManager).refresh(ticket10,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(request20,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(request21,LockModeType.PESSIMISTIC_WRITE);
        order.verify(entityManager).refresh(request30,LockModeType.PESSIMISTIC_WRITE);
        order.verifyNoMoreInteractions();
    }

    @Test
    void lockedAssignmentCheckUsesTheRefreshedRecipientAndCurrentRole() {
        InternalRequest lockedRequest = new InternalRequest();
        lockedRequest.setId(41L);
        lockedRequest.setRecipient(actor);
        lockedRequest.setTargetRole("PM");
        PlatformStaffAccess staffAccess = new PlatformStaffAccess();
        staffAccess.setUser(actor); staffAccess.setRole("PM"); staffAccess.setStatus("ACTIVE");
        when(platformStaffAccesses.findOneByUserIdAndStatusIgnoreCase(29L,"ACTIVE")).thenReturn(Optional.of(staffAccess));

        assertThat(service.canOpenInternalRequest(actor,lockedRequest)).isTrue();
        lockedRequest.setRecipient(user(30L));
        assertThat(service.canOpenInternalRequest(actor,lockedRequest)).isFalse();
        lockedRequest.setRecipient(actor);
        lockedRequest.setTargetRole("CS");
        assertThat(service.canOpenInternalRequest(actor,lockedRequest)).isFalse();
    }

    private static InternalRequest internalRequest(Long id, SupportTicket ticket) {
        InternalRequest request = new InternalRequest();
        request.setId(id);
        request.setTicket(ticket);
        return request;
    }

    private static AppUser user(Long id) {
        AppUser user = new AppUser();
        user.setId(id);
        return user;
    }
}
