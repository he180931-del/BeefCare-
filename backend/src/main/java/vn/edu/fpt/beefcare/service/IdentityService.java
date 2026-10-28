package vn.edu.fpt.beefcare.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.session.SessionInformation;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.fpt.beefcare.domain.AccountLinkToken;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Authority;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AuthorityRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.security.AuthoritiesConstants;
import vn.edu.fpt.beefcare.security.SecurityUtils;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

/** Account registration, verification, password reset and password-method policy. */
@Service
public class IdentityService {

    static final String EMAIL_VERIFICATION = "EMAIL_VERIFICATION";
    static final String PASSWORD_RESET = "PASSWORD_RESET";
    static final int MAX_LINK_EMAILS_PER_HOUR = 5;
    private static final Duration VERIFICATION_LIFETIME = Duration.ofHours(24);
    private static final Duration RESET_LIFETIME = Duration.ofMinutes(30);
    private static final Duration PASSWORD_LOCK = Duration.ofMinutes(15);

    private final UserRepository userRepository;
    private final AppUserRepository appUserRepository;
    private final AuthorityRepository authorityRepository;
    private final AccountLinkTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final ActionLinkSigner linkSigner;
    private final SessionRegistry sessionRegistry;

    public IdentityService(
        UserRepository userRepository,
        AppUserRepository appUserRepository,
        AuthorityRepository authorityRepository,
        AccountLinkTokenRepository tokenRepository,
        PasswordEncoder passwordEncoder,
        MailService mailService,
        ActionLinkSigner linkSigner,
        SessionRegistry sessionRegistry
    ) {
        this.userRepository = userRepository;
        this.appUserRepository = appUserRepository;
        this.authorityRepository = authorityRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.linkSigner = linkSigner;
        this.sessionRegistry = sessionRegistry;
    }

    @Transactional
    public void register(String fullName, String email, String password, String confirmation, boolean termsAccepted) {
        String normalizedEmail = normalizeEmail(email);
        if (fullName == null || fullName.isBlank() || fullName.trim().length() > 255) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name is required");
        validatePassword(password, normalizedEmail, confirmation);
        if (!termsAccepted) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Terms acceptance is required");
        if (userRepository.findOneByEmailIgnoreCase(normalizedEmail).isPresent() || appUserRepository.findOneByEmailIgnoreCase(normalizedEmail).isPresent()) {
            throw new EmailAlreadyUsedException();
        }

        User identity = new User();
        identity.setLogin(normalizedEmail.length() <= 50 ? normalizedEmail : "email-" + UUID.randomUUID().toString().replace("-", ""));
        identity.setEmail(normalizedEmail);
        identity.setPassword(passwordEncoder.encode(password));
        identity.setActivated(false);
        identity.setLangKey("vi");
        identity.setFirstName(fullName.trim().substring(0, Math.min(50, fullName.trim().length())));
        authorityRepository.findById(AuthoritiesConstants.USER).ifPresent(identity.getAuthorities()::add);
        if (identity.getAuthorities().isEmpty()) throw new IllegalStateException("The standard user authority is not configured");
        userRepository.save(identity);

        AppUser account = new AppUser();
        account.setEmail(normalizedEmail);
        account.setFullName(fullName.trim());
        account.setAccountStatus("ACTIVE");
        account.setPasswordLoginEnabled(true);
        appUserRepository.save(account);
        sendLink(identity, EMAIL_VERIFICATION, VERIFICATION_LIFETIME, "VERIFY_EMAIL");
    }

    @Transactional
    public User activateEmail(String token) {
        AccountLinkToken link = consume(token, EMAIL_VERIFICATION);
        User user = userRepository.findOneWithAuthoritiesByLogin(link.getUser().getLogin()).orElseThrow(IdentityService::invalidLink);
        AppUser projection = appUserRepository.findOneByEmailIgnoreCase(user.getEmail()).orElseThrow(IdentityService::invalidLink);
        if (!"ACTIVE".equalsIgnoreCase(projection.getAccountStatus())) throw new AccountSuspendedException();
        if (user.isActivated()) return user;
        user.setActivated(true);
        user.setActivationKey(null);
        user.setFailedPasswordAttempts(0);
        user.setPasswordLockedUntil(null);
        return user;
    }

    @Transactional
    public void resendVerification(String email) {
        findActivePasswordAccount(email).filter(user -> !user.isActivated()).ifPresent(user -> issueRateLimited(user, EMAIL_VERIFICATION, VERIFICATION_LIFETIME, "VERIFY_EMAIL"));
    }

    /** Always responds identically; unknown addresses and Google-only accounts cause no mail. */
    @Transactional
    public void requestPasswordReset(String email) {
        findActivePasswordAccount(email).filter(User::isActivated).ifPresent(user -> issueRateLimited(user, PASSWORD_RESET, RESET_LIFETIME, "RESET_PASSWORD"));
    }

    @Transactional
    public boolean isPasswordResetLinkValid(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return false;
        return tokenRepository.findOneByTokenHashAndTokenType(linkSigner.hash(rawToken), PASSWORD_RESET)
            .filter(link -> link.getUsedAt() == null && link.getExpiresAt().isAfter(Instant.now()))
            .filter(link -> link.getUser().isActivated())
            .filter(link -> appUserRepository.findOneByEmailIgnoreCase(link.getUser().getEmail()).filter(account -> "ACTIVE".equalsIgnoreCase(account.getAccountStatus())).isPresent())
            .isPresent();
    }

    @Transactional
    public User completePasswordReset(String rawToken, String newPassword, String confirmation) {
        AccountLinkToken link = consume(rawToken, PASSWORD_RESET);
        User user = userRepository.findOneWithAuthoritiesByLogin(link.getUser().getLogin()).orElseThrow(IdentityService::invalidLink);
        validatePassword(newPassword, user.getEmail(), confirmation);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setFailedPasswordAttempts(0);
        user.setPasswordLockedUntil(null);
        user.setResetKey(null);
        user.setResetDate(null);
        expireOtherSessions(user, null);
        AppUser account = appUserRepository.findOneByEmailIgnoreCase(user.getEmail()).filter(value -> "ACTIVE".equalsIgnoreCase(value.getAccountStatus())).orElseThrow(IdentityService::invalidLink);
        account.setPasswordLoginEnabled(true);
        mailService.sendEmail(user.getEmail(), "Your BeefCare password changed", "Your password was changed. If you did not make this change, contact BeefCare support.", false, false);
        return user;
    }

    @Transactional
    public void changePassword(String currentPassword, String newPassword, String confirmation) {
        String login = SecurityUtils.getCurrentUserLogin().orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        User user = findLogin(login).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        AppUser account = appUserRepository.findOneByEmailIgnoreCase(user.getEmail()).orElseThrow(IdentityService::invalidLink);
        if (!account.isPasswordLoginEnabled()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Google reauthentication is required before adding a password");
        if (!passwordEncoder.matches(currentPassword == null ? "" : currentPassword, user.getPassword())) {
            recordFailedPasswordAttempt(login);
            throw new InvalidPasswordException();
        }
        validatePassword(newPassword, user.getEmail(), confirmation);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setFailedPasswordAttempts(0);
        user.setPasswordLockedUntil(null);
        expireOtherSessions(user, null);
        mailService.sendEmail(user.getEmail(), "Your BeefCare password changed", "Your password was changed. If you did not make this change, contact BeefCare support.", false, false);
    }

    @Transactional
    public User checkPasswordSignInAllowed(String login) {
        Optional<User> found = userRepository.findOneByEmailIgnoreCase(login.trim()).or(() -> userRepository.findOneByLogin(login.trim().toLowerCase(Locale.ROOT)));
        if (found.isEmpty()) return null;
        User user = found.get();
        AppUser account = appUserRepository.findOneByEmailIgnoreCase(user.getEmail()).orElse(null);
        if (account != null && "SUSPENDED".equalsIgnoreCase(account.getAccountStatus())) throw new AccountSuspendedException();
        if (account != null && !account.isPasswordLoginEnabled()) throw new PasswordSignInDisabledException();
        if (user.getPasswordLockedUntil() != null && user.getPasswordLockedUntil().isAfter(Instant.now())) {
            throw new AccountLoginLockedException(user.getPasswordLockedUntil());
        }
        if (user.getPasswordLockedUntil() != null) {
            user.setPasswordLockedUntil(null);
            user.setFailedPasswordAttempts(0);
        }
        return user;
    }

    @Transactional
    public void recordFailedPasswordAttempt(String login) {
        User user = findLogin(login).orElse(null);
        if (user == null || !user.isActivated()) return;
        int attempts = user.getFailedPasswordAttempts() + 1;
        if (attempts >= 5) {
            user.setFailedPasswordAttempts(5);
            user.setPasswordLockedUntil(Instant.now().plus(PASSWORD_LOCK));
        } else {
            user.setFailedPasswordAttempts(attempts);
        }
    }

    @Transactional
    public void clearFailedPasswordAttempts(String login) {
        findLogin(login).ifPresent(user -> {
            user.setFailedPasswordAttempts(0);
            user.setPasswordLockedUntil(null);
        });
    }

    private Optional<User> findActivePasswordAccount(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return userRepository.findOneByEmailIgnoreCase(normalized)
            .filter(user -> appUserRepository.findOneByEmailIgnoreCase(normalized)
                .filter(AppUser::isPasswordLoginEnabled)
                .filter(account -> "ACTIVE".equalsIgnoreCase(account.getAccountStatus()))
                .isPresent());
    }

    private void issueRateLimited(User user, String type, Duration lifetime, String templateKey) {
        Instant now = Instant.now();
        if (tokenRepository.countByUserIdAndTokenTypeAndCreatedAtAfter(user.getId(), type, now.minus(Duration.ofHours(1))) >= MAX_LINK_EMAILS_PER_HOUR) {
            return;
        }
        sendLink(user, type, lifetime, templateKey);
    }

    private void sendLink(User user, String type, Duration lifetime, String templateKey) {
        Instant now = Instant.now();
        tokenRepository.invalidateUnused(user.getId(), type, now);
        AccountLinkToken link = new AccountLinkToken();
        link.setTokenHash(linkSigner.hash(linkSigner.newNonce())); // replaced in the same transaction after the id is assigned
        link.setTokenType(type);
        link.setTokenNonce(linkSigner.newNonce());
        link.setCreatedAt(now);
        link.setExpiresAt(now.plus(lifetime));
        link.setUser(user);
        tokenRepository.save(link);
        String raw = linkSigner.bearer("ACCOUNT_LINK:" + type, link.getId(), link.getTokenNonce());
        link.setTokenHash(linkSigner.hash(raw));
        tokenRepository.saveAndFlush(link);
        mailService.queueActionLink(user.getEmail(), templateKey, "ACCOUNT_LINK", link.getId(), user.getFirstName(), null, null);
    }

    private AccountLinkToken consume(String rawToken, String type) {
        if (rawToken == null || rawToken.isBlank()) throw invalidLink();
        AccountLinkToken link = tokenRepository.findOneByTokenHashAndTokenType(linkSigner.hash(rawToken), type).orElseThrow(IdentityService::invalidLink);
        Instant now = Instant.now();
        if (link.getUsedAt() != null || !link.getExpiresAt().isAfter(now)) throw invalidLink();
        link.setUsedAt(now);
        return link;
    }

    private Optional<User> findLogin(String login) {
        return userRepository.findOneByEmailIgnoreCase(login.trim()).or(() -> userRepository.findOneByLogin(login.trim().toLowerCase(Locale.ROOT)));
    }

    private static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 254 || !normalized.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email address is invalid");
        }
        return normalized;
    }

    private static void validatePassword(String password, String email, String confirmation) {
        if (password == null || password.length() < 8 || password.length() > 128 || password.equalsIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password does not meet the required policy");
        }
        if (!password.equals(confirmation)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password confirmation does not match");
    }

    private static ResponseStatusException invalidLink() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "This account link is invalid or expired");
    }

    private void expireOtherSessions(User user, String currentSessionId) {
        if (currentSessionId == null && RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            var session = attributes.getRequest().getSession(false);
            if (session != null) currentSessionId = session.getId();
        }
        java.util.Set<String> principals = new java.util.HashSet<>();
        principals.add(user.getLogin());
        if (user.getEmail() != null) principals.add(user.getEmail());
        for (String principal : principals) {
            for (SessionInformation information : sessionRegistry.getAllSessions(principal, false)) {
                if (currentSessionId == null || !currentSessionId.equals(information.getSessionId())) information.expireNow();
            }
        }
    }

    public static class AccountSuspendedException extends RuntimeException {}

    public static class PasswordSignInDisabledException extends RuntimeException {}

    public static class AccountLoginLockedException extends RuntimeException {
        private final Instant lockedUntil;
        public AccountLoginLockedException(Instant lockedUntil) { this.lockedUntil = lockedUntil; }
        public Instant getLockedUntil() { return lockedUntil; }
    }
}
