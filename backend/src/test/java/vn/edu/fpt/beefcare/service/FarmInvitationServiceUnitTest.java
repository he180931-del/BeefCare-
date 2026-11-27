package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
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
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.InvitationView;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.InviteRequest;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE03-01..04:
 * {@link FarmMembershipService#invite}, {@link FarmMembershipService#listInvitations}, {@link FarmMembershipService#resend}
 * and {@link FarmMembershipService#accept}. The link signer is the real HMAC implementation with a test key.
 */
@ExtendWith(MockitoExtension.class)
class FarmInvitationServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");
    private static final long FARM_ID = 401L;
    private static final long INVITATION_ID = 902L;
    private static ValidatorFactory factory;
    private static Validator validator;

    @Mock FarmAccessService access;
    @Mock FarmRepository farms;
    @Mock FarmInvitationRepository invitations;
    @Mock FarmMembershipRepository memberships;
    @Mock AppUserRepository users;
    @Mock AuditService audit;
    @Mock MailService mail;
    @Mock FarmMembershipChangeRepository changes;

    private final ActionLinkSigner signer = new ActionLinkSigner("unit-test-signing-key-with-32-characters!");
    private FarmMembershipService service;
    private Farm farm;
    private AppUser owner;
    private FarmContext ownerContext;

    @BeforeAll
    static void startValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        factory.close();
    }

    @BeforeEach
    void setUp() {
        service = new FarmMembershipService(access, farms, invitations, memberships, users, audit, mail,
            new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), signer, changes);
        farm = new Farm();
        farm.setId(FARM_ID);
        farm.setName("Trai Ba Vi");
        farm.setServiceStatus("ACTIVE");
        farm.setTimeZone("Asia/Ho_Chi_Minh");
        owner = user(11L, "owner@beefcare.test");
        ownerContext = new FarmContext(farm, owner, FarmRole.OWNER);
    }

    private static AppUser user(long id, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setFullName("User " + id);
        user.setAccountStatus("ACTIVE");
        return user;
    }

    private void signedInOwner() {
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenReturn(ownerContext);
    }

    // ------------------------------------------------------------------ UC-FE03-01 invite()

    private void invitable() {
        signedInOwner();
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        lenient().when(users.findOneByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        lenient().when(invitations.findFirstByFarmIdAndInvitedEmailIgnoreCaseAndStatusIgnoreCase(eq(FARM_ID), anyString(), eq("PENDING"))).thenReturn(Optional.empty());
        lenient().when(invitations.saveAndFlush(any(FarmInvitation.class))).thenAnswer(call -> {
            FarmInvitation saved = call.getArgument(0);
            saved.setId(INVITATION_ID);
            saved.setVersion(0);
            return saved;
        });
    }

    @Test
    void tc0303AValidInvitationIsPendingForFourteenDaysWithOneEmailAndNoMembership() {
        invitable();
        ArgumentCaptor<FarmInvitation> saved = ArgumentCaptor.forClass(FarmInvitation.class);

        InvitationView view = service.invite(FARM_ID, new InviteRequest("  A@X.vn ", "MANAGER", 14));

        verify(invitations, times(2)).saveAndFlush(saved.capture());
        FarmInvitation invitation = saved.getValue();
        assertThat(invitation.getInvitedEmail()).isEqualTo("a@x.vn");
        assertThat(invitation.getStatus()).isEqualTo("PENDING");
        assertThat(invitation.getProposedRole()).isEqualTo("MANAGER");
        assertThat(invitation.getProposedPermissions()).isNull();
        assertThat(invitation.getLastSentAt()).isEqualTo(NOW);
        assertThat(invitation.getExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(14)));
        assertThat(signer.matchesHash(signer.bearer("FARM_INVITATION", INVITATION_ID, invitation.getTokenNonce()), invitation.getTokenHash())).isTrue();
        verify(audit).log(ownerContext, "MEMBER_INVITE", "FarmInvitation", INVITATION_ID, Map.of("role", "MANAGER", "validityDays", 14));
        verify(mail).queueActionLink("a@x.vn", "FARM_INVITATION", "INVITATION", INVITATION_ID, null, "Trai Ba Vi", "MANAGER");
        verify(memberships, never()).saveAndFlush(any());
        assertThat(view.status()).isEqualTo("PENDING");
        assertThat(view.hasAccount()).isFalse();
    }

    @Test
    void tcDuc030101WithoutAValidityTheInvitationLastsSevenDays() {
        invitable();

        InvitationView view = service.invite(FARM_ID, new InviteRequest("a@x.vn", "TECHNICIAN", null));

        assertThat(view.validityDays()).isEqualTo(7);
        assertThat(view.expiresAt()).isEqualTo(NOW.plus(Duration.ofDays(7)));
    }

    @Test
    void tcDuc030102OnlyThreeSevenOrFourteenDaysAreAccepted() {
        invitable();

        assertThat(service.invite(FARM_ID, new InviteRequest("a@x.vn", "MANAGER", 3)).expiresAt()).isEqualTo(NOW.plus(Duration.ofDays(3)));
        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("b@x.vn", "MANAGER", 5)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "validityDays");
            });
        verify(invitations, times(2)).saveAndFlush(any());
    }

    @Test
    void tc0301ABlankEmailGetsMsgCom06AndAMalformedOr255CharacterEmailGetsMsgCom10() {
        invitable();
        String longest = "a".repeat(254 - "@x.vn".length()) + "@x.vn";

        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("  ", "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06));
        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("abc", "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10));
        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("a" + longest, "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "email"));
        assertThat(service.invite(FARM_ID, new InviteRequest(longest, "MANAGER", 7)).email()).hasSize(254);
    }

    @Test
    void tc0302TheRoleIsRequiredAndAnOwnerRoleCannotBeInvited() {
        Set<ConstraintViolation<InviteRequest>> missing = validator.validate(new InviteRequest("a@x.vn", null, 7));
        assertThat(missing).extracting(violation -> violation.getPropertyPath().toString()).containsExactly("role");

        invitable();
        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("a@x.vn", "OWNER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "role");
            });
        verify(invitations, never()).saveAndFlush(any());
    }

    @Test
    void tc0304APendingInvitationForTheSameEmailInAnyCaseGetsMsgFe0303() {
        invitable();
        FarmInvitation pending = invitation("PENDING", NOW.plus(Duration.ofDays(2)), 1);
        when(invitations.findFirstByFarmIdAndInvitedEmailIgnoreCaseAndStatusIgnoreCase(FARM_ID, "a@x.vn", "PENDING")).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("A@X.vn", "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_03);
                assertThat(error.getParams()).containsEntry("invitationId", INVITATION_ID).containsEntry("email", "a@x.vn");
            });
        verify(invitations, never()).saveAndFlush(any());
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0305AnActiveMemberGetsMsgFe0302() {
        invitable();
        AppUser member = user(73L, "a@x.vn");
        when(users.findOneByEmailIgnoreCase("a@x.vn")).thenReturn(Optional.of(member));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.of(membership(53L, member, "MANAGER", "ACTIVE")));

        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("a@x.vn", "TECHNICIAN", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-FE03-02");
                assertThat(error.getStatus()).isEqualTo(HttpStatus.CONFLICT);
            });
        verify(invitations, never()).saveAndFlush(any());
    }

    @Test
    void tc0306AnInactiveMemberGetsMsgFe0321WithTheMembershipToReactivate() {
        invitable();
        AppUser member = user(73L, "a@x.vn");
        when(users.findOneByEmailIgnoreCase("a@x.vn")).thenReturn(Optional.of(member));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.of(membership(53L, member, "MANAGER", "INACTIVE")));

        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("a@x.vn", "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_21);
                assertThat(error.getParams()).containsEntry("membershipId", 53L);
            });
        verify(invitations, never()).saveAndFlush(any());
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0307AFarmThatIsNotActiveGetsMsgFe0304BeforeTheFarmIsLocked() {
        farm.setServiceStatus("EXPIRED");
        signedInOwner();

        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("a@x.vn", "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_04));
        verifyNoInteractions(farms, invitations, audit, mail);
    }

    @Test
    void tc0309AManagerCannotInvite() {
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.invite(FARM_ID, new InviteRequest("a@x.vn", "MANAGER", 7)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(farms, invitations, audit, mail);
    }

    @Test
    void tcDuc030103AnOverduePendingInvitationIsExpiredAndReplacedBeforeTheExpiryJobRuns() {
        invitable();
        when(access.currentActiveUser()).thenReturn(owner);
        FarmInvitation overdue = invitation("PENDING", NOW, 1);
        when(invitations.findFirstByFarmIdAndInvitedEmailIgnoreCaseAndStatusIgnoreCase(FARM_ID, "a@x.vn", "PENDING")).thenReturn(Optional.of(overdue));

        InvitationView view = service.invite(FARM_ID, new InviteRequest("a@x.vn", "MANAGER", 7));

        assertThat(overdue.getStatus()).isEqualTo("EXPIRED");
        InOrder order = inOrder(invitations, mail, audit);
        order.verify(invitations).flush();
        order.verify(mail).cancelActionLink("INVITATION", INVITATION_ID);
        order.verify(audit).log(farm, owner, "INVITE_EXPIRED", "FarmInvitation", INVITATION_ID, Map.of("status", "EXPIRED"));
        order.verify(invitations, times(2)).saveAndFlush(any());
        assertThat(view.status()).isEqualTo("PENDING");
    }

    @Test
    void tcDuc030104AnInviteeWithAnAccountButNoMembershipIsInvitedWithHasAccount() {
        invitable();
        when(users.findOneByEmailIgnoreCase("a@x.vn")).thenReturn(Optional.of(user(73L, "a@x.vn")));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.empty());

        assertThat(service.invite(FARM_ID, new InviteRequest("a@x.vn", "MANAGER", 7)).hasAccount()).isTrue();
    }

    // ------------------------------------------------------------------ UC-FE03-02 listInvitations()

    private FarmInvitation invitation(String status, Instant expiresAt, int version) {
        FarmInvitation invitation = new FarmInvitation();
        invitation.setId(INVITATION_ID);
        invitation.setFarm(farm);
        invitation.setInvitedBy(owner);
        invitation.setInvitedEmail("a@x.vn");
        invitation.setProposedRole("MANAGER");
        invitation.setStatus(status);
        invitation.setCreatedAt(NOW.minus(Duration.ofDays(10)));
        invitation.setLastSentAt(NOW.minus(Duration.ofDays(4)));
        invitation.setValidityDays(7);
        invitation.setExpiresAt(expiresAt);
        invitation.setVersion(version);
        invitation.setTokenNonce("nonce-1");
        invitation.setTokenHash(signer.hash(signer.bearer("FARM_INVITATION", INVITATION_ID, "nonce-1")));
        return invitation;
    }

    private FarmInvitationRepository.InvitationCounts counts(long pending, long accepted, long expired, long cancelled) {
        FarmInvitationRepository.InvitationCounts counts = mock(FarmInvitationRepository.InvitationCounts.class);
        when(counts.getPending()).thenReturn(pending);
        when(counts.getAccepted()).thenReturn(accepted);
        when(counts.getExpired()).thenReturn(expired);
        when(counts.getCancelled()).thenReturn(cancelled);
        return counts;
    }

    @Test
    void tc0335TheListReturnsEffectiveStatusesWithFarmWideCountsForEveryTab() {
        signedInOwner();
        FarmInvitation pending = invitation("PENDING", NOW.plus(Duration.ofDays(3)), 1);
        when(invitations.searchInvitations(eq(FARM_ID), eq("PENDING"), eq(null), eq(NOW), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(pending), PageRequest.of(0, 20), 1));
        FarmInvitationRepository.InvitationCounts counts = counts(1, 2, 3, 4);
        when(invitations.countInvitationStatuses(FARM_ID, NOW)).thenReturn(counts);
        when(users.findExistingInvitationEmails(List.of("a@x.vn"))).thenReturn(Set.of());

        var page = service.listInvitations(FARM_ID, " pending ", 0, 20, "lastSentAt", "desc", null);

        assertThat(page.items()).extracting(InvitationView::status).containsExactly("PENDING");
        assertThat(page.counts()).containsExactly(Map.entry("PENDING", 1L), Map.entry("ACCEPTED", 2L), Map.entry("EXPIRED", 3L), Map.entry("CANCELLED", 4L));
        assertThat(page.total()).isEqualTo(1);
        assertThat(page.asOf()).isEqualTo(NOW);
    }

    @Test
    void tc0336PagesAreOrderedByLastSentAtThenByIdDescending() {
        signedInOwner();
        FarmInvitationRepository.InvitationCounts counts = counts(23, 0, 0, 0);
        when(invitations.countInvitationStatuses(FARM_ID, NOW)).thenReturn(counts);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(invitations.searchInvitations(eq(FARM_ID), eq(null), eq(null), eq(NOW), pageable.capture())).thenReturn(new PageImpl<>(List.of()));

        service.listInvitations(FARM_ID, null, 1, 20, "lastSentAt", "asc", null);

        assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
        assertThat(pageable.getValue().getSort()).containsExactly(Sort.Order.asc("lastSentAt"), Sort.Order.desc("id"));
        verifyNoInteractions(audit, mail);
        verify(users, never()).findExistingInvitationEmails(any());
    }

    @Test
    void tc0337APendingInvitationThatExpiresExactlyAtTheReadTimeIsShownExpiredWithoutWriting() {
        signedInOwner();
        FarmInvitation due = invitation("PENDING", NOW, 1);
        when(invitations.searchInvitations(eq(FARM_ID), eq(null), eq(null), eq(NOW), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(due)));
        FarmInvitationRepository.InvitationCounts counts = counts(0, 0, 1, 0);
        when(invitations.countInvitationStatuses(FARM_ID, NOW)).thenReturn(counts);
        when(users.findExistingInvitationEmails(List.of("a@x.vn"))).thenReturn(Set.of());

        var page = service.listInvitations(FARM_ID, null, 0, 20, "lastSentAt", "desc", null);

        assertThat(page.items().get(0).status()).isEqualTo("EXPIRED");
        assertThat(due.getStatus()).isEqualTo("PENDING");
        assertThat(due.getVersion()).isEqualTo(1);
        verify(invitations, never()).saveAndFlush(any());
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0340InvalidQueryParametersGetMsgCom10WithTheirFieldBeforeAnyRead() {
        signedInOwner();
        Map<String, Runnable> calls = new java.util.LinkedHashMap<>();
        calls.put("status", () -> service.listInvitations(FARM_ID, "OPEN", 0, 20, "lastSentAt", "desc", null));
        calls.put("page", () -> service.listInvitations(FARM_ID, null, -1, 20, "lastSentAt", "desc", null));
        calls.put("size", () -> service.listInvitations(FARM_ID, null, 0, 101, "lastSentAt", "desc", null));
        calls.put("sort", () -> service.listInvitations(FARM_ID, null, 0, 20, "createdAt", "desc", null));
        calls.put("dir", () -> service.listInvitations(FARM_ID, null, 0, 20, "lastSentAt", "up", null));
        calls.put("invitationId", () -> service.listInvitations(FARM_ID, null, 0, 20, "lastSentAt", "desc", 0L));
        calls.forEach((field, call) -> assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", field);
            }));
        verifyNoInteractions(invitations, users);
    }

    @Test
    void tcDuc030201PageSizeOneAndOneHundredAreTheAcceptedLimits() {
        signedInOwner();
        FarmInvitationRepository.InvitationCounts counts = counts(0, 0, 0, 0);
        when(invitations.countInvitationStatuses(FARM_ID, NOW)).thenReturn(counts);
        when(invitations.searchInvitations(eq(FARM_ID), eq(null), eq(null), eq(NOW), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        assertThat(service.listInvitations(FARM_ID, null, 0, 1, "lastSentAt", "desc", null).size()).isEqualTo(1);
        assertThat(service.listInvitations(FARM_ID, null, 0, 100, "lastSentAt", "DESC", null).size()).isEqualTo(100);
        assertThatThrownBy(() -> service.listInvitations(FARM_ID, null, 0, 0, "lastSentAt", "desc", null))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "size"));
    }

    @Test
    void tc0339SomeoneWhoIsNotTheOwnerCannotReadTheInvitations() {
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.listInvitations(FARM_ID, null, 0, 20, "lastSentAt", "desc", null))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(invitations, users);
    }

    @Test
    void tc0343AnInvitationIdIsLookedUpInsideTheSameFarm() {
        signedInOwner();
        FarmInvitationRepository.InvitationCounts counts = counts(1, 0, 0, 0);
        when(invitations.countInvitationStatuses(FARM_ID, NOW)).thenReturn(counts);
        when(invitations.searchInvitations(eq(FARM_ID), eq(null), eq(INVITATION_ID), eq(NOW), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(invitation("PENDING", NOW.plus(Duration.ofDays(1)), 5))));
        when(users.findExistingInvitationEmails(List.of("a@x.vn"))).thenReturn(Set.of());

        var page = service.listInvitations(FARM_ID, null, 0, 20, "lastSentAt", "desc", INVITATION_ID);

        assertThat(page.items()).extracting(InvitationView::id, InvitationView::version).containsExactly(org.assertj.core.groups.Tuple.tuple(INVITATION_ID, 5));
    }

    @Test
    void tc0344HasAccountReflectsTheAccountsThatExistNowCaseInsensitively() {
        signedInOwner();
        FarmInvitation upper = invitation("PENDING", NOW.plus(Duration.ofDays(1)), 1);
        upper.setInvitedEmail("A@X.vn");
        FarmInvitation other = invitation("ACCEPTED", NOW.plus(Duration.ofDays(1)), 1);
        other.setInvitedEmail("b@x.vn");
        when(invitations.searchInvitations(eq(FARM_ID), eq(null), eq(null), eq(NOW), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(upper, other)));
        FarmInvitationRepository.InvitationCounts counts = counts(1, 1, 0, 0);
        when(invitations.countInvitationStatuses(FARM_ID, NOW)).thenReturn(counts);
        when(users.findExistingInvitationEmails(List.of("a@x.vn", "b@x.vn"))).thenReturn(Set.of("a@x.vn"));

        var items = service.listInvitations(FARM_ID, null, 0, 20, "lastSentAt", "desc", null).items();

        assertThat(items).extracting(InvitationView::hasAccount).containsExactly(true, false);
    }

    // ------------------------------------------------------------------ UC-FE03-03 resend()

    private FarmInvitation lockedInvitation(String status, Instant expiresAt, int version) {
        FarmInvitation invitation = invitation(status, expiresAt, version);
        when(invitations.lockByIdAndFarmId(INVITATION_ID, FARM_ID)).thenReturn(Optional.of(invitation));
        return invitation;
    }

    @Test
    void tc0310ResendKeepsTheInvitationEmailAndRoleAndRestartsTheValidityFromNow() {
        signedInOwner();
        FarmInvitation invitation = lockedInvitation("PENDING", NOW.plus(Duration.ofDays(3)), 2);
        String oldLink = signer.bearer("FARM_INVITATION", INVITATION_ID, "nonce-1");
        when(users.existsByEmailIgnoreCase("a@x.vn")).thenReturn(false);

        InvitationView view = service.resend(FARM_ID, INVITATION_ID, 2);

        assertThat(view.id()).isEqualTo(INVITATION_ID);
        assertThat(view.email()).isEqualTo("a@x.vn");
        assertThat(view.role()).isEqualTo("MANAGER");
        assertThat(view.lastSentAt()).isEqualTo(NOW);
        assertThat(view.expiresAt()).isEqualTo(NOW.plus(Duration.ofDays(7)));
        assertThat(signer.matchesHash(oldLink, invitation.getTokenHash())).isFalse();
        assertThat(signer.matchesHash(signer.bearer("FARM_INVITATION", INVITATION_ID, invitation.getTokenNonce()), invitation.getTokenHash())).isTrue();
        InOrder order = inOrder(mail);
        order.verify(mail).cancelActionLink("INVITATION", INVITATION_ID);
        order.verify(mail).queueActionLink("a@x.vn", "FARM_INVITATION", "INVITATION", INVITATION_ID, null, "Trai Ba Vi", "MANAGER");
        verify(audit).log(eq(ownerContext), eq("INVITE_RESEND"), eq("FarmInvitation"), eq(INVITATION_ID), any());
    }

    @Test
    void tc0307ResendOnAFarmThatIsNotActiveGetsMsgFe0304() {
        farm.setServiceStatus("SUSPENDED");
        signedInOwner();

        assertThatThrownBy(() -> service.resend(FARM_ID, INVITATION_ID, 2))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_04));
        verifyNoInteractions(invitations, audit, mail);
    }

    @Test
    void tc0348ACancelledOrAcceptedInvitationGetsMsgFe0308WithItsStatusEvenWithAnOutdatedVersion() {
        signedInOwner();
        for (String status : List.of("CANCELLED", "ACCEPTED")) {
            FarmInvitation invitation = lockedInvitation(status, NOW.plus(Duration.ofDays(3)), 4);

            assertThatThrownBy(() -> service.resend(FARM_ID, INVITATION_ID, 1))
                .isInstanceOfSatisfying(DomainException.class, error -> {
                    assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_08);
                    assertThat(error.getParams()).containsEntry("status", status);
                });
            assertThat(invitation.getVersion()).isEqualTo(4);
        }
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0349APendingInvitationDueExactlyNowGetsMsgFe0308ExpiredAndKeepsItsLink() {
        signedInOwner();
        FarmInvitation invitation = lockedInvitation("PENDING", NOW, 2);
        String hashBefore = invitation.getTokenHash();

        assertThatThrownBy(() -> service.resend(FARM_ID, INVITATION_ID, 2))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("status", "EXPIRED"));
        assertThat(invitation.getStatus()).isEqualTo("PENDING");
        assertThat(invitation.getTokenHash()).isEqualTo(hashBefore);
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tcDuc030301AnOutdatedVersionOfAPendingInvitationGetsMsgCom05() {
        signedInOwner();
        FarmInvitation invitation = lockedInvitation("PENDING", NOW.plus(Duration.ofDays(3)), 3);

        assertThatThrownBy(() -> service.resend(FARM_ID, INVITATION_ID, 2))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05));
        assertThat(invitation.getLastSentAt()).isEqualTo(NOW.minus(Duration.ofDays(4)));
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0351AnInvitationOfAnotherFarmGetsMsgCom08AndANonOwnerGetsMsgCom01() {
        signedInOwner();
        when(invitations.lockByIdAndFarmId(INVITATION_ID, FARM_ID)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resend(FARM_ID, INVITATION_ID, 2))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
            });

        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));
        assertThatThrownBy(() -> service.resend(FARM_ID, INVITATION_ID, 2))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(audit, mail);
    }

    // ------------------------------------------------------------------ UC-FE03-04 accept()

    private AppUser invitee;
    private String token;

    private FarmInvitation openLink(String status, Instant expiresAt) {
        invitee = user(73L, "a@x.vn");
        FarmInvitation invitation = invitation(status, expiresAt, 1);
        token = signer.bearer("FARM_INVITATION", INVITATION_ID, "nonce-1");
        when(invitations.lockByTokenHash(signer.hash(token))).thenReturn(Optional.of(invitation));
        when(access.currentActiveUser()).thenReturn(invitee);
        return invitation;
    }

    private static FarmMembership membership(long id, AppUser user, String role, String status) {
        FarmMembership membership = new FarmMembership();
        membership.setId(id);
        membership.setUser(user);
        membership.setRole(role);
        membership.setStatus(status);
        return membership;
    }

    @Test
    void tc0315AcceptingCreatesOneActiveMembershipWithTheProposedRoleAndNotifiesTheOwner() {
        FarmInvitation invitation = openLink("PENDING", NOW.plus(Duration.ofDays(3)));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.empty());
        when(memberships.saveAndFlush(any(FarmMembership.class))).thenAnswer(call -> {
            FarmMembership created = call.getArgument(0);
            created.setId(88L);
            return created;
        });
        FarmMembership ownerRow = membership(1L, owner, "OWNER", "ACTIVE");
        when(memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(FARM_ID, "OWNER", "ACTIVE")).thenReturn(Optional.of(ownerRow));
        ArgumentCaptor<FarmMembership> created = ArgumentCaptor.forClass(FarmMembership.class);

        var accepted = service.accept(token);

        verify(memberships).saveAndFlush(created.capture());
        assertThat(created.getValue().getRole()).isEqualTo("MANAGER");
        assertThat(created.getValue().getStatus()).isEqualTo("ACTIVE");
        assertThat(created.getValue().getUser()).isSameAs(invitee);
        assertThat(created.getValue().getEffectiveDate()).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(created.getValue().getJoinedAt()).isEqualTo(NOW);
        assertThat(invitation.getStatus()).isEqualTo("ACCEPTED");
        assertThat(invitation.getAcceptedAt()).isEqualTo(NOW);
        verify(mail).cancelActionLink("INVITATION", INVITATION_ID);
        verify(audit).log(farm, invitee, "MEMBER_ACCEPT", "FarmMembership", 88L, Map.of("role", "MANAGER"));
        verify(mail).queueMemberJoined(owner, created.getValue());
        assertThat(accepted.membershipId()).isEqualTo(88L);
        assertThat(accepted.farmId()).isEqualTo(FARM_ID);
    }

    @Test
    void tc0316AcceptingAgainReturnsTheExistingActiveMembershipWithoutASecondOne() {
        openLink("ACCEPTED", NOW.plus(Duration.ofDays(3)));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        FarmMembership existing = membership(88L, invitee, "MANAGER", "ACTIVE");
        existing.setFarm(farm);
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.of(existing));

        var accepted = service.accept(token);

        assertThat(accepted.membershipId()).isEqualTo(88L);
        assertThat(accepted.status()).isEqualTo("ACTIVE");
        verify(memberships, never()).saveAndFlush(any());
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0355AnAcceptedLinkWhoseMembershipIsInactiveGetsMsgFe0308Accepted() {
        openLink("ACCEPTED", NOW.plus(Duration.ofDays(3)));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.of(membership(88L, invitee, "MANAGER", "INACTIVE")));

        assertThatThrownBy(() -> service.accept(token))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_08);
                assertThat(error.getParams()).containsEntry("status", "ACCEPTED");
            });
        verify(memberships, never()).saveAndFlush(any());
    }

    @Test
    void tc0317AcceptingWhileTheFarmIsSuspendedGetsMsgFe0304AndTheInvitationStaysPending() {
        FarmInvitation invitation = openLink("PENDING", NOW.plus(Duration.ofDays(3)));
        farm.setServiceStatus("SUSPENDED");
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));

        assertThatThrownBy(() -> service.accept(token))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_04));
        assertThat(invitation.getStatus()).isEqualTo("PENDING");
        verify(memberships, never()).saveAndFlush(any());
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tc0313AnInvitationOverdueByOneMinuteGetsMsgFe0308ExpiredAndNoMembership() {
        openLink("PENDING", NOW.minus(Duration.ofMinutes(1)));

        assertThatThrownBy(() -> service.accept(token))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_08);
                assertThat(error.getParams()).containsEntry("status", "EXPIRED").containsKey("expiresAt");
            });
        verifyNoInteractions(farms, audit, mail);
        verify(memberships, never()).saveAndFlush(any());
    }

    @Test
    void tc0314AnotherSignedInEmailGetsMsgFe0309WithoutTheFarmOrRole() {
        openLink("PENDING", NOW.plus(Duration.ofDays(3)));
        invitee.setEmail("b@x.vn");

        assertThatThrownBy(() -> service.accept(token))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_09);
                assertThat(error.getParams()).isEmpty();
            });
        verifyNoInteractions(farms, audit, mail);
    }

    @Test
    void tc0354ABlankUnknownOrCancelledLinkGetsMsgFe0308AndNoMembership() {
        assertThatThrownBy(() -> service.accept(" "))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsExactly(Map.entry("status", "INVALID")));
        when(invitations.lockByTokenHash(signer.hash("unknown"))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.accept("unknown"))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsExactly(Map.entry("status", "INVALID")));

        openLink("CANCELLED", NOW.plus(Duration.ofDays(3)));
        assertThatThrownBy(() -> service.accept(token))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_08);
                assertThat(error.getParams()).containsEntry("status", "CANCELLED").containsKey("expiresAt");
            });
        verify(memberships, never()).saveAndFlush(any());
        verifyNoInteractions(audit, mail);
    }

    @Test
    void tcDuc030401AnInviteeWhoAlreadyHasAMembershipOfTheFarmGetsMsgCom05() {
        openLink("PENDING", NOW.plus(Duration.ofDays(3)));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.of(membership(88L, invitee, "TECHNICIAN", "INACTIVE")));

        assertThatThrownBy(() -> service.accept(token))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05));
        verify(memberships, never()).saveAndFlush(any());
    }

    @Test
    void tcDuc030402WithoutAnActiveOwnerTheMembershipIsCreatedWithoutAMemberJoinedEmail() {
        openLink("PENDING", NOW.plus(Duration.ofDays(3)));
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        when(memberships.findFirstByFarmIdAndUserId(FARM_ID, 73L)).thenReturn(Optional.empty());
        when(memberships.saveAndFlush(any(FarmMembership.class))).thenAnswer(call -> {
            FarmMembership created = call.getArgument(0);
            created.setId(88L);
            return created;
        });
        when(memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(FARM_ID, "OWNER", "ACTIVE")).thenReturn(Optional.empty());

        assertThat(service.accept(token).membershipId()).isEqualTo(88L);
        verify(mail, never()).queueMemberJoined(any(), any());
    }
}
