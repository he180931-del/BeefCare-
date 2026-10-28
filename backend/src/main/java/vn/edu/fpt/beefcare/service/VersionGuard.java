package vn.edu.fpt.beefcare.service;

import java.util.Objects;

/** Optimistic-lock checks for commands with explicit client form versions (BR-D31, MSG-COM-05). */
public final class VersionGuard {

    private VersionGuard() {}

    public static void check(Integer actual, Integer expected) {
        if (expected != null && !Objects.equals(actual, expected)) {
            throw DomainException.conflict(MessageCodes.COM_05, "expected", expected, "actual", actual);
        }
    }

    /** Use for update/correction commands where the client must send the version it edited. */
    public static void requireExpected(Integer actual, Integer expected) {
        if (expected == null) {
            throw DomainException.conflict(MessageCodes.COM_05, "reason", "expected_version_required");
        }
        check(actual, expected);
    }
}
