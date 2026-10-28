package vn.edu.fpt.beefcare.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;
import vn.edu.fpt.beefcare.service.GoogleIdentityService;

/** Converts a verified OIDC identity into BeefCare's current server-side session principal. */
@Component
public class GoogleOidcSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger LOG = LoggerFactory.getLogger(GoogleOidcSuccessHandler.class);
    private final GoogleIdentityService identities;
    private final UserDetailsService userDetailsService;
    private final SessionRegistry sessions;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();
    private final String frontendBaseUrl;

    @Value("${beefcare.security.session.timeout-seconds:28800}")
    private int sessionTimeoutSeconds;

    public GoogleOidcSuccessHandler(
        GoogleIdentityService identities,
        UserDetailsService userDetailsService,
        SessionRegistry sessions,
        @Value("${beefcare.email.frontend-base-url}") String frontendBaseUrl
    ) {
        this.identities = identities;
        this.userDetailsService = userDetailsService;
        this.sessions = sessions;
        this.frontendBaseUrl = frontendBaseUrl.replaceAll("/+$", "");
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication source) throws IOException, ServletException {
        try {
            if (!(source instanceof OAuth2AuthenticationToken token) || !(token.getPrincipal() instanceof OidcUser google)) {
                throw new IllegalStateException("Expected an OpenID Connect identity");
            }
            GoogleIdentityService.Result linked = identities.provisionOrLink(google);
            UserDetails details = userDetailsService.loadUserByUsername(linked.user().getEmail());
            Authentication beefCareAuthentication = UsernamePasswordAuthenticationToken.authenticated(details, null, details.getAuthorities());
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(beefCareAuthentication);
            SecurityContextHolder.setContext(context);
            if (request.getSession(false) != null) request.changeSessionId();
            HttpSession session = request.getSession(true);
            session.setMaxInactiveInterval(sessionTimeoutSeconds);
            contextRepository.saveContext(context, request, response);
            sessions.registerNewSession(session.getId(), beefCareAuthentication.getName());
            session.setAttribute(GoogleReauthentication.AUTHENTICATED_AT, java.time.Instant.now());
            boolean reauthentication = Boolean.TRUE.equals(session.getAttribute(GoogleReauthentication.RETURN_TO_PROFILE));
            session.removeAttribute(GoogleReauthentication.RETURN_TO_PROFILE);
            String destination = reauthentication ? "/profile?googleReauthenticated=true"
                : linked.ownerRegistrationCompleted() ? "/select-farm" : "/owner-registration";
            response.sendRedirect(frontendBaseUrl + destination);
        } catch (RuntimeException failure) {
            SecurityContextHolder.clearContext();
            LOG.warn("Google sign-in was rejected ({})", failure.getClass().getSimpleName());
            response.sendRedirect(frontendBaseUrl + "/sign-in?error=google-sign-in");
        }
    }
}
