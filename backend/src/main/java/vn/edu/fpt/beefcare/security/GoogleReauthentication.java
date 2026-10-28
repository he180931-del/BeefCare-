package vn.edu.fpt.beefcare.security;

import jakarta.servlet.http.HttpSession;
import java.time.Duration;
import java.time.Instant;

/**
 * UC-FE01-06 AF1/AF2: a Google sign-in within the last 5 minutes, in this session, stands in for the current password
 * when the user adds a first password or forgot the current one.
 */
public final class GoogleReauthentication {

    /** Set by the Google success handler on every Google sign-in. */
    public static final String AUTHENTICATED_AT = "beefcare.google.authenticatedAt";
    /** Set by the profile before it sends the user to Google, so the sign-in returns to the profile. */
    public static final String RETURN_TO_PROFILE = "beefcare.google.returnToProfile";
    public static final Duration WINDOW = Duration.ofMinutes(5);

    private GoogleReauthentication() {}

    /** The time of a Google sign-in in this session within the window, or null. */
    public static Instant recent(HttpSession session, Instant now) {
        if (session == null) return null;
        Object value = session.getAttribute(AUTHENTICATED_AT);
        if (!(value instanceof Instant at)) return null;
        return !at.isAfter(now) && Duration.between(at, now).compareTo(WINDOW) <= 0 ? at : null;
    }
}
