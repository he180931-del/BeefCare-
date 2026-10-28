package vn.edu.fpt.beefcare.service.email;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ActionLinkSignerTest {

    @Test
    void actionTokenIsDerivedFromServerKeyPurposeRowAndUnpredictableNonce() {
        ActionLinkSigner signer = new ActionLinkSigner("this-is-a-test-only-secret-key-with-more-than-32-bytes");
        String nonce = signer.newNonce();
        String token = signer.bearer("ACCOUNT_LINK:EMAIL_VERIFICATION", 22L, nonce);

        assertThat(token).hasSizeGreaterThan(32);
        assertThat(signer.matchesHash(token, signer.hash(token))).isTrue();
        assertThat(signer.matchesHash(signer.bearer("ACCOUNT_LINK:PASSWORD_RESET", 22L, nonce), signer.hash(token))).isFalse();
        assertThat(signer.matchesHash(signer.bearer("ACCOUNT_LINK:EMAIL_VERIFICATION", 23L, nonce), signer.hash(token))).isFalse();
        assertThat(signer.matchesHash(signer.bearer("ACCOUNT_LINK:EMAIL_VERIFICATION", 22L, signer.newNonce()), signer.hash(token))).isFalse();
    }

    @Test
    void refusesWeakSigningSecrets() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new ActionLinkSigner("too-short"))
            .isInstanceOf(IllegalStateException.class);
    }
}
