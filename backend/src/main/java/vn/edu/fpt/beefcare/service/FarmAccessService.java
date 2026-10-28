package vn.edu.fpt.beefcare.service;

import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.security.SecurityUtils;

/**
 * GBR-09: every protected request rechecks the account status, the current membership and role in the path farm,
 * and (for writes) the farm service status. Nothing sent by the client is trusted.
 *
 * The signed-in JHipster login is mapped to the BeefCare {@link AppUser} by e-mail (login or account e-mail).
 */
@Service
public class FarmAccessService {

    static final String ACTIVE = "ACTIVE";

    private final AppUserRepository appUserRepository;
    private final FarmMembershipRepository membershipRepository;
    private final FarmRepository farmRepository;
    private final UserRepository userRepository;

    public FarmAccessService(
        AppUserRepository appUserRepository,
        FarmMembershipRepository membershipRepository,
        FarmRepository farmRepository,
        UserRepository userRepository
    ) {
        this.appUserRepository = appUserRepository;
        this.membershipRepository = membershipRepository;
        this.farmRepository = farmRepository;
        this.userRepository = userRepository;
    }

    /** Verifies the caller may perform {@code action} in the farm and returns the verified context. */
    public FarmContext require(Long farmId, FarmAction action) {
        AppUser user = currentActiveUser();
        FarmMembership membership = membershipRepository
            .findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farmId, user.getId(), ACTIVE)
            .orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        FarmRole role = parseRole(membership.getRole());
        if (role == null || !action.allows(role)) {
            throw DomainException.forbidden(MessageCodes.COM_01);
        }
        Farm farm = farmRepository.findById(farmId).orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        if (action.isWrite() && !ACTIVE.equalsIgnoreCase(farm.getServiceStatus())) {
            throw DomainException.forbidden(MessageCodes.COM_12, "farm", farm.getName(), "status", farm.getServiceStatus());
        }
        return new FarmContext(farm, user, role);
    }

    /** The signed-in account, which must be ACTIVE. */
    public AppUser currentActiveUser() {
        String login = SecurityUtils.getCurrentUserLogin()
            .orElseThrow(() -> new DomainException(MessageCodes.COM_01, null, HttpStatus.UNAUTHORIZED));
        AppUser user = findAppUser(login).orElseThrow(() -> DomainException.forbidden(MessageCodes.COM_01));
        if (!ACTIVE.equalsIgnoreCase(user.getAccountStatus())) {
            throw DomainException.forbidden(MessageCodes.COM_01);
        }
        return user;
    }

    private Optional<AppUser> findAppUser(String login) {
        Optional<AppUser> byEmail = appUserRepository.findOneByEmailIgnoreCase(login);
        if (byEmail.isPresent()) {
            return byEmail;
        }
        return userRepository
            .findOneByLogin(login.toLowerCase(Locale.ROOT))
            .map(u -> u.getEmail())
            .flatMap(appUserRepository::findOneByEmailIgnoreCase);
    }

    static FarmRole parseRole(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT).replace("ROLE_", "").replace("FARM_", "");
        try {
            return FarmRole.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
