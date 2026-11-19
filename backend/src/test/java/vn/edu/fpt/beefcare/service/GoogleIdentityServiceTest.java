package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import vn.edu.fpt.beefcare.domain.Authority;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.AuthorityRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;

class GoogleIdentityServiceTest {

    private final AppUserRepository appUsers = mock(AppUserRepository.class);
    private final UserRepository identities = mock(UserRepository.class);
    private final AuthorityRepository authorities = mock(AuthorityRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final GoogleIdentityService service = new GoogleIdentityService(appUsers, identities, authorities, encoder);

    @Test
    void refusesGoogleIdentityWithoutVerifiedEmail() {
        OidcUser google = profile("person@example.test", "google-subject", false);

        assertThatThrownBy(() -> service.provisionOrLink(google)).isInstanceOf(OAuth2AuthenticationException.class);
        verify(appUsers, never()).findOneByEmailIgnoreCase(any());
        verify(identities, never()).saveAndFlush(any());
    }

    @Test
    void createsActiveGoogleOnlyIdentityWithoutCompletingOwnerRegistration() {
        when(appUsers.findOneByGoogleSubject("google-subject")).thenReturn(Optional.empty());
        when(appUsers.findOneByEmailIgnoreCase("person@example.test")).thenReturn(Optional.empty());
        when(identities.findOneByEmailIgnoreCase("person@example.test")).thenReturn(Optional.empty());
        when(authorities.findById("ROLE_USER")).thenReturn(Optional.of(new Authority().name("ROLE_USER")));
        when(encoder.encode(any())).thenReturn("discarded-secret-hash");
        when(appUsers.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(identities.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        GoogleIdentityService.Result result = service.provisionOrLink(profile("Person@Example.test", "google-subject", true));

        assertThat(result.user().isActivated()).isTrue();
        assertThat(result.user().getEmail()).isEqualTo("person@example.test");
        assertThat(result.user().getAuthorities()).extracting(Authority::getName).containsExactly("ROLE_USER");
        assertThat(result.ownerRegistrationCompleted()).isFalse();
        var account = org.mockito.ArgumentCaptor.forClass(vn.edu.fpt.beefcare.domain.AppUser.class);
        verify(appUsers).saveAndFlush(account.capture());
        assertThat(account.getValue().getGoogleSubject()).isEqualTo("google-subject");
        assertThat(account.getValue().isPasswordLoginEnabled()).isFalse();
        assertThat(account.getValue().isOwnerRegistrationCompleted()).isFalse();
    }

    private OidcUser profile(String email, String subject, boolean verified) {
        OidcUser google = mock(OidcUser.class);
        when(google.getSubject()).thenReturn(subject);
        when(google.getClaimAsString("email")).thenReturn(email);
        when(google.getClaimAsString("name")).thenReturn("Google Person");
        when(google.getClaim("email_verified")).thenReturn(verified);
        return google;
    }
}
