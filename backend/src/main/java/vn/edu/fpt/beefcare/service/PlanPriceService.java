package vn.edu.fpt.beefcare.service;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.PlanPriceLock;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;

/** UC7: immutable publications, withdrawn schedules and one effective version at the server clock. */
@Service
public class PlanPriceService {
    private final PlatformAccessService access;
    private final PlanVersionRepository plans;
    private final AuditLogRepository auditLogs;
    private final FarmClock clock;
    private final EntityManager em;

    public PlanPriceService(PlatformAccessService access, PlanVersionRepository plans, AuditLogRepository auditLogs, FarmClock clock, EntityManager em) {
        this.access = access; this.plans = plans; this.auditLogs = auditLogs; this.clock = clock; this.em = em;
    }

    @Transactional(readOnly = true)
    public PriceVersion current() {
        PlanVersion p = effective(clock.now()); return p == null ? null : PriceVersion.from(p);
    }

    @Transactional(readOnly = true)
    public PricePage history(int page, int size) {
        access.requireRole(PlatformRole.PM);
        if (size < 1 || size > 100 || page < 0 || page > Integer.MAX_VALUE / size) throw DomainException.invalid("page");
        Instant now = clock.now(); PlanVersion current = effective(now);
        var versions = plans.publicationHistory(PageRequest.of(page, size));
        Instant next = plans.findFirstByWithdrawnAtIsNullAndEffectiveAtGreaterThanOrderByEffectiveAtAscIdAsc(now).map(PlanVersion::getEffectiveAt).orElse(null);
        return new PricePage(versions.getContent().stream().map(p -> view(p, current, now)).toList(), versions.getTotalElements(), page, size,
            now, current == null ? null : view(current, current, now), next);
    }

    @Transactional
    public PublishedPrice publish(PublishPriceRequest request) {
        AppUser actor = access.requireRole(PlatformRole.PM).user();
        if (request == null) throw DomainException.required("body");
        validatePrice(request.price1y(), "price1y"); validatePrice(request.price2y(), "price2y"); validatePrice(request.price3y(), "price3y");
        if (request.applyNow() == null) throw DomainException.required("applyNow");
        String terms = StringUtils.hasText(request.terms()) ? request.terms().trim() : null;
        if (terms != null && terms.length() > 500) throw DomainException.invalid("terms");
        lockPublications();
        Instant now = clock.now(); Instant at = request.applyNow() ? now : request.effectiveAt();
        if (at == null) throw DomainException.required("effectiveAt");
        if (at.isBefore(now)) throw DomainException.badRequest("MSG-FE19-14", "field", "effectiveAt");
        plans.findFirstByWithdrawnAtIsNullAndEffectiveAt(at).ifPresent(conflict -> {
            throw DomainException.conflict("MSG-FE19-15", "version", conflict.getId(), "time", at);
        });
        PlanVersion p = new PlanVersion().price1y(request.price1y()).price2y(request.price2y()).price3y(request.price3y()).terms(terms).effectiveAt(at);
        p.setPublishedBy(actor); p.setPublishedAt(now); p = plans.saveAndFlush(p);
        audit(actor, p, now, "PLAN_PRICE_PUBLISH", Map.of("price1y", p.getPrice1y(), "price2y", p.getPrice2y(), "price3y", p.getPrice3y(),
            "effectiveAt", at, "terms", terms == null ? "" : terms));
        return view(p, effective(now), now);
    }

    @Transactional
    public PublishedPrice withdraw(Long id, WithdrawPriceRequest request) {
        AppUser actor = access.requireRole(PlatformRole.PM).user();
        if (request == null || !StringUtils.hasText(request.reason())) throw DomainException.required("reason");
        String reason = request.reason().trim();
        if (reason.length() > 1000 || reason.codePoints().filter(c -> !Character.isWhitespace(c) && !Character.isSpaceChar(c)).count() < 5) throw DomainException.invalid("reason");
        if (request.expectedVersion() == null) throw DomainException.required("expectedVersion");
        lockPublications();
        PlanVersion p = plans.findById(id).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        Instant now = clock.now();
        if (!request.expectedVersion().equals(p.getRevision()) || p.getWithdrawnAt() != null || !p.getEffectiveAt().isAfter(now)) throw DomainException.conflict(MessageCodes.COM_05);
        p.setWithdrawnBy(actor); p.setWithdrawnAt(now); p.setWithdrawReason(reason); plans.saveAndFlush(p);
        audit(actor, p, now, "PLAN_PRICE_WITHDRAW", Map.of("reason", reason, "effectiveAt", p.getEffectiveAt()));
        return view(p, effective(now), now);
    }

    /** A seeded singleton serializes writes across PMs, including publication of the very first price. */
    private void lockPublications() {
        if (em.find(PlanPriceLock.class, 1, LockModeType.PESSIMISTIC_WRITE) == null) throw new IllegalStateException("Plan price lock is not initialized");
    }
    private PlanVersion effective(Instant now) { return plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(now).orElse(null); }
    private void audit(AppUser actor, PlanVersion p, Instant now, String action, Map<String, Object> details) {
        AuditLog audit = new AuditLog(); audit.setActor(actor); audit.setAction(action); audit.setTargetType("PlanVersion");
        audit.setTargetId(p.getId()); audit.setLoggedAt(now); audit.setDetails(JsonSupport.toJson(details)); auditLogs.saveAndFlush(audit);
    }
    private static void validatePrice(BigDecimal value, String field) {
        if (value == null) throw DomainException.required(field);
        if (value.compareTo(BigDecimal.valueOf(1000)) < 0 || value.compareTo(BigDecimal.valueOf(1000000000)) > 0 || value.stripTrailingZeros().scale() > 0)
            throw DomainException.badRequest("MSG-FE19-13", "field", field);
    }
    private static PublishedPrice view(PlanVersion p, PlanVersion current, Instant now) {
        PriceStatus status = p.getWithdrawnAt() != null ? PriceStatus.WITHDRAWN : p.getEffectiveAt().isAfter(now) ? PriceStatus.SCHEDULED
            : current != null && current.getId().equals(p.getId()) ? PriceStatus.EFFECTIVE : PriceStatus.SUPERSEDED;
        return new PublishedPrice(p.getId(), p.getRevision(), p.getPrice1y(), p.getPrice2y(), p.getPrice3y(), p.getEffectiveAt(), p.getTerms(), status,
            p.getPublishedBy() == null ? null : p.getPublishedBy().getId(), p.getPublishedBy() == null ? null : p.getPublishedBy().getFullName(), p.getPublishedAt(),
            p.getWithdrawnBy() == null ? null : p.getWithdrawnBy().getFullName(), p.getWithdrawnAt(), p.getWithdrawReason());
    }

    @Schema(requiredProperties = {"price1y", "price2y", "price3y", "applyNow"})
    public record PublishPriceRequest(
        @Schema(minimum = "1000", maximum = "1000000000", description = "Whole VND") BigDecimal price1y,
        @Schema(minimum = "1000", maximum = "1000000000", description = "Whole VND") BigDecimal price2y,
        @Schema(minimum = "1000", maximum = "1000000000", description = "Whole VND") BigDecimal price3y,
        Boolean applyNow, @Schema(description = "Required when applyNow=false; ISO instant; now or future") Instant effectiveAt,
        @Schema(maxLength = 500) String terms) {}
    @Schema(requiredProperties = {"reason", "expectedVersion"})
    public record WithdrawPriceRequest(@Schema(minLength = 5, maxLength = 1000, description = "At least 5 non-space characters") String reason, Long expectedVersion) {}
    public enum PriceStatus { SCHEDULED, EFFECTIVE, SUPERSEDED, WITHDRAWN }
    @Schema(name = "PlatformPlanPriceVersion", requiredProperties = {"id", "revision", "price1y", "price2y", "price3y", "effectiveAt", "terms", "status", "publishedById", "publishedBy", "publishedAt", "withdrawnBy", "withdrawnAt", "withdrawReason"})
    public record PublishedPrice(Long id, Long revision, BigDecimal price1y, BigDecimal price2y, BigDecimal price3y, Instant effectiveAt, String terms, PriceStatus status,
        Long publishedById, String publishedBy, Instant publishedAt, String withdrawnBy, Instant withdrawnAt, String withdrawReason) {}
    @Schema(name = "PlatformPlanPricePage", requiredProperties = {"items", "total", "page", "size", "asOf", "current", "nextEffectiveAt"})
    public record PricePage(List<PublishedPrice> items, long total, int page, int size, Instant asOf, PublishedPrice current, Instant nextEffectiveAt) {}
    /** Public read contract intentionally contains no PM identity or withdrawal details. */
    public record PriceVersion(Long id, BigDecimal price1y, BigDecimal price2y, BigDecimal price3y, Instant effectiveAt, String terms) {
        static PriceVersion from(PlanVersion p) { return new PriceVersion(p.getId(), p.getPrice1y(), p.getPrice2y(), p.getPrice3y(), p.getEffectiveAt(), p.getTerms()); }
    }
}
