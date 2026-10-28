package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class SupportTicketWorkflowTest extends DomainTestSupport {
    @Autowired SupportTicketCommandService tickets;
    @Autowired InternalSupportRequestService requests;
    @Autowired IdempotencyCommandService commands;
    @Autowired AuditService audit;

    private AppUser owner(Farm farm) {
        AppUser u = user(); u.setOwnerRegistrationCompleted(true); u.setOwnerRegistrationCompletedAt(clock.instant());
        if (farm != null) member(farm, u, "OWNER", "ACTIVE"); em.flush(); return u;
    }
    private AppUser staff(PlatformRole role) {
        AppUser u = user(); PlatformStaffAccess p = new PlatformStaffAccess(); p.setUser(u); p.setRole(role.name()); p.setStatus("ACTIVE"); save(p); return u;
    }
    private SupportDtos.Ticket create(AppUser owner, Farm farm) {
        actAs(owner);
        return tickets.create(new SupportDtos.Create("SYSTEM_USAGE", farm == null ? "ACCOUNT" : "FARM", farm == null ? null : farm.getId(), "Cần hỗ trợ", "Mô tả riêng của chủ trại"));
    }
    private SupportDtos.Ticket claim(SupportDtos.Ticket t, AppUser cs) {
        actAs(cs); return tickets.process(t.id(), new SupportDtos.Processing("CLAIM", null, null, null, null, null, t.version()));
    }
    private SupportDtos.Ticket current(Long id) { return tickets.get(id, true); }

    @Test void ownerCanAskForHelpWhileFarmSuspendedButCannotSelectOtherOwnersFarm() {
        Farm farm = farm("SUSPENDED"); AppUser owner = owner(farm); SupportDtos.Ticket t = create(owner, farm);
        assertThat(t.status()).isEqualTo("OPEN"); assertThat(t.priority()).isEqualTo("NORMAL");
        assertThat(t.messages()).hasSize(1); assertThat(t.code()).startsWith("TK-");
        Farm foreign = farm();
        assertThatThrownBy(() -> create(owner, foreign)).isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getStatus().value()).isEqualTo(403));
        actAs(memberWithRole(farm, FarmRole.MANAGER));
        assertThatThrownBy(() -> tickets.get(t.id(), false)).isInstanceOf(DomainException.class);
        actAs(owner(null)); assertThatThrownBy(() -> tickets.get(t.id(), false)).isInstanceOf(DomainException.class);
    }

    @Test void closureRequiresLatestAcknowledgmentAndExplicitCsReview() {
        AppUser owner = owner(null), cs = staff(PlatformRole.CS); SupportDtos.Ticket t = claim(create(owner, null), cs);
        t = tickets.resolve(t.id(), new SupportDtos.Resolution("Đã hướng dẫn xử lý.", t.version())); Long id = t.id();
        Integer resolvedVersion = t.version();
        assertThatThrownBy(() -> tickets.close(id, new SupportDtos.Close(true, null, resolvedVersion)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo("MSG-FE20-13"));
        actAs(owner); t = tickets.acknowledge(id, new SupportDtos.Acknowledge(1, "Đã dùng được", resolvedVersion));
        assertThat(t.status()).isEqualTo("RESOLVED");
        assertThat(tickets.acknowledge(id, new SupportDtos.Acknowledge(1, "Đã dùng được", resolvedVersion)).version()).isEqualTo(t.version());
        actAs(cs); Integer acknowledgedVersion = t.version();
        assertThatThrownBy(() -> tickets.close(id, new SupportDtos.Close(false, null, acknowledgedVersion))).isInstanceOf(DomainException.class);
        t = tickets.close(id, new SupportDtos.Close(true, "Đã kiểm tra xác nhận", acknowledgedVersion));
        assertThat(t.status()).isEqualTo("CLOSED"); assertThat(t.resolutions().get(0).reviewed()).isTrue();
        actAs(owner); Integer closedVersion = t.version();
        assertThatThrownBy(() -> tickets.reply(id, new SupportDtos.Reply("Một ý khác", closedVersion), false, false))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo("MSG-FE20-06"));
    }

    @Test void reopeningSupersedesOldAcknowledgmentAndNewResolutionNeedsNewConfirmation() {
        AppUser owner = owner(null), cs = staff(PlatformRole.CS); SupportDtos.Ticket t = claim(create(owner, null), cs);
        t = tickets.resolve(t.id(), new SupportDtos.Resolution("Giải pháp lần 1", t.version()));
        actAs(owner); t = tickets.acknowledge(t.id(), new SupportDtos.Acknowledge(1, null, t.version()));
        t = tickets.reopen(t.id(), new SupportDtos.Reopen("Vẫn gặp lỗi", t.version()));
        assertThat(t.status()).isEqualTo("OPEN"); assertThat(t.assignedCsId()).isEqualTo(cs.getId()); assertThat(t.resolutions().get(0).acknowledged()).isFalse();
        actAs(cs); t = tickets.resolve(t.id(), new SupportDtos.Resolution("Giải pháp lần 2", t.version()));
        actAs(owner); Long id = t.id(); Integer latest = t.version();
        assertThatThrownBy(() -> tickets.acknowledge(id, new SupportDtos.Acknowledge(1, null, latest)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo("MSG-FE20-05"));
        assertThat(t.resolutions()).extracting(SupportDtos.ResolutionView::version).containsExactly(2, 1);
    }

    @Test void publicReplyAdvancesWaitingButDoesNotReopenResolvedTicketAndPrivateNotesStayPrivate() {
        AppUser owner = owner(null), cs = staff(PlatformRole.CS); SupportDtos.Ticket t = claim(create(owner, null), cs);
        t = tickets.reply(t.id(), new SupportDtos.Reply("CS_ONLY secret", t.version()), true, true);
        t = tickets.process(t.id(), new SupportDtos.Processing("ASK_CUSTOMER", null, null, null, null, "Bạn gặp lỗi ở bước nào?", t.version()));
        actAs(owner); t = tickets.get(t.id(), false);
        assertThat(t.messages()).noneMatch(m -> "CS_ONLY secret".equals(m.content()));
        t = tickets.reply(t.id(), new SupportDtos.Reply("Ở bước đăng nhập", t.version()), false, false); assertThat(t.status()).isEqualTo("IN_PROGRESS");
        actAs(cs); t = tickets.resolve(t.id(), new SupportDtos.Resolution("Đã xử lý", t.version()));
        actAs(owner); t = tickets.reply(t.id(), new SupportDtos.Reply("Cảm ơn", t.version()), false, false); assertThat(t.status()).isEqualTo("RESOLVED");
    }

    @Test void openInternalRequestBlocksResolutionAndNamedSpecialistCannotReadConversation() {
        Farm farm = farm(); AppUser owner = owner(farm), cs = staff(PlatformRole.CS), pm = staff(PlatformRole.PM), otherPm = staff(PlatformRole.PM);
        SupportDtos.Ticket t = claim(create(owner, farm), cs); Long id = t.id();
        SupportDtos.InternalView ir = requests.create(id, new SupportDtos.InternalCreate(PlatformRole.PM, pm.getId(), "Kiểm tra dịch vụ trại",
            List.of(new SupportDtos.ContextReference("FARM", farm.getId())), t.version()));
        Integer currentVersion = current(id).version();
        assertThatThrownBy(() -> tickets.resolve(id, new SupportDtos.Resolution("Đã xử lý", currentVersion)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo("MSG-FE20-12"));
        actAs(pm); assertThat(requests.get(ir.id()).question()).isEqualTo("Kiểm tra dịch vụ trại");
        assertThatThrownBy(() -> tickets.get(id, true)).isInstanceOf(DomainException.class);
        actAs(otherPm); assertThatThrownBy(() -> requests.get(ir.id())).isInstanceOf(DomainException.class);
        actAs(pm); requests.complete(ir.id(), new SupportDtos.Complete("UNABLE", "Chưa đủ thông tin", null, ir.version()));
        actAs(cs); assertThat(current(id).status()).isEqualTo("IN_PROGRESS");
        assertThat(tickets.resolve(id, new SupportDtos.Resolution("Đã hướng dẫn chủ trại", current(id).version())).status()).isEqualTo("RESOLVED");
    }

    @Test void performedResultMustReferenceRelatedCommittedDomainWorkAndReassignmentRevokesCachedReplay() {
        Farm farm = farm(); AppUser owner = owner(farm), cs = staff(PlatformRole.CS), pm = staff(PlatformRole.PM), nextPm = staff(PlatformRole.PM);
        SupportDtos.Ticket t = claim(create(owner, farm), cs);
        SupportDtos.InternalView ir = requests.create(t.id(), new SupportDtos.InternalCreate(PlatformRole.PM, pm.getId(), "Xem trạng thái trại", List.of(), t.version()));
        actAs(pm);
        AuditLog unrelated = audit.log(farm(), pm, "FARM_ACTIVATE", "Farm", farm.getId(), Map.of()); em.flush();
        assertThatThrownBy(() -> requests.complete(ir.id(), new SupportDtos.Complete("PERFORMED", "Đã thực hiện", unrelated.getId(), ir.version())))
            .isInstanceOf(DomainException.class);
        actAs(cs);
        requests.manage(ir.id(), new SupportDtos.InternalManage("REASSIGN", nextPm.getId(), "Chuyển người xử lý", ir.version()));
        actAs(pm); assertThatThrownBy(() -> requests.get(ir.id())).isInstanceOf(DomainException.class);
        actAs(nextPm); SupportDtos.InternalView active = requests.get(ir.id());
        AuditLog actual = audit.log(farm, nextPm, "FARM_ACTIVATE", "Farm", farm.getId(), Map.of()); em.flush();
        SupportDtos.Complete done = new SupportDtos.Complete("PERFORMED", "Đã cập nhật dịch vụ trại", actual.getId(), active.version());
        SupportDtos.InternalView completed = commands.executePlatformAuthorized(PlatformRole.PM, "IR_COMPLETE:"+ir.id(), "done-key", done,
            SupportDtos.InternalView.class, () -> requests.requireRecipient(ir.id()), () -> requests.complete(ir.id(), done));
        assertThat(completed.status()).isEqualTo("DONE"); assertThat(completed.domainResultAuditId()).isEqualTo(actual.getId());
        actAs(pm);
        assertThatThrownBy(() -> commands.executePlatformAuthorized(PlatformRole.PM, "IR_COMPLETE:"+ir.id(), "done-key", done,
            SupportDtos.InternalView.class, () -> requests.requireRecipient(ir.id()), () -> { throw new AssertionError(); })).isInstanceOf(DomainException.class);
    }

    @Test void otherCsReadsTicketButNotInternalRequestAndCanOnlyClaimWhenAssigneeUnavailable() {
        Farm farm = farm(); AppUser owner = owner(farm), cs = staff(PlatformRole.CS), other = staff(PlatformRole.CS), pm = staff(PlatformRole.PM);
        SupportDtos.Ticket t = claim(create(owner, farm), cs);
        requests.create(t.id(), new SupportDtos.InternalCreate(PlatformRole.PM, pm.getId(), "Nội dung riêng", List.of(), t.version()));
        actAs(other); Long id = t.id(); t = current(id); assertThat(t.internalRequests()).isEmpty(); Integer version = t.version();
        assertThatThrownBy(() -> tickets.process(id, new SupportDtos.Processing("CLAIM", null, null, null, null, null, version))).isInstanceOf(DomainException.class);
        cs.setAccountStatus("SUSPENDED"); em.flush();
        assertThat(tickets.requeueUnavailable()).isEqualTo(1); t = current(id);
        assertThat(t.assignedCsId()).isNull(); assertThat(t.status()).isEqualTo("IN_PROGRESS");
        assertThat(claim(t, other).assignedCsId()).isEqualTo(other.getId());
    }
}
