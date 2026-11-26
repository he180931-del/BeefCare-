package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.InternalRequestState;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;

/** Named PM/SA requests expose scoped references, never the customer's conversation or CS notes. */
@Service
@Transactional
public class InternalSupportRequestService {
    private final EntityManager em;
    private final SupportTicketCommandService tickets;
    private final PlatformAccessService platform;
    private final FarmClock clock;
    private final OutboxService outbox;
    private final NotificationService notifications;
    private final NotificationTargetAccessService notificationTargetAccess;

    public InternalSupportRequestService(EntityManager em, SupportTicketCommandService tickets, PlatformAccessService platform,
        FarmClock clock, OutboxService outbox, NotificationService notifications, NotificationTargetAccessService notificationTargetAccess) {
        this.em = em; this.tickets = tickets; this.platform = platform; this.clock = clock; this.outbox = outbox;
        this.notifications = notifications; this.notificationTargetAccess = notificationTargetAccess;
    }

    public SupportDtos.InternalView create(Long ticketId, SupportDtos.InternalCreate r) {
        SupportTicket t = tickets.find(ticketId, true); AppUser cs = tickets.assigned(t); tickets.writable(t);
        VersionGuard.requireExpected(t.getVersion(), r.ticketVersion());
        if (!Set.of("IN_PROGRESS", "WAITING_CUSTOMER").contains(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        boolean roleAllowed = switch (t.getCategory()) {
            case "ACCOUNT_ACCESS" -> r.targetRole() == PlatformRole.SA;
            case "PAYMENT", "FARM_SERVICE" -> r.targetRole() == PlatformRole.PM;
            case "SYSTEM_USAGE", "OTHER" -> r.targetRole() == PlatformRole.PM || r.targetRole() == PlatformRole.SA;
            default -> false;
        };
        if (!roleAllowed) throw DomainException.invalid("targetRole");
        specialistRole(r.targetRole()); AppUser recipient = tickets.staff(r.recipientId(), r.targetRole());
        if (em.createQuery("select count(r) from InternalRequest r where r.ticket.id=:t and r.targetRole=:role and r.state in ('OPEN','WAITING_CS')", Long.class)
            .setParameter("t", ticketId).setParameter("role", r.targetRole().name()).getSingleResult() != 0)
            throw DomainException.conflict("MSG-FE20-16");
        InternalRequest ir = new InternalRequest(); ir.setTicket(t); ir.setTargetRole(r.targetRole().name());
        ir.setRecipient(recipient); ir.setCreatedBy(cs); ir.setCreatedAt(clock.now()); ir.setState("OPEN");
        ir.setQuestion(requestText(r)); ir.setContextJson(null);
        em.persist(ir); em.flush(); ir.setCode("IR-%04d".formatted(ir.getId())); em.flush();
        appendHistory(ir, cs, "CS", "CREATED", ir.getQuestion());
        tickets.history(t, cs, "IR_CREATED", t.getStatus(), null, Map.of("requestId", ir.getId(), "targetRole", ir.getTargetRole()));
        tickets.changed(t, cs, "SUPPORT_INTERNAL_CREATE", ir, null); enqueueNotice(ir, recipient, "CREATED"); return tickets.internalView(ir);
    }

    /** Recheck mutable assignment before a cached response is read. */
    public void requireAssignedCs(Long requestId) { tickets.assigned(find(requestId, true).getTicket()); }
    public void requireAssignedCs(Long ticketId, Long requestId) {
        InternalRequest r = find(requestId, true);
        if (!r.getTicket().getId().equals(ticketId)) throw DomainException.notFound(MessageCodes.COM_08);
        tickets.assigned(r.getTicket());
    }
    public void requireRecipient(Long requestId) { named(find(requestId, true)); }

    public SupportDtos.InternalView manage(Long id, SupportDtos.InternalManage r) {
        InternalRequest ir = find(id, true); SupportTicket t = tickets.find(ir.getTicket().getId(), true);
        AppUser cs = tickets.assigned(t); tickets.writable(t);
        VersionGuard.requireExpected(ir.getVersion(), r.expectedVersion());
        if ("CLARIFY".equals(r.action())) {
            if (!"WAITING_CS".equals(ir.getState())) throw DomainException.conflict(MessageCodes.COM_05);
            String clarification = SupportTicketCommandService.text(
                r.clarificationText() == null ? r.reason() : r.clarificationText(), 2000, "clarificationText");
            AppUser recipient = ir.getRecipient();
            ir.setResultText(clarification); ir.setState("OPEN"); ir.setCompletedAt(null);
            em.flush();
            appendHistory(ir, cs, "CS", "CLARIFICATION", clarification);
            tickets.history(t, cs, "IR_CLARIFIED", t.getStatus(), null,
                Map.of("requestId", ir.getId(), "clarification", true));
            tickets.changed(t, cs, "SUPPORT_INTERNAL_MANAGE", ir, "WAITING_CS");
            enqueueNotice(ir, recipient, "CLARIFIED");
            return tickets.internalView(ir);
        }
        String priorState = ir.getState();
        if (!Set.of("OPEN", "WAITING_CS").contains(priorState)) throw DomainException.conflict(MessageCodes.COM_05);
        String reason = SupportTicketCommandService.text(r.reason(), 1000, "reason"); AppUser former = ir.getRecipient();
        switch (r.action()) {
            case "REASSIGN" -> {
                AppUser recipient = tickets.staff(r.recipientId(), PlatformRole.valueOf(ir.getTargetRole()));
                if (recipient.equals(former)) throw DomainException.invalid("recipientId"); ir.setRecipient(recipient);
            }
            case "CANCEL" -> { ir.setState("CANCELLED"); ir.setCompletedAt(clock.now()); }
            default -> throw DomainException.invalid("action");
        }
        em.flush(); tickets.history(t, cs, "IR_" + r.action(), t.getStatus(), reason, Map.of("requestId", ir.getId()));
        appendHistory(ir, cs, "CS", "REASSIGN".equals(r.action()) ? "REASSIGNED" : "CANCELLED", reason);
        tickets.changed(t, cs, "SUPPORT_INTERNAL_MANAGE", ir, priorState);
        if ("CANCEL".equals(r.action())) enqueueNotice(ir, former, "CANCELLED");
        else if (!former.equals(ir.getRecipient())) enqueueNotice(ir, ir.getRecipient(), "REASSIGNED");
        return tickets.internalView(ir);
    }

    @Transactional(readOnly = true)
    public List<SupportDtos.RecipientInternalView> mine(String state) {
        PlatformContext ctx = platform.requireAnyPlatformRole(); specialistRole(ctx.role());
        if (state != null && !knownState(state)) throw DomainException.invalid("state");
        return em.createQuery("select r from InternalRequest r where r.recipient.id=:u and r.targetRole=:role order by r.createdAt desc,r.id desc", InternalRequest.class)
            .setParameter("u", ctx.user().getId()).setParameter("role", ctx.role().name()).getResultList().stream()
            .filter(r -> state == null || state.equals(r.getState())).map(tickets::recipientInternalView).toList();
    }

    private static boolean knownState(String state) {
        try {
            InternalRequestState.valueOf(state);
            return true;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    @Transactional(readOnly = true)
    public SupportDtos.RecipientInternalView get(Long id) { InternalRequest ir = find(id, false); named(ir); return tickets.recipientInternalView(ir); }

    public SupportDtos.RecipientInternalView complete(Long id, SupportDtos.Complete r) {
        InternalRequest ir = find(id, true); AppUser actor = named(ir).user();
        // A ticket lock serializes completion with resolve/close and another CS's request commands.
        SupportTicket t = tickets.find(ir.getTicket().getId(), true); tickets.writable(t);
        VersionGuard.requireExpected(ir.getVersion(), r.expectedVersion());
        if (!"OPEN".equals(ir.getState())) throw DomainException.conflict("MSG-FE20-19");
        if (!Set.of("CONFIRMED", "NOT_CONFIRMED", "NEED_MORE_INFO", "OUT_OF_SCOPE").contains(r.outcome()))
            throw DomainException.invalid("outcome");
        boolean needsMoreInfo = "NEED_MORE_INFO".equals(r.outcome());
        String result = SupportTicketCommandService.text(r.resultNote(), 2000, "resultNote");
        if (needsMoreInfo) {
            ir.setOutcome(r.outcome()); ir.setResultText(result); ir.setState("WAITING_CS"); ir.setCompletedAt(null);
            em.flush(); tickets.history(t, actor, "IR_NEEDS_MORE_INFO", t.getStatus(), null, Map.of("requestId", ir.getId()));
            appendHistory(ir, actor, ir.getTargetRole(), "NEED_MORE_INFO", result);
            tickets.changed(t, actor, "SUPPORT_INTERNAL_MANAGE", ir, "OPEN"); tickets.notifyCs(t, "internal-clarification");
            return tickets.recipientInternalView(ir);
        }
        ir.setOutcome(r.outcome()); ir.setResultText(result); ir.setState("DONE"); ir.setCompletedAt(clock.now());
        em.flush(); appendHistory(ir, actor, ir.getTargetRole(), "COMPLETED", result);
        tickets.history(t, actor, "IR_COMPLETED", t.getStatus(), null, Map.of("requestId", ir.getId(), "outcome", ir.getOutcome()));
        tickets.changed(t, actor, "SUPPORT_INTERNAL_DONE", ir, "OPEN"); enqueueCompletionNotice(ir, t); return tickets.recipientInternalView(ir);
    }

    private static String requestText(SupportDtos.InternalCreate request) {
        return SupportTicketCommandService.text(request.requestText(), 2000, "requestText");
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> recipients(PlatformRole role) {
        platform.requireRole(PlatformRole.CS);
        if (role == null) throw DomainException.required("role");
        return em.createQuery("select p.user from PlatformStaffAccess p where upper(p.status)='ACTIVE' and upper(p.role)=:r", AppUser.class)
            .setParameter("r", role.name()).getResultList().stream().filter(u -> tickets.available(u, role))
            .map(u -> Map.<String, Object>of("id", u.getId(), "name", u.getFullName(), "role", role.name())).toList();
    }

    private InternalRequest find(Long id, boolean lock) {
        // Consistent lock order is ticket then request, also used by create/resolve/close.
        InternalRequest observed = em.find(InternalRequest.class, id);
        if (observed == null) throw DomainException.notFound(MessageCodes.COM_08);
        if (lock) { tickets.find(observed.getTicket().getId(), true); em.lock(observed, LockModeType.PESSIMISTIC_WRITE); em.refresh(observed); }
        return observed;
    }
    private PlatformContext named(InternalRequest ir) {
        PlatformRole role = PlatformRole.valueOf(ir.getTargetRole()); specialistRole(role);
        PlatformContext ctx = platform.requireRole(role);
        if (!ctx.user().equals(ir.getRecipient())) throw DomainException.forbidden("MSG-FE20-19"); return ctx;
    }
    private void specialistRole(PlatformRole role) {
        if (role != PlatformRole.PM && role != PlatformRole.SA) throw DomainException.invalid("targetRole");
    }
    private void appendHistory(InternalRequest request, AppUser actor, String actorRole, String eventType, String note) {
        InternalRequestHistory history = new InternalRequestHistory();
        history.setInternalRequest(request); history.setActor(actor); history.setActorRole(actorRole);
        history.setEventType(eventType); history.setNote(note); history.setOccurredAt(clock.now());
        history.setRequestVersion(request.getVersion()); history.setState(request.getState()); history.setOutcome(request.getOutcome());
        em.persist(history);
    }
    /** JOB-07 step 4: the named recipient of a request OPEN for 4 hours gets one reminder notice (per recipient). */
    public int remindLongOpenRequests() {
        java.time.Instant cutoff = clock.now().minus(java.time.Duration.ofHours(4));
        List<InternalRequest> observed = em.createQuery("select r from InternalRequest r where r.state='OPEN' and r.createdAt <= :cutoff", InternalRequest.class)
            .setParameter("cutoff", cutoff).getResultList();
        Map<Long, InternalRequest> currentRequests = notificationTargetAccess.lockInternalRequestsForRead(
            observed.stream().map(InternalRequest::getId).toList()
        );
        for (InternalRequest candidate : observed) {
            InternalRequest ir = currentRequests.get(candidate.getId());
            if (ir == null || !"OPEN".equals(ir.getState()) || ir.getCreatedAt() == null || ir.getCreatedAt().isAfter(cutoff)) continue;
            AppUser recipient = ir.getRecipient();
            if (!notificationTargetAccess.canOpenInternalRequest(recipient, ir)) continue;
            notifications.notify(recipient, "SUPPORT", "INTERNAL_REQUEST", ir.getId(), "Yêu cầu nội bộ " + ir.getCode() + " đang chờ xử lý",
                "Yêu cầu đã mở hơn 4 giờ và đang chờ kết quả của bạn.", "internal:" + ir.getId() + ":open4h:" + recipient.getId());
        }
        return observed.size();
    }

    private void enqueueNotice(InternalRequest ir, AppUser recipient, String action) {
        if (recipient == null || recipient.getId() == null || ir.getId() == null || ir.getVersion() == null) {
            throw new IllegalStateException("Internal request notification snapshot is incomplete");
        }
        Long farmId = ir.getTicket().getFarm() == null ? null : ir.getTicket().getFarm().getId();
        outbox.enqueue(farmId, InternalRequestNotificationOutboxHandler.EVENT_TYPE, "InternalRequest", ir.getId(),
            Map.of("recipientId", recipient.getId(), "action", action, "requestVersion", ir.getVersion()));
    }

    private void enqueueCompletionNotice(InternalRequest ir, SupportTicket ticket) {
        if (ir.getId() == null || ir.getVersion() == null || ticket.getId() == null) {
            throw new IllegalStateException("Internal request completion notification snapshot is incomplete");
        }
        Long farmId = ticket.getFarm() == null ? null : ticket.getFarm().getId();
        outbox.enqueue(farmId, InternalRequestCompletionNotificationOutboxHandler.EVENT_TYPE, "InternalRequest", ir.getId(),
            Map.of("action", "COMPLETED", "requestVersion", ir.getVersion(), "ticketId", ticket.getId()));
    }
}
