package vn.edu.fpt.beefcare.service;

import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;

/**
 * The correlation ID of the current request or job run (SRS Part I §3.2 J, D34). It is kept in the logging MDC, so log
 * lines and audit entries of one request carry the same value.
 */
public final class CorrelationId {

    /** MDC key, also used by the log pattern. */
    public static final String MDC_KEY = "correlationId";
    /** Request / response header. */
    public static final String HEADER = "X-Request-Id";

    private static final Pattern ACCEPTED = Pattern.compile("[A-Za-z0-9._-]{8,64}");

    private CorrelationId() {}

    /** The value of the running request or job; a new one when nothing set it (e.g. a service called directly). */
    public static String current() {
        String value = MDC.get(MDC_KEY);
        return value == null ? newId() : value;
    }

    /** A client value is reused only when it is a plain token of 8–64 characters; anything else gets a new ID. */
    public static String acceptOrNew(String candidate) {
        return candidate != null && ACCEPTED.matcher(candidate).matches() ? candidate : newId();
    }

    public static String newId() {
        return UUID.randomUUID().toString();
    }

    /** Runs {@code work} under {@code id} and restores the previous value afterwards (pooled threads are reused). */
    public static void runWith(String id, Runnable work) {
        String previous = MDC.get(MDC_KEY);
        MDC.put(MDC_KEY, id);
        try {
            work.run();
        } finally {
            if (previous == null) MDC.remove(MDC_KEY);
            else MDC.put(MDC_KEY, previous);
        }
    }

    /** Each scheduled run gets its own ID (job actions are written by "System"). */
    public static Runnable withNewId(Runnable work) {
        return () -> runWith(newId(), work);
    }
}
