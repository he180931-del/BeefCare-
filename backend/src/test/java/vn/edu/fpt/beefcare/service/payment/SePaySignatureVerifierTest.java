package vn.edu.fpt.beefcare.service.payment;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;

class SePaySignatureVerifierTest {
    private static final String SECRET = "a-server-only-test-key-with-enough-entropy";
    private static final String TIMESTAMP = "1793210400";
    private static final Clock CLOCK = Clock.fixed(Instant.ofEpochSecond(1793210400), ZoneOffset.UTC);

    @Test
    void acceptsExactRawPayloadWithFreshTimestamp() throws Exception {
        byte[] body = "{\"id\":123,\"transferAmount\":100000}".getBytes(StandardCharsets.UTF_8);
        SePaySignatureVerifier verifier = new SePaySignatureVerifier(SECRET, CLOCK);
        assertThat(verifier.verify(TIMESTAMP, sign(TIMESTAMP, body), body)).isTrue();
    }

    @Test
    void acceptsTheFiveMinuteBoundaryAndRejectsModifiedBodyOrOlderTimestamps() throws Exception {
        byte[] body = "{\"id\":123}".getBytes(StandardCharsets.UTF_8);
        SePaySignatureVerifier verifier = new SePaySignatureVerifier(SECRET, CLOCK);
        assertThat(verifier.verify(TIMESTAMP, sign(TIMESTAMP, body), "{\"id\":124}".getBytes(StandardCharsets.UTF_8))).isFalse();
        assertThat(verifier.verify(TIMESTAMP, null, body)).isFalse();
        String boundary = "1793210100";
        assertThat(verifier.verify(boundary, sign(boundary, body), body)).isTrue();
        String stale = "1793210099";
        assertThat(verifier.verify(stale, sign(stale, body), body)).isFalse();
        String futureBoundary = "1793210700";
        assertThat(verifier.verify(futureBoundary, sign(futureBoundary, body), body)).isTrue();
        String futureStale = "1793210701";
        assertThat(verifier.verify(futureStale, sign(futureStale, body), body)).isFalse();
    }

    private static String sign(String timestamp, byte[] body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update(timestamp.getBytes(StandardCharsets.US_ASCII));
        mac.update((byte) '.');
        mac.update(body);
        return "sha256=" + HexFormat.of().formatHex(mac.doFinal());
    }
}
