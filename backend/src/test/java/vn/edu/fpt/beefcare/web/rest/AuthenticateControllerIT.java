package vn.edu.fpt.beefcare.web.rest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.web.rest.vm.LoginVM;

@ServiceIntegrationTest
class AuthenticateControllerIT {

    @Autowired ObjectMapper om;
    @Autowired UserRepository userRepository;
    @Autowired AppUserRepository appUserRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired MockMvc mockMvc;

    @Test
    void accountAndLegacyCrudRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/account")).andExpect(status().isUnauthorized());
        // Closed generic CRUD: an anonymous caller is sent to sign in (401, the configured entry point); a signed-in caller gets 403
        // (see unfinishedGenericEntityCrudIsDeniedEvenToSignedInUsers). The earlier 403 expectation predates the session entry point.
        mockMvc.perform(get("/api/app-users")).andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void loginRequiresCsrfAndCreatesReusableHttpSession() throws Exception {
        User user = createIdentity("session-login");
        Csrf csrf = fetchCsrf();
        LoginVM login = login("session-login");
        mockMvc.perform(post("/api/authenticate").contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(login)))
            .andExpect(status().isForbidden());

        MvcResult result = mockMvc.perform(post("/api/authenticate")
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(om.writeValueAsBytes(login)))
            .andExpect(status().isNoContent())
            .andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        org.assertj.core.api.Assertions.assertThat(session.getMaxInactiveInterval()).isEqualTo(28_800);
        mockMvc.perform(get("/api/authenticate").session(session)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isOk());
        org.assertj.core.api.Assertions.assertThat(appUserRepository.findOneByEmailIgnoreCase(user.getEmail())).isPresent();
    }

    @Test
    @Transactional
    void activeAccountSuspensionRevokesAnExistingSession() throws Exception {
        User user = createIdentity("session-suspended");
        MockHttpSession session = loginWithCsrf("session-suspended");
        AppUser appUser = appUserRepository.findOneByEmailIgnoreCase(user.getEmail()).orElseThrow();
        appUser.setAccountStatus("SUSPENDED");
        appUserRepository.saveAndFlush(appUser);
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isForbidden());
        org.assertj.core.api.Assertions.assertThat(session.isInvalid()).isTrue();
    }

    @Test
    @Transactional
    void identityDeactivationAlsoRevokesAnExistingSession() throws Exception {
        User identity = createIdentity("session-deactivated");
        MockHttpSession session = loginWithCsrf("session-deactivated");
        identity.setActivated(false);
        userRepository.saveAndFlush(identity);
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isForbidden());
        org.assertj.core.api.Assertions.assertThat(session.isInvalid()).isTrue();
    }

    @Test
    @Transactional
    void unfinishedGenericEntityCrudIsDeniedEvenToSignedInUsers() throws Exception {
        createIdentity("session-restricted");
        MockHttpSession session = loginWithCsrf("session-restricted");
        mockMvc.perform(get("/api/app-users").session(session)).andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void logoutInvalidatesTheServerSessionAndClearsItsCookie() throws Exception {
        createIdentity("session-logout");
        MockHttpSession session = loginWithCsrf("session-logout");
        Csrf csrf = fetchCsrf();
        mockMvc.perform(post("/api/logout")
            .session(session)
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token()))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/account").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void fiveConsecutivePasswordFailuresLockPasswordSignInForFifteenMinutes() throws Exception {
        User user = createIdentity("session-lockout");
        Csrf csrf = fetchCsrf();
        for (int attempt = 0; attempt < 5; attempt++) {
            mockMvc.perform(post("/api/authenticate")
                .cookie(csrf.cookie())
                .header("X-XSRF-TOKEN", csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsBytes(login("session-lockout", "wrong-password"))))
                .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/authenticate")
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(om.writeValueAsBytes(login("session-lockout", "secret"))))
            .andExpect(status().isLocked());
        User locked = userRepository.findById(user.getId()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(locked.getFailedPasswordAttempts()).isEqualTo(5);
        org.assertj.core.api.Assertions.assertThat(locked.getPasswordLockedUntil()).isAfter(java.time.Instant.now())
            .isBefore(java.time.Instant.now().plusSeconds(901));
    }

    @Test
    @Transactional
    void googleOnlyAccountCannotFallThroughToPasswordAuthentication() throws Exception {
        User identity = createIdentity("session-google-only");
        AppUser projection = new AppUser();
        projection.setEmail(identity.getEmail());
        projection.setFullName("Google Account");
        projection.setAccountStatus("ACTIVE");
        projection.setPasswordLoginEnabled(false);
        appUserRepository.saveAndFlush(projection);
        Csrf csrf = fetchCsrf();
        mockMvc.perform(post("/api/authenticate")
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(om.writeValueAsBytes(login("session-google-only", "secret"))))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerRegistrationRequiresTermsAndReturnsNoCredentialFields() throws Exception {
        User user = createIdentity("session-owner-profile");
        MockHttpSession session = loginWithCsrf("session-owner-profile");
        Csrf csrf = fetchCsrf();
        mockMvc.perform(post("/api/account/owner-registration")
            .session(session)
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"fullName\":\"Farm Owner\",\"phone\":\"0900000000\",\"termsAccepted\":false}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/account/owner-registration")
            .session(session)
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"fullName\":\"Farm Owner\",\"phone\":\"0900000000\",\"termsAccepted\":true}"))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.fullName").value("Farm Owner"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.passwordHash").doesNotExist());
        AppUser appUser = appUserRepository.findOneByEmailIgnoreCase(user.getEmail()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(appUser.isOwnerRegistrationCompleted()).isTrue();
        org.assertj.core.api.Assertions.assertThat(appUser.getOwnerRegistrationCompletedAt()).isNotNull();
    }

    private User createIdentity(String login) {
        User user = new User();
        user.setLogin(login);
        user.setEmail(login + "@example.com");
        user.setActivated(true);
        user.setPassword(passwordEncoder.encode("secret"));
        return userRepository.saveAndFlush(user);
    }

    private MockHttpSession loginWithCsrf(String username) throws Exception {
        Csrf csrf = fetchCsrf();
        MvcResult result = mockMvc.perform(post("/api/authenticate")
            .cookie(csrf.cookie())
            .header("X-XSRF-TOKEN", csrf.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(om.writeValueAsBytes(login(username))))
            .andExpect(status().isNoContent())
            .andReturn();
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private Csrf fetchCsrf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode body = om.readTree(result.getResponse().getContentAsByteArray());
        Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
        return new Csrf(cookie, body.path("token").asText());
    }

    private LoginVM login(String username) {
        return login(username, "secret");
    }

    private LoginVM login(String username, String password) {
        LoginVM login = new LoginVM();
        login.setUsername(username);
        login.setPassword(password);
        return login;
    }

    private record Csrf(Cookie cookie, String token) {}
}
