package vn.edu.fpt.beefcare.web.rest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmAccessService;
import vn.edu.fpt.beefcare.service.IdentityService;
import vn.edu.fpt.beefcare.web.rest.vm.LoginVM;

/** Cookie session authentication. CSRF protection applies to login and every other state-changing request. */
@RestController
public class AuthenticateController {

    private final AuthenticationManager authenticationManager;
    private final FarmAccessService farmAccessService;
    private final SessionRegistry sessionRegistry;
    private final IdentityService identityService;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    @Value("${beefcare.security.session.timeout-seconds:28800}")
    private int standardTimeoutSeconds;

    @Value("${beefcare.security.session.remember-me-timeout-seconds:2592000}")
    private int rememberMeTimeoutSeconds;

    @Value("${beefcare.security.cookie-secure:false}")
    private boolean secureCookies;

    public AuthenticateController(
        AuthenticationManager authenticationManager,
        FarmAccessService farmAccessService,
        SessionRegistry sessionRegistry,
        IdentityService identityService
    ) {
        this.authenticationManager = authenticationManager;
        this.farmAccessService = farmAccessService;
        this.sessionRegistry = sessionRegistry;
        this.identityService = identityService;
    }

    /** Fetch this before login; send the returned value in X-XSRF-TOKEN and retain the XSRF-TOKEN cookie. */
    @GetMapping("/api/csrf")
    public CsrfToken csrf(CsrfToken token) {
        return token;
    }

    @PostMapping("/api/authenticate")
    public ResponseEntity<Void> authorize(@Valid @RequestBody LoginVM loginVM, HttpServletRequest request, HttpServletResponse response) {
        try {
            identityService.checkPasswordSignInAllowed(loginVM.getUsername());
        } catch (IdentityService.AccountSuspendedException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IdentityService.PasswordSignInDisabledException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IdentityService.AccountLoginLockedException ex) {
            return ResponseEntity.status(HttpStatus.LOCKED).build();
        }
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(loginVM.getUsername(), loginVM.getPassword())
            );
        } catch (AuthenticationException ex) {
            if (!(ex instanceof vn.edu.fpt.beefcare.security.UserNotActivatedException)) {
                identityService.recordFailedPasswordAttempt(loginVM.getUsername());
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        identityService.clearFailedPasswordAttempts(loginVM.getUsername());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        HttpSession session = request.getSession(true);
        session.setMaxInactiveInterval(loginVM.isRememberMe() ? rememberMeTimeoutSeconds : standardTimeoutSeconds);
        try {
            farmAccessService.currentActiveUser();
        } catch (DomainException ex) {
            SecurityContextHolder.clearContext();
            session.invalidate();
            return ResponseEntity.status(ex.getStatus()).build();
        }
        contextRepository.saveContext(context, request, response);
        sessionRegistry.registerNewSession(session.getId(), authentication.getName());
        if (loginVM.isRememberMe()) {
            response.addHeader(
                HttpHeaders.SET_COOKIE,
                ResponseCookie.from("JSESSIONID", session.getId())
                    .httpOnly(true)
                    .secure(secureCookies)
                    .sameSite("Lax")
                    .path("/")
                    .maxAge(rememberMeTimeoutSeconds)
                    .build()
                    .toString()
            );
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/authenticate")
    public ResponseEntity<Void> isAuthenticated(Principal principal) {
        return principal == null ? ResponseEntity.status(HttpStatus.UNAUTHORIZED).build() : ResponseEntity.noContent().build();
    }
}
