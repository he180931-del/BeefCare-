package vn.edu.fpt.beefcare.service;

import java.util.Objects;

/** Optimistic-lock check on an explicit expected version (BR-D31, MSG-COM-05). A null expected version skips the check. */
public final class VersionGuard {

    private VersionGuard() {}

    public static void check(Integer actual, Integer expected) {
        if (expected != null && !Objects.equals(actual, expected)) {
            throw DomainException.conflict(MessageCodes.COM_05, "expected", expected, "actual", actual);
        }
    }
}
