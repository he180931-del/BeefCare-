package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.Instant;
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
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.*;
import vn.edu.fpt.beefcare.service.dto.AnnouncementDtos.*;

@ExtendWith(MockitoExtension.class)
class FarmAnnouncementServiceTest {
    @Mock FarmAccessService access;@Mock FarmClock clock;@Mock FarmMembershipRepository memberships;@Mock FarmAnnouncementRepository announcements;
    @Mock AnnouncementVersionRepository versions;@Mock AnnouncementRecipientRepository recipients;@Mock OutboxService outbox;
    @InjectMocks FarmAnnouncementService service;
    Farm farm;AppUser authorUser;FarmMembership author;FarmContext ownerContext;FarmAnnouncement announcement;

    @BeforeEach void setup(){
        farm=new Farm();ReflectionTestUtils.setField(farm,"id",12L);authorUser=new AppUser();authorUser.setId(41L);authorUser.setFullName("Farm owner");author=new FarmMembership();author.setId(101L);author.setFarm(farm);author.setUser(authorUser);author.setRole("OWNER");author.setStatus("ACTIVE");ownerContext=new FarmContext(farm,authorUser,FarmRole.OWNER);
        announcement=new FarmAnnouncement();ReflectionTestUtils.setField(announcement,"id",200L);announcement.setFarm(farm);announcement.setAuthor(author);announcement.setState("DRAFT");announcement.setDraftTitle("Water delivery");announcement.setDraftBody("Water is shut off at noon.");announcement.setRecipientRoles("MANAGER,TECHNICIAN");
    }

    @Test void publishingResolvesAndSnapshotsOnlyPermittedActiveRecipients(){
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        FarmMembership manager=member(102L,"MANAGER");FarmMembership technician=member(103L,"TECHNICIAN");FarmMembership inactive=member(104L,"TECHNICIAN");inactive.setStatus("INACTIVE");
        when(access.require(12L,FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L,41L,"ACTIVE")).thenReturn(java.util.Optional.of(author));
        AtomicReference<AnnouncementVersion> savedVersion=new AtomicReference<>();
        when(announcements.findByIdAndFarm_Id(200L,12L)).thenReturn(java.util.Optional.of(announcement));when(memberships.findByFarm_IdAndStatusIgnoreCase(12L,"ACTIVE")).thenReturn(List.of(author,manager,technician,inactive));when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenAnswer(inv->savedVersion.get()==null?List.of():List.of(savedVersion.get()));
        when(versions.saveAndFlush(any())).thenAnswer(inv->{AnnouncementVersion v=inv.getArgument(0);ReflectionTestUtils.setField(v,"id",301L);savedVersion.set(v);return v;});

        AnnouncementView result=service.publish(12L,200L,new PublishRequest(0));

        assertThat(announcement.getState()).isEqualTo("PUBLISHED");assertThat(result.versions()).hasSize(1);assertThat(result.versions().get(0).versionNo()).isEqualTo(1);
        verify(recipients,times(2)).save(any(AnnouncementRecipient.class));verify(recipients,never()).save(argThat(r->r.getMembership().getId().equals(101L)||r.getMembership().getId().equals(104L)));
        verify(outbox).enqueue(eq(12L),eq("ANNOUNCEMENT_PUBLISHED"),eq("AnnouncementVersion"),eq(301L),any(Map.class));
    }

    @Test void managerCannotAddressAnnouncementToOwnerOrAnotherManager(){
        FarmMembership manager=member(102L,"MANAGER");FarmContext managerContext=new FarmContext(farm,manager.getUser(),FarmRole.MANAGER);
        when(access.require(12L,FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(managerContext);
        assertThatThrownBy(()->service.createDraft(12L,new DraftRequest("Title","Body",List.of("MANAGER"),null))).isInstanceOf(DomainException.class);
        verify(announcements,never()).saveAndFlush(any());
    }

    @Test void correctionKeepsTheOriginalRecipientSnapshotEvenAfterMembershipChanges(){
        when(clock.now()).thenReturn(Instant.parse("2026-10-28T10:00:00Z"));
        announcement.setState("PUBLISHED");FarmMembership recipient=member(103L,"TECHNICIAN");recipient.setStatus("INACTIVE");
        AnnouncementVersion previous=new AnnouncementVersion();ReflectionTestUtils.setField(previous,"id",301L);previous.setAnnouncement(announcement);previous.setVersionNo(1);
        AnnouncementRecipient originalDelivery=new AnnouncementRecipient();originalDelivery.setVersion(previous);originalDelivery.setMembership(recipient);
        when(access.require(12L,FarmAction.MANAGE_ANNOUNCEMENTS)).thenReturn(ownerContext);
        when(memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(12L,41L,"ACTIVE")).thenReturn(java.util.Optional.of(author));
        when(announcements.findByIdAndFarm_Id(200L,12L)).thenReturn(java.util.Optional.of(announcement));
        when(versions.findByAnnouncement_IdOrderByVersionNoDesc(200L)).thenReturn(List.of(previous));
        when(recipients.findByVersion_Id(301L)).thenReturn(List.of(originalDelivery));
        when(versions.saveAndFlush(any())).thenAnswer(inv->{AnnouncementVersion v=inv.getArgument(0);ReflectionTestUtils.setField(v,"id",302L);return v;});
        when(announcements.saveAndFlush(any())).thenAnswer(inv->inv.getArgument(0));

        service.correctPublished(12L,200L,new CorrectionRequest("Updated title","Updated body","Correction reason",0));

        verify(recipients).save(argThat(delivery->delivery.getMembership().getId().equals(103L)));
        verify(memberships,never()).findByFarm_IdAndStatusIgnoreCase(12L,"ACTIVE");
        verify(outbox).enqueue(eq(12L),eq("ANNOUNCEMENT_CORRECTED"),eq("AnnouncementVersion"),eq(302L),any(Map.class));
    }

    private FarmMembership member(Long id,String role){FarmMembership m=new FarmMembership();m.setId(id);m.setFarm(farm);AppUser u=new AppUser();u.setId(id);u.setFullName("Member "+id);m.setUser(u);m.setRole(role);m.setStatus("ACTIVE");return m;}
}
