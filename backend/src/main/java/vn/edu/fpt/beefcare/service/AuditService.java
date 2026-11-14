package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;

/**
 * The one writer of {@code audit_log} (GBR-86, NFR-S11, D34): the entry is saved in the command's own transaction, so a
 * rollback leaves no audit and a replayed request key writes none (GBR-88). It also records the actor's role at that
 * moment and the correlation ID of the request or job run (§3.2 J). An empty actor is "System".
 */
@Service
public class AuditService {

    private static final String ACTIVE = "ACTIVE";

    private final AuditLogRepository repository;
    private final FarmClock clock;
    private final PlatformStaffAccessRepository staffAccess;
    private final FarmMembershipRepository memberships;

    public AuditService(
        AuditLogRepository repository,
        FarmClock clock,
        PlatformStaffAccessRepository staffAccess,
        FarmMembershipRepository memberships
    ) {
        this.repository = repository;
        this.clock = clock;
        this.staffAccess = staffAccess;
        this.memberships = memberships;
    }

    /**
     * @param action     stored action code, e.g. PEN_MOVE, ENTRY_POST, ACCOUNT_SUSPEND (see {@link PlatformAuditCatalog})
     * @param targetType entity name, e.g. HerdEntryVoucher
     * @param details    any JSON-serialisable object (may be null); never secrets, ticket bodies or bank evidence content
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog log(Farm farm, AppUser actor, String action, String targetType, Long targetId, Object details) {
        return write(farm, actor, null, action, targetType, targetId, details, clock.now(), false);
    }

    /** A farm command: the role is the caller's verified role in that farm. */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog log(FarmContext ctx, String action, String targetType, Long targetId, Object details) {
        String role = ctx.role() == null ? null : ctx.role().name();
        return write(ctx.farm(), ctx.user(), role, action, targetType, targetId, details, clock.now(), false);
    }

    /** Same as {@link #log(Farm, AppUser, String, String, Long, Object)} with the time of a history row of the same command. */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog logAt(Farm farm, AppUser actor, String action, String targetType, Long targetId, Object details, Instant at) {
        return write(farm, actor, null, action, targetType, targetId, details, at, false);
    }

    /** Flushes at once, so a failing write surfaces inside the command (plan price publication). */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog logAndFlush(Farm farm, AppUser actor, String action, String targetType, Long targetId, Object details, Instant at) {
        return write(farm, actor, null, action, targetType, targetId, details, at, true);
    }

    private AuditLog write(
        Farm farm,
        AppUser actor,
        String knownRole,
        String action,
        String targetType,
        Long targetId,
        Object details,
        Instant at,
        boolean flush
    ) {
        AuditLog entry = new AuditLog();
        entry.setFarm(farm);
        entry.setActor(actor);
        entry.setActorRole(knownRole != null || actor == null ? knownRole : roleOf(actor, farm, action));
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setLoggedAt(at);
        entry.setDetails(JsonSupport.toJson(details));
        entry.setCorrelationId(CorrelationId.current());
        return flush ? repository.saveAndFlush(entry) : repository.save(entry);
    }

    /** The role the actor acted in: platform staff role for platform actions, farm membership role for farm actions. */
    private String roleOf(AppUser actor, Farm farm, String action) {
        if (actor.getId() == null) return null;
        Supplier<String> platformRole = () -> staffAccess.findOneByUserIdAndStatusIgnoreCase(actor.getId(), ACTIVE)
            .map(PlatformStaffAccess::getRole).orElse(null);
        Supplier<String> farmRole = () -> farm == null || farm.getId() == null ? null
            : memberships.findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farm.getId(), actor.getId(), ACTIVE).map(FarmMembership::getRole).orElse(null);
        boolean platformFirst = PlatformAuditCatalog.scopeOf(action, farm != null) == PlatformAuditCatalog.Scope.PLATFORM;
        String role = platformFirst ? platformRole.get() : farmRole.get();
        if (role == null) role = platformFirst ? farmRole.get() : platformRole.get();
        return role == null ? null : role.trim().toUpperCase(java.util.Locale.ROOT);
    }
}
