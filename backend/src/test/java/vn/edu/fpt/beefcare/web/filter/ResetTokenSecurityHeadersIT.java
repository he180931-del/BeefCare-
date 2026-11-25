package vn.edu.fpt.beefcare.web.filter;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;

/** FE-01 WBS7: reset-token routes use scoped referrer/cache hardening. */
@ServiceIntegrationTest
@TestPropertySource(
    properties =
        "spring.datasource.url=jdbc:h2:mem:reset-token-security-headers;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
)
class ResetTokenSecurityHeadersIT {

    private static final String TOKEN = "reset-token-sentinel";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void resetSpaRouteScrubsTokenFromResponseAndUsesScopedSecurityHeaders() throws Exception {
        mockMvc.perform(get("/resetpassword").param("token", TOKEN).param("email", "owner@example.test"))
            .andExpect(status().isOk())
            .andExpect(forwardedUrl("/index.html"))
            .andExpect(content().string(not(containsString(TOKEN))))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void resetValidationResponseUsesScopedSecurityHeadersWithoutConsumingToken() throws Exception {
        mockMvc.perform(get("/api/account/reset-password/validate").param("token", TOKEN))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.valid").value(false))
            .andExpect(content().string(not(containsString(TOKEN))))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void resetFinishResponseUsesScopedSecurityHeadersForInvalidToken() throws Exception {
        mockMvc.perform(post("/api/account/reset-password/finish")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"key\":\"" + TOKEN + "\",\"newPassword\":\"ResetPassword-88\",\"confirmPassword\":\"ResetPassword-88\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().string(not(containsString(TOKEN))))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void unrelatedCsrfResponseKeepsTheExistingReferrerPolicy() throws Exception {
        mockMvc.perform(get("/api/csrf"))
            .andExpect(status().isOk())
            .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }
}
