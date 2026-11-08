package vn.edu.fpt.beefcare.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

class GoogleOidcFailureHandlerTest {

    @Test
    void sendsCancelledOrRejectedConsentToTheFrontendSignInState() throws Exception {
        GoogleOidcFailureHandler handler = new GoogleOidcFailureHandler("https://app.beefcare.test/");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.onAuthenticationFailure(new MockHttpServletRequest(), response, new BadCredentialsException("cancelled"));

        assertThat(response.getStatus()).isEqualTo(302);
        assertThat(response.getRedirectedUrl()).isEqualTo("https://app.beefcare.test/sign-in?error=google-sign-in");
    }
}
