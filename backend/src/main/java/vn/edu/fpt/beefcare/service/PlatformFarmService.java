package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;

/** FE-02 platform farm service overview and audited suspend/restore commands. */
@Service
public class PlatformFarmService {
    private static final String ACTIVE = "ACTIVE";
    private static final String SUSPENDED = "SUSPENDED";
    private final PlatformAccessService access;
    private final FarmRepository farms;
    private final FarmMembershipRepository memberships;
    private final SubscriptionRepository subscriptions;
    private final AuditLogRepository auditLogs;
    private final NotificationService notifications;
    private final FarmClock clock;

    public PlatformFarmService(
        PlatformAccessService access,
        FarmRepository farms,
        FarmMembershipRepository memberships,
        SubscriptionRepository subscriptions,
        AuditLogRepository auditLogs,
        NotificationService notifications,
        FarmClock clock
    ) {
        this.access = access;
        this.farms = farms;
        this.memberships = memberships;
        this.subscriptions = subscriptions;
        this.auditLogs = auditLogs;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<FarmOverview> overview(String query, String serviceStatus, int page, int size) {
        access.requireRole(PlatformRole.PM);
        String needle = StringUtils.hasText(query) ? query.trim().toLowerCase(Locale.ROOT) : null;
        String status = StringUtils.hasText(serviceStatus) ? serviceStatus.trim().toUpperCase(Locale.ROOT) : null;
        Specification<Farm> filter = (root, criteria, cb) -> {
            var filters = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (status != null) filters.add(cb.equal(cb.upper(root.get("serviceStatus")), status));
            if (needle != null) {
                String like = "%" + needle.replace("%", "\\%").replace("_", "\\_") + "%";
                var ownerQuery = criteria.subquery(Long.class);
                var owner = ownerQuery.from(FarmMembership.class);
                ownerQuery.select(owner.get("farm").get("id"))
                    .where(
                        cb.equal(owner.get("farm").get("id"), root.get("id")),
                        cb.equal(cb.upper(owner.get("role")), "OWNER"),
                        cb.equal(cb.upper(owner.get("status")), "ACTIVE"),
                        cb.or(
                            cb.like(cb.lower(owner.get("user").get("email")), like, '\\'),
                            cb.like(cb.lower(owner.get("user").get("fullName")), like, '\\')
                        )
                    );
                filters.add(cb.or(cb.like(cb.lower(root.get("name")), like, '\\'), cb.exists(ownerQuery)));
            }
            return cb.and(filters.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        return farms.findAll(filter, PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "id"))).map(this::summary);
    }

    @Transactional
    public FarmOverview suspend(Long farmId, ServiceChange request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        validate(request);
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(farm.getVersion(), request.version());
        if (SUSPENDED.equalsIgnoreCase(farm.getServiceStatus()) || "PENDING_PAYMENT".equalsIgnoreCase(farm.getServiceStatus())) {
            throw DomainException.conflict(MessageCodes.FE03_20);
        }
        String before = farm.getServiceStatus();
        farm.setServiceStatus(SUSPENDED);
        farms.saveAndFlush(farm);
        recordAndNotify(actor, farm, "FARM_SERVICE_SUSPEND", before, SUSPENDED, request.reason());
        return summary(farm);
    }

    @Transactional
    public FarmOverview restore(Long farmId, ServiceChange request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        validate(request);
        Farm farm = farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(farm.getVersion(), request.version());
        if (!SUSPENDED.equalsIgnoreCase(farm.getServiceStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
        String before = farm.getServiceStatus();
        String after = subscriptions.findFirstByFarm_Id(farmId)
            .map(Subscription::getLatestEnd)
            .filter(end -> end != null && end.isAfter(clock.now()))
            .map(end -> ACTIVE)
            .orElse("EXPIRED");
        farm.setServiceStatus(after);
        farms.saveAndFlush(farm);
        recordAndNotify(actor, farm, "FARM_SERVICE_RESTORE", before, after, request.reason());
        return summary(farm);
    }

    private FarmOverview summary(Farm farm) {
        FarmMembership owner = memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farm.getId(), "OWNER", ACTIVE).orElse(null);
        Subscription subscription = subscriptions.findFirstByFarm_Id(farm.getId()).orElse(null);
        return new FarmOverview(
            farm.getId(),
            farm.getName(),
            owner == null ? null : owner.getUser().getId(),
            owner == null ? null : owner.getUser().getFullName(),
            owner == null ? null : owner.getUser().getEmail(),
            farm.getServiceStatus(),
            subscription == null ? null : subscription.getLatestEnd(),
            farm.getVersion()
        );
    }

    private void recordAndNotify(vn.edu.fpt.beefcare.domain.AppUser actor, Farm farm, String action, String before, String after, String reason) {
        AuditLog event = new AuditLog();
        event.setFarm(farm);
        event.setActor(actor);
        event.setAction(action);
        event.setTargetType("Farm");
        event.setTargetId(farm.getId());
        event.setLoggedAt(clock.now());
        event.setDetails(JsonSupport.toJson(Map.of("statusBefore", before, "statusAfter", after, "reason", reason.trim())));
        auditLogs.save(event);
        memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(farm.getId(), "OWNER", ACTIVE).ifPresent(owner ->
            notifications.notify(
                owner.getUser(),
                "service",
                "Farm",
                farm.getId(),
                "Dịch vụ trang trại đã thay đổi",
                "Trạng thái dịch vụ: " + after + ". Lý do: " + reason.trim(),
                action + ":" + farm.getId() + ":" + farm.getVersion()
            )
        );
    }

    private static void validate(ServiceChange request) {
        if (request == null || !StringUtils.hasText(request.reason())) throw DomainException.required("reason");
        if (request.reason().trim().length() > 500) throw DomainException.invalid("reason");
    }

    public record ServiceChange(String reason, Integer version) {}

    public record FarmOverview(
        Long farmId,
        String farmName,
        Long ownerId,
        String ownerName,
        String ownerEmail,
        String serviceStatus,
        Instant coverageEnd,
        Integer version
    ) {}
}
