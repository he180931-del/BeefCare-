package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.dto.SupportDtos;

/** FE-20 Policy B: customer acknowledgment and specialist work never imply ticket closure. */
@Service
@Transactional
public class SupportTicketCommandService {
    private static final Set<String> CATEGORIES = Set.of("ACCOUNT_ACCESS", "PAYMENT", "FARM_SERVICE", "SYSTEM_USAGE", "OTHER");
    private static final Set<String> PRIORITIES = Set.of("LOW", "NORMAL", "HIGH");
    private final EntityManager em;
    private final FarmAccessService accounts;
    private final PlatformAccessService platform;
    private final FarmClock clock;
    private final AuditService audit;
    private final OutboxService outbox;
    private final NotificationService notifications;
    private final MailService mail;

    public SupportTicketCommandService(EntityManager em, FarmAccessService accounts, PlatformAccessService platform,
        FarmClock clock, AuditService audit, OutboxService outbox, NotificationService notifications, MailService mail) {
        this.em = em; this.accounts = accounts; this.platform = platform; this.clock = clock;
        this.audit = audit; this.outbox = outbox; this.notifications = notifications; this.mail = mail;
    }

    public SupportDtos.Ticket create(SupportDtos.Create r) {
        AppUser actor = requireOwner();
        if (!CATEGORIES.contains(r.category())) throw DomainException.invalid("category");
        Farm farm = null;
        if ("FARM".equals(r.scope())) {
            if (r.farmId() == null) throw DomainException.required("farmId");
            // Owner help remains accessible for pending, expired and suspended farm services.
            farm = accounts.require(r.farmId(), FarmAction.VIEW_FARM_INFORMATION).farm();
        } else if (!"ACCOUNT".equals(r.scope()) || r.farmId() != null) throw DomainException.invalid("scope");
        SupportTicket t = new SupportTicket();
        t.setRequester(actor); t.setFarm(farm); t.setCategory(r.category()); t.setPriority("NORMAL");
        t.setSubject(text(r.subject(), 150, "subject")); t.setStatus("OPEN");
        t.setCreatedAt(clock.now()); t.setUpdatedAt(clock.now()); em.persist(t); em.flush();
        t.setCode("TK-%04d".formatted(t.getId()));
        message(t, actor, "OWNER", "DESCRIPTION", "PUBLIC", text(r.description(), 3000, "description"));
        history(t, actor, "CREATED", null, null, Map.of());
        changed(t, actor, "SUPPORT_CREATE"); notifyCs(t, "created");
        return view(t, false, actor);
    }

    @Transactional(readOnly = true)
    public SupportDtos.Page mine(String q, String category, String tab, Instant from, Instant to, int page, int size) {
        AppUser actor = requireOwner();
        List<SupportTicket> all = em.createQuery("select t from SupportTicket t where t.requester.id=:u order by t.updatedAt desc,t.id desc", SupportTicket.class)
            .setParameter("u", actor.getId()).getResultList();
        return page(all, q, category, tab, from, to, page, size, false, actor, null, null, null);
    }

    @Transactional(readOnly = true)
    public SupportDtos.Page queue(String q, String category, String tab, Instant from, Instant to, int page, int size,
        Long farmId, String priority, String assignment) {
        AppUser actor = platform.requireRole(PlatformRole.CS).user();
        List<SupportTicket> all = em.createQuery("select t from SupportTicket t order by t.updatedAt desc,t.id desc", SupportTicket.class).getResultList();
        return page(all, q, category, tab, from, to, page, size, true, actor, farmId, priority, assignment);
    }

    @Transactional(readOnly = true)
    public SupportDtos.Ticket get(Long id, boolean cs) {
        AppUser actor = cs ? platform.requireRole(PlatformRole.CS).user() : requireOwner();
        SupportTicket t = find(id, false);
        if (!cs) requester(t, actor);
        return view(t, cs, actor);
    }

    /** Also called inside the idempotency transaction before a cached assigned-CS command can be returned. */
    public void requireAssigned(Long id) { assigned(find(id, true)); }
    public void requireRequester(Long id) { requester(find(id, true), requireOwner()); }

    public SupportDtos.Ticket reply(Long id, SupportDtos.Reply r, boolean cs, boolean internalNote) {
        SupportTicket t = find(id, true);
        AppUser actor = cs ? assigned(t) : requireOwner();
        if (!cs) requester(t, actor);
        writable(t); VersionGuard.requireExpected(t.getVersion(), r.expectedVersion());
        if (internalNote && !cs) throw DomainException.forbidden(MessageCodes.COM_01);
        String prior = t.getStatus();
        message(t, actor, cs ? "CS" : "OWNER", internalNote ? "NOTE" : "REPLY", internalNote ? "CS_ONLY" : "PUBLIC", text(r.content(), 3000, "content"));
        if (!cs && "WAITING_CUSTOMER".equals(prior)) t.setStatus("IN_PROGRESS");
        history(t, actor, internalNote ? "INTERNAL_NOTE" : "PUBLIC_REPLY", prior, null, Map.of());
        changed(t, actor, internalNote ? "SUPPORT_NOTE" : "SUPPORT_REPLY");
        if (!internalNote) { if (cs) notifyOwner(t, "reply"); else notifyCs(t, "reply"); }
        return view(t, cs, actor);
    }

    public SupportDtos.Ticket process(Long id, SupportDtos.Processing r) {
        AppUser actor = platform.requireRole(PlatformRole.CS).user();
        SupportTicket t = find(id, true); writable(t);
        VersionGuard.requireExpected(t.getVersion(), r.expectedVersion());
        String prior = t.getStatus();
        if ("CLAIM".equals(r.action())) {
            if (available(t.getAssignedCs(), PlatformRole.CS)) throw DomainException.conflict(MessageCodes.COM_05);
            t.setAssignedCs(actor);
            if ("OPEN".equals(prior)) t.setStatus("IN_PROGRESS");
        } else {
            assigned(t);
            switch (r.action()) {
                case "HANDOVER" -> {
                    text(r.reason(), 1000, "reason"); AppUser next = staff(r.recipientId(), PlatformRole.CS);
                    if (next.equals(actor)) throw DomainException.invalid("recipientId");
                    t.setAssignedCs(next);
                }
                case "RELEASE" -> { text(r.reason(), 1000, "reason"); t.setAssignedCs(null); }
                case "CLASSIFY" -> {
                    if (r.category() == null && r.priority() == null) throw DomainException.required("classification");
                    if (r.category() != null) { if (!CATEGORIES.contains(r.category())) throw DomainException.invalid("category"); t.setCategory(r.category()); }
                    if (r.priority() != null) { if (!PRIORITIES.contains(r.priority())) throw DomainException.invalid("priority"); t.setPriority(r.priority()); }
                }
                case "ASK_CUSTOMER" -> {
                    if (!Set.of("OPEN", "IN_PROGRESS", "WAITING_CUSTOMER").contains(prior)) throw DomainException.conflict(MessageCodes.COM_05);
                    message(t, actor, "CS", "QUESTION", "PUBLIC", text(r.question(), 3000, "question"));
                    t.setStatus("WAITING_CUSTOMER");
                }
                default -> throw DomainException.invalid("action");
            }
        }
        history(t, actor, r.action(), prior, r.reason(), Map.of()); changed(t, actor, "SUPPORT_PROCESS");
        notifyOwner(t, "process"); notifyCs(t, "process");
        return view(t, true, actor);
    }

    public SupportDtos.Ticket resolve(Long id, SupportDtos.Resolution r) {
        SupportTicket t = find(id, true); AppUser actor = assigned(t); writable(t);
        VersionGuard.requireExpected(t.getVersion(), r.expectedVersion());
        if (!Set.of("OPEN", "IN_PROGRESS", "WAITING_CUSTOMER").contains(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        requireNoOpenRequest(t); String prior = t.getStatus(); supersedeAcknowledgments(t);
        TicketResolution resolution = new TicketResolution(); resolution.ticket = t;
        resolution.versionNo = t.getLatestResolutionVersion() + 1; resolution.content = text(r.content(), 3000, "content");
        resolution.resolvedBy = actor; resolution.resolvedAt = clock.now(); em.persist(resolution);
        t.setLatestResolutionVersion(resolution.versionNo); t.setStatus("RESOLVED");
        message(t, actor, "CS", "RESOLUTION", "PUBLIC", resolution.content);
        history(t, actor, "RESOLVED", prior, null, Map.of("resolutionVersion", resolution.versionNo));
        changed(t, actor, "SUPPORT_RESOLVE"); notifyOwner(t, "resolved"); return view(t, true, actor);
    }

    public SupportDtos.Ticket acknowledge(Long id, SupportDtos.Acknowledge r) {
        AppUser actor = requireOwner(); SupportTicket t = find(id, true); requester(t, actor);
        if (!Objects.equals(t.getLatestResolutionVersion(), r.resolutionVersion())) throw DomainException.conflict("MSG-FE20-05");
        if (!"RESOLVED".equals(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        TicketResolution resolution = latestResolution(t);
        ResolutionAcknowledgment existing = acknowledgment(resolution);
        // A repeated confirmation is a successful no-op, including when the displayed ticket version is now old.
        if (existing != null && "EFFECTIVE".equals(existing.status)) return view(t, false, actor);
        VersionGuard.requireExpected(t.getVersion(), r.expectedVersion());
        ResolutionAcknowledgment ack = new ResolutionAcknowledgment(); ack.resolution = resolution;
        ack.requester = actor; ack.confirmedAt = clock.now(); ack.comment = optionalText(r.comment(), 1000, "comment"); em.persist(ack);
        message(t, actor, "OWNER", "ACKNOWLEDGMENT", "PUBLIC", "Đã xác nhận kết quả giải quyết phiên bản " + resolution.versionNo +
            (ack.comment == null ? "." : ": " + ack.comment));
        history(t, actor, "ACKNOWLEDGED", t.getStatus(), null, Map.of("resolutionVersion", resolution.versionNo));
        changed(t, actor, "SUPPORT_ACKNOWLEDGE"); notifyCs(t, "acknowledged"); return view(t, false, actor);
    }

    public SupportDtos.Ticket reopen(Long id, SupportDtos.Reopen r) {
        AppUser actor = requireOwner(); SupportTicket t = find(id, true); requester(t, actor); writable(t);
        VersionGuard.requireExpected(t.getVersion(), r.expectedVersion());
        if (!"RESOLVED".equals(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        String reason = text(r.reason(), 1000, "reason"); supersedeAcknowledgments(t); t.setStatus("OPEN");
        if (!available(t.getAssignedCs(), PlatformRole.CS)) t.setAssignedCs(null);
        message(t, actor, "OWNER", "REOPEN", "PUBLIC", reason);
        history(t, actor, "REOPENED", "RESOLVED", reason, Map.of()); changed(t, actor, "SUPPORT_REOPEN");
        notifyCs(t, "reopened"); return view(t, false, actor);
    }

    public SupportDtos.Ticket close(Long id, SupportDtos.Close r) {
        SupportTicket t = find(id, true); AppUser actor = assigned(t); writable(t);
        VersionGuard.requireExpected(t.getVersion(), r.expectedVersion());
        if (!"RESOLVED".equals(t.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        requireNoOpenRequest(t); ResolutionAcknowledgment ack = acknowledgment(latestResolution(t));
        if (ack == null || !"EFFECTIVE".equals(ack.status)) throw DomainException.unprocessable("MSG-FE20-13");
        if (!r.reviewedAcknowledgment()) throw DomainException.unprocessable(MessageCodes.COM_16);
        ack.reviewedBy = actor; ack.reviewedAt = clock.now(); t.setStatus("CLOSED");
        history(t, actor, "CLOSED", "RESOLVED", optionalText(r.note(), 500, "note"),
            Map.of("resolutionVersion", t.getLatestResolutionVersion(), "acknowledgmentId", ack.id));
        changed(t, actor, "SUPPORT_CLOSE"); notifyOwner(t, "closed"); return view(t, true, actor);
    }

    /** Called by a scheduled job: loss of staff access returns work to the queue without changing ticket state. */
    public int requeueUnavailable() {
        int count = 0;
        List<SupportTicket> tickets = em.createQuery("select t from SupportTicket t where t.assignedCs is not null and t.status<>'CLOSED'", SupportTicket.class)
            .setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        for (SupportTicket t : tickets) if (!available(t.getAssignedCs(), PlatformRole.CS)) {
            t.setAssignedCs(null); t.setUpdatedAt(clock.now());
            history(t, null, "AUTO_REQUEUE", t.getStatus(), null, Map.of("actorType", "SYSTEM"));
            outbox.enqueue(t.getFarm() == null ? null : t.getFarm().getId(), "SUPPORT_REQUEUED", "SupportTicket", t.getId(), Map.of());
            em.flush(); notifyCs(t, "requeued"); count++;
        }
        return count;
    }

    AppUser requireOwner() {
        AppUser actor = accounts.currentActiveUser();
        if (!actor.isOwnerRegistrationCompleted()) throw DomainException.forbidden(MessageCodes.COM_01);
        return actor;
    }
    SupportTicket find(Long id, boolean lock) {
        SupportTicket t = lock ? em.find(SupportTicket.class, id, LockModeType.PESSIMISTIC_WRITE) : em.find(SupportTicket.class, id);
        if (t == null) throw DomainException.notFound(MessageCodes.COM_08); return t;
    }
    AppUser assigned(SupportTicket t) {
        AppUser actor = platform.requireRole(PlatformRole.CS).user();
        if (t.getAssignedCs() == null || !t.getAssignedCs().equals(actor)) throw DomainException.forbidden("MSG-FE20-09");
        return actor;
    }
    void requester(SupportTicket t, AppUser actor) {
        if (!t.getRequester().equals(actor)) throw DomainException.notFound(MessageCodes.COM_08);
    }
    void writable(SupportTicket t) { if ("CLOSED".equals(t.getStatus())) throw DomainException.conflict("MSG-FE20-06"); }
    boolean available(AppUser user, PlatformRole role) {
        if (user == null || !"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) return false;
        long n = em.createQuery("select count(p) from PlatformStaffAccess p where p.user.id=:u and upper(p.status)='ACTIVE' and upper(p.role)=:r", Long.class)
            .setParameter("u", user.getId()).setParameter("r", role.name()).getSingleResult();
        if (n == 0) return false;
        return em.createQuery("select count(u) from User u where lower(u.email)=:e and u.activated=false", Long.class)
            .setParameter("e", user.getEmail().toLowerCase(Locale.ROOT)).getSingleResult() == 0;
    }
    AppUser staff(Long id, PlatformRole role) {
        AppUser user = id == null ? null : em.find(AppUser.class, id);
        if (!available(user, role)) throw DomainException.notFound(MessageCodes.COM_08); return user;
    }
    void requireNoOpenRequest(SupportTicket t) {
        if (em.createQuery("select count(r) from InternalRequest r where r.ticket.id=:t and r.state='OPEN'", Long.class)
            .setParameter("t", t.getId()).getSingleResult() != 0) throw DomainException.unprocessable("MSG-FE20-12");
    }
    void history(SupportTicket t, AppUser actor, String type, String prior, String reason, Map<String, ?> details) {
        SupportHistory h = new SupportHistory(); h.setTicket(t); h.setActor(actor); h.setEventType(type);
        h.setPriorState(prior); h.setNewState(t.getStatus()); h.setOccurredAt(clock.now()); h.setReason(reason);
        h.setDetails(JsonSupport.toJson(details)); em.persist(h);
    }
    void changed(SupportTicket t, AppUser actor, String action) {
        Instant now = clock.now();
        // Replies and internal requests must advance the aggregate version even within the same clock tick.
        t.setUpdatedAt(t.getUpdatedAt() != null && !now.isAfter(t.getUpdatedAt()) ? t.getUpdatedAt().plusNanos(1000) : now); em.flush();
        audit.log(t.getFarm(), actor, action, "SupportTicket", t.getId(), Map.of("status", t.getStatus()));
        outbox.enqueue(t.getFarm() == null ? null : t.getFarm().getId(), "SUPPORT_UPDATED", "SupportTicket", t.getId(), Map.of("action", action));
    }
    private void message(SupportTicket t, AppUser actor, String role, String type, String audience, String content) {
        TicketMessage m = new TicketMessage(); m.setTicket(t); m.setAuthor(actor); m.setAuthorRole(role);
        m.setType(type); m.setAudience(audience); m.setContent(content); m.setCreatedAt(clock.now()); em.persist(m);
    }
    private void supersedeAcknowledgments(SupportTicket t) {
        em.createQuery("select a from ResolutionAcknowledgment a where a.resolution.ticket.id=:t and a.status='EFFECTIVE'", ResolutionAcknowledgment.class)
            .setParameter("t", t.getId()).getResultList().forEach(a -> a.status = "SUPERSEDED");
    }
    private TicketResolution latestResolution(SupportTicket t) {
        return em.createQuery("select r from TicketResolution r where r.ticket.id=:t and r.versionNo=:v", TicketResolution.class)
            .setParameter("t", t.getId()).setParameter("v", t.getLatestResolutionVersion()).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.conflict(MessageCodes.COM_05));
    }
    private ResolutionAcknowledgment acknowledgment(TicketResolution r) {
        return em.createQuery("select a from ResolutionAcknowledgment a where a.resolution.id=:r", ResolutionAcknowledgment.class)
            .setParameter("r", r.id).getResultStream().findFirst().orElse(null);
    }
    private void notifyOwner(SupportTicket t, String event) {
        notice(t.getRequester(), t, event); mail.queueSupportTicketUpdate(t.getId());
    }
    void notifyCs(SupportTicket t, String event) {
        if (available(t.getAssignedCs(), PlatformRole.CS)) notice(t.getAssignedCs(), t, event);
        else em.createQuery("select p.user from PlatformStaffAccess p where upper(p.role)='CS' and upper(p.status)='ACTIVE'", AppUser.class)
            .getResultList().stream().filter(u -> available(u, PlatformRole.CS)).forEach(u -> notice(u, t, event));
    }
    private void notice(AppUser user, SupportTicket t, String event) {
        notifications.notify(user, "SUPPORT", "SUPPORT_TICKET", t.getId(), "Cập nhật yêu cầu " + t.getCode(),
            "Trạng thái: " + t.getStatus(), "support:" + t.getId() + ":" + event + ":" + t.getVersion());
    }

    private SupportDtos.Page page(List<SupportTicket> all, String q, String category, String tab, Instant from, Instant to,
        int page, int size, boolean cs, AppUser actor, Long farmId, String priority, String assignment) {
        if (page < 0 || page > 100000 || size < 1 || size > 100) throw DomainException.invalid("pagination");
        if (from != null && to != null && to.isBefore(from)) throw DomainException.invalid("period");
        if (category != null && !CATEGORIES.contains(category)) throw DomainException.invalid("category");
        if (priority != null && !PRIORITIES.contains(priority)) throw DomainException.invalid("priority");
        String search = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<SupportTicket> base = all.stream().filter(t -> category == null || category.equals(t.getCategory()))
            .filter(t -> farmId == null || t.getFarm() != null && farmId.equals(t.getFarm().getId()))
            .filter(t -> priority == null || priority.equals(t.getPriority()))
            .filter(t -> from == null || t.getUpdatedAt() != null && !t.getUpdatedAt().isBefore(from))
            .filter(t -> to == null || t.getUpdatedAt() != null && !t.getUpdatedAt().isAfter(to))
            .filter(t -> search.isEmpty() || (Objects.toString(t.getCode(), "") + " " + Objects.toString(t.getSubject(), "") +
                (cs ? " " + t.getRequester().getFullName() : "")).toLowerCase(Locale.ROOT).contains(search))
            .filter(t -> assignment == null || switch (assignment) {
                case "UNASSIGNED" -> !available(t.getAssignedCs(), PlatformRole.CS);
                case "UNAVAILABLE" -> t.getAssignedCs() != null && !available(t.getAssignedCs(), PlatformRole.CS);
                case "MINE" -> actor.equals(t.getAssignedCs());
                default -> throw DomainException.invalid("assignment");
            }).toList();
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String key : List.of("ALL", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED", "UNASSIGNED", "MINE"))
            counts.put(key, base.stream().filter(t -> tabMatches(t, key, actor)).count());
        List<SupportTicket> filtered = base.stream().filter(t -> tabMatches(t, tab == null ? "ALL" : tab, actor)).toList();
        int start = Math.min(page * size, filtered.size());
        return new SupportDtos.Page(filtered.subList(start, Math.min(start + size, filtered.size())).stream()
            .map(t -> view(t, cs, actor, false)).toList(), filtered.size(), page, size, counts);
    }
    private boolean tabMatches(SupportTicket t, String tab, AppUser actor) {
        return switch (tab) {
            case "ALL" -> true;
            case "IN_PROGRESS" -> Set.of("OPEN", "IN_PROGRESS").contains(t.getStatus());
            case "WAITING" -> "WAITING_CUSTOMER".equals(t.getStatus());
            case "RESOLVED", "CLOSED" -> tab.equals(t.getStatus());
            case "UNASSIGNED" -> !"CLOSED".equals(t.getStatus()) && !available(t.getAssignedCs(), PlatformRole.CS);
            case "MINE" -> actor.equals(t.getAssignedCs());
            default -> throw DomainException.invalid("tab");
        };
    }
    private SupportDtos.Ticket view(SupportTicket t, boolean cs, AppUser actor) { return view(t, cs, actor, true); }
    private SupportDtos.Ticket view(SupportTicket t, boolean cs, AppUser actor, boolean detail) {
        boolean assignee = cs && actor.equals(t.getAssignedCs());
        List<SupportDtos.Message> messages = detail ? em.createQuery("select m from TicketMessage m where m.ticket.id=:t order by m.createdAt,m.id", TicketMessage.class)
            .setParameter("t", t.getId()).getResultList().stream().filter(m -> cs || "PUBLIC".equals(m.getAudience()))
            .map(m -> new SupportDtos.Message(m.getId(), m.getType(), m.getAudience(), m.getAuthor().getId(), m.getAuthor().getFullName(),
                m.getAuthorRole(), m.getContent(), m.getCreatedAt())).toList() : List.of();
        List<SupportDtos.ResolutionView> resolutions = detail ? em.createQuery("select r from TicketResolution r where r.ticket.id=:t order by r.versionNo desc", TicketResolution.class)
            .setParameter("t", t.getId()).getResultList().stream().map(r -> {
                ResolutionAcknowledgment a = acknowledgment(r);
                return new SupportDtos.ResolutionView(r.id, r.versionNo, r.content, r.resolvedBy.getFullName(), r.resolvedAt,
                    a != null && "EFFECTIVE".equals(a.status), a == null ? null : a.confirmedAt, a == null ? null : a.comment, a != null && a.reviewedAt != null);
            }).toList() : List.of();
        List<Map<String, Object>> history = new ArrayList<>();
        if (detail) for (SupportHistory h : em.createQuery("select h from SupportHistory h where h.ticket.id=:t order by h.occurredAt,h.id", SupportHistory.class)
            .setParameter("t", t.getId()).getResultList()) {
            if (h.getEventType().startsWith("IR_") && !assignee || !cs && "INTERNAL_NOTE".equals(h.getEventType())) continue;
            Map<String, Object> row = new LinkedHashMap<>(); row.put("time", h.getOccurredAt()); row.put("status", h.getNewState());
            if (cs) { row.put("event", h.getEventType()); row.put("reason", h.getReason()); row.put("actor", h.getActor() == null ? "SYSTEM" : h.getActor().getFullName()); }
            history.add(row);
        }
        List<SupportDtos.InternalView> requests = assignee && detail ? em.createQuery("select r from InternalRequest r where r.ticket.id=:t order by r.createdAt,r.id", InternalRequest.class)
            .setParameter("t", t.getId()).getResultList().stream().map(this::internalView).toList() : List.of();
        AppUser csUser = available(t.getAssignedCs(), PlatformRole.CS) ? t.getAssignedCs() : null;
        return new SupportDtos.Ticket(t.getId(), t.getCode(), t.getSubject(), t.getCategory(), t.getPriority(), t.getStatus(),
            t.getFarm() == null ? null : t.getFarm().getId(), t.getFarm() == null ? null : t.getFarm().getName(),
            t.getRequester().getId(), t.getRequester().getFullName(), csUser == null ? null : csUser.getId(), csUser == null ? null : csUser.getFullName(),
            t.getCreatedAt(), t.getUpdatedAt(), t.getVersion(), messages, resolutions, history, requests);
    }
    SupportDtos.InternalView internalView(InternalRequest r) {
        List<SupportDtos.ContextReference> context = r.getContextJson() == null ? List.of() : Arrays.asList(JsonSupport.fromJson(r.getContextJson(), SupportDtos.ContextReference[].class));
        SupportTicket t = r.getTicket();
        return new SupportDtos.InternalView(r.getId(), r.getCode(), t.getId(), t.getCode(), t.getFarm() == null ? null : t.getFarm().getId(),
            t.getFarm() == null ? null : t.getFarm().getName(), r.getTargetRole(), r.getRecipient().getId(), r.getRecipient().getFullName(),
            r.getCreatedBy() == null ? null : r.getCreatedBy().getFullName(), r.getCreatedAt(), r.getQuestion(), context, r.getState(), r.getOutcome(),
            r.getResultText(), r.getDomainAudit() == null ? null : r.getDomainAudit().getId(), r.getCompletedAt(), r.getVersion());
    }
    static String text(String value, int max, String field) {
        if (value == null || value.isBlank()) throw DomainException.required(field);
        String trimmed = value.trim(); if (trimmed.length() > max) throw DomainException.invalid(field); return trimmed;
    }
    static String optionalText(String value, int max, String field) { return value == null || value.isBlank() ? null : text(value, max, field); }
}
