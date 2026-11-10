package vn.edu.fpt.beefcare.service;

import java.util.List;

/**
 * SCR-11 "Time zone" (GBR-66), decision FE-02 Q2 (08/11/2026): only the UTC+7 zones offered on the screen, so changing
 * the zone of a farm that already has data never shifts a stored date. Keep identical to {@code TIME_ZONES} in
 * {@code frontend/src/features/farm-workspace/data/provinces.ts}; a frontend contract test compares the two.
 */
public final class FarmTimeZones {

    public static final List<String> IDS = List.of("Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Vientiane");
    public static final String DEFAULT = IDS.get(0);

    private FarmTimeZones() {}

    /** Blank means the default zone; any other value must be one of {@link #IDS} (MSG-COM-10). */
    public static String require(String value, String field) {
        String zone = value == null || value.isBlank() ? DEFAULT : value.trim();
        if (!IDS.contains(zone)) throw DomainException.invalid(field);
        return zone;
    }
}
