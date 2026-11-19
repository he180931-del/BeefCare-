package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.FarmInvitationRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;
import vn.edu.fpt.beefcare.service.email.EmailDeliveryJobService;
import vn.edu.fpt.beefcare.service.email.MockEmailDelivery;

/**
 * FE-01 / FE-03 end to end through the real Spring Security chain, the way the React client drives it:
 * GET /api/csrf, cookie session, X-XSRF-TOKEN on every change, Idempotency-Key on commands, and the mock mailbox for links.
 * Nothing here is transactional, so each step commits like production; every test uses its own e-mail addresses.
 */
@ServiceIntegrationTest
class BrowserSessionFlowIT {

    private static final String PASSWORD = "SomeStrongPass9";
    private static final Pattern TOKEN = Pattern.compile("token=([A-Za-z0-9_-]+)");
    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired EmailDeliveryJobService deliveryJobs;
    @Autowired MockEmailDelivery inbox;
    @Autowired ActionLinkSigner signer;
    @Autowired AccountLinkTokenRepository links;
    @Autowired UserRepository users;
    @Autowired AppUserRepository accounts;
    @Autowired FarmRepository farms;
    @Autowired FarmMembershipRepository memberships;
    @Autowired FarmInvitationRepository invitations;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired FarmClock farmClock;

    // ---------------------------------------------------------------- FE-01: register, verify, sign in, profile, sign out

    @Test
    void registerVerifyByEmailSignInProfileAndSignOutWithCsrf() throws Exception {
        String email = email("owner");
        Browser guest = new Browser();

        // UC-FE01-02 pre-step: the client first asks for a CSRF token and keeps the readable cookie
        guest.fetchCsrf();
        assertThat(guest.token).isNotBlank();
        assertThat(guest.xsrf).isNotNull();
        assertThat(guest.xsrf.getValue()).isEqualTo(guest.token);
        assertThat(guest.xsrf.isHttpOnly()).isFalse();

        // a command without the CSRF header never reaches the controller, so nothing is created
        guest.postWithoutCsrf("/api/register", registration(email, PASSWORD, PASSWORD, true)).andExpect(status().isForbidden());
        assertThat(users.findOneByEmailIgnoreCase(email)).isEmpty();

        // UC-FE01-01 AF1: SRS fields only (no login name), the account is pending verification
        guest.post("/api/register", registration(email, PASSWORD, PASSWORD, true)).andExpect(status().isCreated());
        assertThat(users.findOneByEmailIgnoreCase(email)).get().satisfies(user -> assertThat(user.isActivated()).isFalse());
        guest.post("/api/register", registration(email.toUpperCase(), PASSWORD, PASSWORD, true))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE01-10"));
        assertThat(accounts.findAll().stream().filter(account -> email.equalsIgnoreCase(account.getEmail()))).hasSize(1);

        // SCR-02: signing in before the e-mail is verified shows MSG-FE01-11
        guest.login(email, PASSWORD, false).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("MSG-FE01-11"));

        // GBR-03: the link is valid for 24 hours and stored only as a hash
        String verificationToken = linkToken(email, "/api/activate?token=");
        var verification = links.findOneByTokenHashAndTokenType(signer.hash(verificationToken), "EMAIL_VERIFICATION").orElseThrow();
        assertThat(Duration.between(verification.getCreatedAt(), verification.getExpiresAt())).isEqualTo(Duration.ofHours(24));
        assertThat(verification.getTokenHash()).isNotEqualTo(verificationToken);

        // the link opens in the browser: a session is created and the user lands on Owner registration (SCR-07)
        Browser phone = new Browser();
        MvcResult activated = phone.get("/api/activate?token=" + verificationToken)
            .andExpect(status().isSeeOther()).andExpect(header().string("Location", org.hamcrest.Matchers.endsWith("/owner-registration"))).andReturn();
        assertThat(activated.getResponse().getHeader("Location")).startsWith("http://127.0.0.1:8080");
        phone.get("/api/account/profile").andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(true));
        // MSG-FE01-06: a used link is refused, and it does not sign anybody in
        new Browser().get("/api/activate?token=" + verificationToken)
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));
        new Browser().get("/api/activate?token=not-a-real-token").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));

        // UC-FE01-02: password sign-in is 204 + session cookie; the 8-hour idle timeout (30 days with Remember me)
        Browser desktop = new Browser();
        desktop.fetchCsrf();
        desktop.login(email, PASSWORD, false).andExpect(status().isNoContent());
        assertThat(desktop.session.getMaxInactiveInterval()).isEqualTo(8 * 3600);
        desktop.get("/api/authenticate").andExpect(status().isNoContent());
        Browser remembered = new Browser();
        remembered.fetchCsrf();
        remembered.login(email, PASSWORD, true).andExpect(status().isNoContent())
            .andExpect(header().stringValues("Set-Cookie", org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.allOf(
                org.hamcrest.Matchers.containsString("JSESSIONID="), org.hamcrest.Matchers.containsString("HttpOnly"),
                org.hamcrest.Matchers.containsString("SameSite=Lax"), org.hamcrest.Matchers.containsString("Max-Age=2592000")))));
        assertThat(remembered.session.getMaxInactiveInterval()).isEqualTo(30 * 24 * 3600);

        // UC-FE01-04: read the profile; a change without CSRF is rejected and nothing is saved
        desktop.get("/api/account/profile").andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value(email)).andExpect(jsonPath("$.fullName").value("Flow Owner"))
            .andExpect(jsonPath("$.emailVerified").value(true)).andExpect(jsonPath("$.passwordSignInEnabled").value(true))
            .andExpect(jsonPath("$.googleSignInLinked").value(false)).andExpect(jsonPath("$.ownerRegistrationCompleted").value(false))
            .andExpect(jsonPath("$.platformRole").doesNotExist()).andExpect(jsonPath("$.farms").isEmpty())
            .andExpect(jsonPath("$.password").doesNotExist()).andExpect(jsonPath("$.passwordHash").doesNotExist());
        desktop.postWithoutCsrf("/api/account/profile", Map.of("fullName", "Changed Without Csrf", "phone", "")).andExpect(status().isForbidden());
        assertThat(accounts.findOneByEmailIgnoreCase(email).orElseThrow().getFullName()).isEqualTo("Flow Owner");
        // SCR-08: name 2-100 characters, Vietnamese phone only (MSG-COM-10)
        desktop.post("/api/account/profile", Map.of("fullName", "A", "phone", "0901234567"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("fullName"));
        desktop.post("/api/account/profile", Map.of("fullName", "Flow Owner", "phone", "12345"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("phone"));
        desktop.post("/api/account/profile", Map.of("fullName", "  Flow Owner Updated ", "phone", "+84901234567")).andExpect(status().isOk())
            .andExpect(jsonPath("$.fullName").value("Flow Owner Updated")).andExpect(jsonPath("$.phone").value("+84901234567"));
        desktop.get("/api/account/profile").andExpect(jsonPath("$.fullName").value("Flow Owner Updated"));
        // the e-mail is the sign-in identity and cannot be edited through the profile
        desktop.post("/api/account/profile", Map.of("fullName", "Flow Owner Updated", "phone", "+84901234567", "email", "other@example.test")).andExpect(status().isOk());
        assertThat(accounts.findOneByEmailIgnoreCase(email)).isPresent();

        // UC-FE01-01 step 7: Owner registration needs the terms (MSG-FE01-14)
        desktop.post("/api/account/owner-registration", Map.of("fullName", "Flow Owner", "phone", "0901234567", "termsAccepted", false))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-14"));
        desktop.post("/api/account/owner-registration", Map.of("fullName", "Flow Owner", "phone", "0901234567", "termsAccepted", true))
            .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true));
        desktop.get("/api/account/profile").andExpect(jsonPath("$.ownerRegistrationCompleted").value(true));

        // UC-FE01-03: sign-out is a CSRF-protected POST; the old session is dead afterwards
        MockHttpSession oldSession = desktop.session;
        desktop.postWithoutCsrf("/api/logout", null).andExpect(status().isForbidden());
        desktop.get("/api/account/profile").andExpect(status().isOk());
        MvcResult loggedOut = desktop.post("/api/logout", null).andExpect(status().isNoContent()).andReturn();
        assertThat(loggedOut.getResponse().getCookie("XSRF-TOKEN")).isNotNull().satisfies(cookie -> assertThat(cookie.getMaxAge()).isZero());
        mvc.perform(MockMvcRequestBuilders.get("/api/account/profile").session(oldSession)).andExpect(status().isUnauthorized());
        mvc.perform(MockMvcRequestBuilders.get("/api/authenticate").session(oldSession)).andExpect(status().isUnauthorized());
        // the other devices are independent sessions and stay signed in
        remembered.get("/api/account/profile").andExpect(status().isOk());
    }

    @Test
    void registrationFieldErrorsCarryTheSrsMessageCodesAndCreateNothing() throws Exception {
        Browser guest = new Browser();
        guest.fetchCsrf();
        String email = email("invalid");
        record Case(Map<String, Object> body, String code, String field) {}
        List<Case> cases = List.of(
            new Case(registration(email, PASSWORD, PASSWORD, false), "MSG-FE01-14", "termsAccepted"),
            new Case(registration(email, "short", "short", true), "MSG-FE01-08", "password"),
            new Case(registration(email, "x".repeat(129), "x".repeat(129), true), "MSG-FE01-08", "password"),
            new Case(registration(email, email, email, true), "MSG-FE01-08", "password"),
            new Case(registration(email, PASSWORD, PASSWORD + "1", true), "MSG-FE01-09", "confirmPassword"),
            new Case(registration("not-an-email", PASSWORD, PASSWORD, true), "MSG-COM-10", "email"),
            new Case(registration("", PASSWORD, PASSWORD, true), "MSG-COM-06", "email"),
            new Case(Map.of("fullName", " ", "email", email, "password", PASSWORD, "confirmPassword", PASSWORD, "termsAccepted", true), "MSG-COM-06", "fullName"),
            new Case(Map.of("fullName", "X", "email", email, "password", PASSWORD, "confirmPassword", PASSWORD, "termsAccepted", true), "MSG-COM-10", "fullName")
        );
        for (Case c : cases) {
            guest.post("/api/register", c.body())
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value(c.code())).andExpect(jsonPath("$.params.field").value(c.field()));
        }
        assertThat(users.findOneByEmailIgnoreCase(email)).isEmpty();
        assertThat(accounts.findOneByEmailIgnoreCase(email)).isEmpty();
    }

    @Test
    void registrationCannotSelfGrantAuthoritiesOrActivation() throws Exception {
        String email = email("selfgrant");
        Browser guest = new Browser();
        guest.fetchCsrf();
        Map<String, Object> body = new java.util.HashMap<>(registration(email, PASSWORD, PASSWORD, true));
        body.put("authorities", List.of("ROLE_ADMIN"));
        body.put("activated", true);
        body.put("login", "admin");
        guest.post("/api/register", body).andExpect(status().isCreated());
        User created = users.findOneWithAuthoritiesByLogin(email).orElseThrow();
        assertThat(created.isActivated()).isFalse();
        assertThat(created.getAuthorities()).extracting(authority -> authority.getName()).containsExactly("ROLE_USER");
        assertThat(created.getLogin()).isEqualTo(email); // the sign-in name is the e-mail, never a client-chosen login
    }

    @Test
    void verificationLinkCanBeResentAndOnlyTheNewestLinkWorks() throws Exception {
        String email = email("resend");
        Browser guest = new Browser();
        guest.fetchCsrf();
        guest.post("/api/register", registration(email, PASSWORD, PASSWORD, true)).andExpect(status().isCreated());
        String first = linkToken(email, "/api/activate?token=");
        // AF4: the resend response is the same for a registered and an unregistered address (JSON object body)
        guest.post("/api/account/verification/resend", Map.of("email", email)).andExpect(status().isOk());
        guest.post("/api/account/verification/resend", Map.of("email", email("nobody"))).andExpect(status().isOk());
        String second = linkToken(email, "/api/activate?token=");
        assertThat(second).isNotEqualTo(first);
        new Browser().get("/api/activate?token=" + first).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));
        new Browser().get("/api/activate?token=" + second).andExpect(status().isSeeOther());
    }

    @Test
    void wrongPasswordsLockPasswordSignInForFifteenMinutesWithoutRevealingWhichValueIsWrong() throws Exception {
        String email = email("lock");
        Browser user = signedUp(email, "Lock Owner").browser;
        Browser attacker = new Browser();
        attacker.fetchCsrf();
        // GBR-02 / E1: a wrong password and an unknown e-mail give the identical answer
        attacker.login(email("unknown"), "whatever-123", false).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("MSG-FE01-01")).andExpect(jsonPath("$.params").isEmpty());
        for (int attempt = 0; attempt < 5; attempt++) {
            attacker.login(email, "wrong-password-" + attempt, false).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("MSG-FE01-01"));
        }
        // E2: the 6th try is locked even with the right password (MSG-FE01-02, with the time sign-in reopens)
        MvcResult locked = attacker.login(email, PASSWORD, false).andExpect(status().isLocked()).andExpect(jsonPath("$.code").value("MSG-FE01-02")).andReturn();
        Instant until = Instant.parse(om.readTree(locked.getResponse().getContentAsString()).path("params").path("time").asText());
        assertThat(Duration.between(Instant.now(), until)).isBetween(Duration.ofMinutes(14), Duration.ofMinutes(15).plusSeconds(5));
        assertThat(users.findOneByEmailIgnoreCase(email).orElseThrow().getFailedPasswordAttempts()).isEqualTo(5);
        // sessions that already exist are not touched by the lock
        user.get("/api/account/profile").andExpect(status().isOk());
        // once the lock has run out, signing in works and clears the counter
        User stored = users.findOneByEmailIgnoreCase(email).orElseThrow();
        stored.setPasswordLockedUntil(Instant.now().minusSeconds(1));
        users.saveAndFlush(stored);
        attacker.login(email, PASSWORD, false).andExpect(status().isNoContent());
        assertThat(users.findOneByEmailIgnoreCase(email).orElseThrow().getFailedPasswordAttempts()).isZero();
    }

    @Test
    void suspendedAccountsAndGoogleOnlyAccountsAreRefusedPasswordSignIn() throws Exception {
        String suspendedEmail = email("suspended");
        signedUp(suspendedEmail, "Suspended Owner");
        AppUser suspended = accounts.findOneByEmailIgnoreCase(suspendedEmail).orElseThrow();
        suspended.setAccountStatus("SUSPENDED");
        accounts.saveAndFlush(suspended);
        Browser guest = new Browser();
        guest.fetchCsrf();
        guest.login(suspendedEmail, PASSWORD, false).andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("MSG-FE01-03")).andExpect(jsonPath("$.params.email").value(suspendedEmail));

        String googleEmail = email("google");
        User identity = new User();
        identity.setLogin(googleEmail);
        identity.setEmail(googleEmail);
        identity.setActivated(true);
        identity.setPassword(passwordEncoder.encode(PASSWORD));
        users.saveAndFlush(identity);
        AppUser projection = new AppUser();
        projection.setEmail(googleEmail);
        projection.setFullName("Google Person");
        projection.setAccountStatus("ACTIVE");
        projection.setPasswordLoginEnabled(false);
        accounts.saveAndFlush(projection);
        // UC-FE01-02 E1: answered exactly like a wrong password, so the address is not revealed as a Google account
        guest.login(googleEmail, PASSWORD, false).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("MSG-FE01-01"));
        // AF1 of UC-FE01-05: a Google-only account gets an email advising Google sign-in, with no reset link and no password
        String passwordBefore = users.findOneByEmailIgnoreCase(googleEmail).orElseThrow().getPassword();
        guest.post("/api/account/reset-password/init", Map.of("email", googleEmail)).andExpect(status().isOk());
        deliverAll();
        assertThat(inbox.findMessagesFor(googleEmail)).singleElement().satisfies(mail -> {
            assertThat(mail.subject()).contains("Google");
            assertThat(mail.plainText()).contains("/sign-in").doesNotContain("reset-password").doesNotContain("token=");
        });
        assertThat(links.countByUserIdAndTokenTypeAndCreatedAtAfter(identity.getId(), "PASSWORD_RESET", java.time.Instant.EPOCH)).isZero();
        assertThat(users.findOneByEmailIgnoreCase(googleEmail).orElseThrow().getPassword()).isEqualTo(passwordBefore);
        assertThat(accounts.findOneByEmailIgnoreCase(googleEmail).orElseThrow().isPasswordLoginEnabled()).isFalse();
        // the advice mail shares the five-per-hour limit of the link mails
        for (int i = 0; i < 6; i++) guest.post("/api/account/reset-password/init", Map.of("email", googleEmail)).andExpect(status().isOk());
        deliverAll();
        assertThat(inbox.findMessagesFor(googleEmail)).hasSize(5);
    }

    // ---------------------------------------------------------------- FE-01: change password

    @Test
    void changingThePasswordKeepsThisSessionEndsTheOthersAndMailsTheOwner() throws Exception {
        String email = email("change");
        Signed first = signedUp(email, "Change Owner");
        Browser here = first.browser;
        Browser elsewhere = new Browser();
        elsewhere.fetchCsrf();
        elsewhere.login(email, PASSWORD, false).andExpect(status().isNoContent());
        elsewhere.get("/api/account/profile").andExpect(status().isOk());
        int mailsBefore = inbox.findMessagesFor(email).size();

        // the changed password must not be accepted without CSRF
        here.postWithoutCsrf("/api/account/change-password", passwordChange(PASSWORD, "NewPassword-77", "NewPassword-77")).andExpect(status().isForbidden());
        // MSG-FE01-16: wrong current password, and it counts toward the lockout counter (GBR-02)
        here.post("/api/account/change-password", passwordChange("not-my-password", "NewPassword-77", "NewPassword-77"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-16"));
        assertThat(users.findOneByEmailIgnoreCase(email).orElseThrow().getFailedPasswordAttempts()).isEqualTo(1);
        // MSG-FE01-08 / MSG-FE01-09
        here.post("/api/account/change-password", passwordChange(PASSWORD, "short", "short")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-08"));
        here.post("/api/account/change-password", passwordChange(PASSWORD, email, email)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-08"));
        here.post("/api/account/change-password", passwordChange(PASSWORD, "x".repeat(129), "x".repeat(129))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-08"));
        here.post("/api/account/change-password", passwordChange(PASSWORD, "", "")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-08"));
        here.post("/api/account/change-password", passwordChange(PASSWORD, "NewPassword-77", "Different-77")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-09"));
        elsewhere.get("/api/account/profile").andExpect(status().isOk());

        here.post("/api/account/change-password", passwordChange(PASSWORD, "NewPassword-77", "NewPassword-77")).andExpect(status().isOk());
        here.get("/api/account/profile").andExpect(status().isOk());
        elsewhere.get("/api/account/profile").andExpect(status().isUnauthorized());
        assertThat(users.findOneByEmailIgnoreCase(email).orElseThrow().getFailedPasswordAttempts()).isZero();

        Browser fresh = new Browser();
        fresh.fetchCsrf();
        fresh.login(email, PASSWORD, false).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("MSG-FE01-01"));
        fresh.login(email, "NewPassword-77", false).andExpect(status().isNoContent());
        assertThat(users.findOneByEmailIgnoreCase(email).orElseThrow().getPassword()).startsWith("$2").doesNotContain("NewPassword-77");
        deliverAll();
        assertThat(inbox.findMessagesFor(email).size()).isEqualTo(mailsBefore + 1);
        assertThat(inbox.findMessagesFor(email).get(0).subject()).contains("password changed");
        assertThat(inbox.findMessagesFor(email).get(0).plainText()).doesNotContain("NewPassword-77");
    }

    @Test
    void wrongCurrentPasswordFiveTimesLocksPasswordSignIn() throws Exception {
        String email = email("changelock");
        Browser here = signedUp(email, "Lock Changer").browser;
        for (int attempt = 0; attempt < 5; attempt++) {
            here.post("/api/account/change-password", passwordChange("wrong-" + attempt, "NewPassword-77", "NewPassword-77"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-16"));
        }
        // UC-FE01-06 E1: after 5 failures MSG-FE01-02, for the dialog and for the sign-in form alike
        here.post("/api/account/change-password", passwordChange(PASSWORD, "NewPassword-77", "NewPassword-77"))
            .andExpect(status().isLocked()).andExpect(jsonPath("$.code").value("MSG-FE01-02"));
        Browser other = new Browser();
        other.fetchCsrf();
        other.login(email, PASSWORD, false).andExpect(status().isLocked()).andExpect(jsonPath("$.code").value("MSG-FE01-02"));
    }

    // ---------------------------------------------------------------- FE-01: forgotten password

    @Test
    void forgottenPasswordIsGenericSingleUseThirtyMinutesAndEndsAllSessions() throws Exception {
        String email = email("forgot");
        Browser device = signedUp(email, "Forgot Owner").browser;
        Browser guest = new Browser();
        guest.fetchCsrf();
        int mailsBefore = inbox.findMessagesFor(email).size();

        // GBR-03: the answer is the same for a registered and an unknown address (status and body), and the unknown one gets no mail
        String unknown = email("ghost");
        MvcResult known = guest.post("/api/account/reset-password/init", Map.of("email", email)).andExpect(status().isOk()).andReturn();
        MvcResult ghost = guest.post("/api/account/reset-password/init", Map.of("email", unknown)).andExpect(status().isOk()).andReturn();
        assertThat(ghost.getResponse().getContentAsString()).isEqualTo(known.getResponse().getContentAsString());
        assertThat(ghost.getResponse().getHeaderNames()).containsExactlyInAnyOrderElementsOf(known.getResponse().getHeaderNames());
        deliverAll();
        assertThat(inbox.findMessagesFor(unknown)).isEmpty();
        assertThat(inbox.findMessagesFor(email).size()).isEqualTo(mailsBefore + 1);

        String first = linkToken(email, "/reset-password?token=");
        var stored = links.findOneByTokenHashAndTokenType(signer.hash(first), "PASSWORD_RESET").orElseThrow();
        assertThat(Duration.between(stored.getCreatedAt(), stored.getExpiresAt())).isEqualTo(Duration.ofMinutes(30));
        guest.get("/api/account/reset-password/validate?token=" + first).andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(true));
        guest.get("/api/account/reset-password/validate?token=garbage").andExpect(status().isOk()).andExpect(jsonPath("$.valid").value(false));

        // a new request replaces the earlier link (the address is matched case-insensitively)
        guest.post("/api/account/reset-password/init", Map.of("email", email.toUpperCase())).andExpect(status().isOk());
        String second = linkToken(email, "/reset-password?token=");
        assertThat(second).isNotEqualTo(first);
        guest.get("/api/account/reset-password/validate?token=" + first).andExpect(jsonPath("$.valid").value(false));
        guest.post("/api/account/reset-password/finish", reset(first, "ResetPassword-88", "ResetPassword-88"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));
        guest.post("/api/account/reset-password/finish", reset("garbage", "ResetPassword-88", "ResetPassword-88"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));

        // E2: the rules are checked, the old password stays and the link is still usable
        guest.post("/api/account/reset-password/finish", reset(second, "short", "short")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-08"));
        guest.post("/api/account/reset-password/finish", reset(second, "ResetPassword-88", "Mismatch-88")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-09"));
        guest.get("/api/account/reset-password/validate?token=" + second).andExpect(jsonPath("$.valid").value(true));
        device.get("/api/account/profile").andExpect(status().isOk());
        Browser stillOld = new Browser();
        stillOld.fetchCsrf();
        stillOld.login(email, PASSWORD, false).andExpect(status().isNoContent());

        // a failed-attempt lock is cleared by the reset (step 7)
        User lockedUser = users.findOneByEmailIgnoreCase(email).orElseThrow();
        lockedUser.setFailedPasswordAttempts(5);
        lockedUser.setPasswordLockedUntil(Instant.now().plus(Duration.ofMinutes(10)));
        users.saveAndFlush(lockedUser);

        int mailsBeforeFinish = inbox.findMessagesFor(email).size();
        guest.post("/api/account/reset-password/finish", reset(second, "ResetPassword-88", "ResetPassword-88")).andExpect(status().isOk());
        // single use
        guest.get("/api/account/reset-password/validate?token=" + second).andExpect(jsonPath("$.valid").value(false));
        guest.post("/api/account/reset-password/finish", reset(second, "Another-Pass-99", "Another-Pass-99"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));
        // all sessions end, including the one that was signed in before
        device.get("/api/account/profile").andExpect(status().isUnauthorized());
        stillOld.get("/api/account/profile").andExpect(status().isUnauthorized());
        Browser fresh = new Browser();
        fresh.fetchCsrf();
        fresh.login(email, PASSWORD, false).andExpect(status().isUnauthorized());
        fresh.login(email, "ResetPassword-88", false).andExpect(status().isNoContent());
        assertThat(users.findOneByEmailIgnoreCase(email).orElseThrow().getFailedPasswordAttempts()).isZero();
        deliverAll();
        assertThat(inbox.findMessagesFor(email).size()).isEqualTo(mailsBeforeFinish + 1);
        assertThat(inbox.findMessagesFor(email).get(0).subject()).contains("password changed");
    }

    @Test
    void anExpiredResetLinkIsRefusedWithMsgFe0106() throws Exception {
        String email = email("expired");
        signedUp(email, "Expired Owner");
        Browser guest = new Browser();
        guest.fetchCsrf();
        guest.post("/api/account/reset-password/init", Map.of("email", email)).andExpect(status().isOk());
        String token = linkToken(email, "/reset-password?token=");
        var link = links.findOneByTokenHashAndTokenType(signer.hash(token), "PASSWORD_RESET").orElseThrow();
        link.setExpiresAt(Instant.now().minusSeconds(1));
        links.saveAndFlush(link);
        guest.get("/api/account/reset-password/validate?token=" + token).andExpect(jsonPath("$.valid").value(false));
        guest.post("/api/account/reset-password/finish", reset(token, "ResetPassword-88", "ResetPassword-88"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE01-06"));
        Browser fresh = new Browser();
        fresh.fetchCsrf();
        fresh.login(email, PASSWORD, false).andExpect(status().isNoContent());
    }

    @Test
    void resetLinkEmailsAreLimitedToFivePerHour() throws Exception {
        String email = email("limit");
        signedUp(email, "Limit Owner");
        Browser guest = new Browser();
        guest.fetchCsrf();
        int before = resetMails(email);
        for (int request = 1; request <= 7; request++) {
            guest.post("/api/account/reset-password/init", Map.of("email", email)).andExpect(status().isOk()); // always the same answer
            deliverAll();
            assertThat(resetMails(email) - before).isEqualTo(Math.min(request, 5));
        }
    }

    @Test
    void aSuspendedAccountCanResetItsPasswordButStillCannotSignIn() throws Exception {
        String email = email("suspendedreset");
        signedUp(email, "Suspended Reset");
        AppUser account = accounts.findOneByEmailIgnoreCase(email).orElseThrow();
        account.setAccountStatus("SUSPENDED");
        accounts.saveAndFlush(account);
        Browser guest = new Browser();
        guest.fetchCsrf();
        guest.post("/api/account/reset-password/init", Map.of("email", email)).andExpect(status().isOk());
        String token = linkToken(email, "/reset-password?token=");
        guest.post("/api/account/reset-password/finish", reset(token, "ResetPassword-88", "ResetPassword-88")).andExpect(status().isOk());
        guest.login(email, "ResetPassword-88", false).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE01-03"));
    }

    // ---------------------------------------------------------------- FE-03: invitation over HTTP

    @Test
    void ownerInvitesOverHttpAndTheInviteeAcceptsExactlyOnce() throws Exception {
        Signed owner = signedUp(email("farmowner"), "Farm Owner");
        long farmId = activeFarm(owner.browser);
        String inviteeEmail = email("invitee");
        String key = UUID.randomUUID().toString();
        Map<String, Object> invite = Map.of("email", inviteeEmail.toUpperCase(), "role", "MANAGER", "validityDays", 7);

        // UC-FE03-01: 201 PENDING invitation; the command is idempotent per key
        MvcResult created = owner.browser.post("/api/farms/" + farmId + "/invitations", invite, key)
            .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING")).andExpect(jsonPath("$.role").value("MANAGER"))
            .andExpect(jsonPath("$.email").value(inviteeEmail)).andExpect(jsonPath("$.validityDays").value(7))
            .andExpect(jsonPath("$.token").doesNotExist()).andExpect(jsonPath("$.tokenHash").doesNotExist()).andReturn();
        long invitationId = om.readTree(created.getResponse().getContentAsString()).path("id").asLong();
        owner.browser.post("/api/farms/" + farmId + "/invitations", invite, key).andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(invitationId));
        assertThat(invitations.findByFarmIdOrderByCreatedAtDesc(farmId)).hasSize(1);
        // a new key is a new intent: MSG-FE03-03 offers Resend; the same key with other data is MSG-COM-19
        owner.browser.post("/api/farms/" + farmId + "/invitations", invite, UUID.randomUUID().toString())
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE03-03")).andExpect(jsonPath("$.params.email").value(inviteeEmail));
        owner.browser.post("/api/farms/" + farmId + "/invitations", Map.of("email", inviteeEmail, "role", "TECHNICIAN", "validityDays", 7), key)
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-19"));
        owner.browser.post("/api/farms/" + farmId + "/invitations", Map.of("email", email("other"), "role", "MANAGER", "validityDays", 7), null)
            .andExpect(status().isBadRequest());
        owner.browser.post("/api/farms/" + farmId + "/invitations", Map.of("email", email("other"), "role", "MANAGER", "validityDays", 5), UUID.randomUUID().toString())
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-COM-10")).andExpect(jsonPath("$.params.field").value("validityDays"));
        owner.browser.get("/api/farms/" + farmId + "/invitations?status=PENDING").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        // AF4: the e-mail is a durable job; the invitee receives exactly one message with the single-use link
        String invitationToken = linkToken(inviteeEmail, "/invitation/accept?token=");
        assertThat(inbox.findMessagesFor(inviteeEmail).stream().filter(message -> message.plainText().contains("/invitation/accept?token="))).hasSize(1);
        assertThat(inbox.findMessagesFor(inviteeEmail).get(0).plainText()).contains("Quản lý");
        var stored = invitations.findById(invitationId).orElseThrow();
        assertThat(stored.getTokenHash()).isEqualTo(signer.hash(invitationToken)).isNotEqualTo(invitationToken);

        // the invitee has no account yet: creating it by e-mail verification does not accept anything (POST-2 of UC-FE01-02)
        Browser invitee = signedUp(inviteeEmail, "Invited Manager").browser;
        assertThat(memberships.findByFarmIdOrderById(farmId)).hasSize(1);
        // a member of the farm cannot invite (E1 MSG-COM-01) and the Owner membership is not touched
        invitee.post("/api/farms/" + farmId + "/invitations", Map.of("email", email("x"), "role", "TECHNICIAN", "validityDays", 7), UUID.randomUUID().toString())
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-COM-01"));

        // E2 of UC-FE03-04: another verified account sees MSG-FE03-09 and no farm data, and nothing is created
        Browser stranger = signedUp(email("stranger"), "Wrong Person").browser;
        String farmName = "Flow Farm";
        MvcResult previewDenied = stranger.get("/api/invitations/accept?token=" + invitationToken)
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-09")).andReturn();
        assertThat(previewDenied.getResponse().getContentAsString()).doesNotContain(farmName);
        stranger.post("/api/invitations/accept", Map.of("token", invitationToken)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("MSG-FE03-09"));
        assertThat(memberships.findByFarmIdOrderById(farmId)).hasSize(1);
        assertThat(invitations.findById(invitationId).orElseThrow().getStatus()).isEqualTo("PENDING");
        // not signed in: the router sends the person to Sign In (401), unknown token is MSG-FE03-08
        Browser anonymous = new Browser();
        anonymous.fetchCsrf();
        anonymous.post("/api/invitations/accept", Map.of("token", invitationToken)).andExpect(status().isUnauthorized());
        invitee.post("/api/invitations/accept", Map.of("token", "no-such-token"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value("INVALID"));

        // SCR-15 preview, then accept: one ACTIVE membership with the invited fixed role
        invitee.get("/api/invitations/accept?token=" + invitationToken).andExpect(status().isOk())
            .andExpect(jsonPath("$.farmName").value(farmName)).andExpect(jsonPath("$.role").value("MANAGER")).andExpect(jsonPath("$.email").value(inviteeEmail));
        MvcResult accepted = invitee.post("/api/invitations/accept", Map.of("token", invitationToken))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MANAGER")).andExpect(jsonPath("$.status").value("ACTIVE"))
            .andExpect(jsonPath("$.email").value(inviteeEmail)).andReturn();
        long membershipId = om.readTree(accepted.getResponse().getContentAsString()).path("id").asLong();
        assertThat(membershipId).isPositive();
        AppUser inviteeAccount = accounts.findOneByEmailIgnoreCase(inviteeEmail).orElseThrow();
        assertThat(memberships.findFirstByFarmIdAndUserId(farmId, inviteeAccount.getId())).get().satisfies(membership -> {
            assertThat(membership.getId()).isEqualTo(membershipId);
            assertThat(membership.getRole()).isEqualTo("MANAGER");
            assertThat(membership.getStatus()).isEqualTo("ACTIVE");
        });
        assertThat(memberships.findByFarmIdOrderById(farmId)).hasSize(2);

        // the same call again (lost response, double click) returns the same membership and creates nothing
        invitee.post("/api/invitations/accept", Map.of("token", invitationToken)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(membershipId));
        assertThat(memberships.findByFarmIdOrderById(farmId)).hasSize(2);
        assertThat(invitations.findById(invitationId).orElseThrow().getStatus()).isEqualTo("ACCEPTED");

        // GBR-14: the new Manager sees the farm with the Manager role, the Owner roster lists both, the profile shows the role
        invitee.get("/api/farms").andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id==" + farmId + ")].role").value("MANAGER"));
        invitee.get("/api/account/profile").andExpect(jsonPath("$.farms[0].farmId").value(farmId)).andExpect(jsonPath("$.farms[0].role").value("MANAGER"));
        owner.browser.get("/api/farms/" + farmId + "/members").andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        owner.browser.get("/api/farms/" + farmId + "/invitations?status=ACCEPTED").andExpect(jsonPath("$.length()").value(1));
        // an accepted invitation cannot be cancelled or resent: MSG-FE03-08 with its status
        var version = invitations.findById(invitationId).orElseThrow().getVersion();
        owner.browser.post("/api/farms/" + farmId + "/invitations/" + invitationId + "/cancel", Map.of("expectedVersion", version), UUID.randomUUID().toString())
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-FE03-08")).andExpect(jsonPath("$.params.status").value("ACCEPTED"));
        // the Owner is told (fixed text e-mail after commit)
        deliverAll();
        assertThat(inbox.findMessagesFor(owner.email).stream().anyMatch(message -> message.subject().contains("Farm invitation accepted"))).isTrue();
    }

    @Test
    void resendRotatesTheLinkCancelKillsItAndTheMemberRoleChangeIsIdempotent() throws Exception {
        Signed owner = signedUp(email("owner2"), "Second Owner");
        long farmId = activeFarm(owner.browser);
        String inviteeEmail = email("invitee2");
        MvcResult created = owner.browser.post("/api/farms/" + farmId + "/invitations", Map.of("email", inviteeEmail, "role", "TECHNICIAN", "validityDays", 14), UUID.randomUUID().toString())
            .andExpect(status().isCreated()).andReturn();
        JsonNode view = om.readTree(created.getResponse().getContentAsString());
        long invitationId = view.path("id").asLong();
        String firstLink = linkToken(inviteeEmail, "/invitation/accept?token=");

        // UC-FE03-03: resend keeps the same invitation, replaces the link, and a repeated key does not mail twice
        String resendKey = UUID.randomUUID().toString();
        Map<String, Object> resend = Map.of("expectedVersion", view.path("version").asInt());
        owner.browser.post("/api/farms/" + farmId + "/invitations/" + invitationId + "/resend", resend, resendKey)
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(invitationId)).andExpect(jsonPath("$.status").value("PENDING"));
        owner.browser.post("/api/farms/" + farmId + "/invitations/" + invitationId + "/resend", resend, resendKey).andExpect(status().isOk());
        String secondLink = linkToken(inviteeEmail, "/invitation/accept?token=");
        assertThat(secondLink).isNotEqualTo(firstLink);
        assertThat(inbox.findMessagesFor(inviteeEmail).stream().filter(message -> message.plainText().contains("/invitation/accept?token="))).hasSize(2);
        Browser invitee = signedUp(inviteeEmail, "Second Invitee").browser;
        invitee.get("/api/invitations/accept?token=" + firstLink).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08"));
        // a stale version is MSG-COM-05
        owner.browser.post("/api/farms/" + farmId + "/invitations/" + invitationId + "/resend", resend, UUID.randomUUID().toString())
            .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));

        // cancel: the link grants nothing (MSG-FE03-08) and nothing is created
        int currentVersion = invitations.findById(invitationId).orElseThrow().getVersion();
        owner.browser.post("/api/farms/" + farmId + "/invitations/" + invitationId + "/cancel", Map.of("expectedVersion", currentVersion), UUID.randomUUID().toString())
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        invitee.post("/api/invitations/accept", Map.of("token", secondLink)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MSG-FE03-08"));
        assertThat(memberships.findByFarmIdOrderById(farmId)).hasSize(1);

        // a fresh invitation is accepted; then UC-FE03-06 over HTTP: role change replays on the same key, a second change is stale
        owner.browser.post("/api/farms/" + farmId + "/invitations", Map.of("email", inviteeEmail, "role", "TECHNICIAN", "validityDays", 3), UUID.randomUUID().toString()).andExpect(status().isCreated());
        String thirdLink = linkToken(inviteeEmail, "/invitation/accept?token=");
        long membershipId = om.readTree(invitee.post("/api/invitations/accept", Map.of("token", thirdLink)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString()).path("id").asLong();
        int membershipVersion = memberships.findById(membershipId).orElseThrow().getVersion();
        Map<String, Object> change = Map.of("action", "CHANGE_ROLE", "role", "MANAGER", "effectiveDate", farmClock.today().toString(), "reason", "Promoted", "expectedVersion", membershipVersion);
        String changeKey = UUID.randomUUID().toString();
        owner.browser.put("/api/farms/" + farmId + "/members/" + membershipId, change, changeKey).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MANAGER"));
        owner.browser.put("/api/farms/" + farmId + "/members/" + membershipId, change, changeKey).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("MANAGER"));
        owner.browser.put("/api/farms/" + farmId + "/members/" + membershipId, change, UUID.randomUUID().toString()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MSG-COM-05"));
        // the Manager role applies from the member's next request without signing in again (GBR-14)
        invitee.get("/api/farms").andExpect(jsonPath("$[?(@.id==" + farmId + ")].role").value("MANAGER"));
    }

    @Test
    void theClosedGenericCrudRoutesStayClosedForAnonymousAndSignedInCallers() throws Exception {
        Browser anonymous = new Browser();
        anonymous.fetchCsrf();
        for (String path : List.of("/api/farm-invitations", "/api/farm-memberships", "/api/app-users")) {
            anonymous.get(path).andExpect(status().isUnauthorized());
        }
        Browser member = signedUp(email("crud"), "Crud Probe").browser;
        for (String path : List.of("/api/farm-invitations", "/api/farm-memberships", "/api/app-users", "/api/farm-invitations/1", "/api/farm-memberships/1")) {
            member.get(path).andExpect(status().isForbidden());
        }
        member.post("/api/farm-invitations", Map.of("invitedEmail", "a@b.test")).andExpect(status().isForbidden());
        member.post("/api/farm-memberships", Map.of("role", "OWNER")).andExpect(status().isForbidden());
        member.delete("/api/farm-memberships/1").andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------- helpers

    private record Signed(String email, Browser browser) {}

    /** Registers, opens the verification link from the mailbox, then signs in on a fresh browser (the user's normal path). */
    private Signed signedUp(String email, String fullName) throws Exception {
        Browser guest = new Browser();
        guest.fetchCsrf();
        guest.post("/api/register", registration(email, fullName, PASSWORD, PASSWORD, true)).andExpect(status().isCreated());
        new Browser().get("/api/activate?token=" + linkToken(email, "/api/activate?token=")).andExpect(status().isSeeOther());
        Browser browser = new Browser();
        browser.fetchCsrf();
        browser.login(email, PASSWORD, false).andExpect(status().isNoContent());
        return new Signed(email, browser);
    }

    /** Completes the Owner profile, registers a farm over HTTP and activates its service (payment is out of scope here). */
    private long activeFarm(Browser owner) throws Exception {
        owner.post("/api/account/owner-registration", Map.of("fullName", "Flow Farm Owner", "phone", "0901234567", "termsAccepted", true)).andExpect(status().isOk());
        MvcResult result = owner.post("/api/farms",
            Map.of("name", "Flow Farm", "province", "Dong Nai", "commune", "Xuan Loc", "expectedHerdSize", "UNDER_50"), UUID.randomUUID().toString())
            .andExpect(status().isCreated()).andExpect(jsonPath("$.serviceStatus").value("PENDING_PAYMENT")).andReturn();
        long farmId = om.readTree(result.getResponse().getContentAsString()).path("id").asLong();
        var farm = farms.findById(farmId).orElseThrow();
        farm.setServiceStatus("ACTIVE");
        farms.saveAndFlush(farm);
        return farmId;
    }

    private static String email(String prefix) {
        return "flow-" + prefix + "-" + SEQ.incrementAndGet() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
    }

    private static Map<String, Object> registration(String email, String password, String confirmation, boolean terms) {
        return registration(email, "Flow Owner", password, confirmation, terms);
    }

    private static Map<String, Object> registration(String email, String fullName, String password, String confirmation, boolean terms) {
        return Map.of("fullName", fullName, "email", email, "password", password, "confirmPassword", confirmation, "termsAccepted", terms);
    }

    private static Map<String, Object> passwordChange(String current, String next, String confirmation) {
        return Map.of("currentPassword", current, "newPassword", next, "confirmPassword", confirmation);
    }

    private static Map<String, Object> reset(String token, String next, String confirmation) {
        return Map.of("key", token, "newPassword", next, "confirmPassword", confirmation);
    }

    private int resetMails(String email) {
        return (int) inbox.findMessagesFor(email).stream().filter(message -> message.plainText() != null && message.plainText().contains("/reset-password?token=")).count();
    }

    /** Runs the durable mail dispatcher (the scheduler is slowed down in the test profile). */
    private void deliverAll() {
        for (int round = 0; round < 3; round++) deliveryJobs.dispatchDueJobs();
    }

    /** The newest mailbox message whose action link contains {@code urlPart}; returns its token. */
    private String linkToken(String email, String urlPart) {
        deliverAll();
        return inbox.findMessagesFor(email).stream()
            .filter(message -> message.plainText() != null && message.plainText().contains(urlPart))
            .findFirst()
            .map(message -> {
                Matcher matcher = TOKEN.matcher(message.plainText());
                assertThat(matcher.find()).as("action link in " + message.subject()).isTrue();
                return matcher.group(1);
            })
            .orElseThrow(() -> new AssertionError("No mail with " + urlPart + " for " + email));
    }

    /** A browser tab: a cookie session plus the readable XSRF cookie and the token the client echoes in X-XSRF-TOKEN. */
    private final class Browser {

        MockHttpSession session;
        Cookie xsrf;
        String token;

        ResultActions fetchCsrf() throws Exception {
            ResultActions result = send(MockMvcRequestBuilders.get("/api/csrf"), null, false, null).andExpect(status().isOk());
            MvcResult mvcResult = result.andReturn();
            token = om.readTree(mvcResult.getResponse().getContentAsString()).path("token").asText();
            Cookie cookie = mvcResult.getResponse().getCookie("XSRF-TOKEN");
            if (cookie != null) xsrf = cookie;
            return result;
        }

        ResultActions login(String username, String password, boolean rememberMe) throws Exception {
            ResultActions result = post("/api/authenticate", Map.of("username", username, "password", password, "rememberMe", rememberMe));
            if (result.andReturn().getResponse().getStatus() == 204) fetchCsrf(); // "Fetch a fresh CSRF token after login"
            return result;
        }

        ResultActions get(String path) throws Exception {
            return send(MockMvcRequestBuilders.get(path), null, false, null);
        }

        ResultActions post(String path, Object body) throws Exception {
            return send(MockMvcRequestBuilders.post(path), body, true, null);
        }

        ResultActions post(String path, Object body, String idempotencyKey) throws Exception {
            return send(MockMvcRequestBuilders.post(path), body, true, idempotencyKey);
        }

        ResultActions postWithoutCsrf(String path, Object body) throws Exception {
            return send(MockMvcRequestBuilders.post(path), body, false, null);
        }

        ResultActions put(String path, Object body, String idempotencyKey) throws Exception {
            return send(MockMvcRequestBuilders.put(path), body, true, idempotencyKey);
        }

        ResultActions delete(String path) throws Exception {
            return send(MockMvcRequestBuilders.delete(path), null, true, null);
        }

        private ResultActions send(MockHttpServletRequestBuilder request, Object body, boolean withCsrf, String idempotencyKey) throws Exception {
            if (session != null) request.session(session);
            if (xsrf != null) request.cookie(xsrf);
            if (withCsrf && token != null) request.header("X-XSRF-TOKEN", token);
            if (idempotencyKey != null) request.header("Idempotency-Key", idempotencyKey);
            if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(om.writeValueAsBytes(body));
            ResultActions result = mvc.perform(request);
            if (result.andReturn().getRequest().getSession(false) instanceof MockHttpSession current) session = current;
            return result;
        }
    }
}
