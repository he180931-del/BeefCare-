package vn.edu.fpt.beefcare.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class MigratingPasswordEncoderTest {

    private static final String LEGACY_PASSWORD = "LegacyPass9!";
    private static final String LEGACY_BCRYPT_2A = new BCryptPasswordEncoder().encode(LEGACY_PASSWORD);

    private final MigratingPasswordEncoder encoder = new MigratingPasswordEncoder();

    @Test
    void emitsArgon2idAndMatchesTheOriginalPassword() {
        String encoded = encoder.encode("FreshPassword9!");

        assertThat(encoded).startsWith("$argon2id$");
        assertThat(encoder.matches("FreshPassword9!", encoded)).isTrue();
        assertThat(encoder.upgradeEncoding(encoded)).isFalse();
    }

    @Test
    void distinguishesPasswordsBeyondTheLegacyBcrypt72BytePrefix() {
        String first = "a".repeat(72) + "X";
        String distinct = "a".repeat(72) + "Y";

        assertThat(encoder.matches(first, encoder.encode(first))).isTrue();
        assertThat(encoder.matches(distinct, encoder.encode(first))).isFalse();
    }

    @ParameterizedTest(name = "accepts legacy {0} hash prefix")
    @MethodSource("legacyHashes")
    void acceptsLegacyBcryptPrefixesAndMarksThemForUpgrade(String prefix, String hash) {
        assertThat(encoder.matches(LEGACY_PASSWORD, hash)).isTrue();
        assertThat(encoder.upgradeEncoding(hash)).isTrue();
    }

    private static Stream<Arguments> legacyHashes() {
        return Stream.of(
            Arguments.of("$2a$", LEGACY_BCRYPT_2A),
            Arguments.of("$2b$", LEGACY_BCRYPT_2A.replace("$2a$", "$2b$")),
            Arguments.of("$2y$", LEGACY_BCRYPT_2A.replace("$2a$", "$2y$"))
        );
    }

    @ParameterizedTest(name = "does not accept malformed encoded value {0}")
    @MethodSource("invalidEncodedValues")
    void handlesUnknownMalformedAndNullHashesWithoutThrowing(String encoded) {
        assertThatCode(() -> encoder.matches("anything", encoded)).doesNotThrowAnyException();
        assertThatCode(() -> encoder.upgradeEncoding(encoded)).doesNotThrowAnyException();
        assertThat(encoder.matches("anything", encoded)).isFalse();
        assertThat(encoder.upgradeEncoding(encoded)).isFalse();
    }

    private static Stream<String> invalidEncodedValues() {
        return Stream.of(null, "", "not-a-password-hash", "$argon2id$malformed", "$2z$10$unknown");
    }
}
