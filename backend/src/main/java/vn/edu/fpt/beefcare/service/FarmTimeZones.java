package vn.edu.fpt.beefcare.service;

import java.time.ZoneOffset;
import java.util.Set;

/**
 * Fixed business time for every farm and platform feature. The canonical IANA name is retained in the API.
 */
public final class FarmTimeZones {

    public static final String DEFAULT = "Asia/Ho_Chi_Minh";
    public static final ZoneOffset OFFSET = ZoneOffset.ofHours(7);
    public static final String SCHEDULER_ZONE = "GMT+07:00";
    private static final Set<String> ACCEPTED_IDS = Set.of(DEFAULT, "Asia/Bangkok", "Asia/Vientiane", "+07:00", "UTC+07:00");

    private FarmTimeZones() {}

    /** Accept equivalent UTC+7 values from existing clients and always store the canonical ID. */
    public static String require(String value, String field) {
        String zone = value == null || value.isBlank() ? DEFAULT : value.trim();
        if (!ACCEPTED_IDS.contains(zone)) throw DomainException.invalid(field);
        return DEFAULT;
    }
}
