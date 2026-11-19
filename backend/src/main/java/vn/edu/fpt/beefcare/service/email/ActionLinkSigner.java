package vn.edu.fpt.beefcare.service.email;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Derives an opaque link from a purpose, immutable source-row id, nonce and server-only HMAC key. */
@Component
public class ActionLinkSigner {

    private final byte[] secret;
    private final SecureRandom random = new SecureRandom();

    public ActionLinkSigner(@Value("${beefcare.email.link-signing-key}") String secret) {
        if (secret == null || secret.length() < 32) throw new IllegalStateException("BEEFCARE_EMAIL_LINK_SIGNING_KEY must contain at least 32 characters");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String newNonce() {
        byte[] nonce = new byte[32];
        random.nextBytes(nonce);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
    }

    public String bearer(String purpose, Long sourceId, String nonce) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal((purpose + ":" + sourceId + ":" + nonce).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException("HMAC-SHA256 is required by the Java runtime", failure);
        }
    }

    public String hash(String bearer) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bearer.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception failure) {
            throw new IllegalStateException("SHA-256 is required by the Java runtime", failure);
        }
    }

    public boolean matchesHash(String bearer, String expectedHash) {
        if (bearer == null || expectedHash == null) return false;
        return MessageDigest.isEqual(hash(bearer).getBytes(StandardCharsets.US_ASCII), expectedHash.getBytes(StandardCharsets.US_ASCII));
    }
}
