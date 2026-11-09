package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;

/**
 * FE-02 Platform Manager farm service (SCR-12): the overview (UC-FE02-04) and the audited suspend / restore commands
 * (UC-FE02-05). Only service data is returned (GBR-11). Suspension and payment stay independent (GBR-15): suspending
 * keeps every purchased period, restoring derives the status from the subscription again. The farm service history is
 * the append-only audit entry written in the same transaction (BR-D29, decision 08/11/2026).
 */
@Service
public class PlatformFarmService {
    private static final String SUSPENDED = "SUSPENDED";
    private static final Map<String, String> STATUS_LABEL = Map.of(
        "ACTIVE", "Đang hoạt động",
        "PENDING_PAYMENT", "Chờ thanh toán",
        "EXPIRED", "Đã hết hạn",
        SUSPENDED, "Tạm ngưng"
    );
    private static final int SUMMARY_LIMIT = 500;

    private final PlatformAccessService access;
    private final FarmRepository farms;
    private final AuditLogRepository auditLogs;
    private final NotificationService notifications;
    private final FarmServiceFacts facts;

    public PlatformFarmService(
        PlatformAccessService access,
        FarmRepository farms,
        AuditLogRepository auditLogs,
        NotificationService notifications,
        FarmServiceFacts facts
    ) {
        this.access = access;
        this.farms = farms;
        this.auditLogs = auditLogs;
        this.notifications = notifications;
        this.facts = facts;
    }

    /**
     * UC-FE02-04: tiles count every farm by status, whatever the search; the search (farm name or Owner email) and the
     * status filter narrow the list, which is sorted by {@code name}, {@code status} or {@code coverageEnd}
     * (prefix {@code -} for descending; farms without an end come last) and paged.
     */
    @Transactional(readOnly = true)
    public FarmServicePage overview(String query, String serviceStatus, String sort, int page, int size) {
        access.requireRole(PlatformRole.PM);
        Comparator<FarmOverview> order = order(sort);
        String needle = StringUtils.hasText(query) ? query.trim().toLowerCase(Locale.ROOT) : null;
        String status = StringUtils.hasText(serviceStatus) ? serviceStatus.trim().toUpperCase(Locale.ROOT) : null;
        Specification<Farm> filter = (root, criteria, cb) -> {
            var filters = new ArrayList<jakarta.persistence.criteria.Predicate>();
            if (status != null) filters.add(cb.equal(cb.upper(root.get("serviceStatus")), status));
            if (needle != null) {
                String like = "%" + needle.replace("%", "\\%").replace("_", "\\_") + "%";
                var ownerQuery = criteria.subquery(Long.class);
                var owner = ownerQuery.from(FarmMembership.class);
                ownerQuery
                    .select(owner.get("farm").get("id"))
                    .where(
                        cb.equal(owner.get("farm").get("id"), root.get("id")),
                        cb.equal(cb.upper(owner.get("role")), "OWNER"),
                        cb.equal(cb.upper(owner.get("status")), "ACTIVE"),
                        cb.like(cb.lower(owner.get("user").get("email")), like, '\\')
                    );
                filters.add(cb.or(cb.like(cb.lower(root.get("name")), like, '\\'), cb.exists(ownerQuery)));
            }
            return cb.and(filters.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        List<FarmOverview> rows = new ArrayList<>(overviews(farms.findAll(filter)));
        rows.sort(order);
        int safeSize = Math.max(1, Math.min(100, size));
        int from = Math.min(Math.max(0, page) * safeSize, rows.size());
        return new FarmServicePage(tiles(), List.copyOf(rows.subList(from, Math.min(from + safeSize, rows.size()))), rows.size());
    }

    /** Popup "Suspend / Restore Farm Service": farm, Owner, herd size, status, purchased period, last suspension, status after restore. */
    @Transactional(readOnly = true)
    public FarmServicePreview preview(Long farmId) {
        access.requireRole(PlatformRole.PM);
        Farm farm = farms.findById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        List<Long> ids = List.of(farmId);
        AppUser owner = facts.owners(ids).get(farmId);
        Instant latestEnd = facts.latestEnd(ids).get(farmId);
        FarmServiceFacts.Suspension suspension = suspended(farm) ? facts.lastSuspension(ids).get(farmId) : null;
        FarmServiceFacts.Period period = facts.currentPeriod(farmId).orElse(null);
        return new FarmServicePreview(
            farm.getId(),
            farm.getName(),
            owner == null ? null : owner.getFullName(),
            owner == null ? null : owner.getEmail(),
            facts.activeCattle(ids).getOrDefault(farmId, 0L),
            farm.getServiceStatus(),
            suspension == null ? null : suspension.at(),
            suspension == null ? null : suspension.byName(),
            suspension == null ? null : suspension.reason(),
            period == null ? null : period.start(),
            period == null ? null : period.end(),
            latestEnd,
            facts.statusFromSubscription(latestEnd),
            farm.getVersion()
        );
    }

    /** UC-FE02-05 suspend: any farm not yet SUSPENDED, PENDING_PAYMENT included (PRE-2, TC-02-26). */
    @Transactional
    public FarmOverview suspend(Long farmId, ServiceChange request) {
        AppUser actor = access.requireRole(PlatformRole.PM).user();
        validate(request);
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if (suspended(farm)) throw alreadyIn(farm);
        VersionGuard.requireExpected(farm.getVersion(), request.version());
        String before = farm.getServiceStatus();
        farm.setServiceStatus(SUSPENDED);
        farms.saveAndFlush(farm);
        recordAndNotify(actor, farm, FarmServiceFacts.SUSPEND_ACTION, before, SUSPENDED, request.reason());
        return summary(farm);
    }

    /** UC-FE02-05 restore: only a SUSPENDED farm; the status follows the subscription again and no period changes. */
    @Transactional
    public FarmOverview restore(Long farmId, ServiceChange request) {
        AppUser actor = access.requireRole(PlatformRole.PM).user();
        validate(request);
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        if (!suspended(farm)) throw alreadyIn(farm);
        VersionGuard.requireExpected(farm.getVersion(), request.version());
        String before = farm.getServiceStatus();
        String after = facts.statusFromSubscription(facts.latestEnd(List.of(farmId)).get(farmId));
        farm.setServiceStatus(after);
        farms.saveAndFlush(farm);
        recordAndNotify(actor, farm, FarmServiceFacts.RESTORE_ACTION, before, after, request.reason());
        return summary(farm);
    }

    private static boolean suspended(Farm farm) {
        return SUSPENDED.equalsIgnoreCase(farm.getServiceStatus());
    }

    /** E3: MSG-FE02-09, before any write, so no new history entry is created. */
    private static DomainException alreadyIn(Farm farm) {
        return DomainException.conflict(MessageCodes.FE02_09, "farm", farm.getName(), "status", farm.getServiceStatus());
    }

    private FarmServiceTiles tiles() {
        Map<String, Long> counts = facts.farmsByStatus();
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        long active = counts.getOrDefault("ACTIVE", 0L);
        return new FarmServiceTiles(
            total,
            active,
            total == 0 ? 0 : Math.round(active * 100.0 / total),
            counts.getOrDefault("PENDING_PAYMENT", 0L),
            counts.getOrDefault("EXPIRED", 0L),
            counts.getOrDefault(SUSPENDED, 0L)
        );
    }

    private List<FarmOverview> overviews(List<Farm> list) {
        List<Long> ids = list.stream().map(Farm::getId).toList();
        Map<Long, AppUser> owners = facts.owners(ids);
        Map<Long, Instant> ends = facts.latestEnd(ids);
        Map<Long, Long> cattle = facts.activeCattle(ids);
        Map<Long, FarmServiceFacts.Suspension> suspensions = facts.lastSuspension(list.stream().filter(PlatformFarmService::suspended).map(Farm::getId).toList());
        return list.stream().map(farm -> overview(farm, owners.get(farm.getId()), ends.get(farm.getId()), cattle.getOrDefault(farm.getId(), 0L), suspensions.get(farm.getId()))).toList();
    }

    private FarmOverview summary(Farm farm) {
        return overviews(List.of(farm)).get(0);
    }

    private static FarmOverview overview(Farm farm, AppUser owner, Instant coverageEnd, long activeCattle, FarmServiceFacts.Suspension suspension) {
        return new FarmOverview(
            farm.getId(),
            farm.getName(),
            owner == null ? null : owner.getId(),
            owner == null ? null : owner.getFullName(),
            owner == null ? null : owner.getEmail(),
            farm.getServiceStatus(),
            coverageEnd,
            suspended(farm),
            suspension == null ? null : suspension.at(),
            activeCattle,
            farm.getVersion()
        );
    }

    private static Comparator<FarmOverview> order(String sort) {
        String key = StringUtils.hasText(sort) ? sort.trim() : "name";
        boolean descending = key.startsWith("-");
        if (descending) key = key.substring(1);
        Comparator<FarmOverview> byName = Comparator.comparing(row -> row.farmName() == null ? "" : row.farmName().toLowerCase(Locale.ROOT));
        Comparator<FarmOverview> base = switch (key) {
            case "name" -> byName;
            case "status" -> Comparator.comparing(row -> row.serviceStatus() == null ? "" : row.serviceStatus());
            case "coverageEnd" -> Comparator.comparing(FarmOverview::coverageEnd, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> throw DomainException.invalid("sort");
        };
        if (descending) {
            base = "coverageEnd".equals(key)
                ? Comparator.comparing(FarmOverview::coverageEnd, Comparator.nullsLast(Comparator.<Instant>reverseOrder()))
                : base.reversed();
        }
        return base.thenComparing(byName).thenComparing(FarmOverview::farmId);
    }

    private void recordAndNotify(AppUser actor, Farm farm, String action, String before, String after, String reason) {
        AuditLog event = new AuditLog();
        event.setFarm(farm);
        event.setActor(actor);
        event.setAction(action);
        event.setTargetType("Farm");
        event.setTargetId(farm.getId());
        event.setLoggedAt(facts.now());
        event.setDetails(JsonSupport.toJson(Map.of("statusBefore", before, "statusAfter", after, "reason", reason.trim())));
        auditLogs.save(event);
        String summary = "Dịch vụ của " + farm.getName() + " hiện là " + STATUS_LABEL.getOrDefault(after, after) + ". Lý do: " + reason.trim();
        AppUser owner = facts.owners(List.of(farm.getId())).get(farm.getId());
        if (owner != null) {
            notifications.notify(
                owner,
                "service",
                "Farm",
                farm.getId(),
                "Dịch vụ trang trại đã thay đổi",
                summary.length() <= SUMMARY_LIMIT ? summary : summary.substring(0, SUMMARY_LIMIT - 1) + "…",
                action + ":" + farm.getId() + ":" + farm.getVersion()
            );
        }
    }

    private static void validate(ServiceChange request) {
        if (request == null || !StringUtils.hasText(request.reason())) throw DomainException.required("reason");
        if (request.reason().trim().length() > 500) throw DomainException.invalid("reason");
    }

    public record ServiceChange(String reason, Integer version) {}

    /** SCR-12 tiles: every farm, by service status (UC-FE02-04). */
    public record FarmServiceTiles(long total, long active, long activePercent, long pendingPayment, long expired, long suspended) {}

    public record FarmServicePage(FarmServiceTiles tiles, List<FarmOverview> items, long total) {}

    /** One SCR-12 row; {@code coverageEnd} is the latest confirmed end. Service data only (GBR-11). */
    public record FarmOverview(
        Long farmId,
        String farmName,
        Long ownerId,
        String ownerName,
        String ownerEmail,
        String serviceStatus,
        Instant coverageEnd,
        boolean suspended,
        Instant suspendedAt,
        long activeCattle,
        Integer version
    ) {}

    /** The popup of UC-FE02-05; {@code periodStart}/{@code periodEnd} is the purchased period covering now, if any. */
    public record FarmServicePreview(
        Long farmId,
        String farmName,
        String ownerName,
        String ownerEmail,
        long activeCattle,
        String serviceStatus,
        Instant suspendedAt,
        String suspendedBy,
        String previousReason,
        Instant periodStart,
        Instant periodEnd,
        Instant coverageEnd,
        String statusAfterRestore,
        Integer version
    ) {}
}
