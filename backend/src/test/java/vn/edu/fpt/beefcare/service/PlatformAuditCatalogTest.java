package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.service.PlatformAuditCatalog.Action;
import vn.edu.fpt.beefcare.service.PlatformAuditCatalog.Change;
import vn.edu.fpt.beefcare.service.PlatformAuditCatalog.Scope;
import vn.edu.fpt.beefcare.service.PlatformAuditCatalog.TargetType;

/** D34 / GBR-86: which stored rows reach SCR-51, under which public code, and which values may be shown. */
class PlatformAuditCatalogTest {

    private static Action action(String code) {
        return PlatformAuditCatalog.byCode(code).orElseThrow();
    }

    private static Map<String, Object> details(Object... keyValues) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) values.put((String) keyValues[i], keyValues[i + 1]);
        return values;
    }

    /** Every public code is unique and every stored code belongs to one entry only. */
    @Test
    void codesAreUniqueAndEachStoredCodeHasOneEntry() {
        Set<String> codes = new HashSet<>();
        Set<String> stored = new HashSet<>();
        for (Action action : PlatformAuditCatalog.actions()) {
            assertThat(codes.add(action.code())).as(action.code()).isTrue();
            for (String code : action.stored()) assertThat(stored.add(code)).as(code).isTrue();
        }
        assertThat(PlatformAuditCatalog.actions()).extracting(Action::targetType).contains(TargetType.values());
    }

    /** K2: stored codes are kept; the SRS-style public code is derived. */
    @Test
    void mapsStoredCodesToThePublicSrsCodes() {
        assertThat(PlatformAuditCatalog.byStored("ACCOUNT_SUSPEND")).map(Action::code).contains("ACCOUNT_SUSPENDED");
        assertThat(PlatformAuditCatalog.byStored("PLATFORM_ACCESS_GRANT")).map(Action::code).contains("PLATFORM_ACCESS_GRANTED");
        assertThat(PlatformAuditCatalog.byStored("MEMBER_CHANGE_ROLE")).map(Action::code).contains("MEMBERSHIP_ROLE_CHANGED");
        assertThat(PlatformAuditCatalog.byStored("FARM_SERVICE_RESTORE")).map(Action::code).contains("FARM_SERVICE_RESTORED");
        assertThat(PlatformAuditCatalog.byStored("PM_ACCEPT_PAYMENT_PAID")).map(Action::code).contains("PAYMENT_CONFIRMED");
        assertThat(PlatformAuditCatalog.byStored("SEPAY_PAYMENT_PAID")).map(Action::code).contains("PAYMENT_CONFIRMED");
        assertThat(PlatformAuditCatalog.byStored("FINANCE_RECORD_POST")).map(Action::code).contains("FINANCE_RECORD_POSTED");
        assertThat(PlatformAuditCatalog.byStored("SUPPORT_CLOSE")).map(Action::code).contains("TICKET_CLOSED");
        assertThat(PlatformAuditCatalog.byStored("SUPPORT_CLAIM")).map(Action::code).contains("TICKET_ASSIGNED");
        assertThat(PlatformAuditCatalog.byCode("ticket_closed")).map(Action::targetType).contains(TargetType.TICKET);
    }

    /** K1 / K3: farm data, invitations, other payment steps, prices and ticket content never reach SCR-51. */
    @Test
    void leavesFarmDataAndTheExcludedPlatformActionsOut() {
        for (String stored : java.util.Arrays.asList(
            "HEALTH_CASE_OPEN", "VACCINATION_RECORD_BATCH", "CALVING_RECORD", "ENTRY_POST", "EXIT_CONFIRM", "FEED_RECEIPT_POST",
            "CATTLE_PROFILE_UPDATE", "PEN_MOVE", "FARM_UPDATE", "MEMBER_INVITE", "INVITE_RESEND", "INVITE_CANCEL", "INVITE_EXPIRED",
            "PAYMENT_REQUEST", "PAYMENT_EXPIRED", "SEPAY_EVIDENCE", "EVIDENCE_LOCK_RETURN", "EVIDENCE_RETURN_RECORDED",
            "PLAN_PRICE_PUBLISH", "PLAN_PRICE_WITHDRAW", "FINANCE_DRAFT_CREATE", "CASH_REPORT_RUN", "SUPPORT_REPLY",
            "SUPPORT_NOTE", "SUPPORT_CLASSIFY", "SUPPORT_PROCESS", "PAYMENT_PAID_LATER", null
        )) {
            assertThat(PlatformAuditCatalog.byStored(stored)).as(String.valueOf(stored)).isEmpty();
        }
    }

    /** The shapes written by the sources: xBefore/xAfter, fromX/toX ("NONE" = no access), a single value. */
    @Test
    void readsTheBeforeAndAfterShapesOfEverySource() {
        Change account = PlatformAuditCatalog.change(action("ACCOUNT_SUSPENDED"), details("statusBefore", "ACTIVE", "statusAfter", "SUSPENDED"));
        assertThat(account.before()).containsExactly(Map.entry("status", "ACTIVE"));
        assertThat(account.after()).containsExactly(Map.entry("status", "SUSPENDED"));

        Change granted = PlatformAuditCatalog.change(action("PLATFORM_ACCESS_GRANTED"),
            details("fromRole", "NONE", "fromStatus", "NONE", "toRole", "CS", "toStatus", "ACTIVE"));
        assertThat(granted.before()).isEmpty(); // SCR-51 "role: — → CS · ACTIVE"
        assertThat(granted.after()).containsExactly(Map.entry("role", "CS"), Map.entry("status", "ACTIVE"));

        Change joined = PlatformAuditCatalog.change(action("MEMBERSHIP_JOINED"), details("role", "MANAGER"));
        assertThat(joined.before()).isEmpty();
        assertThat(joined.after()).containsExactly(Map.entry("role", "MANAGER"));

        Change ticket = PlatformAuditCatalog.change(action("TICKET_HANDED_OVER"), details("statusBefore", "IN_PROGRESS", "status", "IN_PROGRESS", "assignee", "CS B"));
        assertThat(ticket.before()).containsExactly(Map.entry("status", "IN_PROGRESS"));
        assertThat(ticket.after()).containsExactly(Map.entry("status", "IN_PROGRESS"), Map.entry("assignee", "CS B"));

        Change nested = PlatformAuditCatalog.change(action("MEMBERSHIP_ROLE_CHANGED"),
            details("before", Map.of("role", "TECHNICIAN"), "after", Map.of("role", "MANAGER")));
        assertThat(nested.before()).containsExactly(Map.entry("role", "TECHNICIAN"));
        assertThat(nested.after()).containsExactly(Map.entry("role", "MANAGER"));

        assertThat(PlatformAuditCatalog.change(action("FARM_REGISTERED"), null).after()).isEmpty();
    }

    /** TC-17-05 / 06 / 07 (R-17-04): reasons, bank evidence, ticket content and secrets are dropped whatever the source wrote. */
    @Test
    void neverShowsReasonsEvidenceContentTicketBodiesOrSecrets() {
        Map<String, Object> written = details(
            "statusBefore", "ACTIVE", "statusAfter", "SUSPENDED", "status", "CLOSED", "role", "PM",
            "reason", "Nghi ngờ lộ mật khẩu", "password", "p@ss", "token", "tok", "apiKey", "key", "webhookSecret", "wh",
            "providerTxnId", "FT123", "transferContent", "BC123 chuyen khoan", "receivingAccount", "0123456789", "content", "Nội dung ticket",
            "description", "Mô tả riêng", "quoteRef", "BC123", "email", "a@b.c", "cattleId", 5, "amountVnd", 990000, "decision", "ACCEPT"
        );
        for (Action action : PlatformAuditCatalog.actions()) {
            Change change = PlatformAuditCatalog.change(action, written);
            Set<String> keys = new HashSet<>(change.before().keySet());
            keys.addAll(change.after().keySet());
            assertThat(keys).as(action.code()).isSubsetOf("role", "status", "name", "decision", "amountVnd", "termYears", "periodStart", "periodEnd", "receiptCode", "assignee");
            assertThat(change.before().values()).as(action.code()).doesNotContain("Nghi ngờ lộ mật khẩu", "p@ss", "FT123", "Nội dung ticket");
            assertThat(change.after().values()).as(action.code()).doesNotContain("Nghi ngờ lộ mật khẩu", "p@ss", "FT123", "Nội dung ticket", "BC123 chuyen khoan", "0123456789");
        }
        assertThat(PlatformAuditCatalog.change(action("PAYMENT_CONFIRMED"), written).after()).containsExactly(Map.entry("amountVnd", "990000"));
        assertThat(PlatformAuditCatalog.change(action("EVIDENCE_REVIEWED"), written).after()).containsExactly(Map.entry("decision", "ACCEPT"));
    }

    /** K4: the actor's role is read from the platform first for platform actions, from the farm first otherwise. */
    @Test
    void choosesWhoseRoleTheActorActedIn() {
        assertThat(PlatformAuditCatalog.scopeOf("FARM_SERVICE_SUSPEND", true)).isEqualTo(Scope.PLATFORM);
        assertThat(PlatformAuditCatalog.scopeOf("SUPPORT_CREATE", true)).isEqualTo(Scope.FARM);
        assertThat(PlatformAuditCatalog.scopeOf("SUPPORT_CLOSE", true)).isEqualTo(Scope.PLATFORM);
        assertThat(PlatformAuditCatalog.scopeOf("PEN_MOVE", true)).isEqualTo(Scope.FARM);
        assertThat(PlatformAuditCatalog.scopeOf("PLAN_PRICE_PUBLISH", false)).isEqualTo(Scope.PLATFORM);
    }

    /** Filters: one action, one target type, or both; a mismatch selects nothing. */
    @Test
    void selectsByActionAndTargetType() {
        assertThat(PlatformAuditCatalog.select(null, null)).hasSameSizeAs(PlatformAuditCatalog.actions());
        assertThat(PlatformAuditCatalog.select(null, TargetType.PAYMENT)).extracting(Action::code).containsExactly("PAYMENT_CONFIRMED", "EVIDENCE_REVIEWED");
        assertThat(PlatformAuditCatalog.select(action("PAYMENT_CONFIRMED"), TargetType.PAYMENT)).extracting(Action::code).containsExactly("PAYMENT_CONFIRMED");
        assertThat(PlatformAuditCatalog.select(action("PAYMENT_CONFIRMED"), TargetType.TICKET)).isEmpty();
        assertThat(PlatformAuditCatalog.storedSuffixes(PlatformAuditCatalog.select(null, TargetType.PAYMENT))).containsExactly("_PAYMENT_PAID");
        assertThat(PlatformAuditCatalog.storedCodes(PlatformAuditCatalog.select(null, TargetType.PAYMENT))).containsExactly("EVIDENCE_REVIEW");
    }
}
