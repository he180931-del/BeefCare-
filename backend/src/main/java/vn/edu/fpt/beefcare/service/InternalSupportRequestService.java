package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
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
    private final NotificationService notifications;

    public InternalSupportRequestService(EntityManager em, SupportTicketCommandService tickets, PlatformAccessService platform,
        FarmClock clock, NotificationService notifications) {
        this.em = em; this.tickets = tickets; this.platform = platform; this.clock = clock; this.notifications = notifications;
    }

    public SupportDtos.InternalView create(Long ticketId, SupportDtos.InternalCreate r) {
        SupportTicket t = tickets.find(ticketId, true); AppUser cs = tickets.assigned(t); tickets.writable(t);
        VersionGuard.requireExpected(t.getVersion(), r.ticketVersion());
        if (!Set.of("IN_PROGRESS", "WAITING_CUSTOMER").contains(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        specialistRole(r.targetRole()); AppUser recipient = tickets.staff(r.recipientId(), r.targetRole());
        if (em.createQuery("select count(r) from InternalRequest r where r.ticket.id=:t and r.targetRole=:role and r.state='OPEN'", Long.class)
            .setParameter("t", ticketId).setParameter("role", r.targetRole().name()).getSingleResult() != 0)
            throw DomainException.conflict("MSG-FE20-16");
        List<SupportDtos.ContextReference> refs = r.context() == null ? List.of() : r.context();
        if (refs.size() > 20 || new HashSet<>(refs).size() != refs.size()) throw DomainException.invalid("context");
        refs.forEach(ref -> validateReference(t, r.targetRole(), ref));
        InternalRequest ir = new InternalRequest(); ir.setTicket(t); ir.setTargetRole(r.targetRole().name());
        ir.setRecipient(recipient); ir.setCreatedBy(cs); ir.setCreatedAt(clock.now()); ir.setState("OPEN");
        ir.setQuestion(SupportTicketCommandService.text(r.question(), 2000, "question")); ir.setContextJson(JsonSupport.toJson(refs));
        em.persist(ir); em.flush(); ir.setCode("IR-%04d".formatted(ir.getId()));
        tickets.history(t, cs, "IR_CREATED", t.getStatus(), null, Map.of("requestId", ir.getId(), "targetRole", ir.getTargetRole()));
        tickets.changed(t, cs, "SUPPORT_INTERNAL_CREATE"); notice(ir, recipient, "created"); return tickets.internalView(ir);
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
        if (!"OPEN".equals(ir.getState())) throw DomainException.conflict(MessageCodes.COM_05);
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
        tickets.changed(t, cs, "SUPPORT_INTERNAL_MANAGE"); notice(ir, former, "changed");
        if (!former.equals(ir.getRecipient())) notice(ir, ir.getRecipient(), "assigned");
        return tickets.internalView(ir);
    }

    @Transactional(readOnly = true)
    public List<SupportDtos.InternalView> mine(String state) {
        PlatformContext ctx = platform.requireAnyPlatformRole(); specialistRole(ctx.role());
        if (state != null && !Set.of("OPEN", "DONE", "CANCELLED").contains(state)) throw DomainException.invalid("state");
        return em.createQuery("select r from InternalRequest r where r.recipient.id=:u and r.targetRole=:role order by r.createdAt desc,r.id desc", InternalRequest.class)
            .setParameter("u", ctx.user().getId()).setParameter("role", ctx.role().name()).getResultList().stream()
            .filter(r -> state == null || state.equals(r.getState())).map(tickets::internalView).toList();
    }

    @Transactional(readOnly = true)
    public SupportDtos.InternalView get(Long id) { InternalRequest ir = find(id, false); named(ir); return tickets.internalView(ir); }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> domainResults(Long id) {
        InternalRequest ir = find(id, false); AppUser actor = named(ir).user();
        return em.createQuery("select a from AuditLog a where a.actor.id=:u and a.loggedAt>=:start order by a.loggedAt desc,a.id desc", AuditLog.class)
            .setParameter("u", actor.getId()).setParameter("start", ir.getCreatedAt()).getResultList().stream()
            .filter(a -> validDomainResult(ir, a, actor)).limit(100)
            .map(a -> Map.<String, Object>of("auditId", a.getId(), "action", a.getAction(), "targetType", a.getTargetType(), "targetId", a.getTargetId(), "time", a.getLoggedAt())).toList();
    }

    public SupportDtos.InternalView complete(Long id, SupportDtos.Complete r) {
        InternalRequest ir = find(id, true); AppUser actor = named(ir).user();
        // A ticket lock serializes completion with resolve/close and another CS's request commands.
        SupportTicket t = tickets.find(ir.getTicket().getId(), true); tickets.writable(t);
        VersionGuard.requireExpected(ir.getVersion(), r.expectedVersion());
        if (!"OPEN".equals(ir.getState())) throw DomainException.conflict("MSG-FE20-19");
        if (!Set.of("PERFORMED", "UNABLE", "OUTSIDE_DOMAIN").contains(r.outcome())) throw DomainException.invalid("outcome");
        String result = SupportTicketCommandService.text(r.result(), 2000, "result");
        if ("PERFORMED".equals(r.outcome())) {
            AuditLog a = r.domainResultAuditId() == null ? null : em.find(AuditLog.class, r.domainResultAuditId());
            if (!validDomainResult(ir, a, actor)) throw DomainException.notFound(MessageCodes.COM_08);
            ir.setDomainAudit(a);
        } else if (r.domainResultAuditId() != null) throw DomainException.invalid("domainResultAuditId");
        ir.setOutcome(r.outcome()); ir.setResultText(result); ir.setState("DONE"); ir.setCompletedAt(clock.now());
        em.flush(); tickets.history(t, actor, "IR_COMPLETED", t.getStatus(), null, Map.of("requestId", ir.getId(), "outcome", ir.getOutcome()));
        tickets.changed(t, actor, "SUPPORT_INTERNAL_DONE"); tickets.notifyCs(t, "internal-done"); return tickets.internalView(ir);
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
    private void validateReference(SupportTicket t, PlatformRole role, SupportDtos.ContextReference ref) {
        if (ref == null || ref.id() == null || ref.id() < 1) throw DomainException.invalid("context");
        boolean valid;
        if (role == PlatformRole.SA) valid = "ACCOUNT".equals(ref.type()) && ref.id().equals(t.getRequester().getId());
        else {
            Farm farm = switch (ref.type()) {
                case "FARM" -> em.find(Farm.class, ref.id());
                case "SUBSCRIPTION" -> { Subscription s = em.find(Subscription.class, ref.id()); yield s == null ? null : s.getFarm(); }
                case "PAYMENT" -> { Payment p = em.find(Payment.class, ref.id()); yield p == null ? null : p.getSubscription().getFarm(); }
                case "FINANCE_RECORD" -> { ManualFinanceRecord f = em.find(ManualFinanceRecord.class, ref.id()); yield f == null ? null : f.getFarm(); }
                case "FINANCE_SNAPSHOT" -> { CashReportSnapshot s = em.find(CashReportSnapshot.class, ref.id()); yield s == null ? null : s.getFarm(); }
                default -> null;
            };
            valid = farm != null && t.getFarm() != null && farm.equals(t.getFarm());
        }
        if (!valid) throw DomainException.notFound(MessageCodes.COM_08);
    }
    private boolean validDomainResult(InternalRequest ir, AuditLog a, AppUser actor) {
        if (a == null || !actor.equals(a.getActor()) || a.getLoggedAt().isBefore(ir.getCreatedAt()) ||
            a.getAction().startsWith("SUPPORT_") || a.getAction().startsWith("INTERNAL_")) return false;
        if ("PM".equals(ir.getTargetRole())) return ir.getTicket().getFarm() != null && ir.getTicket().getFarm().equals(a.getFarm()) &&
            Set.of("Farm", "Subscription", "Payment", "BankTransferEvidence", "EvidenceReview", "ManualFinanceRecord").contains(a.getTargetType());
        if ("AppUser".equals(a.getTargetType())) return a.getTargetId().equals(ir.getTicket().getRequester().getId());
        if ("User".equals(a.getTargetType())) {
            User identity = em.find(User.class, a.getTargetId());
            return identity != null && identity.getEmail() != null && identity.getEmail().equalsIgnoreCase(ir.getTicket().getRequester().getEmail());
        }
        return false;
    }
    /** JOB-07 step 4: the named recipient of a request OPEN for 4 hours gets one reminder notice (per recipient). */
    public int remindLongOpenRequests() {
        java.time.Instant cutoff = clock.now().minus(java.time.Duration.ofHours(4));
        List<InternalRequest> open = em.createQuery("select r from InternalRequest r where r.state='OPEN' and r.createdAt <= :cutoff", InternalRequest.class)
            .setParameter("cutoff", cutoff).getResultList();
        for (InternalRequest ir : open) {
            notifications.notify(ir.getRecipient(), "SUPPORT", "INTERNAL_REQUEST", ir.getId(), "Yêu cầu nội bộ " + ir.getCode() + " đang chờ xử lý",
                "Yêu cầu đã mở hơn 4 giờ và đang chờ kết quả của bạn.", "internal:" + ir.getId() + ":open4h:" + ir.getRecipient().getId());
        }
        return open.size();
    }

    private void notice(InternalRequest ir, AppUser recipient, String event) {
        notifications.notify(recipient, "SUPPORT", "INTERNAL_REQUEST", ir.getId(), "Cập nhật yêu cầu nội bộ " + ir.getCode(),
            "Trạng thái: " + ir.getState(), "internal:" + ir.getId() + ":" + event + ":" + ir.getVersion());
    }
}
