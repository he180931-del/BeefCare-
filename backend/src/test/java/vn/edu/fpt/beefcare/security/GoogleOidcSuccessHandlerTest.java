package vn.edu.fpt.beefcare.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.core.session.SessionRegistry;
import org.springframework.security.core.userdetails.UserDetailsService;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.GoogleIdentityService;
import vn.edu.fpt.beefcare.service.MessageCodes;

class GoogleOidcSuccessHandlerTest {

    @Test
    void redirectsASuspendedGoogleAccountToTheSuspendedState() throws Exception {
        GoogleIdentityService identities = mock(GoogleIdentityService.class);
        UserDetailsService userDetails = mock(UserDetailsService.class);
        SessionRegistry sessions = mock(SessionRegistry.class);
        GoogleOidcSuccessHandler handler = new GoogleOidcSuccessHandler(identities, userDetails, sessions, "https://app.beefcare.test/");
        OidcUser google = mock(OidcUser.class);
        when(identities.provisionOrLink(google)).thenThrow(DomainException.forbidden(MessageCodes.FE01_03, "email", "suspended@example.test"));
        OAuth2AuthenticationToken source = new OAuth2AuthenticationToken(google, List.of(new SimpleGrantedAuthority("ROLE_USER")), "google");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, source);

        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(response.getRedirectedUrl()).isEqualTo("https://app.beefcare.test/tai-khoan-tam-ngung?email=suspended%40example.test");
    }

    @Test
    void doesNotHaveALockoutSpecificGoogleFailurePath() throws Exception {
        GoogleIdentityService identities = mock(GoogleIdentityService.class);
        UserDetailsService userDetails = mock(UserDetailsService.class);
        SessionRegistry sessions = mock(SessionRegistry.class);
        GoogleOidcSuccessHandler handler = new GoogleOidcSuccessHandler(identities, userDetails, sessions, "https://app.beefcare.test/");
        OidcUser google = mock(OidcUser.class);
        when(identities.provisionOrLink(google)).thenThrow(DomainException.forbidden("MSG-FE01-12"));
        OAuth2AuthenticationToken source = new OAuth2AuthenticationToken(google, List.of(new SimpleGrantedAuthority("ROLE_USER")), "google");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, source);

        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(response.getRedirectedUrl()).isEqualTo("https://app.beefcare.test/sign-in?error=google-sign-in");
    }
}
