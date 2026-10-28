package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.security.GoogleReauthentication;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** UC-FE01-06 AF1 (first password for a Google-only account) and AF2 (Google instead of the forgotten password). */
@ServiceIntegrationTest
@Transactional
class GoogleReauthenticationIT extends DomainTestSupport {

    private static final String NEW_PASSWORD = "Fresh-Password-77";

    @Autowired
    IdentityService identity;

    @Autowired
    PasswordEncoder encoder;

    @Test
    void googleOnlyAccountNeedsARecentGoogleSignInToAddAFirstPassword() {
        AppUser account = account("google-only", false, "google-sub-1", null);
        actAs(account);

        assertThatThrownBy(() -> identity.changePassword(null, NEW_PASSWORD, NEW_PASSWORD, false))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01);
                assertThat(e.getParams()).containsEntry("reason", "google_reauthentication_required");
            });

        identity.changePassword(null, NEW_PASSWORD, NEW_PASSWORD, true);
        em.flush();
        em.clear();
        assertThat(em.find(AppUser.class, account.getId()).isPasswordLoginEnabled()).isTrue();
        User credential = em.createQuery("select u from User u where u.login = :l", User.class).setParameter("l", account.getEmail()).getSingleResult();
        assertThat(encoder.matches(NEW_PASSWORD, credential.getPassword())).isTrue();
        assertThat(identity.checkPasswordSignInAllowed(account.getEmail())).isNotNull(); // password sign-in now allowed
        assertThat(em.find(AppUser.class, account.getId()).getGoogleSubject()).isEqualTo("google-sub-1"); // POST-2
    }

    @Test
    void recentGoogleSignInReplacesAForgottenCurrentPasswordButOnlyForALinkedAccount() {
        AppUser linked = account("linked", true, "google-sub-2", "Old-Password-77");
        actAs(linked);
        assertThatThrownBy(() -> identity.changePassword("wrong", NEW_PASSWORD, NEW_PASSWORD, false))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE01_16));
        identity.changePassword(null, NEW_PASSWORD, NEW_PASSWORD, true);

        AppUser passwordOnly = account("password-only", true, null, "Old-Password-77");
        actAs(passwordOnly);
        // a Google flag without a linked Google identity changes nothing: the current password is still required
        assertThatThrownBy(() -> identity.changePassword("wrong", NEW_PASSWORD, NEW_PASSWORD, true))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE01_16));
    }

    @Test
    void reauthenticationCountsForFiveMinutesInTheSameSession() {
        Instant now = Instant.parse("2026-10-28T10:00:00Z");
        MockHttpSession session = new MockHttpSession();
        assertThat(GoogleReauthentication.recent(session, now)).isNull();
        session.setAttribute(GoogleReauthentication.AUTHENTICATED_AT, now.minusSeconds(299));
        assertThat(GoogleReauthentication.recent(session, now)).isNotNull();
        session.setAttribute(GoogleReauthentication.AUTHENTICATED_AT, now.minusSeconds(301));
        assertThat(GoogleReauthentication.recent(session, now)).isNull();
        assertThat(GoogleReauthentication.recent(null, now)).isNull();
    }

    private AppUser account(String name, boolean passwordLogin, String googleSubject, String password) {
        String email = name + next() + "@beefcare.test";
        User credential = new User();
        credential.setLogin(email);
        credential.setEmail(email);
        credential.setActivated(true);
        credential.setPassword(encoder.encode(password == null ? "unused-google-only-" + next() : password));
        save(credential);
        AppUser account = new AppUser();
        account.setEmail(email);
        account.setFullName("Person " + name);
        account.setAccountStatus("ACTIVE");
        account.setPasswordLoginEnabled(passwordLogin);
        account.setGoogleSubject(googleSubject);
        return save(account);
    }
}
