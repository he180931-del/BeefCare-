package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;

/** Use-case commands and safe account queries for FE-03-07/08/09. */
@Service
public class PlatformAccountAdministrationService {
    private static final String ACTIVE = "ACTIVE";
    private static final String SUSPENDED = "SUSPENDED";
    private static final String REVOKED = "REVOKED";
    private final PlatformAccessService platformAccess;
    private final AppUserRepository appUsers;
    private final UserRepository users;
    private final PlatformStaffAccessRepository staffAccess;
    private final AuditLogRepository auditLogs;
    private final FarmClock clock;
    private final SessionRegistry sessions;

    public PlatformAccountAdministrationService(
        PlatformAccessService platformAccess,
        AppUserRepository appUsers,
        UserRepository users,
        PlatformStaffAccessRepository staffAccess,
        AuditLogRepository auditLogs,
        FarmClock clock,
        SessionRegistry sessions
    ) {
        this.platformAccess = platformAccess;
        this.appUsers = appUsers;
        this.users = users;
        this.staffAccess = staffAccess;
        this.auditLogs = auditLogs;
        this.clock = clock;
        this.sessions = sessions;
    }

    @Transactional(readOnly = true)
    public Page<AccountSummary> search(String query, String status, int page, int size) {
        platformAccess.requireRole(PlatformRole.SA);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        String needle = StringUtils.hasText(query) ? query.trim().toLowerCase(Locale.ROOT) : null;
        String state = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : null;
        Specification<AppUser> filter = (root, criteria, cb) -> {
            var restrictions = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (needle != null) {
                String pattern = "%" + needle.replace("%", "\\%").replace("_", "\\_") + "%";
                restrictions.add(cb.or(
                    cb.like(cb.lower(root.get("email")), pattern, '\\'),
                    cb.like(cb.lower(root.get("fullName")), pattern, '\\'),
                    cb.like(cb.lower(root.get("phone")), pattern, '\\')
                ));
            }
            if (state != null) restrictions.add(cb.equal(cb.upper(root.get("accountStatus")), state));
            return cb.and(restrictions.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Page<AppUser> accounts = appUsers.findAll(filter, PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "email")));
        return accounts.map(this::summary);
    }

    @Transactional(readOnly = true)
    public AccountSummary get(Long id) {
        platformAccess.requireRole(PlatformRole.SA);
        return summary(load(id));
    }

    @Transactional
    public AccountSummary suspend(Long id, ChangeRequest request) {
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
        return summary(saved);
    }

    @Transactional
    public AccountSummary restore(Long id, ChangeRequest request) {
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
        return summary(saved);
    }

    @Transactional
    public AccountSummary changePlatformAccess(Long id, PlatformAccessChange request) {
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
        return summary(target);
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

    private AccountSummary summary(AppUser account) {
        PlatformStaffAccess access = staffAccess.findOneByUserId(account.getId()).orElse(null);
        return new AccountSummary(
            account.getId(),
            account.getEmail(),
            account.getFullName(),
            account.getPhone(),
            account.getAccountStatus(),
            access == null ? null : access.getRole(),
            access == null ? null : access.getStatus(),
            access == null ? null : access.getVersion(),
            account.isOwnerRegistrationCompleted(),
            account.getVersion()
        );
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

    public record AccountSummary(
        Long id,
        String email,
        String fullName,
        String phone,
        String accountStatus,
        String platformRole,
        String platformAccessStatus,
        Long platformAccessVersion,
        boolean ownerRegistrationCompleted,
        Long version
    ) {}

    public record AuditItem(Long id, String action, Instant at, String details) {}
}
