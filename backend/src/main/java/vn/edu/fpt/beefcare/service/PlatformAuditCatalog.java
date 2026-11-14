package vn.edu.fpt.beefcare.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * D34 / UC-FE17-01: the central audit (SCR-51) is the GBR-86 list of important platform changes. Every other row of
 * {@code audit_log} (cattle, care, clinical, vouchers, feed, catalogues…) belongs to its farm feature and is never shown
 * to the SA. Stored action codes stay as written by the source features (other readers depend on them); this catalogue
 * gives each one its public SRS-style code, its SCR-51 target type, whose role the actor acted in and the before/after
 * fields that may be shown. Reasons and any other detail key are never shown.
 */
public final class PlatformAuditCatalog {

    /** SCR-51 Target type (SRS Part III §17.1). */
    public enum TargetType { ACCOUNT, PLATFORM_ACCESS, MEMBERSHIP, FARM, PAYMENT, FINANCE_RECORD, TICKET, INTERNAL_REQUEST }

    /** Whose role the actor acted in: a platform staff role or a farm membership role. */
    public enum Scope { PLATFORM, FARM }

    /**
     * @param code         public action code (SCR-51 Action)
     * @param stored       action codes written to {@code audit_log}
     * @param storedSuffix stored codes ending with this text (payment confirmation: {@code <channel>_PAYMENT_PAID}), or null
     * @param paired       fields shown with a before and an after value (role, status)
     * @param result       fields shown only as the new value
     */
    public record Action(String code, TargetType targetType, Scope scope, Set<String> stored, String storedSuffix, List<String> paired, List<String> result) {
        boolean matches(String storedAction) {
            if (storedAction == null) return false;
            return stored.contains(storedAction) || (storedSuffix != null && storedAction.endsWith(storedSuffix));
        }
    }

    /** Before / after values that may be shown; a value missing on one side is shown as "—". */
    public record Change(Map<String, String> before, Map<String, String> after) {}

    private static final List<String> STATUS = List.of("status");
    private static final List<String> ROLE_STATUS = List.of("role", "status");
    private static final List<String> NONE = List.of();

    private static final List<Action> ACTIONS = List.of(
        // Accounts and platform access (FE-03 UC8, UC9)
        action("ACCOUNT_SUSPENDED", TargetType.ACCOUNT, Scope.PLATFORM, STATUS, NONE, "ACCOUNT_SUSPEND"),
        action("ACCOUNT_RESTORED", TargetType.ACCOUNT, Scope.PLATFORM, STATUS, NONE, "ACCOUNT_RESTORE"),
        action("PLATFORM_ACCESS_GRANTED", TargetType.PLATFORM_ACCESS, Scope.PLATFORM, ROLE_STATUS, NONE, "PLATFORM_ACCESS_GRANT"),
        action("PLATFORM_ACCESS_CHANGED", TargetType.PLATFORM_ACCESS, Scope.PLATFORM, ROLE_STATUS, NONE, "PLATFORM_ACCESS_CHANGE"),
        action("PLATFORM_ACCESS_REVOKED", TargetType.PLATFORM_ACCESS, Scope.PLATFORM, ROLE_STATUS, NONE, "PLATFORM_ACCESS_REVOKE"),
        action("PLATFORM_ACCESS_RESTORED", TargetType.PLATFORM_ACCESS, Scope.PLATFORM, ROLE_STATUS, NONE, "PLATFORM_ACCESS_RESTORE"),
        // Farm memberships (FE-03 UC4, UC6); invitations are not membership changes and stay out (D34)
        action("MEMBERSHIP_JOINED", TargetType.MEMBERSHIP, Scope.FARM, List.of("role"), NONE, "MEMBER_ACCEPT"),
        action("MEMBERSHIP_ROLE_CHANGED", TargetType.MEMBERSHIP, Scope.FARM, ROLE_STATUS, NONE, "MEMBER_CHANGE_ROLE"),
        action("MEMBERSHIP_DEACTIVATED", TargetType.MEMBERSHIP, Scope.FARM, ROLE_STATUS, NONE, "MEMBER_DEACTIVATE"),
        action("MEMBERSHIP_REACTIVATED", TargetType.MEMBERSHIP, Scope.FARM, ROLE_STATUS, NONE, "MEMBER_REACTIVATE"),
        // Farm service (FE-02 UC1, UC4/5; JOB-04)
        action("FARM_REGISTERED", TargetType.FARM, Scope.FARM, NONE, List.of("name"), "FARM_REGISTER"),
        action("FARM_SERVICE_SUSPENDED", TargetType.FARM, Scope.PLATFORM, STATUS, NONE, "FARM_SERVICE_SUSPEND"),
        action("FARM_SERVICE_RESTORED", TargetType.FARM, Scope.PLATFORM, STATUS, NONE, "FARM_SERVICE_RESTORE"),
        action("FARM_SERVICE_STATUS_CHANGED", TargetType.FARM, Scope.PLATFORM, STATUS, NONE, "SERVICE_STATUS_JOB"),
        // Payment acceptance (FE-19): no bank evidence content, no reason
        new Action("PAYMENT_CONFIRMED", TargetType.PAYMENT, Scope.PLATFORM, Set.of(), "_PAYMENT_PAID", NONE,
            List.of("amountVnd", "termYears", "periodStart", "periodEnd", "receiptCode")),
        action("EVIDENCE_REVIEWED", TargetType.PAYMENT, Scope.PLATFORM, NONE, List.of("decision"), "EVIDENCE_REVIEW"),
        // Finance posting / voiding (FE-21)
        action("FINANCE_RECORD_POSTED", TargetType.FINANCE_RECORD, Scope.PLATFORM, STATUS, NONE, "FINANCE_RECORD_POST"),
        action("FINANCE_RECORD_VOIDED", TargetType.FINANCE_RECORD, Scope.PLATFORM, STATUS, NONE, "FINANCE_RECORD_VOID"),
        // Ticket assignment and status changes (FE-20); replies, notes and classification are not shown
        action("TICKET_CREATED", TargetType.TICKET, Scope.FARM, STATUS, List.of("assignee"), "SUPPORT_CREATE"),
        action("TICKET_ASSIGNED", TargetType.TICKET, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_CLAIM"),
        action("TICKET_HANDED_OVER", TargetType.TICKET, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_HANDOVER"),
        action("TICKET_RELEASED", TargetType.TICKET, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_RELEASE"),
        action("TICKET_WAITING_CUSTOMER", TargetType.TICKET, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_ASK_CUSTOMER"),
        action("TICKET_RESOLVED", TargetType.TICKET, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_RESOLVE"),
        action("TICKET_ACKNOWLEDGED", TargetType.TICKET, Scope.FARM, STATUS, List.of("assignee"), "SUPPORT_ACKNOWLEDGE"),
        action("TICKET_CLOSED", TargetType.TICKET, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_CLOSE"),
        action("TICKET_REOPENED", TargetType.TICKET, Scope.FARM, STATUS, List.of("assignee"), "SUPPORT_REOPEN"),
        // Internal requests (FE-20)
        action("INTERNAL_REQUEST_CREATED", TargetType.INTERNAL_REQUEST, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_INTERNAL_CREATE"),
        action("INTERNAL_REQUEST_UPDATED", TargetType.INTERNAL_REQUEST, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_INTERNAL_MANAGE"),
        action("INTERNAL_REQUEST_COMPLETED", TargetType.INTERNAL_REQUEST, Scope.PLATFORM, STATUS, List.of("assignee"), "SUPPORT_INTERNAL_DONE")
    );

    private static final Map<String, Action> BY_CODE = new LinkedHashMap<>();

    static {
        for (Action action : ACTIONS) BY_CODE.put(action.code(), action);
    }

    private PlatformAuditCatalog() {}

    private static Action action(String code, TargetType type, Scope scope, List<String> paired, List<String> result, String stored) {
        return new Action(code, type, scope, Set.of(stored), null, paired, result);
    }

    public static List<Action> actions() {
        return ACTIONS;
    }

    public static Optional<Action> byCode(String code) {
        return Optional.ofNullable(code == null ? null : BY_CODE.get(code.trim().toUpperCase(Locale.ROOT)));
    }

    /** The catalogue entry of a stored row; empty for a farm-feature row that SCR-51 never shows. */
    public static Optional<Action> byStored(String storedAction) {
        for (Action action : ACTIONS) if (action.matches(storedAction)) return Optional.of(action);
        return Optional.empty();
    }

    /** Role used for a stored action: platform role first for platform actions, the farm role first otherwise. */
    public static Scope scopeOf(String storedAction, boolean hasFarm) {
        return byStored(storedAction).map(Action::scope).orElse(hasFarm ? Scope.FARM : Scope.PLATFORM);
    }

    /** Entries selected by the optional SCR-51 filters, already validated by the caller. */
    public static List<Action> select(Action action, TargetType targetType) {
        List<Action> selected = new ArrayList<>();
        for (Action candidate : ACTIONS) {
            if (action != null && candidate != action) continue;
            if (targetType != null && candidate.targetType() != targetType) continue;
            selected.add(candidate);
        }
        return selected;
    }

    /** Exact stored codes of the selected entries. */
    public static Set<String> storedCodes(Collection<Action> selected) {
        Set<String> codes = new LinkedHashSet<>();
        selected.forEach(action -> codes.addAll(action.stored()));
        return codes;
    }

    /** Stored-code suffixes of the selected entries. */
    public static Set<String> storedSuffixes(Collection<Action> selected) {
        Set<String> suffixes = new LinkedHashSet<>();
        selected.forEach(action -> {
            if (action.storedSuffix() != null) suffixes.add(action.storedSuffix());
        });
        return suffixes;
    }

    /**
     * GBR-86: only the allowlisted fields of the entry, whatever the source wrote. A paired field is read from the
     * shapes the sources use ({@code xBefore/xAfter}, {@code fromX/toX}, {@code before{x}/after{x}}; a single {@code x}
     * is the new value). "NONE" (no access before) and empty values are left out.
     */
    public static Change change(Action action, Map<?, ?> details) {
        Map<String, String> before = new LinkedHashMap<>();
        Map<String, String> after = new LinkedHashMap<>();
        if (details == null) return new Change(before, after);
        Map<?, ?> nestedBefore = details.get("before") instanceof Map<?, ?> map ? map : Map.of();
        Map<?, ?> nestedAfter = details.get("after") instanceof Map<?, ?> map ? map : Map.of();
        for (String field : action.paired()) {
            String capital = Character.toUpperCase(field.charAt(0)) + field.substring(1);
            put(before, field, first(details.get(field + "Before"), details.get("from" + capital), nestedBefore.get(field)));
            put(after, field, first(details.get(field + "After"), details.get("to" + capital), nestedAfter.get(field), details.get(field)));
        }
        for (String field : action.result()) put(after, field, scalar(details.get(field)));
        return new Change(before, after);
    }

    private static String first(Object... values) {
        for (Object value : values) {
            String text = scalar(value);
            if (text != null) return text;
        }
        return null;
    }

    private static String scalar(Object value) {
        if (!(value instanceof String) && !(value instanceof Number) && !(value instanceof Boolean)) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() || "NONE".equals(text) ? null : text;
    }

    private static void put(Map<String, String> values, String field, String value) {
        if (value != null) values.put(field, value);
    }
}
