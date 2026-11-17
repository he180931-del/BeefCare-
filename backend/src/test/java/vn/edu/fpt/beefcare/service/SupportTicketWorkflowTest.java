package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.transaction.TestTransaction;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
@TestPropertySource(properties="beefcare.outbox.poll-delay-ms=3600000")
class SupportTicketWorkflowTest extends DomainTestSupport {
    @DynamicPropertySource
    static void isolatedDatabase(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> "jdbc:h2:mem:beefcare-support-ticket-workflow;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1");
    }

    @Autowired SupportTicketCommandService tickets;
    @Autowired InternalSupportRequestService requests;
    @Autowired IdempotencyCommandService commands;
    @Autowired AuditService audit;
    @Autowired NotificationService notificationService;
    @Autowired InternalRequestNotificationOutboxHandler internalRequestNotifications;
    @Autowired InternalRequestCompletionNotificationOutboxHandler completionNotifications;
    @Autowired ObjectMapper objectMapper;
    @Autowired PlatformTransactionManager transactionManager;

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

    private OutboxEvent noticeEvent(Long requestId, String action) throws Exception {
        return noticeEvent(requestId,action,null,null);
    }
    private OutboxEvent noticeEvent(Long requestId, String action, Long recipientId, Integer requestVersion) throws Exception {
        em.flush();
        List<OutboxEvent> events=em.createQuery("select e from OutboxEvent e where e.eventType=:type and e.aggregateType='InternalRequest' and e.aggregateId=:id order by e.id",OutboxEvent.class)
            .setParameter("type",InternalRequestNotificationOutboxHandler.EVENT_TYPE).setParameter("id",requestId.toString()).getResultList();
        return events.stream().filter(event->{
            try {
                JsonNode payload=objectMapper.readTree(event.getPayloadJson());
                return action.equals(payload.path("action").asText()) &&
                    (recipientId==null||recipientId.equals(payload.path("recipientId").asLong())) &&
                    (requestVersion==null||requestVersion.equals(payload.path("requestVersion").asInt()));
            }
            catch (Exception invalid) { throw new IllegalStateException(invalid); }
        }).findFirst().orElseThrow();
    }
    private OutboxEvent completionNoticeEvent(Long requestId) {
        em.flush();
        return em.createQuery("select e from OutboxEvent e where e.eventType=:type and e.aggregateType='InternalRequest' and e.aggregateId=:id order by e.id",OutboxEvent.class)
            .setParameter("type",InternalRequestCompletionNotificationOutboxHandler.EVENT_TYPE).setParameter("id",requestId.toString())
            .getResultStream().findFirst().orElseThrow();
    }

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

    @Test void ownerEndpointsRejectFarmNonOwnersAndPlatformStaffEvenWhenOwnerProfileFlagIsSet() {
        Farm farm = farm();
        AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
        AppUser technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        AppUser cs = staff(PlatformRole.CS);
        AppUser pm = staff(PlatformRole.PM);
        AppUser sa = staff(PlatformRole.SA);
        List<AppUser> actors = List.of(manager, technician, cs, pm, sa);
        actors.forEach(actor -> {
            actor.setOwnerRegistrationCompleted(true);
            actor.setOwnerRegistrationCompletedAt(clock.instant());
        });
        em.flush();

        for (AppUser actor : actors) {
            actAs(actor);
            assertThatThrownBy(() -> tickets.mine(null, null, null, null, null, 0, 25))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getStatus().value()).isEqualTo(403));
            assertThatThrownBy(() -> tickets.create(new SupportDtos.Create(
                "ACCOUNT_ACCESS", "ACCOUNT", null, "Cần hỗ trợ tài khoản", "Không thể đăng nhập"
            ))).isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getStatus().value()).isEqualTo(403));
        }
    }

    @Test void detailReturnsLatestMessagePageAndOwnerCanLoadOlderPublicMessages() {
        AppUser owner = owner(null);
        SupportDtos.Ticket ticket = create(owner, null);
        for (int index = 1; index <= 24; index++) {
            ticket = tickets.reply(ticket.id(), new SupportDtos.Reply("Phản hồi " + index, ticket.version()), false, false);
        }

        SupportDtos.Ticket latest = tickets.get(ticket.id(), false);
        assertThat(latest.messages()).hasSize(20);
        assertThat(latest.messages()).extracting(SupportDtos.Message::content)
            .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(5, 24).mapToObj(i -> "Phản hồi " + i).toList());
        assertThat(latest.messagesHasMore()).isTrue();
        assertThat(latest.messagesBeforeId()).isEqualTo(latest.messages().getFirst().id());

        SupportDtos.MessagePage older = tickets.messages(ticket.id(), latest.messagesBeforeId(), 20, false);
        assertThat(older.items()).extracting(SupportDtos.Message::content)
            .containsExactly("Mô tả riêng của chủ trại", "Phản hồi 1", "Phản hồi 2", "Phản hồi 3", "Phản hồi 4");
        assertThat(older.hasMore()).isFalse();
        assertThat(older.nextBeforeId()).isNull();
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

    @Test void internalPaymentContextUsesReconciliationCodeInsteadOfDatabaseId() {
        Farm farm = farm(); AppUser owner = owner(farm), cs = staff(PlatformRole.CS), pm = staff(PlatformRole.PM);
        PlanVersion plan = save(new PlanVersion().price1y(new BigDecimal("1200000")).price2y(new BigDecimal("2160000"))
            .price3y(new BigDecimal("3060000")).effectiveAt(clock.instant().minusSeconds(1)));
        Subscription subscription = save(new Subscription().farm(farm).planVersion(plan).entitlementStatus("PENDING"));
        Payment payment = new Payment(); payment.setSubscription(subscription); payment.setRequestedBy(owner); payment.setPriceVersion(plan);
        payment.setQuoteRef("BC-TRASOAT-15901"); payment.setState("PENDING"); payment.setDurationYears(1);
        payment.setAmountVnd(new BigDecimal("1200000")); payment.setRequestedAt(clock.instant()); payment.setExpiresAt(clock.instant().plusSeconds(3600));
        save(payment);

        SupportDtos.Ticket ticket = claim(create(owner, farm), cs);
        SupportDtos.InternalView internal = requests.create(ticket.id(), new SupportDtos.InternalCreate(PlatformRole.PM, pm.getId(),
            "Kiểm tra thanh toán", List.of(new SupportDtos.ContextReference("PAYMENT", payment.getId())), ticket.version()));

        assertThat(internal.context()).singleElement().satisfies(ref -> {
            assertThat(ref.type()).isEqualTo("PAYMENT");
            assertThat(ref.id()).isEqualTo(payment.getId());
            assertThat(ref.label()).isEqualTo("Thanh toán BC-TRASOAT-15901");
        });
    }

    @Test void performedResultMustReferenceRelatedCommittedDomainWorkAndReassignmentRevokesCachedReplay() throws Exception {
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
        OutboxEvent completionNotice=completionNoticeEvent(ir.id());
        completionNotifications.handle(completionNotice);
        completionNotifications.handle(completionNotice);
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",cs.getId()).setParameter("k","JOB07:INTERNAL_REQUEST_COMPLETED:"+completionNotice.getId()).getSingleResult()).isEqualTo(1L);
        actAs(cs);
        assertThat(notificationService.mine()).anyMatch(notice->"SUPPORT_TICKET".equals(notice.targetType())&&t.id().equals(notice.targetId()));
        em.createQuery("select p from PlatformStaffAccess p where p.user.id=:u",PlatformStaffAccess.class).setParameter("u",cs.getId()).getSingleResult().setStatus("INACTIVE");
        em.flush();
        assertThat(notificationService.mine()).isEmpty();
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

    @Test void internalRequestNoticeRetriesOnceAndOnlyNotifiesTheCurrentNamedRecipient() throws Exception {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),oldPm=staff(PlatformRole.PM),nextPm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(PlatformRole.PM,oldPm.getId(),"Kiểm tra nghiệp vụ",List.of(),ticket.version()));
        OutboxEvent created=noticeEvent(request.id(),"CREATED",oldPm.getId(),request.version());
        JsonNode payload=objectMapper.readTree(created.getPayloadJson());
        assertThat(payload.path("recipientId").asLong()).isEqualTo(oldPm.getId());
        assertThat(payload.path("requestVersion").asInt()).isEqualTo(request.version());

        actAs(cs);
        SupportDtos.InternalView reassignedToY=requests.manage(request.id(),new SupportDtos.InternalManage("REASSIGN",nextPm.getId(),"Đổi người xử lý",request.version()));
        OutboxEvent reassignedToYEvent=noticeEvent(reassignedToY.id(),"REASSIGNED",nextPm.getId(),reassignedToY.version());
        actAs(cs);
        SupportDtos.InternalView reassignedBack=requests.manage(request.id(),new SupportDtos.InternalManage("REASSIGN",oldPm.getId(),"Chuyển lại người xử lý",reassignedToY.version()));
        OutboxEvent reassignedBackEvent=noticeEvent(reassignedBack.id(),"REASSIGNED",oldPm.getId(),reassignedBack.version());
        internalRequestNotifications.handle(created);
        internalRequestNotifications.handle(reassignedToYEvent);
        internalRequestNotifications.handle(reassignedBackEvent);
        internalRequestNotifications.handle(reassignedBackEvent);

        String retryKey="JOB07:INTERNAL_REQUEST:"+reassignedBackEvent.getId();
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",oldPm.getId()).setParameter("k","JOB07:INTERNAL_REQUEST:"+created.getId()).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",nextPm.getId()).setParameter("k","JOB07:INTERNAL_REQUEST:"+reassignedToYEvent.getId()).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",oldPm.getId()).setParameter("k",retryKey).getSingleResult()).isEqualTo(1L);

        actAs(oldPm);
        assertThat(notificationService.mine()).extracting(NotificationService.NotificationView::targetType).containsExactly("INTERNAL_REQUEST");
        em.createQuery("select p from PlatformStaffAccess p where p.user.id=:u",PlatformStaffAccess.class).setParameter("u",oldPm.getId()).getSingleResult().setStatus("INACTIVE");
        em.flush();
        assertThat(notificationService.mine()).isEmpty();
    }

    @Test void createdRequestNoticeDispatchesWithTheVersionAfterItsCodeWasPersisted() throws Exception {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),pm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(PlatformRole.PM,pm.getId(),"Kiểm tra sau tạo",List.of(),ticket.version()));
        OutboxEvent event=noticeEvent(request.id(),"CREATED",pm.getId(),request.version());

        internalRequestNotifications.handle(event);

        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",pm.getId()).setParameter("k","JOB07:INTERNAL_REQUEST:"+event.getId()).getSingleResult()).isEqualTo(1L);
        actAs(pm);
        assertThat(notificationService.mine()).extracting(NotificationService.NotificationView::targetId).containsExactly(request.id());
    }

    @Test void formerNamedRecipientCannotMarkAnInternalRequestNoticeReadAfterReassignment() throws Exception {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),formerPm=staff(PlatformRole.PM),nextPm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(
            PlatformRole.PM,formerPm.getId(),"Kiểm tra giao dịch",List.of(),ticket.version()));
        OutboxEvent created=noticeEvent(request.id(),"CREATED",formerPm.getId(),request.version());
        internalRequestNotifications.handle(created);

        actAs(cs);
        requests.manage(request.id(),new SupportDtos.InternalManage("REASSIGN",nextPm.getId(),"Chuyển người xử lý",request.version()));

        actAs(formerPm);
        Notification notice=em.createQuery("select n from Notification n where n.recipient.id=:userId and n.eventKey=:eventKey",Notification.class)
            .setParameter("userId",formerPm.getId()).setParameter("eventKey","JOB07:INTERNAL_REQUEST:"+created.getId()).getSingleResult();
        assertThatThrownBy(()->notificationService.markRead(notice.getId())).isInstanceOfSatisfying(DomainException.class,error -> {
            assertThat(error.getCode()).isEqualTo(MessageCodes.FE20_19);
            assertThat(error.getStatus().value()).isEqualTo(404);
        });
        assertThat(notice.getReadTime()).isNull();
        assertThat(notificationService.mine()).noneMatch(row->row.id().equals(notice.getId()));
    }

    @Test void cancellationNoticeRemainsScopedToTheNamedRecipientAndStaleCreateIsSkipped() throws Exception {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),pm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(PlatformRole.PM,pm.getId(),"Kiểm tra giao dịch",List.of(),ticket.version()));
        OutboxEvent created=noticeEvent(request.id(),"CREATED");
        actAs(cs);
        SupportDtos.InternalView cancelled=requests.manage(request.id(),new SupportDtos.InternalManage("CANCEL",null,"Không cần xử lý",request.version()));
        OutboxEvent cancellation=noticeEvent(cancelled.id(),"CANCELLED");

        internalRequestNotifications.handle(created);
        internalRequestNotifications.handle(cancellation);

        actAs(pm);
        List<NotificationService.NotificationView> visible=notificationService.mine();
        assertThat(visible).hasSize(1).first().satisfies(notice->{
            assertThat(notice.targetType()).isEqualTo("INTERNAL_REQUEST");
            assertThat(notice.targetId()).isEqualTo(request.id());
            assertThat(notice.title()).contains("đã bị hủy");
        });
    }

    @Test void fourHourInternalReminderRetriesByRecipientEventAndSkipsRevokedAccess() {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),pm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(PlatformRole.PM,pm.getId(),"Kiểm tra đối soát",List.of(),ticket.version()));
        clock.set(clock.instant().plus(java.time.Duration.ofHours(4)));
        String reminderKey="internal:"+request.id()+":open4h:"+pm.getId();

        assertThat(requests.remindLongOpenRequests()).isEqualTo(1);
        assertThat(requests.remindLongOpenRequests()).isEqualTo(1);
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",pm.getId()).setParameter("k",reminderKey).getSingleResult()).isEqualTo(1L);

        em.createQuery("select p from PlatformStaffAccess p where p.user.id=:u",PlatformStaffAccess.class).setParameter("u",pm.getId()).getSingleResult().setStatus("INACTIVE");
        em.flush();
        requests.remindLongOpenRequests();
        assertThat(em.createQuery("select count(n) from Notification n where n.recipient.id=:u and n.eventKey=:k",Long.class)
            .setParameter("u",pm.getId()).setParameter("k",reminderKey).getSingleResult()).isEqualTo(1L);
    }

    @Test void fourHourReminderRefreshesAStaleAssignmentBeforeChoosingItsRecipient() {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),formerPm=staff(PlatformRole.PM),currentPm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(
            PlatformRole.PM,formerPm.getId(),"Kiểm tra giao dịch",List.of(),ticket.version()));
        clock.set(clock.instant().plus(java.time.Duration.ofHours(4)));

        InternalRequest staleRequest=em.createQuery("select r from InternalRequest r where r.id=:id",InternalRequest.class)
            .setParameter("id",request.id()).getSingleResult();
        assertThat(staleRequest.getRecipient().getId()).isEqualTo(formerPm.getId());
        // Model a database-side assignment change after this persistence context loaded the request.
        em.createNativeQuery("update internal_request set recipient_id=:recipient where id=:id")
            .setParameter("recipient",currentPm.getId()).setParameter("id",request.id()).executeUpdate();
        assertThat(staleRequest.getRecipient().getId()).isEqualTo(formerPm.getId());

        assertThat(requests.remindLongOpenRequests()).isEqualTo(1);

        assertThat(staleRequest.getRecipient().getId()).isEqualTo(currentPm.getId());
        String formerKey="internal:"+request.id()+":open4h:"+formerPm.getId();
        String currentKey="internal:"+request.id()+":open4h:"+currentPm.getId();
        assertThat(em.createQuery("select count(n) from Notification n where n.eventKey=:key",Long.class)
            .setParameter("key",formerKey).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(n) from Notification n where n.eventKey=:key",Long.class)
            .setParameter("key",currentKey).getSingleResult()).isEqualTo(1L);
    }

    @Test void rolledBackRequestCommandHidesItsRequestAndNoticeEventTogether() throws Exception {
        Farm farm=farm();AppUser owner=owner(farm),cs=staff(PlatformRole.CS),pm=staff(PlatformRole.PM);
        SupportDtos.Ticket ticket=claim(create(owner,farm),cs);
        actAs(cs);
        SupportDtos.InternalView request=requests.create(ticket.id(),new SupportDtos.InternalCreate(
            PlatformRole.PM,pm.getId(),"Yêu cầu bị rollback",List.of(),ticket.version()));
        OutboxEvent event=noticeEvent(request.id(),"CREATED");
        assertThat(event.getPayloadJson()).contains("\"recipientId\":"+pm.getId());

        TransactionTemplate independentRead=new TransactionTemplate(transactionManager);
        independentRead.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        TestTransaction.flagForRollback();
        independentRead.executeWithoutResult(status->{
            assertThat(em.find(InternalRequest.class,request.id())).isNull();
            assertThat(em.createQuery("select count(e) from OutboxEvent e where e.eventType=:type and e.aggregateType='InternalRequest' and e.aggregateId=:id",Long.class)
                .setParameter("type",InternalRequestNotificationOutboxHandler.EVENT_TYPE).setParameter("id",request.id().toString()).getSingleResult()).isZero();
        });
    }
}
