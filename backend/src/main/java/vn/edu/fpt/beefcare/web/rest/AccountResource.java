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
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.security.SecurityUtils;
import vn.edu.fpt.beefcare.service.UserService;
import vn.edu.fpt.beefcare.service.FarmAccessService;
import vn.edu.fpt.beefcare.service.IdentityService;
import vn.edu.fpt.beefcare.service.dto.AdminUserDTO;
import vn.edu.fpt.beefcare.service.dto.PasswordChangeDTO;
import vn.edu.fpt.beefcare.web.rest.errors.*;
import vn.edu.fpt.beefcare.web.rest.vm.KeyAndPasswordVM;
import vn.edu.fpt.beefcare.web.rest.vm.ManagedUserVM;

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
        SessionRegistry sessionRegistry
    ) {
        this.userRepository = userRepository;
        this.userService = userService;
        this.appUserRepository = appUserRepository;
        this.farmAccessService = farmAccessService;
        this.identityService = identityService;
        this.userDetailsService = userDetailsService;
        this.sessionRegistry = sessionRegistry;
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
    public void registerAccount(@Valid @RequestBody ManagedUserVM managedUserVM) {
        String fullName = managedUserVM.getFullName();
        if (fullName == null || fullName.isBlank()) {
            fullName = ((managedUserVM.getFirstName() == null ? "" : managedUserVM.getFirstName().trim()) + " " +
                (managedUserVM.getLastName() == null ? "" : managedUserVM.getLastName().trim())).trim();
        }
        identityService.register(fullName, managedUserVM.getEmail(), managedUserVM.getPassword(), managedUserVM.getConfirmPassword(), managedUserVM.isTermsAccepted());
    }

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

    @PostMapping("/account/verification/resend")
    public void resendEmailVerification(@RequestBody String email) {
        identityService.resendVerification(email);
    }

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
    public OwnerRegistrationResponse completeOwnerRegistration(@Valid @RequestBody OwnerRegistrationRequest request) {
        if (!request.termsAccepted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Terms acceptance is required");
        }
        AppUser user = farmAccessService.currentActiveUser();
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone() == null || request.phone().isBlank() ? null : request.phone().trim());
        user.setOwnerRegistrationCompleted(true);
        user.setOwnerRegistrationCompletedAt(Instant.now());
        appUserRepository.save(user);
        return new OwnerRegistrationResponse(user.getId(), user.getEmail(), user.getFullName(), user.getPhone(), true);
    }

    public record OwnerRegistrationRequest(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 255) String fullName,
        @jakarta.validation.constraints.Size(max = 255) String phone,
        boolean termsAccepted
    ) {}

    public record OwnerRegistrationResponse(Long id, String email, String fullName, String phone, boolean completed) {}

    @GetMapping("/account/profile")
    public ProfileResponse getProfile() {
        AppUser account = farmAccessService.currentActiveUser();
        boolean verified = userRepository.findOneByEmailIgnoreCase(account.getEmail()).map(User::isActivated).orElse(false);
        return new ProfileResponse(account.getId(), account.getEmail(), account.getFullName(), account.getPhone(), verified,
            account.isPasswordLoginEnabled(), account.getGoogleSubject() != null, account.isOwnerRegistrationCompleted());
    }

    @PostMapping("/account/profile")
    public ProfileResponse updateProfile(@Valid @RequestBody ProfileUpdate request) {
        AppUser account = farmAccessService.currentActiveUser();
        account.setFullName(request.fullName().trim());
        account.setPhone(request.phone() == null || request.phone().isBlank() ? null : request.phone().trim());
        appUserRepository.save(account);
        userRepository.findOneByEmailIgnoreCase(account.getEmail()).ifPresent(identity -> {
            identity.setFirstName(request.fullName().trim().substring(0, Math.min(50, request.fullName().trim().length())));
            userRepository.save(identity);
        });
        boolean verified = userRepository.findOneByEmailIgnoreCase(account.getEmail()).map(User::isActivated).orElse(false);
        return new ProfileResponse(account.getId(), account.getEmail(), account.getFullName(), account.getPhone(), verified,
            account.isPasswordLoginEnabled(), account.getGoogleSubject() != null, account.isOwnerRegistrationCompleted());
    }

    public record ProfileUpdate(
        @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 255) String fullName,
        @jakarta.validation.constraints.Size(max = 255) String phone
    ) {}

    public record ProfileResponse(Long id, String email, String fullName, String phone, boolean emailVerified,
        boolean passwordSignInEnabled, boolean googleSignInLinked, boolean ownerRegistrationCompleted) {}

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
    public void requestPasswordReset(@RequestBody String mail) {
        identityService.requestPasswordReset(mail);
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
