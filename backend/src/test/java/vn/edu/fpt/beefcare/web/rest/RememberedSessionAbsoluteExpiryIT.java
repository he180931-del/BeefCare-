package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.UserRepository;

/** FE-01 WBS6 contract tests; the absolute-expiry attribute name is part of the server-session contract. */
@ServiceIntegrationTest
class RememberedSessionAbsoluteExpiryIT {

    private static final String ABSOLUTE_EXPIRY_ATTRIBUTE = "beefcare.security.session.absolute-expiry";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    @Transactional
    void rememberedLoginSetsAnAbsoluteExpirySeparateFromInactivityTimeout() throws Exception {
        User user = createIdentity("remembered-cap-login");
        MockHttpSession session = login(user.getLogin(), true);

        assertThat(session.getMaxInactiveInterval()).isEqualTo(30 * 24 * 3600);
        assertThat(session.getAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE)).isInstanceOf(Instant.class);
        assertThat((Instant) session.getAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE)).isAfter(Instant.now());
    }

    @Test
    @Transactional
    void requestBeforeRememberedAbsoluteExpiryRemainsAuthenticated() throws Exception {
        User user = createIdentity("remembered-cap-before");
        MockHttpSession session = login(user.getLogin(), true);
        Instant deadline = Instant.now().plusSeconds(60);
        session.setAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE, deadline);

        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isOk());
        assertThat(session.isInvalid()).isFalse();
        assertThat(session.getAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE)).isEqualTo(deadline);
    }

    @Test
    @Transactional
    void requestAtOrAfterRememberedAbsoluteExpiryInvalidatesSessionWithUnauthorized() throws Exception {
        User user = createIdentity("remembered-cap-after");
        MockHttpSession session = login(user.getLogin(), true);
        session.setAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE, Instant.now().minusSeconds(1));

        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isUnauthorized());
        assertThat(session.isInvalid()).isTrue();
    }

    @Test
    @Transactional
    void authenticatedActivityDoesNotMoveRememberedAbsoluteDeadline() throws Exception {
        User user = createIdentity("remembered-cap-fixed");
        MockHttpSession session = login(user.getLogin(), true);
        Instant deadline = Instant.now().plusSeconds(60);
        session.setAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE, deadline);

        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isOk());
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isOk());

        assertThat(session.getAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE)).isEqualTo(deadline);
    }

    @Test
    @Transactional
    void ordinarySessionHasNoRememberedAbsoluteCap() throws Exception {
        User user = createIdentity("ordinary-no-cap");
        MockHttpSession session = login(user.getLogin(), false);

        assertThat(session.getMaxInactiveInterval()).isEqualTo(8 * 3600);
        assertThat(session.getAttribute(ABSOLUTE_EXPIRY_ATTRIBUTE)).isNull();
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isOk());
        assertThat(session.isInvalid()).isFalse();
    }

    private User createIdentity(String login) {
        User user = new User();
        user.setLogin(login);
        user.setEmail(login + "@example.com");
        user.setActivated(true);
        user.setPassword(passwordEncoder.encode("secret"));
        return users.saveAndFlush(user);
    }

    private MockHttpSession login(String username, boolean rememberMe) throws Exception {
        MvcResult csrf = mockMvc.perform(get("/api/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode body = objectMapper.readTree(csrf.getResponse().getContentAsByteArray());
        Cookie cookie = csrf.getResponse().getCookie("XSRF-TOKEN");
        String request = objectMapper.writeValueAsString(
            java.util.Map.of("username", username, "password", "secret", "rememberMe", rememberMe)
        );
        MvcResult result = mockMvc.perform(post("/api/authenticate")
            .cookie(cookie)
            .header("X-XSRF-TOKEN", body.path("token").asText())
            .contentType(MediaType.APPLICATION_JSON)
            .content(request))
            .andExpect(status().isNoContent())
            .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
