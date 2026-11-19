package vn.edu.fpt.beefcare.service.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Verifies SePay's X-SePay-Signature over timestamp + "." + the exact raw UTF-8 request body. */
@Component
public class SePaySignatureVerifier {
    private static final Duration ALLOWED_SKEW = Duration.ofSeconds(300);
    private final String secret;
    private final Clock clock;

    public SePaySignatureVerifier(@Value("$" + "{beefcare.sepay.webhook-secret:}") String secret, Clock clock) {
        this.secret = secret;
        this.clock = clock;
    }

    public boolean verify(String timestampHeader, String signatureHeader, byte[] rawBody) {
        if (secret == null || secret.isBlank() || timestampHeader == null || signatureHeader == null || rawBody == null) return false;
        final long timestampSeconds;
        try {
            if (!timestampHeader.matches("[0-9]{1,12}")) return false;
            timestampSeconds = Long.parseLong(timestampHeader);
        } catch (NumberFormatException invalid) {
            return false;
        }
        long difference;
        try {
            difference = Math.abs(Math.subtractExact(clock.instant().getEpochSecond(), timestampSeconds));
        } catch (ArithmeticException overflow) {
            return false;
        }
        if (difference > ALLOWED_SKEW.toSeconds()) return false;
        if (!signatureHeader.matches("sha256=[0-9a-fA-F]{64}")) return false;
        byte[] supplied;
        try {
            supplied = HexFormat.of().parseHex(signatureHeader.substring("sha256=".length()));
        } catch (IllegalArgumentException malformed) {
            return false;
        }
        byte[] expected = hmac(timestampHeader, rawBody);
        return MessageDigest.isEqual(expected, supplied);
    }

    private byte[] hmac(String timestampHeader, byte[] rawBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            mac.update(timestampHeader.getBytes(StandardCharsets.US_ASCII));
            mac.update((byte) '.');
            mac.update(rawBody);
            return mac.doFinal();
        } catch (java.security.GeneralSecurityException unavailable) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", unavailable);
        }
    }
}
