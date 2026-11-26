package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.session.SessionRegistry;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AppUserStatusChangeRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.PlatformAccessChangeRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class PlatformAccountAdministrationServiceTest {
    @Mock PlatformAccessService platformAccess;
    @Mock AppUserRepository accounts;
    @Mock UserRepository users;
    @Mock PlatformStaffAccessRepository staffAccess;
    @Mock FarmMembershipRepository farmMemberships;
    @Mock AuditService audit;
    @Mock AppUserStatusChangeRepository statusChanges;
    @Mock PlatformAccessChangeRepository accessChanges;
    @Mock SupportTicketCommandService supportTickets;
    @Mock FarmClock clock;
    @Mock SessionRegistry sessions;
    PlatformAccountAdministrationService service;
    AppUser actor;

    @BeforeEach
    void setUp() {
        service = new PlatformAccountAdministrationService(platformAccess, accounts, users, staffAccess, farmMemberships, audit, statusChanges, accessChanges, supportTickets, clock, sessions);
        actor = account(90L, "sa@example.test", "ACTIVE", 2L);
        when(platformAccess.requireRole(PlatformRole.SA)).thenReturn(new PlatformContext(actor, null, PlatformRole.SA));
    }

    /** D33: a grant saves the access, one history row with the reason, and an audit entry with before / after only. */
    @Test
    void grantsVerifiedUserPlatformAccessWithHistoryAndAuditWithoutReason() {
        AppUser target = account(12L, "staff@example.test", "ACTIVE", 0L);
        User identity = new User();
        identity.setEmail(target.getEmail());
        identity.setActivated(true);
        when(accounts.findByIdForUpdate(12L)).thenReturn(Optional.of(target));
        when(users.findOneByEmailIgnoreCaseAndActivatedTrue(target.getEmail())).thenReturn(Optional.of(identity));
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.empty());
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(true);
        when(staffAccess.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(staffAccess.findOneByUserId(12L)).thenAnswer(invocation -> Optional.of(newAccess(target, "PM", "ACTIVE", 1L)));

        var result = service.changePlatformAccess(
            12L,
            new PlatformAccountAdministrationService.AccessChangeRequest("GRANT", "PM", "  Staff onboarding  ", null)
        );

        assertThat(result.platformRole()).isEqualTo("PM");
        assertThat(result.platformAccessStatus()).isEqualTo("ACTIVE");
        assertThat(result.accessActions()).containsExactly("CHANGE", "REVOKE");
        verify(accessChanges).save(argThat(row ->
            "GRANT".equals(row.getAction()) && row.getRoleBefore() == null && "PM".equals(row.getRoleAfter()) &&
            "ACTIVE".equals(row.getStatusAfter()) && "Staff onboarding".equals(row.getReason()) && row.getChangedBy() == actor
        ));
        // D33 / D34: before / after only, through the shared writer (role and correlation ID are filled there)
        verify(audit).log(isNull(), same(actor), eq("PLATFORM_ACCESS_GRANT"), eq("AppUser"), eq(12L), argThat(details ->
            details instanceof java.util.Map<?, ?> values && "PM".equals(values.get("toRole")) && "NONE".equals(values.get("fromRole")) &&
            !values.containsValue("Staff onboarding")
        ));
        verifyNoInteractions(supportTickets);
    }

    @Test
    void cannotRevokeTheOnlyActiveSystemAdministrator() {
        AppUser target = account(12L, "last-sa@example.test", "ACTIVE", 0L);
        PlatformStaffAccess existing = newAccess(target, "SA", "ACTIVE", 3L);
        when(accounts.findByIdForUpdate(12L)).thenReturn(Optional.of(target));
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(existing));
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(true);
        when(staffAccess.countOtherActiveAdministrators(12L)).thenReturn(0L);

        assertThatThrownBy(() -> service.changePlatformAccess(
            12L,
            new PlatformAccountAdministrationService.AccessChangeRequest("REVOKE", null, "No longer staff", 3L)
        )).isInstanceOf(DomainException.class).hasMessageContaining(MessageCodes.FE03_17);

        var order = inOrder(accounts, staffAccess);
        order.verify(accounts).findByIdForUpdate(12L);
        order.verify(accounts).lockRow(90L);
        order.verify(staffAccess).countOtherActiveAdministrators(12L);
        verify(staffAccess, never()).saveAndFlush(any());
        verify(accessChanges, never()).save(any());
        verifyNoInteractions(audit);
    }

    /** D32 (G9): a suspension locks both accounts in id order, so two SAs suspending each other cannot deadlock or both pass. */
    @Test
    void suspensionLocksBothAccountsInIdOrderBeforeCheckingTheLastAdministrator() {
        AppUser target = account(12L, "other-sa@example.test", "ACTIVE", 4L);
        when(accounts.findByIdForUpdate(12L)).thenReturn(Optional.of(target));
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(true);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(newAccess(target, "SA", "ACTIVE", 1L)));
        when(staffAccess.countOtherActiveAdministrators(12L)).thenReturn(0L);

        assertThatThrownBy(() -> service.suspend(12L, new PlatformAccountAdministrationService.ChangeRequest("Nghi ngờ lộ mật khẩu", 4L)))
            .isInstanceOf(DomainException.class).hasMessageContaining(MessageCodes.FE03_17);

        var order = inOrder(accounts, staffAccess);
        order.verify(accounts).findByIdForUpdate(12L);
        order.verify(accounts).lockRow(90L);
        order.verify(staffAccess).isActiveAdministrator(90L);
        order.verify(staffAccess).countOtherActiveAdministrators(12L);
        verify(accounts, never()).saveAndFlush(any());
        verify(statusChanges, never()).save(any());
        verifyNoInteractions(audit);
        verifyNoInteractions(supportTickets);
    }

    private static AppUser account(long id, String email, String status, long version) {
        AppUser account = new AppUser();
        account.setId(id);
        account.setEmail(email);
        account.setFullName("Test User");
        account.setAccountStatus(status);
        account.setVersion(version);
        return account;
    }

    private static PlatformStaffAccess newAccess(AppUser user, String role, String status, long version) {
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(user);
        access.setRole(role);
        access.setStatus(status);
        access.setVersion(version);
        return access;
    }
}
