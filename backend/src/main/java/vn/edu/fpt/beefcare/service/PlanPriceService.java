package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;

/** Immutable plan price publication shared by Owner quotes and the public landing page. */
@Service
public class PlanPriceService {
    private final PlatformAccessService access;
    private final PlanVersionRepository plans;
    private final AuditLogRepository auditLogs;
    private final FarmClock clock;

    public PlanPriceService(PlatformAccessService access, PlanVersionRepository plans, AuditLogRepository auditLogs, FarmClock clock) {
        this.access = access;
        this.plans = plans;
        this.auditLogs = auditLogs;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PriceVersion current() {
        return plans.findFirstByEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(clock.now()).map(PriceVersion::from).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<PriceVersion> history() {
        access.requireRole(PlatformRole.PM);
        return plans.findAllByOrderByEffectiveAtDescIdDesc().stream().map(PriceVersion::from).toList();
    }

    @Transactional
    public PriceVersion publish(PublishPriceRequest request) {
        var actor = access.requireRole(PlatformRole.PM).user();
        if (request == null || request.effectiveAt() == null) throw DomainException.required("effectiveAt");
        validateWholePositiveVnd(request.price1y(), "price1y");
        validateWholePositiveVnd(request.price2y(), "price2y");
        validateWholePositiveVnd(request.price3y(), "price3y");
        if (request.terms() != null && request.terms().trim().length() > 255) throw DomainException.invalid("terms");
        if (plans.existsByEffectiveAt(request.effectiveAt())) throw DomainException.conflict(MessageCodes.COM_05);

        PlanVersion plan = new PlanVersion();
        plan.setPrice1y(request.price1y());
        plan.setPrice2y(request.price2y());
        plan.setPrice3y(request.price3y());
        plan.setTerms(StringUtils.hasText(request.terms()) ? request.terms().trim() : null);
        plan.setEffectiveAt(request.effectiveAt());
        PlanVersion saved = plans.saveAndFlush(plan);
        AuditLog audit = new AuditLog();
        audit.setActor(actor);
        audit.setAction("PLAN_PRICE_PUBLISH");
        audit.setTargetType("PlanVersion");
        audit.setTargetId(saved.getId());
        audit.setLoggedAt(clock.now());
        audit.setDetails(JsonSupport.toJson(Map.of(
            "price1y", saved.getPrice1y(),
            "price2y", saved.getPrice2y(),
            "price3y", saved.getPrice3y(),
            "effectiveAt", saved.getEffectiveAt(),
            "terms", saved.getTerms() == null ? "" : saved.getTerms()
        )));
        auditLogs.save(audit);
        return PriceVersion.from(saved);
    }

    private static void validateWholePositiveVnd(BigDecimal value, String field) {
        if (value == null || value.signum() <= 0 || value.stripTrailingZeros().scale() > 0) {
            throw DomainException.invalid(field);
        }
    }

    public record PublishPriceRequest(BigDecimal price1y, BigDecimal price2y, BigDecimal price3y, Instant effectiveAt, String terms) {}

    public record PriceVersion(Long id, BigDecimal price1y, BigDecimal price2y, BigDecimal price3y, Instant effectiveAt, String terms) {
        static PriceVersion from(PlanVersion p) {
            return new PriceVersion(p.getId(), p.getPrice1y(), p.getPrice2y(), p.getPrice3y(), p.getEffectiveAt(), p.getTerms());
        }
    }
}
