package vn.edu.fpt.beefcare.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

/** Gives cancelled or rejected Google consent the same public frontend outcome as a rejected OIDC identity. */
@Component
public class GoogleOidcFailureHandler implements AuthenticationFailureHandler {

    private final String frontendBaseUrl;

    public GoogleOidcFailureHandler(@Value("${beefcare.email.frontend-base-url}") String frontendBaseUrl) {
        this.frontendBaseUrl = frontendBaseUrl.replaceAll("/+$", "");
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
        throws IOException, ServletException {
        response.sendRedirect(frontendBaseUrl + "/sign-in?error=google-sign-in");
    }
}
