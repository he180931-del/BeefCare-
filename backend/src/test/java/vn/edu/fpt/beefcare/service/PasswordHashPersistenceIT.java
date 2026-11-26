package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.UserRepository;

/** FE-01 WBS4: a new Argon2id credential survives the ORM/database round trip. */
@ServiceIntegrationTest
class PasswordHashPersistenceIT {

    @Autowired
    private IdentityService identityService;

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void registerPersistsAnArgon2idHashThatMatchesAfterReload() {
        String email = "argon2-roundtrip-" + UUID.randomUUID() + "@example.test";
        String password = "😀".repeat(64) + "lowercase-only";

        assertThat(identityService.register("Round Trip Owner", email, password, password, true)).isEqualTo(email);

        User reloaded = users.findOneByEmailIgnoreCase(email).orElseThrow();
        assertThat(reloaded.getPassword()).startsWith("$argon2id$").hasSizeLessThanOrEqualTo(255).doesNotContain(password);
        assertThat(passwordEncoder.matches(password, reloaded.getPassword())).isTrue();
    }
}
