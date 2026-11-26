package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.domain.AnnouncementMemberSelector;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementMemberSelectorRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.repository.FarmAnnouncementRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.*;

@ExtendWith(MockitoExtension.class)
class FarmAnnouncementServiceTest {
    @Mock FarmAccessService access;
    @Mock FarmClock clock;
    @Mock EntityManager entityManager;
    @Mock FarmMembershipRepository memberships;
    @Mock FarmAnnouncementRepository announcements;
    @Mock AnnouncementVersionRepository versions;
    @Mock AnnouncementRecipientRepository recipients;
    @Mock AnnouncementMemberSelectorRepository memberSelectors;
    @Mock OutboxService outbox;
    @InjectMocks FarmAnnouncementService service;

    Farm farm;
    AppUser authorUser;
    FarmMembership author;
    FarmContext ownerContext;
    FarmAnnouncement announcement;

    @BeforeEach
    void setup() {
        farm = new Farm().name("Trại mẫu");
        ReflectionTestUtils.setField(farm, "id", 12L);
        authorUser = new AppUser();
        authorUser.setId(41L);
        authorUser.setFullName("Farm owner");
        author = member(101L, "OWNER", farm);
        author.setUser(authorUser);
        ownerContext = new FarmContext(farm, authorUser, FarmRole.OWNER);

        announcement = new FarmAnnouncement();
        ReflectionTestUtils.setField(announcement, "id", 200L);
        announcement.setFarm(farm);
        announcement.setAuthor(author);
        announcement.setState("DRAFT");
        announcement.setDraftTitle("Water delivery");
        announcement.setDraftBody("Water is shut off at noon.");
        announcement.setRecipientRoles("MANAGER,TECHNICIAN");
    }

    @Test
    void publishingResolvesAndSnapshotsOnlyPermittedActiveRecipients() {
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        FarmMembership manager = member(102L, "MANAGER", farm);
        FarmMembership technician = member(103L, "TECHNICIAN", farm);
        FarmMembership platformTechnician = member(105L, "TECHNICIAN", farm);
        platformTechnician.getUser().setPlatformStaffAccess(new PlatformStaffAccess().role("CS").status("ACTIVE"));
        FarmMembership inactive = member(104L, "TECHNICIAN", farm);
        inactive.setStatus("INACTIVE");
        when(memberSelectors.findByAnnouncement_IdOrderByMembership_Id(200L)).thenReturn(List.of(selector(announcement, technician)));
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(memberships.lockAnnouncementCandidatesByFarmIdAndRolesOrIds(
            12L, List.of("MANAGER", "TECHNICIAN"), List.of(101L, 103L)
        )).thenReturn(List.of(author, manager, technician, inactive, platformTechnician));

        AtomicReference<List<AnnouncementVersion>> history = new AtomicReference<>(List.of());
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenAnswer(invocation -> history.get());
        when(versions.saveAndFlush(any())).thenAnswer(invocation -> {
            AnnouncementVersion saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 301L);
            history.set(List.of(saved));
            return saved;
        });
        List<AnnouncementRecipient> savedRecipients = new ArrayList<>();
        when(recipients.save(any())).thenAnswer(invocation -> {
            AnnouncementRecipient saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 400L + savedRecipients.size());
            savedRecipients.add(saved);
            return saved;
        });
        when(recipients.findByVersion_Id(any())).thenAnswer(invocation -> savedRecipients.stream()
            .filter(delivery -> delivery.getVersion().getId().equals(invocation.getArgument(0)))
            .toList());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView result = service.publish(12L, 200L, new PublishRequest(0));

        assertThat(announcement.getState()).isEqualTo("PUBLISHED");
        assertThat(result.versions()).singleElement().satisfies(version -> assertThat(version.versionNo()).isEqualTo(1));
        assertThat(result.recipientCount()).isEqualTo(2);
        assertThat(result.recipientMemberIds()).containsExactly(103L);
        assertThat(result.deliveries()).extracting(DeliveryView::role).containsExactlyInAnyOrder("MANAGER", "TECHNICIAN");
        assertThat(result.isAuthor()).isTrue();
        assertThat(result.myDeliveryId()).isNull();
        verify(recipients, times(2)).save(any(AnnouncementRecipient.class));
        verify(recipients).save(org.mockito.ArgumentMatchers.argThat(delivery -> delivery.getMembership().getId().equals(103L)));
        verify(recipients, never()).save(org.mockito.ArgumentMatchers.argThat(delivery ->
            delivery.getMembership().getId().equals(101L) ||
            delivery.getMembership().getId().equals(104L) ||
            delivery.getMembership().getId().equals(105L)));
        verify(outbox).enqueue(eq(12L), eq("ANNOUNCEMENT_PUBLISHED"), eq("AnnouncementVersion"), eq(301L), any(Map.class));
    }

    @Test
    void managerCannotAddressAnnouncementToOwnerOrAnotherManager() {
        FarmMembership manager = member(102L, "MANAGER", farm);
        FarmContext managerContext = new FarmContext(farm, manager.getUser(), FarmRole.MANAGER);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(managerContext);

        assertThatThrownBy(() -> service.createDraft(12L, new DraftRequest("Title", "Body", List.of("MANAGER"), null)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-FE07-02");
        verify(announcements, never()).saveAndFlush(any());
    }

    @Test
    void unknownRecipientRolesAreRejectedInsteadOfSilentlyIgnored() {
        FarmMembership manager = member(102L, "MANAGER", farm);
        FarmContext managerContext = new FarmContext(farm, manager.getUser(), FarmRole.MANAGER);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(managerContext);

        assertThatThrownBy(() -> service.createDraft(12L, new DraftRequest("Title", "Body", List.of("TECHNICIAN", "PLATFORM_ADMIN"), null)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-FE07-02");
        verify(announcements, never()).saveAndFlush(any());
    }

    @Test
    void previewShowsOnlyCurrentActiveEligibleMembers() {
        FarmMembership manager = member(102L, "MANAGER", farm);
        FarmMembership technician = member(103L, "TECHNICIAN", farm);
        FarmMembership inactiveTechnician = member(104L, "TECHNICIAN", farm);
        inactiveTechnician.setStatus("INACTIVE");
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(memberships.findByFarm_IdAndStatusIgnoreCase(12L, "ACTIVE")).thenReturn(List.of(author, manager, technician, inactiveTechnician));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        PublishPreview preview = service.previewPublish(12L, 200L);

        assertThat(preview.recipients()).extracting(MemberOption::id).containsExactly(102L, 103L);
        assertThat(preview.announcement().recipientRoles()).containsExactly("MANAGER", "TECHNICIAN");
        assertThat(preview.announcement().draftTitle()).isEqualTo("Water delivery");
    }

    @Test
    void namedRecipientCanBeSavedWithoutRoleSelectorsAndUsesFarmMembershipId() {
        FarmMembership technician = member(103L, "TECHNICIAN", farm);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(memberships.findByIdInAndFarm_IdAndStatusIgnoreCase(List.of(103L), 12L, "ACTIVE")).thenReturn(List.of(technician));
        when(announcements.saveAndFlush(any())).thenAnswer(invocation -> {
            FarmAnnouncement saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 201L);
            return saved;
        });
        List<AnnouncementMemberSelector> saved = new ArrayList<>();
        when(memberSelectors.saveAll(any())).thenAnswer(invocation -> {
            List<AnnouncementMemberSelector> selection = invocation.getArgument(0);
            saved.addAll(selection);
            return selection;
        });
        when(memberSelectors.findByAnnouncement_IdOrderByMembership_Id(201L)).thenAnswer(invocation -> saved);
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(201L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView result = service.createDraft(12L, new DraftRequest("Title", "Body", List.of(), List.of(103L, 103L), null));

        assertThat(result.recipientRoles()).isEmpty();
        assertThat(result.recipientMemberIds()).containsExactly(103L);
        assertThat(saved).singleElement().satisfies(item -> {
            assertThat(item.getAnnouncement().getId()).isEqualTo(201L);
            assertThat(item.getMembership().getId()).isEqualTo(103L);
        });
    }

    @Test
    void anOlderDraftUpdateThatOmitsTheNewFieldPreservesExistingNamedMembers() {
        FarmMembership technician = member(103L, "TECHNICIAN", farm);
        AnnouncementMemberSelector savedSelector = selector(announcement, technician);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(memberships.findByIdInAndFarm_IdAndStatusIgnoreCase(List.of(103L), 12L, "ACTIVE")).thenReturn(List.of(technician));
        when(memberSelectors.findByAnnouncement_IdOrderByMembership_Id(200L)).thenReturn(List.of(savedSelector));
        when(announcements.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(memberSelectors.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView updated = service.updateDraft(12L, 200L, new DraftRequest("Revised", "New body", List.of("TECHNICIAN"), 0));

        assertThat(updated.recipientMemberIds()).containsExactly(103L);
        assertThat(updated.recipientRoles()).containsExactly("TECHNICIAN");
        verify(memberSelectors).deleteByAnnouncement_Id(200L);
        verify(memberSelectors).saveAll(org.mockito.ArgumentMatchers.argThat(rows -> {
            List<?> selection = (List<?>) rows;
            return selection.size() == 1 && ((AnnouncementMemberSelector) selection.get(0)).getMembership().getId().equals(103L);
        }));
    }

    @Test
    void memberOnlyAudienceChangeMarksTheAnnouncementDirtyForOptimisticVersioning() {
        FarmMembership technician = member(103L, "TECHNICIAN", farm);
        announcement.setRecipientRoles("TECHNICIAN");
        AnnouncementMemberSelector savedSelector = selector(announcement, technician);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(memberSelectors.findByAnnouncement_IdOrderByMembership_Id(200L)).thenReturn(List.of(savedSelector), List.of());
        when(announcements.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView updated = service.updateDraft(
            12L,
            200L,
            new DraftRequest("Water delivery", "Water is shut off at noon.", List.of("TECHNICIAN"), List.of(), 0)
        );

        assertThat(announcement.getDraftAudienceRevision()).isEqualTo(1);
        assertThat(updated.recipientMemberIds()).isEmpty();
        verify(announcements).saveAndFlush(announcement);
        verify(memberSelectors).deleteByAnnouncement_Id(200L);
    }

    @Test
    void staleDraftVersionCannotReplaceTheSavedNamedAudience() {
        ReflectionTestUtils.setField(announcement, "version", 2);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        assertThatThrownBy(() -> service.updateDraft(12L, 200L, new DraftRequest("Stale", "Stale", List.of("TECHNICIAN"), List.of(103L), 1)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-COM-05");

        verify(announcements, never()).saveAndFlush(any());
        verify(memberSelectors, never()).deleteByAnnouncement_Id(any());
        verify(memberSelectors, never()).saveAll(any());
    }

    @Test
    void rejectsNamedRecipientsOutsideFarmOrNotAllowedForAuthorsRole() {
        FarmMembership manager = member(102L, "MANAGER", farm);
        FarmMembership otherManager = member(105L, "MANAGER", farm);
        FarmContext managerContext = new FarmContext(farm, manager.getUser(), FarmRole.MANAGER);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(managerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, manager.getUser().getId(), "ACTIVE"))
            .thenReturn(java.util.Optional.of(manager));
        when(memberships.findByIdInAndFarm_IdAndStatusIgnoreCase(List.of(105L), 12L, "ACTIVE"))
            .thenReturn(List.of(otherManager));

        assertThatThrownBy(() -> service.createDraft(12L, new DraftRequest("Title", "Body", List.of(), List.of(105L), null)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-FE07-02");
        verify(announcements, never()).saveAndFlush(any());

        when(memberships.findByIdInAndFarm_IdAndStatusIgnoreCase(List.of(999L), 12L, "ACTIVE")).thenReturn(List.of());
        assertThatThrownBy(() -> service.createDraft(12L, new DraftRequest("Title", "Body", List.of(), List.of(999L), null)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-FE07-02");

        FarmMembership platformTechnician = member(106L, "TECHNICIAN", farm);
        platformTechnician.getUser().setPlatformStaffAccess(new PlatformStaffAccess().role("SA").status("ACTIVE"));
        when(memberships.findByIdInAndFarm_IdAndStatusIgnoreCase(List.of(106L), 12L, "ACTIVE"))
            .thenReturn(List.of(platformTechnician));
        assertThatThrownBy(() -> service.createDraft(12L, new DraftRequest("Title", "Body", List.of(), List.of(106L), null)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-FE07-02");
        verify(announcements, never()).saveAndFlush(any());
    }

    @Test
    void recipientOptionsAreActiveFarmScopedAndRoleAllowed() {
        FarmMembership manager = member(102L, "MANAGER", farm);
        manager.getUser().setPlatformStaffAccess(new PlatformStaffAccess().role("PM").status("ACTIVE"));
        FarmMembership technician = member(103L, "TECHNICIAN", farm);
        FarmMembership inactive = member(104L, "TECHNICIAN", farm);
        inactive.setStatus("INACTIVE");
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(memberships.findByFarm_IdAndStatusIgnoreCase(12L, "ACTIVE")).thenReturn(List.of(author, manager, technician, inactive));

        assertThat(service.listEligibleRecipients(12L)).extracting(MemberOption::id).containsExactly(103L);
    }

    @Test
    void correctionDeliversOnlyToOriginalRecipientsStillActiveInTheSameFarm() {
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        announcement.setState("PUBLISHED");
        FarmMembership activePlatformStaff = member(103L, "TECHNICIAN", farm);
        activePlatformStaff.getUser().setPlatformStaffAccess(new PlatformStaffAccess().role("CS").status("ACTIVE"));
        FarmMembership activeFarmMember = member(106L, "TECHNICIAN", farm);
        FarmMembership inactive = member(104L, "TECHNICIAN", farm);
        inactive.setStatus("INACTIVE");
        Farm otherFarm = new Farm();
        ReflectionTestUtils.setField(otherFarm, "id", 13L);
        FarmMembership differentFarm = member(105L, "TECHNICIAN", otherFarm);
        AnnouncementVersion previous = version(301L, 1, announcement);
        AnnouncementRecipient originalActivePlatformStaff = delivery(previous, activePlatformStaff, 401L);
        AnnouncementRecipient originalActiveFarmMember = delivery(previous, activeFarmMember, 404L);
        AnnouncementRecipient originalInactive = delivery(previous, inactive, 402L);
        AnnouncementRecipient originalDifferentFarm = delivery(previous, differentFarm, 403L);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        AtomicReference<List<AnnouncementVersion>> history = new AtomicReference<>(List.of(previous));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenAnswer(invocation -> history.get());
        when(recipients.findByVersion_Id(301L)).thenReturn(List.of(
            originalActivePlatformStaff, originalActiveFarmMember, originalInactive, originalDifferentFarm
        ));
        when(memberships.lockByIdsAndFarmIdOrderById(12L, List.of(101L, 103L, 104L, 105L, 106L)))
            .thenReturn(List.of(author, activePlatformStaff, inactive, activeFarmMember));
        List<AnnouncementRecipient> savedRecipients = new ArrayList<>();
        when(recipients.save(any())).thenAnswer(invocation -> {
            AnnouncementRecipient saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 500L);
            savedRecipients.add(saved);
            return saved;
        });
        when(versions.saveAndFlush(any())).thenAnswer(invocation -> {
            AnnouncementVersion saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 302L);
            history.set(List.of(saved, previous));
            return saved;
        });
        when(announcements.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recipients.findByVersion_Id(302L)).thenAnswer(invocation -> savedRecipients);
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView result = service.correctPublished(12L, 200L, new CorrectionRequest("Updated title", "Updated body", "Correction reason", 0));

        assertThat(result.versions()).extracting(VersionView::versionNo).containsExactly(2, 1);
        assertThat(result.recipientCount()).isEqualTo(1);
        assertThat(savedRecipients).extracting(delivery -> delivery.getMembership().getId()).containsExactly(106L);
        verify(outbox).enqueue(eq(12L), eq("ANNOUNCEMENT_CORRECTED"), eq("AnnouncementVersion"), eq(302L), any(Map.class));
    }

    @Test
    void laterCorrectionUsesTheOriginalSnapshotSoReactivatedMembersCanReceiveIt() {
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        announcement.setState("PUBLISHED");
        ReflectionTestUtils.setField(announcement, "version", 2);
        FarmMembership reactivated = member(103L, "TECHNICIAN", farm);
        FarmMembership stillActive = member(104L, "TECHNICIAN", farm);
        AnnouncementVersion original = version(301L, 1, announcement);
        AnnouncementVersion previousCorrection = version(302L, 2, announcement);
        AnnouncementRecipient originalReactivated = delivery(original, reactivated, 401L);
        AnnouncementRecipient originalStillActive = delivery(original, stillActive, 402L);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        AtomicReference<List<AnnouncementVersion>> history = new AtomicReference<>(List.of(previousCorrection, original));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenAnswer(invocation -> history.get());
        when(recipients.findByVersion_Id(301L)).thenReturn(List.of(originalReactivated, originalStillActive));
        when(memberships.lockByIdsAndFarmIdOrderById(12L, List.of(101L, 103L, 104L)))
            .thenReturn(List.of(author, reactivated, stillActive));
        List<AnnouncementRecipient> savedRecipients = new ArrayList<>();
        when(recipients.save(any())).thenAnswer(invocation -> {
            AnnouncementRecipient saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 500L + savedRecipients.size());
            savedRecipients.add(saved);
            return saved;
        });
        when(versions.saveAndFlush(any())).thenAnswer(invocation -> {
            AnnouncementVersion saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 303L);
            history.set(List.of(saved, previousCorrection, original));
            return saved;
        });
        when(announcements.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recipients.findByVersion_Id(303L)).thenAnswer(invocation -> savedRecipients);
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView result = service.correctPublished(12L, 200L, new CorrectionRequest("Third title", "Third body", "Another correction", 2));

        assertThat(result.versions()).extracting(VersionView::versionNo).containsExactly(3, 2, 1);
        assertThat(savedRecipients).extracting(delivery -> delivery.getMembership().getId()).containsExactly(103L, 104L);
    }

    @Test
    void recipientOnlySeesTheNewestVersionThatWasActuallyDeliveredToThem() {
        announcement.setState("PUBLISHED");
        FarmMembership manager = member(102L, "MANAGER", farm);
        announcement.setAuthor(manager);
        manager.getUser().setFullName("Author Manager");
        FarmMembership reader = member(103L, "TECHNICIAN", farm);
        FarmContext readerContext = new FarmContext(farm, reader.getUser(), FarmRole.TECHNICIAN);
        AnnouncementVersion v1 = version(301L, 1, announcement);
        v1.setTitle("Received version one");
        v1.setBody("This is the delivered content.");
        v1.setPublishedTime(Instant.parse("2026-10-28T08:00:00Z"));
        AnnouncementVersion v2 = version(302L, 2, announcement);
        v2.setTitle("Version two not delivered");
        v2.setBody("This content is not visible to this member.");
        v2.setPublishedTime(Instant.parse("2026-10-28T09:00:00Z"));
        AnnouncementRecipient deliveredV1 = delivery(v1, reader, 401L);
        when(access.require(12L, FarmAction.VIEW_ANNOUNCEMENTS)).thenReturn(readerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 103L, "ACTIVE")).thenReturn(java.util.Optional.of(reader));
        when(announcements.findByFarm_IdOrderByIdDesc(12L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(103L)).thenReturn(List.of(deliveredV1));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of(v2, v1));

        AnnouncementView result = service.list(12L).get(0);

        assertThat(result.title()).isEqualTo("Received version one");
        assertThat(result.body()).isEqualTo("This is the delivered content.");
        assertThat(result.publishedTime()).isEqualTo(v1.getPublishedTime());
        assertThat(result.version()).isEqualTo(1);
        assertThat(result.versions()).extracting(VersionView::versionNo).containsExactly(1);
        assertThat(result.isReceived()).isTrue();
        assertThat(result.myDeliveryId()).isEqualTo(401L);
        assertThat(result.deliveries()).isNull();
    }

    @Test
    void detailReturnsTheVisibleRecipientViewWithoutLoadingTheFarmList() {
        announcement.setState("PUBLISHED");
        FarmMembership reader = member(103L, "TECHNICIAN", farm);
        FarmContext readerContext = new FarmContext(farm, reader.getUser(), FarmRole.TECHNICIAN);
        AnnouncementVersion v1 = version(301L, 1, announcement);
        v1.setTitle("Visible detail");
        v1.setBody("Only the delivered version is visible.");
        AnnouncementRecipient delivered = delivery(v1, reader, 401L);

        when(access.require(12L, FarmAction.VIEW_ANNOUNCEMENTS)).thenReturn(readerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 103L, "ACTIVE"))
            .thenReturn(java.util.Optional.of(reader));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(recipients.existsByVersion_Announcement_IdAndMembership_Id(200L, 103L)).thenReturn(true);
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(103L)).thenReturn(List.of(delivered));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of(v1));

        AnnouncementView result = service.get(12L, 200L);

        assertThat(result.title()).isEqualTo("Visible detail");
        assertThat(result.body()).isEqualTo("Only the delivered version is visible.");
        assertThat(result.isReceived()).isTrue();
        verify(announcements, never()).findByFarm_IdOrderByIdDesc(12L);
    }

    @Test
    void detailHidesUndeliveredAnnouncementsFromNonAuthorsWithTypedNotFound() {
        announcement.setState("PUBLISHED");
        FarmMembership reader = member(103L, "TECHNICIAN", farm);
        FarmContext readerContext = new FarmContext(farm, reader.getUser(), FarmRole.TECHNICIAN);
        when(access.require(12L, FarmAction.VIEW_ANNOUNCEMENTS)).thenReturn(readerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 103L, "ACTIVE"))
            .thenReturn(java.util.Optional.of(reader));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(recipients.existsByVersion_Announcement_IdAndMembership_Id(200L, 103L)).thenReturn(false);

        assertThatThrownBy(() -> service.get(12L, 200L))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-COM-08");
                assertThat(error.getStatus().value()).isEqualTo(404);
            });
        verify(versions, never()).findByAnnouncement_IdOrderByVersionNoDesc(200L);
    }

    @Test
    void detailKeepsDraftsPrivateEvenWhenARecipientRowExists() {
        FarmMembership reader = member(103L, "TECHNICIAN", farm);
        FarmContext readerContext = new FarmContext(farm, reader.getUser(), FarmRole.TECHNICIAN);
        when(access.require(12L, FarmAction.VIEW_ANNOUNCEMENTS)).thenReturn(readerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 103L, "ACTIVE"))
            .thenReturn(java.util.Optional.of(reader));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        assertThatThrownBy(() -> service.get(12L, 200L))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-COM-08");
                assertThat(error.getStatus().value()).isEqualTo(404);
            });
        verify(recipients, never()).existsByVersion_Announcement_IdAndMembership_Id(200L, 103L);
        verify(versions, never()).findByAnnouncement_IdOrderByVersionNoDesc(200L);
    }

    @Test
    void detailReturnsTheAuthorsDraftWithAuthorOnlyFields() {
        when(access.require(12L, FarmAction.VIEW_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE"))
            .thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());
        when(memberSelectors.findByAnnouncement_IdOrderByMembership_Id(200L)).thenReturn(List.of());

        AnnouncementView result = service.get(12L, 200L);

        assertThat(result.isAuthor()).isTrue();
        assertThat(result.state()).isEqualTo("DRAFT");
        assertThat(result.title()).isEqualTo("Water delivery");
        assertThat(result.deliveries()).isEmpty();
    }

    @Test
    void publishWithNoActiveRecipientsLeavesDraftUnchanged() {
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));
        when(memberships.lockAnnouncementCandidatesByFarmIdAndRolesOrIds(
            12L, List.of("MANAGER", "TECHNICIAN"), List.of(101L)
        )).thenReturn(List.of(author));

        assertThatThrownBy(() -> service.publish(12L, 200L, new PublishRequest(0)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-FE07-05");
        assertThat(announcement.getState()).isEqualTo("DRAFT");
        verify(versions, never()).saveAndFlush(any());
        verify(outbox, never()).enqueue(any(), any(), any(), any(), any());
    }

    @Test
    void staleVersionCannotPublishDraft() {
        ReflectionTestUtils.setField(announcement, "version", 2);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        assertThatThrownBy(() -> service.publish(12L, 200L, new PublishRequest(1)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-COM-05");

        assertThat(announcement.getState()).isEqualTo("DRAFT");
        verify(versions, never()).saveAndFlush(any());
        verify(recipients, never()).save(any());
        verify(outbox, never()).enqueue(any(), any(), any(), any(), any());
    }

    @Test
    void publishedAnnouncementCannotBeSavedAsDraftAgain() {
        announcement.setState("PUBLISHED");
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        assertThatThrownBy(() -> service.updateDraft(12L, 200L, new DraftRequest("Changed", "Changed", List.of("TECHNICIAN"), 0)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-COM-05");

        assertThat(announcement.getDraftTitle()).isEqualTo("Water delivery");
        assertThat(announcement.getDraftBody()).isEqualTo("Water is shut off at noon.");
        verify(announcements, never()).saveAndFlush(any());
    }

    @Test
    void draftMutationCannotLoadAnAnnouncementOutsideTheRequestedFarm() {
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.updateDraft(12L, 200L, new DraftRequest("Changed", "Changed", List.of("TECHNICIAN"), 0)))
            .isInstanceOf(DomainException.class)
            .hasMessageContaining("MSG-COM-08");

        verify(announcements, never()).saveAndFlush(any());
        verify(versions, never()).saveAndFlush(any());
    }

    @Test
    void correctionPublishesEvenWhenNoOriginalRecipientRemainsActive() {
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        announcement.setState("PUBLISHED");
        FarmMembership inactive = member(103L, "TECHNICIAN", farm);
        inactive.setStatus("INACTIVE");
        AnnouncementVersion original = version(301L, 1, announcement);
        AnnouncementRecipient originalDelivery = delivery(original, inactive, 401L);
        when(access.require(12L, FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L, 41L, "ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L, 12L)).thenReturn(java.util.Optional.of(announcement));

        AtomicReference<List<AnnouncementVersion>> history = new AtomicReference<>(List.of(original));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenAnswer(invocation -> history.get());
        when(recipients.findByVersion_Id(301L)).thenReturn(List.of(originalDelivery));
        when(memberships.lockByIdsAndFarmIdOrderById(12L, List.of(101L, 103L))).thenReturn(List.of(author, inactive));
        when(versions.saveAndFlush(any())).thenAnswer(invocation -> {
            AnnouncementVersion saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 302L);
            history.set(List.of(saved, original));
            return saved;
        });
        when(announcements.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(recipients.findByVersion_Id(302L)).thenReturn(List.of());
        when(recipients.findByMembership_IdOrderByDeliveredTimeDesc(101L)).thenReturn(List.of());

        AnnouncementView result = service.correctPublished(12L, 200L, new CorrectionRequest("Corrected", "Corrected body", "Reason", 0));

        assertThat(result.versions()).extracting(VersionView::versionNo).containsExactly(2, 1);
        assertThat(result.recipientCount()).isZero();
        assertThat(result.deliveries()).isEmpty();
        verify(recipients, never()).save(any());
        verify(outbox).enqueue(eq(12L), eq("ANNOUNCEMENT_CORRECTED"), eq("AnnouncementVersion"), eq(302L), any(Map.class));
    }

    private FarmMembership member(Long id, String role, Farm memberFarm) {
        FarmMembership membership = new FarmMembership();
        membership.setId(id);
        membership.setFarm(memberFarm);
        AppUser user = new AppUser();
        user.setId(id);
        user.setFullName("Member " + id);
        membership.setUser(user);
        membership.setRole(role);
        membership.setStatus("ACTIVE");
        return membership;
    }

    private AnnouncementVersion version(Long id, int versionNo, FarmAnnouncement parent) {
        AnnouncementVersion version = new AnnouncementVersion();
        ReflectionTestUtils.setField(version, "id", id);
        version.setAnnouncement(parent);
        version.setVersionNo(versionNo);
        version.setTitle("Version " + versionNo);
        version.setBody("Body " + versionNo);
        version.setPublishedTime(Instant.parse("2026-10-28T09:00:00Z"));
        return version;
    }

    private AnnouncementRecipient delivery(AnnouncementVersion version, FarmMembership member, Long id) {
        AnnouncementRecipient delivery = new AnnouncementRecipient();
        ReflectionTestUtils.setField(delivery, "id", id);
        delivery.setVersion(version);
        delivery.setMembership(member);
        delivery.setDeliveredTime(Instant.parse("2026-10-28T09:00:00Z"));
        return delivery;
    }

    private AnnouncementMemberSelector selector(FarmAnnouncement parent, FarmMembership member) {
        AnnouncementMemberSelector selector = new AnnouncementMemberSelector();
        selector.setAnnouncement(parent);
        selector.setMembership(member);
        return selector;
    }
}
