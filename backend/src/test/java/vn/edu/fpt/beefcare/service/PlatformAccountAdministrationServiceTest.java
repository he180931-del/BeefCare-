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
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AppUserStatusChangeRepository;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class PlatformAccountAdministrationServiceTest {
    @Mock PlatformAccessService platformAccess;
    @Mock AppUserRepository accounts;
    @Mock UserRepository users;
    @Mock PlatformStaffAccessRepository staffAccess;
    @Mock FarmMembershipRepository farmMemberships;
    @Mock AuditLogRepository auditLogs;
    @Mock AppUserStatusChangeRepository statusChanges;
    @Mock SupportTicketCommandService supportTickets;
    @Mock FarmClock clock;
    @Mock SessionRegistry sessions;
    PlatformAccountAdministrationService service;
    AppUser actor;

    @BeforeEach
    void setUp() {
        service = new PlatformAccountAdministrationService(platformAccess, accounts, users, staffAccess, farmMemberships, auditLogs, statusChanges, supportTickets, clock, sessions);
        actor = account(90L, "sa@example.test", "ACTIVE", 2L);
        when(platformAccess.requireRole(PlatformRole.SA)).thenReturn(new PlatformContext(actor, null, PlatformRole.SA));
    }

    @Test
    void grantsVerifiedUserPlatformAccessAndAuditsAppUserTarget() {
        AppUser target = account(12L, "staff@example.test", "ACTIVE", 0L);
        User identity = new User();
        identity.setEmail(target.getEmail());
        identity.setActivated(true);
        when(accounts.findByIdForUpdate(12L)).thenReturn(Optional.of(target));
        when(users.findOneByEmailIgnoreCaseAndActivatedTrue(target.getEmail())).thenReturn(Optional.of(identity));
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.empty());
        when(staffAccess.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(staffAccess.findOneByUserId(12L)).thenAnswer(invocation -> Optional.of(newAccess(target, "PM", "ACTIVE", 1L)));

        var result = service.changePlatformAccess(
            12L,
            new PlatformAccountAdministrationService.PlatformAccessChange("GRANT", "PM", "Staff onboarding", null)
        );

        assertThat(result.platformRole()).isEqualTo("PM");
        assertThat(result.platformAccessStatus()).isEqualTo("ACTIVE");
        verify(auditLogs).save(argThat(event ->
            "AppUser".equals(event.getTargetType()) &&
            Long.valueOf(12L).equals(event.getTargetId()) &&
            "PLATFORM_ACCESS_GRANT".equals(event.getAction()) &&
            event.getDetails().contains("Staff onboarding")
        ));
    }

    @Test
    void cannotRevokeTheOnlyActiveSystemAdministrator() {
        AppUser target = account(12L, "last-sa@example.test", "ACTIVE", 0L);
        PlatformStaffAccess existing = newAccess(target, "SA", "ACTIVE", 3L);
        when(accounts.findByIdForUpdate(12L)).thenReturn(Optional.of(target));
        when(users.findOneByEmailIgnoreCaseAndActivatedTrue(target.getEmail())).thenReturn(Optional.of(new User()));
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(existing));
        when(staffAccess.countOtherActiveAdministrators(12L)).thenReturn(0L);

        assertThatThrownBy(() -> service.changePlatformAccess(
            12L,
            new PlatformAccountAdministrationService.PlatformAccessChange("REVOKE", null, "No longer staff", 3L)
        )).isInstanceOf(DomainException.class).hasMessageContaining(MessageCodes.FE03_17);

        verify(staffAccess, never()).saveAndFlush(any());
        verify(auditLogs, never()).save(any());
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
        verify(auditLogs, never()).save(any());
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
