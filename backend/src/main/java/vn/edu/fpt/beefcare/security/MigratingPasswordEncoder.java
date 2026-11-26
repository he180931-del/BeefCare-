package vn.edu.fpt.beefcare.security;

import java.util.regex.Pattern;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Encodes new credentials with Argon2id while retaining verification support for
 * hashes created by the legacy bcrypt encoder.
 */
public final class MigratingPasswordEncoder implements PasswordEncoder {

    private static final Pattern LEGACY_BCRYPT = Pattern.compile("\\A\\$2[aby]\\$(0[4-9]|[12]\\d|3[01])\\$[./0-9A-Za-z]{53}\\z");

    private final Argon2PasswordEncoder argon2 = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    @Override
    public String encode(CharSequence rawPassword) {
        return argon2.encode(rawPassword);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (rawPassword == null || encodedPassword == null || encodedPassword.isEmpty()) return false;
        try {
            if (encodedPassword.startsWith("$argon2id$")) return argon2.matches(rawPassword, encodedPassword);
            if (isLegacyBcrypt(encodedPassword)) return bcrypt.matches(rawPassword, encodedPassword);
        } catch (RuntimeException ignored) {
            // Encoded credentials are untrusted persistence data; a malformed value is simply not a match.
        }
        return false;
    }

    @Override
    public boolean upgradeEncoding(String encodedPassword) {
        return encodedPassword != null && isLegacyBcrypt(encodedPassword);
    }

    private static boolean isLegacyBcrypt(String encodedPassword) {
        return LEGACY_BCRYPT.matcher(encodedPassword).matches();
    }
}
