package vn.edu.fpt.beefcare.service;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.text.Collator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.config.VietnameseSortFunctionContributor;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;

/** Use-case commands and safe account queries for FE-03-07/08/09. */
@Service
public class PlatformAccountAdministrationService {
    private static final String ACTIVE = "ACTIVE";
    private static final String SUSPENDED = "SUSPENDED";
    private static final String REVOKED = "REVOKED";
    /** Table III-1: a search box is short text (max 100 characters). */
    static final int MAX_SEARCH_LENGTH = 100;
    private static final Set<String> ACCOUNT_STATUSES = Set.of(ACTIVE, SUSPENDED);
    /** SCR-16 Platform role filter: All (absent), None, CS, PM, SA. */
    private static final Set<String> PLATFORM_ROLE_FILTERS = Set.of("NONE", "CS", "PM", "SA");
    private static final List<String> FARM_ROLE_ORDER = List.of("OWNER", "MANAGER", "TECHNICIAN");
    private final PlatformAccessService platformAccess;
    private final AppUserRepository appUsers;
    private final UserRepository users;
    private final PlatformStaffAccessRepository staffAccess;
    private final FarmMembershipRepository farmMemberships;
    private final AuditLogRepository auditLogs;
    private final FarmClock clock;
    private final SessionRegistry sessions;

    public PlatformAccountAdministrationService(
        PlatformAccessService platformAccess,
        AppUserRepository appUsers,
        UserRepository users,
        PlatformStaffAccessRepository staffAccess,
        FarmMembershipRepository farmMemberships,
        AuditLogRepository auditLogs,
        FarmClock clock,
        SessionRegistry sessions
    ) {
        this.platformAccess = platformAccess;
        this.appUsers = appUsers;
        this.users = users;
        this.staffAccess = staffAccess;
        this.farmMemberships = farmMemberships;
        this.auditLogs = auditLogs;
        this.clock = clock;
        this.sessions = sessions;
    }

    /**
     * A9 / SCR-16 (D31): one page of accounts. {@code q} matches the name or email (trimmed, case-insensitive, accents
     * kept); {@code platformRole} filters on the ACTIVE platform role (NONE includes a REVOKED one); order by the
     * Vietnamese name (email when there is no name), then email, then id. Invalid parameters are COM-10.
     */
    @Transactional(readOnly = true)
    public AccountPage search(String query, String status, String platformRole, int page, int size, String sort, String dir) {
        platformAccess.requireRole(PlatformRole.SA);
        String needle = query == null ? "" : query.trim();
        if (needle.length() > MAX_SEARCH_LENGTH) throw DomainException.invalid("q");
        String state = StringUtils.hasText(status) ? status.trim() : null;
        if (state != null && !ACCOUNT_STATUSES.contains(state)) throw DomainException.invalid("status");
        String role = StringUtils.hasText(platformRole) ? platformRole.trim() : null;
        if (role != null && !PLATFORM_ROLE_FILTERS.contains(role)) throw DomainException.invalid("platformRole");
        if (page < 0 || page > Integer.MAX_VALUE / 100) throw DomainException.invalid("page");
        if (size < 1 || size > 100) throw DomainException.invalid("size");
        if (!"name".equals(sort)) throw DomainException.invalid("sort");
        if (dir == null || !List.of("asc", "desc").contains(dir.toLowerCase(Locale.ROOT))) throw DomainException.invalid("dir");
        boolean ascending = "asc".equalsIgnoreCase(dir);

        Specification<AppUser> filter = (root, criteria, cb) -> {
            List<Predicate> restrictions = new ArrayList<>();
            if (!needle.isEmpty()) {
                String pattern = "%" + escapeLike(needle.toLowerCase(Locale.ROOT)) + "%";
                restrictions.add(cb.or(cb.like(cb.lower(root.get("email")), pattern, '\\'), cb.like(cb.lower(root.get("fullName")), pattern, '\\')));
            }
            if (state != null) restrictions.add(cb.equal(cb.upper(root.get("accountStatus")), state));
            if (role != null) {
                Subquery<Long> activeAccess = criteria.subquery(Long.class);
                Root<PlatformStaffAccess> access = activeAccess.from(PlatformStaffAccess.class);
                Predicate ofAccount = cb.and(cb.equal(access.get("user"), root), cb.equal(cb.upper(access.get("status")), ACTIVE));
                if ("NONE".equals(role)) {
                    activeAccess.select(access.get("id")).where(ofAccount);
                    restrictions.add(cb.not(cb.exists(activeAccess)));
                } else {
                    activeAccess.select(access.get("id")).where(ofAccount, cb.equal(cb.upper(access.get("role")), role));
                    restrictions.add(cb.exists(activeAccess));
                }
            }
            if (!isCountQuery(criteria)) {
                // The inverse one-to-one would otherwise cost one select per account (no N+1).
                root.fetch("platformStaffAccess", JoinType.LEFT);
                Expression<String> name = cb.coalesce(cb.nullif(cb.trim(root.<String>get("fullName")), ""), root.<String>get("email"));
                Expression<String> key = cb.function(VietnameseSortFunctionContributor.NAME, String.class, name);
                Expression<String> email = cb.lower(root.get("email"));
                List<Order> order = ascending
                    ? List.of(cb.asc(key), cb.asc(email), cb.asc(root.get("id")))
                    : List.of(cb.desc(key), cb.desc(email), cb.desc(root.get("id")));
                criteria.orderBy(order);
            }
            return cb.and(restrictions.toArray(Predicate[]::new));
        };
        Page<AppUser> found = appUsers.findAll(filter, PageRequest.of(page, size));
        List<AppUser> accounts = found.getContent();
        List<Long> ids = accounts.stream().map(AppUser::getId).toList();
        Map<Long, Map<String, Long>> farmRoles = farmRolesOf(ids);
        Set<String> activated = accounts.isEmpty()
            ? Set.of()
            : users.findActivatedEmails(accounts.stream().map(account -> account.getEmail().toLowerCase(Locale.ROOT)).toList());
        List<AccountListItem> items = accounts.stream().map(account -> {
            PlatformStaffAccess access = account.getPlatformStaffAccess();
            FarmsJoined farms = farmsJoined(farmRoles.get(account.getId()));
            return new AccountListItem(
                account.getId(),
                account.getFullName(),
                account.getEmail(),
                account.getAccountStatus(),
                access == null ? null : access.getRole(),
                access == null ? null : access.getStatus(),
                emailVerified(account, activated.contains(account.getEmail().toLowerCase(Locale.ROOT))),
                farms.count(),
                farms.roles()
            );
        }).toList();
        return new AccountPage(items, found.getTotalElements(), page, size);
    }

    /** A10 / SCR-16 account detail (D31): no phone, no farm operational data, no password information (GBR-11). */
    @Transactional(readOnly = true)
    public AccountDetail get(Long id) {
        platformAccess.requireRole(PlatformRole.SA);
        return detail(load(id));
    }

    @Transactional
    public AccountDetail suspend(Long id, ChangeRequest request) {
        var actor = platformAccess.requireRole(PlatformRole.SA).user();
        validateRequest(request);
        AppUser target = loadForUpdate(id);
        verifyVersion(request.version(), target.getVersion());
        if (!ACTIVE.equalsIgnoreCase(target.getAccountStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
        if (actor.getId().equals(target.getId())) throw DomainException.forbidden(MessageCodes.FE03_17);

        PlatformStaffAccess access = staffAccess.findOneByUserIdForUpdate(id).orElse(null);
        if (access != null && ACTIVE.equalsIgnoreCase(access.getStatus()) && isSa(access.getRole())) {
            if (countActiveAdministrators(id) == 0) {
                throw DomainException.conflict(MessageCodes.FE03_17);
            }
        }
        String oldStatus = target.getAccountStatus();
        target.setAccountStatus(SUSPENDED);
        AppUser saved = appUsers.saveAndFlush(target);
        User identity = users.findOneByEmailIgnoreCaseAndActivatedTrue(target.getEmail()).orElse(null);
        if (identity != null) expireSessions(identity);
        audit(actor, "ACCOUNT_SUSPEND", saved, java.util.Map.of("from", oldStatus, "to", SUSPENDED, "reason", request.reason().trim()));
        return detail(saved);
    }

    @Transactional
    public AccountDetail restore(Long id, ChangeRequest request) {
        var actor = platformAccess.requireRole(PlatformRole.SA).user();
        validateRequest(request);
        AppUser target = loadForUpdate(id);
        verifyVersion(request.version(), target.getVersion());
        if (!SUSPENDED.equalsIgnoreCase(target.getAccountStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
        if (users.findOneByEmailIgnoreCaseAndActivatedTrue(target.getEmail()).isEmpty()) {
            throw DomainException.conflict(MessageCodes.FE03_18);
        }
        target.setAccountStatus(ACTIVE);
        AppUser saved = appUsers.saveAndFlush(target);
        audit(actor, "ACCOUNT_RESTORE", saved, java.util.Map.of("from", SUSPENDED, "to", ACTIVE, "reason", request.reason().trim()));
        return detail(saved);
    }

    @Transactional
    public AccountDetail changePlatformAccess(Long id, PlatformAccessChange request) {
        var actor = platformAccess.requireRole(PlatformRole.SA).user();
        if (request == null || !StringUtils.hasText(request.operation()) || !StringUtils.hasText(request.reason())) {
            throw DomainException.required("operation and reason");
        }
        if (request.reason().trim().length() > 500) throw DomainException.invalid("reason");
        AppUser target = loadForUpdate(id);
        if (!ACTIVE.equalsIgnoreCase(target.getAccountStatus())) throw DomainException.forbidden(MessageCodes.COM_01);
        if (users.findOneByEmailIgnoreCaseAndActivatedTrue(target.getEmail()).isEmpty()) {
            throw DomainException.conflict(MessageCodes.FE03_18);
        }
        PlatformStaffAccess current = staffAccess.findOneByUserIdForUpdate(id).orElse(null);
        if (current != null) verifyVersion(request.version(), current.getVersion());
        else if (request.version() != null && request.version() != 0) throw DomainException.conflict(MessageCodes.COM_05);
        String operation = request.operation().trim().toUpperCase(Locale.ROOT);
        String oldRole = current == null ? null : current.getRole();
        String oldStatus = current == null ? null : current.getStatus();
        PlatformRole nextRole = request.role() == null || request.role().isBlank() ? null : parseRole(request.role());

        switch (operation) {
            case "GRANT" -> {
                if (current != null && ACTIVE.equalsIgnoreCase(current.getStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
                if (nextRole == null) throw DomainException.required("role");
                if (current == null) {
                    current = new PlatformStaffAccess();
                    current.setUser(target);
                }
                current.setRole(nextRole.name());
                current.setStatus(ACTIVE);
            }
            case "CHANGE" -> {
                if (current == null || !ACTIVE.equalsIgnoreCase(current.getStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
                if (nextRole == null) throw DomainException.required("role");
                if (nextRole.name().equalsIgnoreCase(current.getRole())) throw DomainException.conflict(MessageCodes.FE03_20);
                current.setRole(nextRole.name());
                current.setStatus(ACTIVE);
            }
            case "REVOKE" -> {
                if (current == null || !ACTIVE.equalsIgnoreCase(current.getStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
                current.setStatus(REVOKED);
            }
            case "RESTORE" -> {
                if (current == null || !REVOKED.equalsIgnoreCase(current.getStatus())) throw DomainException.conflict(MessageCodes.FE03_20);
                current.setStatus(ACTIVE);
            }
            default -> throw DomainException.invalid("operation");
        }

        if (isSa(oldRole) && ACTIVE.equalsIgnoreCase(oldStatus) && !(isSa(current.getRole()) && ACTIVE.equalsIgnoreCase(current.getStatus()))) {
            requireAnotherActiveSa(id);
        }
        PlatformStaffAccess savedAccess = staffAccess.saveAndFlush(current);
        audit(actor, "PLATFORM_ACCESS_" + operation, target, java.util.Map.of(
            "fromRole", oldRole == null ? "NONE" : oldRole,
            "fromStatus", oldStatus == null ? "NONE" : oldStatus,
            "toRole", savedAccess.getRole(),
            "toStatus", savedAccess.getStatus(),
            "reason", request.reason().trim()
        ));
        return detail(target);
    }

    @Transactional(readOnly = true)
    public List<AuditItem> history(Long id) {
        platformAccess.requireRole(PlatformRole.SA);
        load(id);
        return auditLogs.findTop100ByTargetTypeAndTargetIdOrderByLoggedAtDescIdDesc("AppUser", id).stream()
            .filter(entry -> entry.getAction().startsWith("ACCOUNT_") || entry.getAction().startsWith("PLATFORM_ACCESS_"))
            .map(entry -> new AuditItem(entry.getId(), entry.getAction(), entry.getLoggedAt(), entry.getDetails()))
            .toList();
    }

    private AppUser load(Long id) {
        return appUsers.findById(id).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private AppUser loadForUpdate(Long id) {
        return appUsers.findByIdForUpdate(id).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private AccountDetail detail(AppUser account) {
        PlatformStaffAccess access = staffAccess.findOneByUserId(account.getId()).orElse(null);
        FarmsJoined farms = farmsJoined(farmRolesOf(List.of(account.getId())).get(account.getId()));
        boolean activated = users.findOneByEmailIgnoreCaseAndActivatedTrue(account.getEmail()).isPresent();
        List<String> methods = new ArrayList<>();
        if (account.isPasswordLoginEnabled()) methods.add("PASSWORD");
        if (account.getGoogleSubject() != null) methods.add("GOOGLE");
        Collator collator = Collator.getInstance(Locale.forLanguageTag("vi"));
        collator.setStrength(Collator.SECONDARY);
        List<String> ownedFarms = farmMemberships.findOwnedFarmNames(account.getId()).stream().sorted(collator).toList();
        return new AccountDetail(
            account.getId(),
            account.getFullName(),
            account.getEmail(),
            account.getAccountStatus(),
            access == null ? null : access.getRole(),
            access == null ? null : access.getStatus(),
            access == null ? null : access.getVersion(),
            emailVerified(account, activated),
            methods,
            account.getCreatedAt(),
            latest(account.getPasswordLastUsedAt(), account.getGoogleLastUsedAt()),
            account.isOwnerRegistrationCompleted(),
            account.getOwnerRegistrationCompletedAt(),
            ownedFarms,
            farms.count(),
            farms.roles(),
            account.getVersion()
        );
    }

    /** userId → (ROLE → ACTIVE memberships) for the given accounts; nothing is queried for an empty page. */
    private Map<Long, Map<String, Long>> farmRolesOf(List<Long> accountIds) {
        if (accountIds.isEmpty()) return Map.of();
        Map<Long, Map<String, Long>> result = new HashMap<>();
        for (Object[] row : farmMemberships.countActiveByUserAndRole(accountIds)) {
            result.computeIfAbsent((Long) row[0], ignored -> new HashMap<>()).put((String) row[1], ((Number) row[2]).longValue());
        }
        return result;
    }

    /** SCR-16 "Farms joined" (D31): ACTIVE memberships only, roles in the order Owner, Manager, Technician. */
    private static FarmsJoined farmsJoined(Map<String, Long> byRole) {
        if (byRole == null || byRole.isEmpty()) return new FarmsJoined(0, List.of());
        long count = byRole.values().stream().mapToLong(Long::longValue).sum();
        return new FarmsJoined(count, FARM_ROLE_ORDER.stream().filter(byRole::containsKey).toList());
    }

    /** Verified by Google (the identity provider confirmed the email) or by the emailed link (activated identity). */
    private static boolean emailVerified(AppUser account, boolean activatedIdentity) {
        return account.getGoogleSubject() != null || activatedIdentity;
    }

    private static Instant latest(Instant first, Instant second) {
        if (first == null) return second;
        if (second == null) return first;
        return first.isAfter(second) ? first : second;
    }

    private static boolean isCountQuery(CriteriaQuery<?> criteria) {
        return Long.class == criteria.getResultType() || long.class == criteria.getResultType();
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private void audit(AppUser actor, String action, AppUser target, Object details) {
        AuditLog event = new AuditLog();
        event.setActor(actor);
        event.setAction(action);
        event.setTargetType("AppUser");
        event.setTargetId(target.getId());
        event.setLoggedAt(clock.now());
        event.setDetails(JsonSupport.toJson(details));
        auditLogs.save(event);
    }

    private void validateRequest(ChangeRequest request) {
        if (request == null || !StringUtils.hasText(request.reason())) throw DomainException.required("reason");
        if (request.reason().trim().length() > 500) throw DomainException.invalid("reason");
    }

    private void verifyVersion(Long expected, Long actual) {
        if (expected == null || !Objects.equals(expected, actual)) throw DomainException.conflict(MessageCodes.COM_05);
    }

    private void requireAnotherActiveSa(Long excludedUserId) {
        long otherAdmins = countActiveAdministrators(excludedUserId);
        if (otherAdmins < 1) throw DomainException.conflict(MessageCodes.FE03_17);
    }

    private long countActiveAdministrators(Long excludedUserId) {
        List<PlatformStaffAccess> active = staffAccess.findAllByRoleIgnoreCaseAndStatusIgnoreCaseOrderById(PlatformRole.SA.name(), ACTIVE);
        return active.stream()
            .filter(access -> !excludedUserId.equals(access.getUser().getId()))
            .filter(access -> ACTIVE.equalsIgnoreCase(access.getUser().getAccountStatus()))
            .count();
    }

    private void expireSessions(User user) {
        Set<String> principals = Set.of(user.getLogin(), user.getEmail());
        for (String principal : principals) {
            if (principal == null) continue;
            for (SessionInformation information : sessions.getAllSessions(principal, false)) information.expireNow();
        }
    }

    private static boolean isSa(String role) {
        return PlatformRole.SA.name().equalsIgnoreCase(role);
    }

    private static PlatformRole parseRole(String role) {
        try {
            return PlatformRole.valueOf(role.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException exception) {
            throw DomainException.invalid("role");
        }
    }

    public record ChangeRequest(String reason, Long version) {}

    public record PlatformAccessChange(String operation, String role, String reason, Long version) {}

    private record FarmsJoined(long count, List<String> roles) {}

    /** A9 row of SCR-16 (D31). {@code platformRole} / {@code platformAccessStatus} are the stored access (REVOKED kept). */
    public record AccountListItem(
        Long id,
        String fullName,
        String email,
        @Schema(allowableValues = { "ACTIVE", "SUSPENDED" }) String accountStatus,
        @Schema(allowableValues = { "CS", "PM", "SA" }, nullable = true) String platformRole,
        @Schema(allowableValues = { "ACTIVE", "REVOKED" }, nullable = true) String platformAccessStatus,
        boolean emailVerified,
        @Schema(description = "ACTIVE farm memberships") long farmCount,
        @Schema(description = "Roles of the ACTIVE memberships, ordered OWNER, MANAGER, TECHNICIAN") List<String> farmRoles
    ) {}

    /** A9 page (D31): 20 rows by default, page numbers start at 0. */
    public record AccountPage(List<AccountListItem> items, long total, int page, int size) {}

    /** A10 (D31), also returned by suspend / restore / platform access. No phone (SCR-16, GBR-11). */
    public record AccountDetail(
        Long id,
        String fullName,
        String email,
        @Schema(allowableValues = { "ACTIVE", "SUSPENDED" }) String accountStatus,
        @Schema(allowableValues = { "CS", "PM", "SA" }, nullable = true) String platformRole,
        @Schema(allowableValues = { "ACTIVE", "REVOKED" }, nullable = true) String platformAccessStatus,
        @Schema(nullable = true) Long platformAccessVersion,
        boolean emailVerified,
        @Schema(description = "PASSWORD and/or GOOGLE") List<String> signInMethods,
        Instant createdAt,
        @Schema(nullable = true, description = "Latest password or Google sign-in; null when never signed in") Instant lastSignInAt,
        boolean ownerRegistrationCompleted,
        @Schema(nullable = true) Instant ownerRegistrationCompletedAt,
        @Schema(description = "Names of the farms this account owns, Vietnamese order") List<String> ownedFarms,
        long farmCount,
        List<String> farmRoles,
        Long version
    ) {}

    public record AuditItem(Long id, String action, Instant at, String details) {}
}
