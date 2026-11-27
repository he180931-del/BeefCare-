package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AppUserStatusChange;
import vn.edu.fpt.beefcare.domain.PlatformAccessChange;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AppUserStatusChangeRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.PlatformAccessChangeRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccessChangeRequest;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.AccountListItem;
import vn.edu.fpt.beefcare.service.PlatformAccountAdministrationService.ChangeRequest;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE03-07..09:
 * {@link PlatformAccountAdministrationService#search}, {@link PlatformAccountAdministrationService#suspend} and
 * {@link PlatformAccountAdministrationService#changePlatformAccess}. The acting System Administrator has id 90.
 */
@ExtendWith(MockitoExtension.class)
class PlatformAccountServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");

    @Mock PlatformAccessService platformAccess;
    @Mock AppUserRepository accounts;
    @Mock UserRepository users;
    @Mock PlatformStaffAccessRepository staffAccess;
    @Mock FarmMembershipRepository farmMemberships;
    @Mock AuditService audit;
    @Mock AppUserStatusChangeRepository statusChanges;
    @Mock PlatformAccessChangeRepository accessChanges;
    @Mock SupportTicketCommandService supportTickets;
    @Mock SessionRegistry sessions;

    private PlatformAccountAdministrationService service;
    private AppUser actor;

    @BeforeEach
    void setUp() {
        service = new PlatformAccountAdministrationService(platformAccess, accounts, users, staffAccess, farmMemberships, audit,
            statusChanges, accessChanges, supportTickets, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), sessions);
        actor = account(90L, "sa@beefcare.test", "ACTIVE", 2L);
    }

    private void signedInAsSa() {
        when(platformAccess.requireRole(PlatformRole.SA)).thenReturn(new PlatformContext(actor, null, PlatformRole.SA));
    }

    private static AppUser account(long id, String email, String status, long version) {
        AppUser account = new AppUser();
        account.setId(id);
        account.setEmail(email);
        account.setFullName("User " + id);
        account.setAccountStatus(status);
        account.setVersion(version);
        account.setPasswordLoginEnabled(true);
        return account;
    }

    private static PlatformStaffAccess access(AppUser user, String role, String status, long version) {
        PlatformStaffAccess access = new PlatformStaffAccess();
        access.setUser(user);
        access.setRole(role);
        access.setStatus(status);
        access.setVersion(version);
        return access;
    }

    private static User identity(String login, String email) {
        User identity = new User();
        identity.setLogin(login);
        identity.setEmail(email);
        identity.setActivated(true);
        return identity;
    }

    // ------------------------------------------------------------------ UC-FE03-07 search()

    @SuppressWarnings("unchecked")
    private void accountsFound(List<AppUser> rows, long total) {
        when(accounts.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(rows, PageRequest.of(0, 20), total));
    }

    @Test
    void tc0374RowsShowStoredAccessVerificationAndActiveFarmRolesInOwnerManagerTechnicianOrder() {
        signedInAsSa();
        AppUser google = account(1L, "Google@X.vn", "ACTIVE", 1L);
        google.setGoogleSubject("google-sub");
        google.setPlatformStaffAccess(access(google, "CS", "REVOKED", 3L));
        AppUser linked = account(2L, "linked@x.vn", "SUSPENDED", 1L);
        AppUser pending = account(3L, "pending@x.vn", "ACTIVE", 1L);
        accountsFound(List.of(google, linked, pending), 3);
        when(farmMemberships.countActiveByUserAndRole(List.of(1L, 2L, 3L))).thenReturn(List.of(
            new Object[] { 2L, "TECHNICIAN", 1L }, new Object[] { 2L, "OWNER", 2L }, new Object[] { 1L, "MANAGER", 1L }));
        when(users.findActivatedEmails(List.of("google@x.vn", "linked@x.vn", "pending@x.vn"))).thenReturn(Set.of("linked@x.vn"));

        List<AccountListItem> rows = service.search(null, null, null, 0, 20, "name", "asc").items();

        assertThat(rows.get(0).platformRole()).isEqualTo("CS");
        assertThat(rows.get(0).platformAccessStatus()).isEqualTo("REVOKED");
        assertThat(rows).extracting(AccountListItem::emailVerified).containsExactly(true, true, false);
        assertThat(rows.get(1).farmCount()).isEqualTo(3);
        assertThat(rows.get(1).farmRoles()).containsExactly("OWNER", "TECHNICIAN");
        assertThat(rows.get(2).farmCount()).isZero();
        assertThat(rows.get(2).platformRole()).isNull();
    }

    @Test
    void tc0377InvalidFiltersPagingSortOrA101CharacterSearchGetMsgCom10WithTheirField() {
        signedInAsSa();
        Map<String, Runnable> calls = new LinkedHashMap<>();
        calls.put("q", () -> service.search("q".repeat(101), null, null, 0, 20, "name", "asc"));
        calls.put("status", () -> service.search(null, "DELETED", null, 0, 20, "name", "asc"));
        calls.put("platformRole", () -> service.search(null, null, "OWNER", 0, 20, "name", "asc"));
        calls.put("page", () -> service.search(null, null, null, -1, 20, "name", "asc"));
        calls.put("size", () -> service.search(null, null, null, 0, 101, "name", "asc"));
        calls.put("sort", () -> service.search(null, null, null, 0, 20, "email", "asc"));
        calls.put("dir", () -> service.search(null, null, null, 0, 20, "name", "down"));
        calls.forEach((field, call) -> assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", field);
            }));
        verifyNoInteractions(accounts, users, farmMemberships);
    }

    @Test
    void tcDuc030701AOneHundredCharacterSearchAndPageSizesOneAndOneHundredAreAccepted() {
        signedInAsSa();
        accountsFound(List.of(), 0);

        assertThat(service.search("  " + "q".repeat(100) + "  ", "ACTIVE", "NONE", 0, 1, "name", "DESC").size()).isEqualTo(1);
        assertThat(service.search(null, "SUSPENDED", "SA", 3, 100, "name", "asc").page()).isEqualTo(3);
    }

    @Test
    void tc0376ThePageNumberAndSizeAreSentToTheRepositoryAndTheTotalComesFromItsPage() {
        signedInAsSa();
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        AppUser one = account(1L, "a@x.vn", "ACTIVE", 1L);
        when(accounts.findAll(any(Specification.class), pageable.capture())).thenReturn(new PageImpl<>(List.of(one), PageRequest.of(1, 2), 5));
        when(users.findActivatedEmails(List.of("a@x.vn"))).thenReturn(Set.of());

        var page = service.search(null, null, null, 1, 2, "name", "desc");

        assertThat(pageable.getValue()).isEqualTo(PageRequest.of(1, 2));
        assertThat(page.total()).isEqualTo(5);
        assertThat(page.items()).hasSize(1);
    }

    @Test
    void tcDuc030702AnEmptyPageQueriesNeitherMembershipsNorIdentities() {
        signedInAsSa();
        accountsFound(List.of(), 0);

        assertThat(service.search("khong-co", null, null, 0, 20, "name", "asc").items()).isEmpty();
        verifyNoInteractions(users, farmMemberships);
    }

    @Test
    void tc0378OnlyAnActiveSystemAdministratorCanSearchAccounts() {
        when(platformAccess.requireRole(PlatformRole.SA)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.search(null, null, null, 0, 20, "name", "asc"))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(accounts, users, farmMemberships);
    }

    // ------------------------------------------------------------------ UC-FE03-08 suspend()

    private AppUser target;

    private void suspendable(long id, String status, long version) {
        signedInAsSa();
        target = account(id, "manager@x.vn", status, version);
        when(accounts.findByIdForUpdate(id)).thenReturn(Optional.of(target));
    }

    private void detailReads() {
        lenient().when(staffAccess.findOneByUserId(anyLong())).thenReturn(Optional.empty());
        lenient().when(farmMemberships.findOwnedFarmNames(anyLong())).thenReturn(List.of());
    }

    @Test
    void tc0383SuspendingAnActiveAccountStoresHistoryAuditEndsSessionsAndRequeuesTickets() {
        suspendable(12L, "ACTIVE", 4L);
        detailReads();
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(true);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(access(target, "PM", "ACTIVE", 1L)));
        when(accounts.saveAndFlush(target)).thenReturn(target);
        when(users.findOneByEmailIgnoreCaseAndActivatedTrue("manager@x.vn")).thenReturn(Optional.of(identity("manager", "manager@x.vn")));
        SessionInformation byLogin = new SessionInformation("manager", "s-1", new Date());
        SessionInformation byEmail = new SessionInformation("manager@x.vn", "s-2", new Date());
        when(sessions.getAllSessions("manager", false)).thenReturn(List.of(byLogin));
        when(sessions.getAllSessions("manager@x.vn", false)).thenReturn(List.of(byEmail));
        ArgumentCaptor<AppUserStatusChange> history = ArgumentCaptor.forClass(AppUserStatusChange.class);

        var detail = service.suspend(12L, new ChangeRequest("  Nghi ngo lo mat khau  ", 4L));

        assertThat(target.getAccountStatus()).isEqualTo("SUSPENDED");
        verify(statusChanges).save(history.capture());
        assertThat(history.getValue().getAction()).isEqualTo("SUSPEND");
        assertThat(history.getValue().getStatusBefore()).isEqualTo("ACTIVE");
        assertThat(history.getValue().getReason()).isEqualTo("Nghi ngo lo mat khau");
        assertThat(history.getValue().getChangedBy()).isSameAs(actor);
        verify(audit).log(isNull(), eq(actor), eq("ACCOUNT_SUSPEND"), eq("AppUser"), eq(12L), eq(Map.of("statusBefore", "ACTIVE", "statusAfter", "SUSPENDED")));
        assertThat(byLogin.isExpired()).isTrue();
        assertThat(byEmail.isExpired()).isTrue();
        verify(supportTickets).requeueTicketsOf(target, "ACCOUNT_SUSPENDED");
        verify(staffAccess, never()).saveAndFlush(any());
        assertThat(detail.actions()).containsExactly("RESTORE");
    }

    @Test
    void tc0328ASystemAdministratorCannotSuspendTheirOwnAccount() {
        signedInAsSa();
        when(accounts.findByIdForUpdate(90L)).thenReturn(Optional.of(actor));

        assertThatThrownBy(() -> service.suspend(90L, new ChangeRequest("Tu tam ngung", 2L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_17));
        verify(accounts, never()).saveAndFlush(any());
        verifyNoInteractions(statusChanges, audit, supportTickets);
    }

    @Test
    void tc0385ReasonVersionAndExistenceRulesRejectTheSuspensionBeforeAnyWrite() {
        suspendable(12L, "ACTIVE", 4L);
        Map<String, ChangeRequest> refused = new LinkedHashMap<>();
        refused.put(MessageCodes.COM_06, new ChangeRequest("   ", 4L));
        refused.put(MessageCodes.COM_10 + " short", new ChangeRequest("a b c d", 4L));
        refused.put(MessageCodes.COM_10 + " long", new ChangeRequest("R".repeat(501), 4L));
        refused.put(MessageCodes.COM_05 + " missing", new ChangeRequest("Nghi ngo lo mat khau", null));
        refused.put(MessageCodes.COM_05 + " old", new ChangeRequest("Nghi ngo lo mat khau", 3L));
        refused.forEach((code, request) -> assertThatThrownBy(() -> service.suspend(12L, request))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(code.split(" ")[0])));

        when(accounts.findByIdForUpdate(77L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.suspend(77L, new ChangeRequest(" ", 4L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08));
        verify(accounts, never()).saveAndFlush(any());
        verifyNoInteractions(statusChanges, audit, supportTickets);
    }

    @Test
    void tcDuc030801AnAccountThatIsAlreadySuspendedGetsMsgFe0320EvenWithAnOutdatedVersion() {
        suspendable(12L, "SUSPENDED", 4L);

        assertThatThrownBy(() -> service.suspend(12L, new ChangeRequest("Tam ngung lai", 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_20);
                assertThat(error.getParams()).containsEntry("value", "status");
            });
        verifyNoInteractions(statusChanges, audit, supportTickets);
    }

    @Test
    void tcDuc030802AFiveCharacterReasonIsAcceptedForAnAccountWithoutPlatformAccess() {
        suspendable(12L, "ACTIVE", 4L);
        detailReads();
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(true);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.empty());
        when(accounts.saveAndFlush(target)).thenReturn(target);

        assertThat(service.suspend(12L, new ChangeRequest("a b c d e", 4L)).accountStatus()).isEqualTo("SUSPENDED");
        verify(staffAccess, never()).countOtherActiveAdministrators(anyLong());
    }

    @Test
    void tcDuc030803AnActingAdministratorWhoLostAccessMeanwhileGetsMsgCom01() {
        suspendable(12L, "ACTIVE", 4L);
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(false);

        assertThatThrownBy(() -> service.suspend(12L, new ChangeRequest("Nghi ngo lo mat khau", 4L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verify(accounts, never()).saveAndFlush(any());
    }

    @Test
    void tcDuc030804ATargetWithAHigherIdIsLockedAfterTheActingAdministrator() {
        suspendable(120L, "ACTIVE", 4L);
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(false);

        assertThatThrownBy(() -> service.suspend(120L, new ChangeRequest("Nghi ngo lo mat khau", 4L))).isInstanceOf(DomainException.class);

        InOrder order = inOrder(accounts);
        order.verify(accounts).lockRow(90L);
        order.verify(accounts).findByIdForUpdate(120L);
    }

    // ------------------------------------------------------------------ UC-FE03-09 changePlatformAccess()

    private void accessTarget(String accountStatus, boolean verified, PlatformStaffAccess current) {
        signedInAsSa();
        target = account(12L, "staff@x.vn", accountStatus, 1L);
        when(accounts.findByIdForUpdate(12L)).thenReturn(Optional.of(target));
        lenient().when(users.findOneByEmailIgnoreCaseAndActivatedTrue("staff@x.vn")).thenReturn(verified ? Optional.of(identity("staff", "staff@x.vn")) : Optional.empty());
        lenient().when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.ofNullable(current));
        lenient().when(staffAccess.isActiveAdministrator(90L)).thenReturn(true);
        lenient().when(staffAccess.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        detailReads();
    }

    private void nothingSaved() {
        verify(staffAccess, never()).saveAndFlush(any());
        verify(accessChanges, never()).save(any());
        verifyNoInteractions(audit, supportTickets);
    }

    @Test
    void tc0329AnAccountWithAnActiveCsRoleCannotBeGrantedASecondRoleAndGetsMsgCom05() {
        accessTarget("ACTIVE", true, null);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(access(target, "CS", "ACTIVE", 3L)));

        assertThatThrownBy(() -> service.changePlatformAccess(12L, new AccessChangeRequest("GRANT", "PM", "Them quyen PM", 3L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05));
        nothingSaved();
    }

    @Test
    void tc0330AnUnverifiedEmailCannotBeGrantedAccessAndGetsMsgFe0318() {
        accessTarget("ACTIVE", false, null);

        assertThatThrownBy(() -> service.changePlatformAccess(12L, new AccessChangeRequest("GRANT", "CS", "Nhan vien moi", null)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_18);
                assertThat(error.getParams()).containsEntry("email", "staff@x.vn");
            });
        nothingSaved();
    }

    @Test
    void tc0393ASuspendedAccountCanOnlyLoseAccessAndOtherOperationsGetMsgFe0322() {
        accessTarget("SUSPENDED", true, null);
        PlatformStaffAccess pm = access(target, "PM", "ACTIVE", 3L);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(pm));

        assertThatThrownBy(() -> service.changePlatformAccess(12L, new AccessChangeRequest("CHANGE", "CS", "Doi vai tro", 3L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_22));
        var detail = service.changePlatformAccess(12L, new AccessChangeRequest("REVOKE", null, "Ngung cong tac", 3L));

        assertThat(pm.getStatus()).isEqualTo("REVOKED");
        assertThat(detail.id()).isEqualTo(12L);
        verify(audit).log(isNull(), eq(actor), eq("PLATFORM_ACCESS_REVOKE"), eq("AppUser"), eq(12L), any());
    }

    @Test
    void tc0392InputOwnAccountAndCurrentStateRulesRefuseTheChangeBeforeAnyWrite() {
        accessTarget("ACTIVE", true, null);
        PlatformStaffAccess pm = access(target, "PM", "ACTIVE", 3L);
        PlatformStaffAccess revoked = access(target, "CS", "REVOKED", 5L);
        record Refusal(String code, String detail, AccessChangeRequest request, PlatformStaffAccess current) {}
        List<Refusal> refusals = List.of(
            new Refusal(MessageCodes.COM_06, "field=operation", new AccessChangeRequest(" ", "PM", "Ly do hop le", 3L), pm),
            new Refusal(MessageCodes.COM_10, "field=operation", new AccessChangeRequest("PROMOTE", "PM", "Ly do hop le", 3L), pm),
            new Refusal(MessageCodes.COM_06, "field=role", new AccessChangeRequest("GRANT", "", "Ly do hop le", null), null),
            new Refusal(MessageCodes.COM_10, "field=role", new AccessChangeRequest("GRANT", "OWNER", "Ly do hop le", null), null),
            new Refusal(MessageCodes.COM_10, "field=reason", new AccessChangeRequest("REVOKE", null, "a b c d", 3L), pm),
            new Refusal(MessageCodes.FE03_20, "value=role", new AccessChangeRequest("CHANGE", "PM", "Ly do hop le", 3L), pm),
            new Refusal(MessageCodes.FE03_20, "value=status", new AccessChangeRequest("RESTORE", null, "Ly do hop le", 3L), pm),
            new Refusal(MessageCodes.FE03_20, "value=status", new AccessChangeRequest("REVOKE", null, "Ly do hop le", 5L), revoked),
            new Refusal(MessageCodes.COM_05, "", new AccessChangeRequest("CHANGE", "CS", "Ly do hop le", null), null),
            new Refusal(MessageCodes.COM_05, "", new AccessChangeRequest("CHANGE", "CS", "Ly do hop le", 2L), pm),
            new Refusal(MessageCodes.COM_05, "", new AccessChangeRequest("GRANT", "CS", "Ly do hop le", 3L), null));
        for (Refusal refusal : refusals) {
            when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.ofNullable(refusal.current()));
            assertThatThrownBy(() -> service.changePlatformAccess(12L, refusal.request()))
                .as(refusal.request().toString())
                .isInstanceOfSatisfying(DomainException.class, error -> {
                    assertThat(error.getCode()).isEqualTo(refusal.code());
                    if (!refusal.detail().isEmpty()) {
                        String[] pair = refusal.detail().split("=");
                        assertThat(error.getParams()).containsEntry(pair[0], pair[1]);
                    }
                });
        }

        when(accounts.findByIdForUpdate(90L)).thenReturn(Optional.of(actor));
        assertThatThrownBy(() -> service.changePlatformAccess(90L, new AccessChangeRequest("REVOKE", null, "Tu thu hoi", 2L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        nothingSaved();
    }

    @Test
    void tc0394RemovingCustomerSupportAccessReturnsTheOpenTicketsToTheQueue() {
        accessTarget("ACTIVE", true, null);
        PlatformStaffAccess cs = access(target, "CS", "ACTIVE", 3L);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(cs));

        service.changePlatformAccess(12L, new AccessChangeRequest("CHANGE", "PM", "Chuyen sang PM", 3L));

        assertThat(cs.getRole()).isEqualTo("PM");
        assertThat(cs.getStatus()).isEqualTo("ACTIVE");
        verify(supportTickets).requeueTicketsOf(target, "CS_ACCESS_REMOVED");
        ArgumentCaptor<PlatformAccessChange> history = ArgumentCaptor.forClass(PlatformAccessChange.class);
        verify(accessChanges).save(history.capture());
        assertThat(history.getValue().getRoleBefore()).isEqualTo("CS");
        assertThat(history.getValue().getRoleAfter()).isEqualTo("PM");
        assertThat(history.getValue().getReason()).isEqualTo("Chuyen sang PM");
    }

    @Test
    void tcDuc030901RestoringRevokedAccessMakesItActiveAgainWithoutRequeueingTickets() {
        accessTarget("ACTIVE", true, null);
        PlatformStaffAccess revoked = access(target, "PM", "REVOKED", 5L);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(revoked));

        service.changePlatformAccess(12L, new AccessChangeRequest("restore", null, " Quay lai lam viec ", 5L));

        assertThat(revoked.getStatus()).isEqualTo("ACTIVE");
        assertThat(revoked.getRole()).isEqualTo("PM");
        verify(audit).log(isNull(), eq(actor), eq("PLATFORM_ACCESS_RESTORE"), eq("AppUser"), eq(12L), eq(Map.of(
            "fromRole", "PM", "fromStatus", "REVOKED", "toRole", "PM", "toStatus", "ACTIVE")));
        verifyNoInteractions(supportTickets);
    }

    @Test
    void tc0396ChangingTheLastActiveSystemAdministratorToAnotherRoleGetsMsgFe0317() {
        accessTarget("ACTIVE", true, null);
        when(staffAccess.findOneByUserIdForUpdate(12L)).thenReturn(Optional.of(access(target, "SA", "ACTIVE", 3L)));
        when(staffAccess.countOtherActiveAdministrators(12L)).thenReturn(0L);

        assertThatThrownBy(() -> service.changePlatformAccess(12L, new AccessChangeRequest("CHANGE", "PM", "Doi sang PM", 3L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_17));
        nothingSaved();
    }

    @Test
    void tcDuc030902AnActingAdministratorWhoLostAccessMeanwhileGetsMsgCom01() {
        accessTarget("ACTIVE", true, null);
        when(staffAccess.isActiveAdministrator(90L)).thenReturn(false);

        assertThatThrownBy(() -> service.changePlatformAccess(12L, new AccessChangeRequest("GRANT", "CS", "Nhan vien moi", null)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        nothingSaved();
    }
}
