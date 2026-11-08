package vn.edu.fpt.beefcare.service;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Authority;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AuthorityRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.security.AuthoritiesConstants;

/** Links only Google-verified emails; Google passwords and access tokens are not retained by the identity model. */
@Service
public class GoogleIdentityService {

    private final AppUserRepository appUsers;
    private final UserRepository identities;
    private final AuthorityRepository authorities;
    private final PasswordEncoder passwordEncoder;

    public GoogleIdentityService(AppUserRepository appUsers, UserRepository identities, AuthorityRepository authorities, PasswordEncoder passwordEncoder) {
        this.appUsers = appUsers;
        this.identities = identities;
        this.authorities = authorities;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Result provisionOrLink(OidcUser google) {
        String subject = google.getSubject();
        String email = normalizeEmail(google.getClaimAsString("email"));
        if (subject == null || subject.isBlank() || !Boolean.TRUE.equals(google.getClaim("email_verified"))) throw denied("missing-subject-or-unverified-email");

        Optional<AppUser> bySubject = appUsers.findOneByGoogleSubject(subject);
        if (bySubject.isPresent() && !email.equals(bySubject.orElseThrow().getEmail())) throw denied("subject-email-mismatch");
        AppUser account = bySubject.or(() -> appUsers.findOneByEmailIgnoreCase(email)).orElse(null);
        if (account != null && "SUSPENDED".equalsIgnoreCase(account.getAccountStatus())) {
            throw DomainException.forbidden(MessageCodes.FE01_03, "email", account.getEmail());
        }
        if (account != null && !"ACTIVE".equalsIgnoreCase(account.getAccountStatus())) throw denied("inactive-account");
        if (account != null && account.getGoogleSubject() != null && !account.getGoogleSubject().equals(subject)) throw denied("conflicting-google-subject");

        User identity = identities.findOneByEmailIgnoreCase(email).orElse(null);

        String displayName = safeDisplayName(google, email);
        if (account == null) {
            account = new AppUser();
            account.setEmail(email);
            account.setAccountStatus("ACTIVE");
            account.setPasswordLoginEnabled(false);
            account.setFullName(displayName);
        }
        Instant signedInAt = Instant.now();
        account.setGoogleSubject(subject);
        if (account.getGoogleLinkedAt() == null) account.setGoogleLinkedAt(signedInAt);
        account.setGoogleLastUsedAt(signedInAt);
        if (account.getFullName() == null || account.getFullName().isBlank()) account.setFullName(displayName);
        appUsers.saveAndFlush(account);

        if (identity == null) {
            identity = new User();
            identity.setLogin(email.length() <= 50 ? email : "google-" + UUID.randomUUID().toString().replace("-", ""));
            // Google-only identities have no usable local password; an unpredictable discarded secret satisfies legacy schema.
            identity.setPassword(passwordEncoder.encode(UUID.randomUUID() + UUID.randomUUID().toString()));
            identity.setEmail(email);
            identity.setLangKey("vi");
            identity.setActivated(true);
            identity.setFirstName(firstName(displayName));
            identity.setLastName(lastName(displayName));
            Authority userAuthority = authorities.findById(AuthoritiesConstants.USER).orElseThrow(() -> new IllegalStateException("ROLE_USER is not configured"));
            identity.getAuthorities().add(userAuthority);
        } else {
            identity.setActivated(true); // Google's verified claim is sufficient to verify an existing email identity.
            identity.setActivationKey(null);
            if ((identity.getFirstName() == null || identity.getFirstName().isBlank()) && !displayName.isBlank()) identity.setFirstName(firstName(displayName));
        }
        identities.saveAndFlush(identity);
        return new Result(identity, account.isOwnerRegistrationCompleted());
    }

    private String normalizeEmail(String raw) {
        if (raw == null || raw.isBlank()) throw denied("missing-email");
        String email = raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw denied("invalid-email");
        return email;
    }

    private String safeDisplayName(OidcUser google, String email) {
        String name = google.getClaimAsString("name");
        if (name == null || name.isBlank()) name = google.getClaimAsString("given_name");
        if (name == null || name.isBlank()) name = email.substring(0, email.indexOf('@'));
        return name.trim().substring(0, Math.min(255, name.trim().length()));
    }

    private String firstName(String fullName) {
        String value = fullName.trim().split("\\s+", 2)[0];
        return value.substring(0, Math.min(50, value.length()));
    }

    private String lastName(String fullName) {
        String[] parts = fullName.trim().split("\\s+", 2);
        return parts.length > 1 ? parts[1].substring(0, Math.min(50, parts[1].length())) : null;
    }

    private static OAuth2AuthenticationException denied(String reason) {
        return new OAuth2AuthenticationException(new OAuth2Error("access_denied", null, reason));
    }

    public record Result(User user, boolean ownerRegistrationCompleted) {}
}
