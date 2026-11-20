package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.PlatformAuditCatalog.Action;
import vn.edu.fpt.beefcare.service.PlatformAuditCatalog.TargetType;

/**
 * UC-FE17-01 / SCR-51 (D34): the SA searches the central audit and opens one entry. Only the GBR-86 actions of
 * {@link PlatformAuditCatalog} are visible, with allowlisted before / after values; there is no route to change or delete
 * an entry (NFR-S11). Names are read as scalar columns, so no account entity (and its staff access) is loaded per row.
 */
@Service
public class PlatformAuditQueryService {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;
    private static final int MAX_RANGE_MONTHS = 12;
    private static final int MAX_ACTOR_QUERY = 254;

    private final PlatformAccessService platformAccess;
    private final EntityManager em;
    private final FarmClock clock;

    public PlatformAuditQueryService(PlatformAccessService platformAccess, EntityManager em, FarmClock clock) {
        this.platformAccess = platformAccess;
        this.em = em;
        this.clock = clock;
    }

    /**
     * A1. {@code from}/{@code to} are farm-zone calendar days, both included, at most 12 months apart. {@code actor}
     * matches part of the name or email; {@code system} keeps the actions without an actor ("System").
     */
    @Transactional(readOnly = true)
    public AuditPage search(LocalDate from, LocalDate to, String actor, boolean system, String action, String targetType, int page, int size, String dir) {
        platformAccess.requireRole(PlatformRole.SA);
        if (from == null) throw DomainException.required("from");
        if (to == null) throw DomainException.required("to");
        if (from.isAfter(to)) throw DomainException.badRequest(MessageCodes.COM_11, "field", "dateRange");
        if (to.isAfter(from.plusMonths(MAX_RANGE_MONTHS))) throw DomainException.invalid("dateRange");
        Action selectedAction = blank(action) ? null : PlatformAuditCatalog.byCode(action).orElseThrow(() -> DomainException.invalid("action"));
        TargetType selectedType = blank(targetType) ? null : targetType(targetType);
        String text = actor == null ? "" : actor.trim();
        if (text.length() > MAX_ACTOR_QUERY) throw DomainException.invalid("actor");
        if (system && !text.isEmpty()) throw DomainException.invalid("actor");
        boolean ascending = ascending(dir);
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(MAX_SIZE, size));

        List<Action> selected = PlatformAuditCatalog.select(selectedAction, selectedType);
        if (selected.isEmpty()) return new AuditPage(List.of(), 0, safePage, safeSize);
        ZoneId zone = clock.zone();
        Criteria criteria = new Criteria(from.atStartOfDay(zone).toInstant(), to.plusDays(1).atStartOfDay(zone).toInstant(), selected, text, system);

        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<AuditLog> countRoot = count.from(AuditLog.class);
        Join<AuditLog, AppUser> countActor = countRoot.join("actor", JoinType.LEFT);
        count.select(cb.count(countRoot)).where(criteria.where(cb, countRoot, countActor));
        long total = em.createQuery(count).getSingleResult();
        if (total == 0) return new AuditPage(List.of(), 0, safePage, safeSize);

        CriteriaQuery<Tuple> rows = cb.createTupleQuery();
        Root<AuditLog> root = rows.from(AuditLog.class);
        Join<AuditLog, AppUser> actorJoin = root.join("actor", JoinType.LEFT);
        rows.multiselect(
            root.get("id"), root.get("loggedAt"), root.get("action"), root.get("targetType"), root.get("targetId"), root.get("actorRole"),
            actorJoin.get("id"), actorJoin.get("fullName"), actorJoin.get("email")
        ).where(criteria.where(cb, root, actorJoin)).orderBy(
            ascending ? cb.asc(root.get("loggedAt")) : cb.desc(root.get("loggedAt")),
            ascending ? cb.asc(root.get("id")) : cb.desc(root.get("id"))
        );
        List<Tuple> found = em.createQuery(rows).setFirstResult(safePage * safeSize).setMaxResults(safeSize).getResultList();

        Map<String, Set<Long>> targets = new HashMap<>();
        found.forEach(row -> targets.computeIfAbsent(row.get(3, String.class), key -> new LinkedHashSet<>()).add(row.get(4, Long.class)));
        Map<String, Map<Long, String>> labels = labels(targets);
        List<AuditRow> items = found.stream().map(row -> {
            Action entry = PlatformAuditCatalog.byStored(row.get(2, String.class)).orElseThrow();
            return new AuditRow(
                row.get(0, Long.class),
                row.get(1, Instant.class),
                actor(row.get(6, Long.class), row.get(7, String.class), row.get(8, String.class), row.get(5, String.class)),
                entry.code(),
                entry.targetType().name(),
                label(labels, row.get(3, String.class), row.get(4, Long.class))
            );
        }).toList();
        return new AuditPage(items, total, safePage, safeSize);
    }

    /** A2. A row outside the central catalogue (farm data) is not found, like a missing one. */
    @Transactional(readOnly = true)
    public AuditDetail get(Long id) {
        platformAccess.requireRole(PlatformRole.SA);
        List<Tuple> found = em.createQuery(
            "select a.id, a.loggedAt, a.action, a.targetType, a.targetId, a.actorRole, a.correlationId, a.details, u.id, u.fullName, u.email, f.id, f.name " +
            "from AuditLog a left join a.actor u left join a.farm f where a.id = :id", Tuple.class)
            .setParameter("id", id).getResultList();
        if (found.isEmpty()) throw DomainException.notFound(MessageCodes.COM_08);
        Tuple row = found.get(0);
        Action entry = PlatformAuditCatalog.byStored(row.get(2, String.class)).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        Object parsed = JsonSupport.fromJson(row.get(7, String.class), Object.class);
        PlatformAuditCatalog.Change change = PlatformAuditCatalog.change(entry, parsed instanceof Map<?, ?> map ? map : null);
        String storedType = row.get(3, String.class);
        Long targetId = row.get(4, Long.class);
        Long farmId = row.get(11, Long.class);
        return new AuditDetail(
            row.get(0, Long.class),
            row.get(1, Instant.class),
            actor(row.get(8, Long.class), row.get(9, String.class), row.get(10, String.class), row.get(5, String.class)),
            farmId == null ? null : new AuditFarm(farmId, row.get(12, String.class)),
            entry.code(),
            entry.targetType().name(),
            targetId,
            label(labels(Map.of(storedType, Set.of(targetId))), storedType, targetId),
            change.before(),
            change.after(),
            row.get(6, String.class)
        );
    }

    /** A3. Action codes of the Action filter, in catalogue order. */
    @Transactional(readOnly = true)
    public List<AuditActionOption> actions() {
        platformAccess.requireRole(PlatformRole.SA);
        return PlatformAuditCatalog.actions().stream().map(action -> new AuditActionOption(action.code(), action.targetType().name())).toList();
    }

    private record Criteria(Instant start, Instant end, List<Action> actions, String actorText, boolean system) {
        Predicate[] where(CriteriaBuilder cb, Root<AuditLog> root, Join<AuditLog, AppUser> actor) {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("loggedAt"), start));
            predicates.add(cb.lessThan(root.<Instant>get("loggedAt"), end));
            List<Predicate> codes = new ArrayList<>();
            Set<String> exact = PlatformAuditCatalog.storedCodes(actions);
            if (!exact.isEmpty()) codes.add(root.<String>get("action").in(exact));
            for (String suffix : PlatformAuditCatalog.storedSuffixes(actions)) codes.add(cb.like(root.<String>get("action"), "%" + escapeLike(suffix), '\\'));
            predicates.add(cb.or(codes.toArray(Predicate[]::new)));
            if (system) predicates.add(cb.isNull(root.get("actor")));
            if (!actorText.isEmpty()) {
                String pattern = "%" + escapeLike(actorText.toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(actor.<String>get("fullName")), pattern, '\\'),
                    cb.like(cb.lower(actor.<String>get("email")), pattern, '\\')
                ));
            }
            return predicates.toArray(Predicate[]::new);
        }
    }

    /** Target display names, read per stored target type in one query each (SCR-51 Target: display name or masked identifier). */
    private Map<String, Map<Long, String>> labels(Map<String, Set<Long>> idsByType) {
        Map<String, Map<Long, String>> labels = new HashMap<>();
        idsByType.forEach((type, ids) -> {
            List<Long> keys = ids.stream().filter(java.util.Objects::nonNull).toList();
            if (keys.isEmpty()) return;
            Map<Long, String> byId = new HashMap<>();
            switch (type) {
                case "AppUser" -> rows("select u.id, u.fullName, u.email from AppUser u where u.id in :ids", keys)
                    .forEach(r -> byId.put(r.get(0, Long.class), person(r.get(1, String.class), r.get(2, String.class))));
                case "FarmMembership" -> rows("select m.id, u.fullName, u.email, f.name from FarmMembership m join m.user u join m.farm f where m.id in :ids", keys)
                    .forEach(r -> byId.put(r.get(0, Long.class), person(r.get(1, String.class), r.get(2, String.class)) + " · " + r.get(3, String.class)));
                case "Farm" -> simple("select f.id, f.name from Farm f where f.id in :ids", keys, byId);
                case "Payment" -> simple("select p.id, p.quoteRef from Payment p where p.id in :ids", keys, byId);
                case "EvidenceReview" -> simple("select r.id, p.quoteRef from EvidenceReview r left join r.relatedPayment p where r.id in :ids", keys, byId);
                case "ManualFinanceRecord" -> simple("select r.id, r.recordCode from ManualFinanceRecord r where r.id in :ids", keys, byId);
                case "SupportTicket" -> simple("select t.id, t.code from SupportTicket t where t.id in :ids", keys, byId);
                case "InternalRequest" -> simple("select r.id, r.code from InternalRequest r where r.id in :ids", keys, byId);
                default -> { }
            }
            labels.put(type, byId);
        });
        return labels;
    }

    private List<Tuple> rows(String jpql, List<Long> ids) {
        return em.createQuery(jpql, Tuple.class).setParameter("ids", ids).getResultList();
    }

    private void simple(String jpql, List<Long> ids, Map<Long, String> byId) {
        rows(jpql, ids).forEach(r -> {
            String text = r.get(1, String.class);
            if (!blank(text)) byId.put(r.get(0, Long.class), text.trim());
        });
    }

    private static String label(Map<String, Map<Long, String>> labels, String type, Long id) {
        String text = labels.getOrDefault(type, Map.of()).get(id);
        return text != null ? text : "#" + id;
    }

    private static AuditActor actor(Long id, String fullName, String email, String role) {
        if (id == null) return null;
        return new AuditActor(id, person(fullName, email), initials(fullName, email), role);
    }

    /** The name, or the masked email when the account has no name. */
    static String person(String fullName, String email) {
        if (!blank(fullName)) return fullName.trim();
        return blank(email) ? "—" : maskEmail(email.trim());
    }

    /** "ngovanduc@gmail.com" → "ng***@gmail.com"; a one- or two-letter local part keeps its first letter. */
    static String maskEmail(String email) {
        int at = email.indexOf('@');
        String local = at < 0 ? email : email.substring(0, at);
        String domain = at < 0 ? "" : email.substring(at);
        String kept = local.length() <= 2 ? local.substring(0, Math.min(1, local.length())) : local.substring(0, 2);
        return kept + "***" + domain;
    }

    /** First letters of the first and last words of the name ("Ngô Văn Đức" → "NĐ"); the email's first letter otherwise. */
    static String initials(String fullName, String email) {
        if (!blank(fullName)) {
            String[] words = fullName.trim().split("\\s+");
            String first = words[0].substring(0, 1);
            String last = words.length > 1 ? words[words.length - 1].substring(0, 1) : "";
            return (first + last).toUpperCase(Locale.ROOT);
        }
        return blank(email) ? "?" : email.trim().substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private static TargetType targetType(String value) {
        try {
            return TargetType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException invalid) {
            throw DomainException.invalid("targetType");
        }
    }

    private static boolean ascending(String dir) {
        if (blank(dir) || "desc".equalsIgnoreCase(dir.trim())) return false;
        if ("asc".equalsIgnoreCase(dir.trim())) return true;
        throw DomainException.invalid("dir");
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** One SCR-51 actor; {@code null} in a row means "System". {@code role} is empty for entries written before D34. */
    public record AuditActor(Long id, String name, String initials, String role) {}

    public record AuditRow(Long id, Instant time, AuditActor actor, String action, String targetType, String targetLabel) {}

    public record AuditPage(List<AuditRow> items, long total, int page, int size) {}

    public record AuditFarm(Long id, String name) {}

    public record AuditDetail(
        Long id,
        Instant time,
        AuditActor actor,
        AuditFarm farm,
        String action,
        String targetType,
        Long targetId,
        String targetLabel,
        Map<String, String> before,
        Map<String, String> after,
        String correlationId
    ) {}

    public record AuditActionOption(String code, String targetType) {}
}
