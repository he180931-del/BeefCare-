package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.FarmMembershipChange;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipChangeRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.MemberChange;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.MemberList;
import vn.edu.fpt.beefcare.service.dto.MembershipDtos.MemberView;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE03-05 and UC-FE03-06:
 * {@link FarmMembershipService#listMembers} and {@link FarmMembershipService#changeMember}. The farm clock is fixed at
 * 17:00 UTC, which is already the next day in UTC+7.
 */
@ExtendWith(MockitoExtension.class)
class FarmMemberServiceUnitTest {

    /** 2026-11-26T17:00Z = 2026-11-27 00:00 in UTC+7, the farm's "today". */
    private static final Instant NOW = Instant.parse("2026-11-26T17:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 27);
    private static final long FARM_ID = 401L;

    @Mock FarmAccessService access;
    @Mock FarmRepository farms;
    @Mock FarmInvitationRepository invitations;
    @Mock FarmMembershipRepository memberships;
    @Mock AppUserRepository users;
    @Mock AuditService audit;
    @Mock MailService mail;
    @Mock FarmMembershipChangeRepository changes;

    private FarmMembershipService service;
    private Farm farm;
    private AppUser owner;

    @BeforeEach
    void setUp() {
        service = new FarmMembershipService(access, farms, invitations, memberships, users, audit, mail,
            new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), new ActionLinkSigner("unit-test-signing-key-with-32-characters!"), changes);
        farm = new Farm();
        farm.setId(FARM_ID);
        farm.setName("Trai Ba Vi");
        farm.setServiceStatus("ACTIVE");
        farm.setTimeZone("Asia/Ho_Chi_Minh");
        owner = user(11L, "Nguyen Van Duc", "owner@beefcare.test");
    }

    private static AppUser user(long id, String name, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setFullName(name);
        user.setEmail(email);
        return user;
    }

    private FarmMembership membership(long id, AppUser user, String role, String status) {
        FarmMembership membership = new FarmMembership();
        membership.setId(id);
        membership.setFarm(farm);
        membership.setUser(user);
        membership.setRole(role);
        membership.setStatus(status);
        membership.setVersion(2);
        membership.setJoinedAt(Instant.parse("2026-10-01T02:00:00Z").plusSeconds(id));
        membership.setEffectiveDate(LocalDate.of(2026, 11, 1));
        return membership;
    }

    // ------------------------------------------------------------------ UC-FE03-05 listMembers()

    private List<FarmMembership> mixedFarm() {
        List<FarmMembership> rows = new ArrayList<>();
        rows.add(membership(1L, owner, "OWNER", "ACTIVE"));
        rows.add(membership(2L, user(21L, "Tran Thi Binh", "binh@x.vn"), "MANAGER", "ACTIVE"));
        rows.add(membership(3L, user(22L, "Đặng Văn An", "an@x.vn"), "TECHNICIAN", "ACTIVE"));
        rows.add(membership(4L, user(23L, "Le Van Cuong", "cuong@x.vn"), "TECHNICIAN", "INACTIVE"));
        return rows;
    }

    private void caller(FarmRole role) {
        when(access.require(FARM_ID, FarmAction.VIEW_MEMBERS)).thenReturn(new FarmContext(farm, owner, role));
    }

    @Test
    void tc0359TheOwnerSeesEveryMemberByVietnameseNameWithD29CountsAndRowActions() {
        caller(FarmRole.OWNER);
        when(memberships.findWithUserByFarmId(FARM_ID)).thenReturn(mixedFarm());

        MemberList list = service.listMembers(FARM_ID);

        assertThat(list.farmName()).isEqualTo("Trai Ba Vi");
        assertThat(list.items()).extracting(MemberView::fullName)
            .containsExactly("Đặng Văn An", "Le Van Cuong", "Nguyen Van Duc", "Tran Thi Binh");
        assertThat(list.counts().all()).isEqualTo(4);
        assertThat(list.counts().managers()).isEqualTo(1);
        assertThat(list.counts().technicians()).isEqualTo(1);
        assertThat(list.counts().inactive()).isEqualTo(1);
        Map<String, List<String>> actions = new java.util.HashMap<>();
        list.items().forEach(row -> actions.put(row.fullName(), row.actions()));
        assertThat(actions.get("Nguyen Van Duc")).isEmpty();
        assertThat(actions.get("Tran Thi Binh")).containsExactly("CHANGE_ROLE", "DEACTIVATE");
        assertThat(actions.get("Le Van Cuong")).containsExactly("REACTIVATE");
    }

    @Test
    void tc0325AManagerSeesOnlyActiveMembersWithoutActionsOrAnInactiveCount() {
        caller(FarmRole.MANAGER);
        when(memberships.findWithUserByFarmId(FARM_ID)).thenReturn(mixedFarm());

        MemberList list = service.listMembers(FARM_ID);

        assertThat(list.items()).extracting(MemberView::status).containsOnly("ACTIVE");
        assertThat(list.items()).hasSize(3);
        assertThat(list.items()).allSatisfy(row -> assertThat(row.actions()).isEmpty());
        assertThat(list.counts().all()).isEqualTo(3);
        assertThat(list.counts().inactive()).isNull();
    }

    @Test
    void tc0360OnAFarmThatIsNotActiveTheOwnerCanOnlyDeactivate() {
        farm.setServiceStatus("EXPIRED");
        caller(FarmRole.OWNER);
        when(memberships.findWithUserByFarmId(FARM_ID)).thenReturn(mixedFarm());

        MemberList list = service.listMembers(FARM_ID);

        assertThat(list.serviceStatus()).isEqualTo("EXPIRED");
        Map<String, List<String>> actions = new java.util.HashMap<>();
        list.items().forEach(row -> actions.put(row.fullName(), row.actions()));
        assertThat(actions.get("Tran Thi Binh")).containsExactly("DEACTIVATE");
        assertThat(actions.get("Le Van Cuong")).isEmpty();
    }

    @Test
    void tc0326ATechnicianIsRefusedBeforeTheMembersAreRead() {
        when(access.require(FARM_ID, FarmAction.VIEW_MEMBERS)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.listMembers(FARM_ID))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(memberships);
    }

    @Test
    void tcDuc030501AMemberWithoutANameSortsByEmailAndEqualNamesFallBackToEmailThenId() {
        caller(FarmRole.OWNER);
        List<FarmMembership> rows = new ArrayList<>();
        rows.add(membership(7L, user(31L, "Hoa", "z@x.vn"), "MANAGER", "ACTIVE"));
        rows.add(membership(6L, user(32L, "hoa", "b@x.vn"), "MANAGER", "ACTIVE"));
        rows.add(membership(5L, user(33L, " ", "c@x.vn"), "TECHNICIAN", "ACTIVE"));
        when(memberships.findWithUserByFarmId(FARM_ID)).thenReturn(rows);

        assertThat(service.listMembers(FARM_ID).items()).extracting(MemberView::email).containsExactly("c@x.vn", "b@x.vn", "z@x.vn");
    }

    @Test
    void tc0362JoinedAtIsTheMembershipCreationInstantNotTheLastEffectiveDate() {
        caller(FarmRole.OWNER);
        FarmMembership manager = membership(2L, user(21L, "Tran Thi Binh", "binh@x.vn"), "MANAGER", "ACTIVE");
        manager.setEffectiveDate(LocalDate.of(2026, 11, 20));
        when(memberships.findWithUserByFarmId(FARM_ID)).thenReturn(List.of(manager));

        assertThat(service.listMembers(FARM_ID).items().get(0).joinedAt()).isEqualTo(Instant.parse("2026-10-01T02:00:02Z"));
    }

    // ------------------------------------------------------------------ UC-FE03-06 changeMember()

    private FarmMembership target;

    private void ownerChanges(String role, String status) {
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
        target = membership(53L, user(21L, "Tran Thi Binh", "binh@x.vn"), role, status);
        when(memberships.lockByIdAndFarmId(53L, FARM_ID)).thenReturn(Optional.of(target));
    }

    private static MemberChange change(String action, String role, LocalDate date, String reason, Integer version) {
        return new MemberChange(action, role, date, reason, version);
    }

    private void nothingWritten() {
        verify(changes, never()).save(any());
        verify(memberships, never()).flush();
        verifyNoInteractions(audit);
    }

    @Test
    void tc0320ChangingAManagerToTechnicianStoresTheRoleHistoryWithDateReasonAndAudit() {
        ownerChanges("MANAGER", "ACTIVE");
        ArgumentCaptor<FarmMembershipChange> history = ArgumentCaptor.forClass(FarmMembershipChange.class);

        MemberView view = service.changeMember(FARM_ID, 53L, change(" change_role ", "TECHNICIAN", TODAY, "  Doi ca lam viec  ", 2));

        assertThat(target.getRole()).isEqualTo("TECHNICIAN");
        assertThat(target.getEffectiveDate()).isEqualTo(TODAY);
        assertThat(target.getChangeReason()).isEqualTo("Doi ca lam viec");
        verify(changes).save(history.capture());
        assertThat(history.getValue().getAction()).isEqualTo("CHANGE_ROLE");
        assertThat(history.getValue().getRoleBefore()).isEqualTo("MANAGER");
        assertThat(history.getValue().getRoleAfter()).isEqualTo("TECHNICIAN");
        assertThat(history.getValue().getReason()).isEqualTo("Doi ca lam viec");
        assertThat(history.getValue().getChangedBy()).isSameAs(owner);
        assertThat(history.getValue().getChangedAt()).isEqualTo(NOW);
        verify(audit).log(any(FarmContext.class), eq("MEMBER_CHANGE_ROLE"), eq("FarmMembership"), eq(53L), eq(Map.of(
            "roleBefore", "MANAGER", "roleAfter", "TECHNICIAN", "statusBefore", "ACTIVE", "statusAfter", "ACTIVE", "effectiveDate", "2026-11-27")));
        assertThat(view.actions()).containsExactly("CHANGE_ROLE", "DEACTIVATE");
    }

    @Test
    void tcDuc030601DeactivateAndReactivateSwitchTheStatusAndKeepTheRole() {
        ownerChanges("TECHNICIAN", "ACTIVE");

        assertThat(service.changeMember(FARM_ID, 53L, change("DEACTIVATE", null, TODAY, "Nghi viec", 2)).status()).isEqualTo("INACTIVE");
        target.setVersion(2);
        MemberView back = service.changeMember(FARM_ID, 53L, change("REACTIVATE", null, TODAY, "Quay lai lam", 2));

        assertThat(back.status()).isEqualTo("ACTIVE");
        assertThat(back.role()).isEqualTo("TECHNICIAN");
        verify(audit).log(any(FarmContext.class), eq("MEMBER_DEACTIVATE"), any(), eq(53L), any());
        verify(audit).log(any(FarmContext.class), eq("MEMBER_REACTIVATE"), any(), eq(53L), any());
    }

    @Test
    void tc0319TheOwnerMembershipCannotBeChangedAndGetsMsgCom01() {
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
        when(memberships.lockByIdAndFarmId(1L, FARM_ID)).thenReturn(Optional.of(membership(1L, owner, "OWNER", "ACTIVE")));

        assertThatThrownBy(() -> service.changeMember(FARM_ID, 1L, change("DEACTIVATE", null, TODAY, "x", 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        nothingWritten();
    }

    @Test
    void tc0371AnUnchangedRoleOrStatusGetsMsgFe0320EvenWithAnOutdatedVersion() {
        ownerChanges("MANAGER", "ACTIVE");
        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, change("CHANGE_ROLE", "MANAGER", TODAY, "Giu nguyen", 1)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_20);
                assertThat(error.getParams()).containsEntry("value", "role").containsEntry("target", "binh@x.vn");
            });
        target.setStatus("INACTIVE");
        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, change("DEACTIVATE", null, TODAY, "Ngung lan hai", 1)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("value", "status"));
        nothingWritten();
    }

    @Test
    void tc0370ReasonAndDateRulesUseTheFarmTodayInUtcPlus7() {
        ownerChanges("MANAGER", "ACTIVE");
        Map<String, MemberChange> invalid = new java.util.LinkedHashMap<>();
        invalid.put(MessageCodes.COM_07, change("DEACTIVATE", null, TODAY.plusDays(1), "Ngung viec", 2));
        invalid.put(MessageCodes.COM_06, change("DEACTIVATE", null, TODAY, "   ", 2));
        invalid.put(MessageCodes.COM_10 + " long", change("DEACTIVATE", null, TODAY, "R".repeat(501), 2));
        invalid.put(MessageCodes.COM_10 + " short", change("DEACTIVATE", null, TODAY, "a b c d", 2));
        invalid.put(MessageCodes.COM_06 + " role", change("CHANGE_ROLE", " ", TODAY, "Doi vai tro", 2));
        invalid.forEach((code, request) -> assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, request))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(code.split(" ")[0])));
        nothingWritten();
    }

    @Test
    void tcDuc030602TodayInUtcPlus7AndAFiveCharacterReasonAreAccepted() {
        ownerChanges("MANAGER", "ACTIVE");

        MemberView view = service.changeMember(FARM_ID, 53L, change("DEACTIVATE", null, TODAY, " a b c d e ", 2));

        assertThat(view.status()).isEqualTo("INACTIVE");
        assertThat(target.getChangeReason()).isEqualTo("a b c d e");
    }

    @Test
    void tc0323OnAnExpiredFarmDeactivateIsAllowedButChangeRoleAndReactivateGetMsgFe0304() {
        farm.setServiceStatus("EXPIRED");
        ownerChanges("MANAGER", "ACTIVE");

        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, change("CHANGE_ROLE", "TECHNICIAN", TODAY, "Doi vai tro", 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_04));
        assertThat(service.changeMember(FARM_ID, 53L, change("DEACTIVATE", null, TODAY, "Ngung viec", 2)).actions()).isEmpty();
        target.setVersion(2);
        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, change("REACTIVATE", null, TODAY, "Quay lai", 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.FE03_04));
        assertThat(target.getStatus()).isEqualTo("INACTIVE");
    }

    @Test
    void tc0369AMembershipOfAnotherFarmGetsMsgCom08AndANonOwnerGetsMsgCom01() {
        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
        when(memberships.lockByIdAndFarmId(anyLong(), eq(FARM_ID))).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.changeMember(FARM_ID, 999L, change("DEACTIVATE", null, TODAY, "Ngung viec", 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08);
                assertThat(error.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
            });

        when(access.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));
        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, change("DEACTIVATE", null, TODAY, "x", 2)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        nothingWritten();
    }

    @Test
    void tcDuc030603AnOutdatedVersionGetsMsgCom05AndNothingIsWritten() {
        ownerChanges("MANAGER", "ACTIVE");

        assertThatThrownBy(() -> service.changeMember(FARM_ID, 53L, change("CHANGE_ROLE", "TECHNICIAN", TODAY, "Doi vai tro", 1)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_05));
        assertThat(target.getRole()).isEqualTo("MANAGER");
        nothingWritten();
    }
}
