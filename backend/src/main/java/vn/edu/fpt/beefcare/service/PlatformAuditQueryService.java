package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;

/** Filtered, append-only platform audit reader. It returns selected DTO fields and allowlisted detail keys only. */
@Service
public class PlatformAuditQueryService {
    private static final Set<String> DETAIL_KEYS = Set.of(
        "from", "to", "before", "after", "reason", "role", "status", "operation", "version", "termYears",
        "amount", "amountVnd", "currency", "paymentCode", "quoteRef", "source", "category", "type",
        "decision", "scope", "periodStart", "periodEnd", "income", "expense", "net", "farmName", "statusBefore", "statusAfter"
    );
    private final PlatformAccessService platformAccess;
    private final AuditLogRepository repository;

    public PlatformAuditQueryService(PlatformAccessService platformAccess, AuditLogRepository repository) {
        this.platformAccess = platformAccess;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<AuditEntry> search(Instant from, Instant to, String action, String targetType, Long actorId, int page, int size) {
        platformAccess.requireRole(PlatformRole.SA);
        if (from != null && to != null && !from.isBefore(to)) throw DomainException.invalid("dateRange");
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(100, size));
        Specification<AuditLog> spec = (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("loggedAt"), from));
            if (to != null) predicates.add(cb.lessThan(root.get("loggedAt"), to));
            if (StringUtils.hasText(action)) predicates.add(cb.equal(cb.upper(root.get("action")), action.trim().toUpperCase(java.util.Locale.ROOT)));
            if (StringUtils.hasText(targetType)) predicates.add(cb.equal(cb.upper(root.get("targetType")), targetType.trim().toUpperCase(java.util.Locale.ROOT)));
            if (actorId != null) predicates.add(cb.equal(root.get("actor").get("id"), actorId));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return repository.findAll(spec, PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "loggedAt").and(Sort.by(Sort.Direction.DESC, "id"))))
            .map(this::dto);
    }

    @Transactional(readOnly = true)
    public AuditEntry get(Long id) {
        platformAccess.requireRole(PlatformRole.SA);
        return repository.findById(id).map(this::dto).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private AuditEntry dto(AuditLog entry) {
        String actorEmail = entry.getActor() == null ? null : entry.getActor().getEmail();
        String actorName = entry.getActor() == null ? "System" : entry.getActor().getFullName();
        String farmName = entry.getFarm() == null ? null : entry.getFarm().getName();
        Map<String, Object> details = new LinkedHashMap<>();
        Object parsed = JsonSupport.fromJson(entry.getDetails(), Object.class);
        if (parsed instanceof Map<?, ?> values) {
            values.forEach((key, value) -> {
                if (key instanceof String name && DETAIL_KEYS.contains(name)) details.put(name, value);
            });
        }
        return new AuditEntry(entry.getId(), entry.getLoggedAt(), actorEmail, actorName, farmName, entry.getAction(), entry.getTargetType(), entry.getTargetId(), Map.copyOf(details));
    }

    public record AuditEntry(
        Long id,
        Instant loggedAt,
        String actorEmail,
        String actorName,
        String farmName,
        String action,
        String targetType,
        Long targetId,
        Map<String, Object> details
    ) {}
}
