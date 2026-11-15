package vn.edu.fpt.beefcare.service;

/**
 * Message codes of Appendix E of the FE-04 / FE-06 / FE-13 specification.
 * Default texts live in i18n/domain_messages*.properties.
 */
public final class MessageCodes {

    public static final String COM_01 = "MSG-COM-01";
    public static final String COM_02 = "MSG-COM-02";
    public static final String COM_03 = "MSG-COM-03";
    public static final String COM_04 = "MSG-COM-04";
    public static final String COM_05 = "MSG-COM-05";
    public static final String COM_06 = "MSG-COM-06";
    public static final String COM_07 = "MSG-COM-07";
    public static final String COM_08 = "MSG-COM-08";
    public static final String COM_09 = "MSG-COM-09";
    public static final String COM_10 = "MSG-COM-10";
    public static final String COM_11 = "MSG-COM-11";
    public static final String COM_12 = "MSG-COM-12";
    public static final String COM_13 = "MSG-COM-13";
    public static final String COM_14 = "MSG-COM-14";
    public static final String COM_15 = "MSG-COM-15";
    public static final String COM_16 = "MSG-COM-16";
    public static final String COM_17 = "MSG-COM-17";
    /** FE-09 R-09-10: the animal already received this dose of the schedule and is skipped in a batch. */
    public static final String FE09_09 = "MSG-FE09-09";
    public static final String COM_18 = "MSG-COM-18";
    public static final String COM_19 = "MSG-COM-19";

    /** FE-10 R-10-04: body temperature outside 35.0–43.0 °C. */
    public static final String FE10_06 = "MSG-FE10-06";
    /** FE-10 R-10-05: a follow-up, treatment, closure or corrected time earlier than the latest record of the case; params.date. */
    public static final String FE10_07 = "MSG-FE10-07";
    /** FE-10 R-10-11: the opening observation of a case cannot be voided. */
    public static final String FE10_13 = "MSG-FE10-13";

    /** FE-11 R-11-03 / Q2: a similar estrus or breeding of the cow within 12 hours; resend with confirmDuplicate. */
    public static final String FE11_03 = "MSG-FE11-03";
    /** FE-11 R-11-01: the farm sire must be another ACTIVE male of the farm; params.field. */
    public static final String FE11_04 = "MSG-FE11-04";
    /** FE-11 R-11-04: the cow has an OPEN (confirmed) pregnancy. */
    public static final String FE11_05 = "MSG-FE11-05";
    /** FE-11 R-11-11 / FE-12 R-12-15: later records depend on this one; params.records, params.dependents[]. */
    public static final String FE11_07 = "MSG-FE11-07";
    /** FE-11 R-11-07 / REM-02: a farm parameter is missing; returned as {@code parameterMissing}, never thrown. */
    public static final String FE11_08 = "MSG-FE11-08";
    /** FE-11 R-11-09: breeding eligibility not met; a warning ({@code eligibilityWarning}), never thrown. */
    public static final String FE11_09 = "MSG-FE11-09";
    /** FE-11 R-11-05: the time is earlier than the linked event; params.event, params.time, params.field. */
    public static final String FE11_10 = "MSG-FE11-10";
    /** FE-11 R-11-10: the cattle is not tracked for reproduction; params.reason. */
    public static final String FE11_11 = "MSG-FE11-11";
    /** FE-12 R-12-04: the check contradicts a check or pregnancy of the cow. */
    public static final String FE12_02 = "MSG-FE12-02";
    /** FE-12 R-12-08: a calving needs at least one calf outcome. */
    public static final String FE12_06 = "MSG-FE12-06";
    /** FE-12 R-12-09: birth weight 1–80 kg with a basis; params.field. */
    public static final String FE12_07 = "MSG-FE12-07";
    /** FE-12 R-12-10: the calf tag is already used in the farm; params.tag_code, params.field. */
    public static final String FE12_08 = "MSG-FE12-08";
    /** FE-12 R-12-03: the pregnancy has no expected calving date (notice, never thrown). */
    public static final String FE12_11 = "MSG-FE12-11";
    /** FE-12 R-12-05 / §3.4: the pregnancy is no longer OPEN, or a second calving within 30 days; params.dam_code. */
    public static final String FE12_12 = "MSG-FE12-12";

    /** UC-FE02-01 E1: Owner registration is not complete. */
    public static final String FE02_02 = "MSG-FE02-02";
    /** UC-FE02-02 AF3: a Manager or Technician enters a farm that is not ACTIVE. */
    public static final String FE02_04 = "MSG-FE02-04";
    /** UC-FE02-05 E3: the farm is already in the requested state (suspend a SUSPENDED farm, restore one that is not). */
    public static final String FE02_09 = "MSG-FE02-09";
    /** UC-FE19-06 E1/E2: PM acceptance blocked; params.reason names the rule (D19). */
    public static final String FE19_11 = "MSG-FE19-11";

    public static final String FE03_17 = "MSG-FE03-17";
    public static final String FE03_18 = "MSG-FE03-18";
    public static final String FE03_20 = "MSG-FE03-20";
    public static final String FE03_21 = "MSG-FE03-21";
    /** D33 (FE-03 Q4): grant / change / restore platform access of a SUSPENDED account. */
    public static final String FE03_22 = "MSG-FE03-22";

    public static final String FE18_02 = "MSG-FE18-02";
    public static final String FE18_04 = "MSG-FE18-04";
    public static final String FE18_06 = "MSG-FE18-06";
    /** A catalogue value (medicine, vaccine) that is not ACTIVE; params.field. */
    public static final String FE18_08 = "MSG-FE18-08";
    public static final String FE18_09 = "MSG-FE18-09";
    public static final String FE04_01 = "MSG-FE04-01";
    public static final String FE04_02 = "MSG-FE04-02";
    public static final String FE04_03 = "MSG-FE04-03";
    public static final String FE04_04 = "MSG-FE04-04";
    public static final String FE04_05 = "MSG-FE04-05";
    public static final String FE04_06 = "MSG-FE04-06";
    public static final String FE04_07 = "MSG-FE04-07";
    public static final String FE04_08 = "MSG-FE04-08";
    public static final String FE04_09 = "MSG-FE04-09";

    public static final String FE06_01 = "MSG-FE06-01";
    public static final String FE06_02 = "MSG-FE06-02";
    public static final String FE06_03 = "MSG-FE06-03";
    public static final String FE06_04 = "MSG-FE06-04";
    public static final String FE06_05 = "MSG-FE06-05";
    public static final String FE06_06 = "MSG-FE06-06";
    public static final String FE06_07 = "MSG-FE06-07";
    public static final String FE06_08 = "MSG-FE06-08";
    public static final String FE06_09 = "MSG-FE06-09";
    public static final String FE06_10 = "MSG-FE06-10";
    public static final String FE06_11 = "MSG-FE06-11";
    public static final String FE06_12 = "MSG-FE06-12";
    public static final String FE06_13 = "MSG-FE06-13";
    public static final String FE06_14 = "MSG-FE06-14";
    public static final String FE06_15 = "MSG-FE06-15";
    public static final String FE06_16 = "MSG-FE06-16";
    public static final String FE06_17 = "MSG-FE06-17";
    public static final String FE06_18 = "MSG-FE06-18";
    public static final String FE06_19 = "MSG-FE06-19";
    public static final String FE06_20 = "MSG-FE06-20";
    public static final String FE06_21 = "MSG-FE06-21";
    public static final String FE06_22 = "MSG-FE06-22";
    public static final String FE06_23 = "MSG-FE06-23";
    public static final String FE06_24 = "MSG-FE06-24";

    public static final String FE13_01 = "MSG-FE13-01";
    public static final String FE13_02 = "MSG-FE13-02";
    public static final String FE13_03 = "MSG-FE13-03";
    public static final String FE13_04 = "MSG-FE13-04";
    public static final String FE13_05 = "MSG-FE13-05";
    public static final String FE13_06 = "MSG-FE13-06";
    public static final String FE13_07 = "MSG-FE13-07";
    public static final String FE13_08 = "MSG-FE13-08";
    public static final String FE13_09 = "MSG-FE13-09";

    public static final String FE23_03 = "MSG-FE23-03";
    public static final String FE23_05 = "MSG-FE23-05";
    public static final String FE23_08 = "MSG-FE23-08";

    public static final String FE01_01 = "MSG-FE01-01";
    public static final String FE01_02 = "MSG-FE01-02";
    public static final String FE01_03 = "MSG-FE01-03";
    public static final String FE01_06 = "MSG-FE01-06";
    public static final String FE01_08 = "MSG-FE01-08";
    public static final String FE01_09 = "MSG-FE01-09";
    public static final String FE01_10 = "MSG-FE01-10";
    public static final String FE01_11 = "MSG-FE01-11";
    public static final String FE01_14 = "MSG-FE01-14";
    public static final String FE01_16 = "MSG-FE01-16";
    public static final String FE03_02 = "MSG-FE03-02";
    public static final String FE03_03 = "MSG-FE03-03";
    public static final String FE03_04 = "MSG-FE03-04";
    public static final String FE03_08 = "MSG-FE03-08";
    public static final String FE03_09 = "MSG-FE03-09";

    private MessageCodes() {}
}
