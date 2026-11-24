package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipChangeRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.MemberChange;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

@ExtendWith(MockitoExtension.class)
class FarmMembershipServiceUnitTest {

    private static final Long FARM_ID = 401L;
    private static final Long USER_ID = 73L;
    private static final Long INVITATION_ID = 902L;
    private static final Instant NOW = Instant.parse("2026-11-22T05:00:00Z");
    private static final Instant CREATED_AT = Instant.parse("2026-10-01T02:00:00Z");
    private static final Instant LAST_SENT_AT = Instant.parse("2026-11-14T02:00:00Z");
    private static final String RAW_TOKEN = "unit-test-token";
    private static final String TOKEN_HASH = "stored-token-hash";

    @Mock FarmAccessService access;
    @Mock FarmRepository farms;
    @Mock FarmInvitationRepository invitations;
    @Mock FarmMembershipRepository memberships;
    @Mock AppUserRepository users;
    @Mock AuditService audit;
    @Mock MailService mail;
    @Mock FarmClock clock;
    @Mock ActionLinkSigner linkSigner;
    @Mock FarmMembershipChangeRepository changes;

    private FarmMembershipService service;
    private Farm farm;
    private AppUser invitee;
    private FarmInvitation invitation;

    private void createService() {
        service = new FarmMembershipService(access, farms, invitations, memberships, users, audit, mail, clock, linkSigner, changes);
        farm = mock(Farm.class);
        invitee = mock(AppUser.class);
        invitation = mock(FarmInvitation.class);
    }

    private void stubToken(String status) {
        when(farm.getId()).thenReturn(FARM_ID);
        when(invitee.getEmail()).thenReturn("moi@example.test");
        when(invitation.getId()).thenReturn(INVITATION_ID);
        when(invitation.getFarm()).thenReturn(farm);
        when(invitation.getInvitedEmail()).thenReturn("moi@example.test");
        when(invitation.getStatus()).thenReturn(status);
        when(invitation.getExpiresAt()).thenReturn(NOW.plusSeconds(604_800));
        when(invitation.getTokenNonce()).thenReturn("nonce");
        when(invitation.getTokenHash()).thenReturn(TOKEN_HASH);
        when(access.currentActiveUser()).thenReturn(invitee);
        when(linkSigner.hash(RAW_TOKEN)).thenReturn(TOKEN_HASH);
        when(linkSigner.bearer("FARM_INVITATION", INVITATION_ID, "nonce")).thenReturn(RAW_TOKEN);
        when(linkSigner.matchesHash(RAW_TOKEN, TOKEN_HASH)).thenReturn(true);
        when(clock.now()).thenReturn(NOW);
        when(invitations.findOneByTokenHash(TOKEN_HASH)).thenReturn(Optional.of(invitation));
    }

    @Test
    void tc0353PreviewUsesLastSentAtAndTheFarmTimeZone() {
        createService();
        stubToken("PENDING");
        AppUser inviter = mock(AppUser.class);
        when(farm.getName()).thenReturn("Trại Ba Vì");
        when(farm.getTimeZone()).thenReturn("Asia/Ho_Chi_Minh");
        when(farm.getServiceStatus()).thenReturn("ACTIVE");
        when(inviter.getFullName()).thenReturn("Nguyễn Văn Hùng");
        when(invitation.getInvitedBy()).thenReturn(inviter);
        when(invitation.getProposedRole()).thenReturn("MANAGER");
        when(invitation.getLastSentAt()).thenReturn(LAST_SENT_AT);

        var preview = service.preview(RAW_TOKEN);

        assertThat(preview.status()).isEqualTo("PENDING");
        assertThat(preview.farmId()).isEqualTo(FARM_ID);
        assertThat(preview.timeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(preview.invitedBy()).isEqualTo("Nguyễn Văn Hùng");
        assertThat(preview.sentAt()).isEqualTo(LAST_SENT_AT).isNotEqualTo(CREATED_AT);
        assertThat(preview.expiresAt()).isEqualTo(NOW.plusSeconds(604_800));
    }

    @Test
    void tc0355AcceptedInvitationWithoutAnActiveMembershipReturnsTheUsedLinkError() {
        createService();
        stubToken("ACCEPTED");
        when(invitee.getId()).thenReturn(USER_ID);
        FarmMembership inactive = mock(FarmMembership.class);
        when(inactive.getStatus()).thenReturn("INACTIVE");
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, USER_ID)).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> service.preview(RAW_TOKEN))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_08);
                assertThat(error.getParams()).containsEntry("status", "ACCEPTED");
                assertThat(error.getParams()).containsEntry("expiresAt", invitation.getExpiresAt().toString());
            });
        verify(memberships, never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
        verifyNoInteractions(audit, mail, changes);
    }

    @Test
    void tc0370ChangingTheRoleOfAnInactiveMemberFailsBeforeWriting() {
        createService();
        AppUser owner = mock(AppUser.class);
        FarmContext context = new FarmContext(farm, owner, FarmRole.OWNER);
        FarmMembership inactive = mock(FarmMembership.class);
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenReturn(context);
        when(memberships.lockByIdAndFarmId(53L, FARM_ID)).thenReturn(Optional.of(inactive));
        when(clock.today()).thenReturn(LocalDate.of(2026, 11, 22));
        when(inactive.getRole()).thenReturn("TECHNICIAN");
        when(inactive.getStatus()).thenReturn("INACTIVE");

        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L,
            new MemberChange("CHANGE_ROLE", "MANAGER", LocalDate.of(2026, 11, 22), "Role change request", 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "action");
            });
        verify(memberships, never()).flush();
        verifyNoInteractions(audit, changes, mail);
    }
}
