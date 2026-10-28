package vn.edu.fpt.beefcare.web.rest;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.net.URI;
import java.util.*;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.PlatformStaffAccessRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.security.SecurityUtils;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.UserService;
import vn.edu.fpt.beefcare.service.FarmAccessService;
import vn.edu.fpt.beefcare.service.FarmWorkspaceService;
import vn.edu.fpt.beefcare.service.IdentityService;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.dto.AdminUserDTO;
import vn.edu.fpt.beefcare.service.dto.PasswordChangeDTO;
import vn.edu.fpt.beefcare.web.rest.errors.*;
import vn.edu.fpt.beefcare.web.rest.vm.KeyAndPasswordVM;

/**
 * REST controller for managing the current user's account.
 */
@RestController
@RequestMapping("/api")
public class AccountResource {

    private static class AccountResourceException extends RuntimeException {

        private AccountResourceException(String message) {
            super(message);
        }
    }

    private final UserRepository userRepository;

    private final UserService userService;

    private final AppUserRepository appUserRepository;
    private final FarmAccessService farmAccessService;
    private final IdentityService identityService;
    private final UserDetailsService userDetailsService;
    private final SessionRegistry sessionRegistry;
    private final PlatformStaffAccessRepository platformStaffAccess;
    private final FarmWorkspaceService workspace;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    @Value("${beefcare.email.frontend-base-url}")
    private String frontendBaseUrl;

    @Value("${beefcare.security.session.timeout-seconds:28800}")
    private int sessionTimeoutSeconds;

    public AccountResource(
        UserRepository userRepository,
        UserService userService,
        AppUserRepository appUserRepository,
        FarmAccessService farmAccessService,
        IdentityService identityService,
        UserDetailsService userDetailsService,
        SessionRegistry sessionRegistry,
        PlatformStaffAccessRepository platformStaffAccess,
        FarmWorkspaceService workspace
    ) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.appUserRepository = appUserRepository;
        this.farmAccessService = farmAccessService;
        this.identityService = identityService;
        this.userDetailsService = userDetailsService;
        this.sessionRegistry = sessionRegistry;
        this.platformStaffAccess = platformStaffAccess;
        this.workspace = workspace;
    }

    /**
     * {@code POST  /register} : register the user.
     *
     * @param managedUserVM the managed user View Model.
     * @throws InvalidPasswordException {@code 400 (Bad Request)} if the password is incorrect.
     * @throws EmailAlreadyUsedException {@code 400 (Bad Request)} if the email is already used.
     * @throws LoginAlreadyUsedException {@code 400 (Bad Request)} if the login is already used.
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void registerAccount(@RequestBody RegistrationRequest request) {
        identityService.register(request.fullName(), request.email(), request.password(), request.confirmPassword(), request.termsAccepted());
    }

    /** SCR-03 fields. Rules are enforced by {@link IdentityService} so each failure carries its MSG-FE01 / MSG-COM code. */
    public record RegistrationRequest(String fullName, String email, String password, String confirmPassword, boolean termsAccepted) {}

    /**
     * {@code GET  /activate} : activate the registered user.
     *
     * @param key the activation key.
     * @throws RuntimeException {@code 500 (Internal Server Error)} if the user couldn't be activated.
     */
    @GetMapping("/activate")
    public ResponseEntity<Void> activateAccount(@RequestParam(value = "token") String token, HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) {
        User activated = identityService.activateEmail(token);
        UserDetails details = userDetailsService.loadUserByUsername(activated.getEmail());
        Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(details, null, details.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        if (request.getSession(false) != null) request.changeSessionId();
        HttpSession session = request.getSession(true);
        session.setMaxInactiveInterval(sessionTimeoutSeconds);
        contextRepository.saveContext(context, request, response);
        sessionRegistry.registerNewSession(session.getId(), authentication.getName());
        return ResponseEntity.status(HttpStatus.SEE_OTHER).location(URI.create(frontendBaseUrl.replaceAll("/+$", "") + "/owner-registration")).build();
    }

    /** Same answer for every address (GBR-03). The body is a JSON object: a bare JSON string would arrive with its quotes. */
    @PostMapping("/account/verification/resend")
    public void resendEmailVerification(@RequestBody EmailRequest request) {
        identityService.resendVerification(request.email());
    }

    public record EmailRequest(String email) {}

    /**
     * {@code GET  /account} : get the current user.
     *
     * @return the current user.
     * @throws RuntimeException {@code 500 (Internal Server Error)} if the user couldn't be returned.
     */
    @GetMapping("/account")
    public AdminUserDTO getAccount() {
        return userService
            .getUserWithAuthorities()
            .map(AdminUserDTO::new)
            .orElseThrow(() -> new AccountResourceException("User could not be found"));
    }

    /** Completes the personal Owner profile; it does not create a farm or grant farm/platform access. */
    @PostMapping("/account/owner-registration")
    public OwnerRegistrationResponse completeOwnerRegistration(@RequestBody OwnerRegistrationRequest request) {
        String name = fullName(request.fullName());
        String phone = phone(request.phone());
        if (!request.termsAccepted()) throw DomainException.badRequest(MessageCodes.FE01_14, "field", "termsAccepted");
        AppUser user = farmAccessService.currentActiveUser();
        user.setFullName(name);
        user.setPhone(phone);
        user.setOwnerRegistrationCompleted(true);
        user.setOwnerRegistrationCompletedAt(Instant.now());
        appUserRepository.save(user);
        return new OwnerRegistrationResponse(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(), true);
    }

    public record OwnerRegistrationRequest(String fullName, String phone, boolean termsAccepted) {}

    public record OwnerRegistrationResponse(Long id, String email, String fullName, String phone, boolean completed) {}

    @GetMapping("/account/profile")
    public ProfileResponse getProfile() {
        return profile(farmAccessService.currentActiveUser());
    }

    @PostMapping("/account/profile")
    public ProfileResponse updateProfile(@RequestBody ProfileUpdate request) {
        String name = fullName(request.fullName());
        String phone = phone(request.phone());
        AppUser account = farmAccessService.currentActiveUser();
        account.setFullName(name);
        account.setPhone(phone);
        appUserRepository.save(account);
        userRepository.findOneByEmailIgnoreCase(account.getEmail()).ifPresent(identity -> {
            identity.setFirstName(name.substring(0, Math.min(50, name.length())));
            userRepository.save(identity);
        });
        return profile(account);
    }

    /** SCR-07 / SCR-08: full name 2-100 characters. */
    private static String fullName(String value) {
        if (value == null || value.isBlank()) throw DomainException.required("fullName");
        String name = value.trim();
        if (name.length() < 2 || name.length() > 100) throw DomainException.invalid("fullName");
        return name;
    }

    /** SCR-07 / SCR-08: optional Vietnamese phone, 10 digits starting with 0 or +84 followed by 9 digits (MSG-COM-10). */
    private static String phone(String value) {
        if (value == null || value.isBlank()) return null;
        String phone = value.trim();
        if (!phone.matches("^(?:0[0-9]{9}|\\+84[0-9]{9})$")) throw DomainException.invalid("phone");
        return phone;
    }

    private ProfileResponse profile(AppUser account) {
        boolean verified = userRepository.findOneByEmailIgnoreCase(account.getEmail()).map(User::isActivated).orElse(false);
        String platformRole = platformStaffAccess.findOneByUserIdAndStatusIgnoreCase(account.getId(), "ACTIVE").map(access -> access.getRole()).orElse(null);
        List<FarmRoleSummary> farms = workspace.list().stream().map(farm -> new FarmRoleSummary(farm.id(), farm.name(), farm.role())).toList();
        return new ProfileResponse(account.getId(), account.getEmail(), account.getFullName(), account.getPhone(), verified,
            account.isPasswordLoginEnabled(), account.getGoogleSubject() != null, account.isOwnerRegistrationCompleted(), platformRole, farms);
    }

    public record ProfileUpdate(String fullName, String phone) {}

    /** SCR-08 header: the platform role (staff) and the role in each available farm. The permission table per role is the fixed GBR-06 policy. */
    public record ProfileResponse(Long id, String email, String fullName, String phone, boolean emailVerified,
        boolean passwordSignInEnabled, boolean googleSignInLinked, boolean ownerRegistrationCompleted,
        String platformRole, List<FarmRoleSummary> farms) {}

    public record FarmRoleSummary(Long farmId, String farmName, String role) {}

    /**
     * {@code POST  /account} : update the current user information.
     *
     * @param userDTO the current user information.
     * @throws EmailAlreadyUsedException {@code 400 (Bad Request)} if the email is already used.
     * @throws RuntimeException {@code 500 (Internal Server Error)} if the user login wasn't found.
     */
    @PostMapping("/account")
    public void saveAccount(@Valid @RequestBody AdminUserDTO userDTO) {
        String userLogin = SecurityUtils.getCurrentUserLogin().orElseThrow(() ->
            new AccountResourceException("Current user login not found")
        );
        Optional<User> existingUser = userRepository.findOneByEmailIgnoreCase(userDTO.getEmail());
        if (existingUser.isPresent() && (!existingUser.orElseThrow().getLogin().equalsIgnoreCase(userLogin))) {
            throw new EmailAlreadyUsedException();
        }
        Optional<User> user = userRepository.findOneByLogin(userLogin);
        if (!user.isPresent()) {
            throw new AccountResourceException("User could not be found");
        }
        if (userDTO.getEmail() == null || !user.orElseThrow().getEmail().equalsIgnoreCase(userDTO.getEmail().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Changing the sign-in email requires an email-verification flow");
        }
        userService.updateUser(
            userDTO.getFirstName(),
            userDTO.getLastName(),
            userDTO.getEmail(),
            userDTO.getLangKey(),
            userDTO.getImageUrl()
        );
        appUserRepository.findOneByEmailIgnoreCase(userDTO.getEmail()).ifPresent(account -> {
            String name = ((userDTO.getFirstName() == null ? "" : userDTO.getFirstName().trim()) + " " +
                (userDTO.getLastName() == null ? "" : userDTO.getLastName().trim())).trim();
            if (!name.isBlank()) {
                account.setFullName(name);
                appUserRepository.save(account);
            }
        });
    }

    /**
     * {@code POST  /account/change-password} : changes the current user's password.
     *
     * @param passwordChangeDto current and new password.
     * @throws InvalidPasswordException {@code 400 (Bad Request)} if the new password is incorrect.
     */
    @PostMapping(path = "/account/change-password")
    public void changePassword(@RequestBody PasswordChangeDTO passwordChangeDto) {
        identityService.changePassword(passwordChangeDto.getCurrentPassword(), passwordChangeDto.getNewPassword(), passwordChangeDto.getConfirmPassword());
    }

    /**
     * {@code POST   /account/reset-password/init} : Send an email to reset the password of the user.
     *
     * @param mail the mail of the user.
     */
    @PostMapping(path = "/account/reset-password/init")
    public void requestPasswordReset(@RequestBody EmailRequest request) {
        identityService.requestPasswordReset(request.email());
    }

    @GetMapping(path = "/account/reset-password/validate")
    public ResetLinkValidation validateResetLink(@RequestParam("token") String token) {
        return new ResetLinkValidation(identityService.isPasswordResetLinkValid(token));
    }

    public record ResetLinkValidation(boolean valid) {}

    /**
     * {@code POST   /account/reset-password/finish} : Finish to reset the password of the user.
     *
     * @param keyAndPassword the generated key and the new password.
     * @throws InvalidPasswordException {@code 400 (Bad Request)} if the password is incorrect.
     * @throws RuntimeException {@code 500 (Internal Server Error)} if the password could not be reset.
     */
    @PostMapping(path = "/account/reset-password/finish")
    public void finishPasswordReset(@RequestBody KeyAndPasswordVM keyAndPassword) {
        identityService.completePasswordReset(keyAndPassword.getKey(), keyAndPassword.getNewPassword(), keyAndPassword.getConfirmPassword());
    }

}
