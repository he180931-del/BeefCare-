package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;

@ServiceIntegrationTest
@Transactional
class IdentityPasswordPolicyIT {

    @Autowired
    private IdentityService identityService;

    @ParameterizedTest(name = "register accepts {0}")
    @MethodSource("validPasswords")
    void registerAcceptsEightTo128UnicodeCodePointsWithoutCompositionRules(String label, String password) {
        String email = email(label);

        assertThat(identityService.register("Policy Owner", email, password, password, true)).isEqualTo(email);
    }

    @ParameterizedTest(name = "register rejects {0} code-point boundary")
    @MethodSource("invalidLengthPasswords")
    void registerRejectsPasswordsOutsideEightTo128UnicodeCodePoints(String label, String password) {
        assertThatThrownBy(() -> identityService.register("Policy Owner", email(label), password, password, true))
            .isInstanceOfSatisfying(DomainException.class, failure -> assertThat(failure.getCode()).isEqualTo(MessageCodes.FE01_08));
    }

    @Test
    void registerRejectsPasswordEqualToEmailIgnoringCase() {
        String email = email("email-equality");

        assertThatThrownBy(() -> identityService.register("Policy Owner", email, email.toUpperCase(), email.toUpperCase(), true))
            .isInstanceOfSatisfying(DomainException.class, failure -> assertThat(failure.getCode()).isEqualTo(MessageCodes.FE01_08));
    }

    @Test
    void registerRejectsMismatchedConfirmationThroughThePublicFlow() {
        assertThatThrownBy(() -> identityService.register("Policy Owner", email("confirmation"), "abcdefgh", "abcdefgi", true))
            .isInstanceOfSatisfying(DomainException.class, failure -> assertThat(failure.getCode()).isEqualTo(MessageCodes.FE01_09));
    }

    private static Stream<Arguments> validPasswords() {
        return Stream.of(
            Arguments.of("lowercase-only", "abcdefgh"),
            Arguments.of("digit-only", "12345678"),
            Arguments.of("symbol-only", "!!!!!!!!"),
            Arguments.of("eight-unicode-code-points", "😀".repeat(8)),
            Arguments.of("128-unicode-code-points", "😀".repeat(128))
        );
    }

    private static Stream<Arguments> invalidLengthPasswords() {
        return Stream.of(Arguments.of("seven-unicode-code-points", "😀".repeat(7)), Arguments.of("129-unicode-code-points", "😀".repeat(129)));
    }

    private static String email(String label) {
        return label + "-" + UUID.randomUUID() + "@example.test";
    }
}
