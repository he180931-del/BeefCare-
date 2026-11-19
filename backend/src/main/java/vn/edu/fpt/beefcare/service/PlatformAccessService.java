package vn.edu.fpt.beefcare.service;

import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;

/** Rechecks current platform role from storage on each protected request; farm membership never implies platform access. */
@Service
public class PlatformAccessService {

    private static final String ACTIVE = "ACTIVE";

    private final FarmAccessService accountAccess;
    private final PlatformStaffAccessRepository repository;

    public PlatformAccessService(FarmAccessService accountAccess, PlatformStaffAccessRepository repository) {
        this.accountAccess = accountAccess;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PlatformContext requireRole(PlatformRole role) {
        var user = accountAccess.currentActiveUser();
        PlatformStaffAccess access = repository
            .findOneByUserIdAndStatusIgnoreCase(user.getId(), ACTIVE)
            .filter(value -> value.getRole() != null && value.getRole().trim().equalsIgnoreCase(role.name()))
            .orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        return new PlatformContext(user, access, role);
    }

    /** Returns the caller's current platform role, rejecting farm-only accounts. */
    @Transactional(readOnly = true)
    public PlatformContext requireAnyPlatformRole() {
        var user = accountAccess.currentActiveUser();
        PlatformStaffAccess access = repository
            .findOneByUserIdAndStatusIgnoreCase(user.getId(), ACTIVE)
            .orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        PlatformRole role = parse(access.getRole());
        if (role == null) {
            throw DomainException.forbidden(MessageCodes.COM_01);
        }
        return new PlatformContext(user, access, role);
    }

    /** Checks the role and the named assignment used by internal support requests. */
    @Transactional(readOnly = true)
    public PlatformContext requireNamedAssignment(PlatformRole role, Long assignedUserId) {
        PlatformContext context = requireRole(role);
        if (assignedUserId == null || !assignedUserId.equals(context.user().getId())) {
            throw DomainException.forbidden(MessageCodes.COM_01);
        }
        return context;
    }

    @Transactional(readOnly = true)
    public boolean hasActiveSystemAdministrator() {
        return repository.countByRoleIgnoreCaseAndStatusIgnoreCase(PlatformRole.SA.name(), ACTIVE) > 0;
    }

    private PlatformRole parse(String raw) {
        if (raw == null) return null;
        try {
            return PlatformRole.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
