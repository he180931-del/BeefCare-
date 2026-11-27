package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_MOCKS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService.AuditPage;
import vn.edu.fpt.beefcare.service.PlatformAuditQueryService.AuditRow;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main function of UC-FE17-01:
 * {@link PlatformAuditQueryService#search}. The JPA criteria objects are Mockito mocks; the audit catalogue and the farm
 * clock (fixed, UTC+7) are the real classes.
 */
@ExtendWith(MockitoExtension.class)
class PlatformAuditQueryServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");
    private static final LocalDate FROM = LocalDate.of(2026, 11, 20);
    private static final LocalDate TO = LocalDate.of(2026, 11, 26);

    @Mock PlatformAccessService platformAccess;
    @Mock EntityManager em;

    private PlatformAuditQueryService service;
    private CriteriaBuilder cb;

    @BeforeEach
    void setUp() {
        service = new PlatformAuditQueryService(platformAccess, em, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)));
    }

    private void signedInAsSa() {
        when(platformAccess.requireRole(PlatformRole.SA)).thenReturn(new PlatformContext(null, null, PlatformRole.SA));
    }

    private AuditPage search(LocalDate from, LocalDate to, String actor, boolean system, String action, String type, int page, int size, String dir) {
        return service.search(from, to, actor, system, action, type, page, size, dir);
    }

    // ------------------------------------------------------------------ input rules (no database access)

    @Test
    void tc1701OnlyAnActiveSystemAdministratorCanSearchTheAudit() {
        when(platformAccess.requireRole(PlatformRole.SA)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> search(FROM, TO, null, false, null, null, 0, 20, null))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(em);
    }

    @Test
    void tc1710AMissingDateGetsMsgCom06AReversedRangeMsgCom11AndThirteenMonthsMsgCom10() {
        signedInAsSa();

        assertThatThrownBy(() -> search(null, TO, null, false, null, null, 0, 20, null))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
                assertThat(error.getParams()).containsEntry("field", "from");
            });
        assertThatThrownBy(() -> search(FROM, null, null, false, null, null, 0, 20, null))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "to"));
        assertThatThrownBy(() -> search(TO, FROM, null, false, null, null, 0, 20, null))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_11);
                assertThat(error.getParams()).containsEntry("field", "dateRange");
            });
        assertThatThrownBy(() -> search(FROM, FROM.plusMonths(12).plusDays(1), null, false, null, null, 0, 20, null))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", "dateRange");
            });
        verifyNoInteractions(em);
    }

    @Test
    void tcDuc170101UnknownFiltersAnOverlongActorTextActorTextWithSystemOrAnUnknownDirectionGetMsgCom10() {
        signedInAsSa();
        Map<String, Runnable> calls = new LinkedHashMap<>();
        calls.put("action", () -> search(FROM, TO, null, false, "DELETE_EVERYTHING", null, 0, 20, null));
        calls.put("targetType", () -> search(FROM, TO, null, false, null, "CATTLE", 0, 20, null));
        calls.put("actor", () -> search(FROM, TO, "a".repeat(255), false, null, null, 0, 20, null));
        calls.put("dir", () -> search(FROM, TO, null, false, null, null, 0, 20, "up"));
        calls.forEach((field, call) -> assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", field);
            }));
        assertThatThrownBy(() -> search(FROM, TO, "duc", true, null, null, 0, 20, null))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "actor"));
        verifyNoInteractions(em);
    }

    @Test
    void tc1715FarmDataActionsAreNotPartOfTheCentralAuditFilter() {
        signedInAsSa();

        for (String farmAction : List.of("HEALTH_RECORD_CREATE", "VACCINATION_RECORD", "INVITE_RESEND", "PLAN_PRICE_PUBLISH")) {
            assertThatThrownBy(() -> search(FROM, TO, null, false, farmAction, null, 0, 20, null))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "action"));
        }
        verifyNoInteractions(em);
    }

    @Test
    void tcDuc170102AnActionThatDoesNotBelongToTheSelectedTargetTypeReturnsAnEmptyPageWithoutQuerying() {
        signedInAsSa();

        AuditPage page = search(FROM, TO, null, false, "ACCOUNT_SUSPENDED", "payment", -3, 0, null);

        assertThat(page.items()).isEmpty();
        assertThat(page.total()).isZero();
        assertThat(page.page()).isZero();
        assertThat(page.size()).isEqualTo(1);
        verifyNoInteractions(em);
    }

    @Test
    void tcDuc170103AnExactlyTwelveMonthRangeIsAcceptedAndAnEmptyCountSkipsTheRowQuery() {
        signedInAsSa();
        TypedQuery<Long> count = countQuery(0L);

        AuditPage page = search(FROM, FROM.plusMonths(12), null, false, null, null, 0, 500, null);

        assertThat(page.items()).isEmpty();
        assertThat(page.size()).isEqualTo(100);
        verify(em, times(1)).createQuery(any(CriteriaQuery.class));
        verify(count).getSingleResult();
    }

    // ------------------------------------------------------------------ rows

    @SuppressWarnings("unchecked")
    private TypedQuery<Long> countQuery(long total) {
        cb = mock(CriteriaBuilder.class, RETURNS_MOCKS);
        when(em.getCriteriaBuilder()).thenReturn(cb);
        TypedQuery<Long> count = mock(TypedQuery.class);
        when(count.getSingleResult()).thenReturn(total);
        // lenient: withRows() replaces this stub with one that answers the count query first and the row query second
        lenient().when(em.createQuery(any(CriteriaQuery.class))).thenReturn((TypedQuery) count);
        return count;
    }

    @SuppressWarnings("unchecked")
    private TypedQuery<Tuple> withRows(long total, Tuple... rows) {
        TypedQuery<Long> count = countQuery(total);
        TypedQuery<Tuple> query = mock(TypedQuery.class);
        when(query.setFirstResult(anyInt())).thenReturn(query);
        when(query.setMaxResults(anyInt())).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(rows));
        when(em.createQuery(any(CriteriaQuery.class))).thenReturn((TypedQuery) count, (TypedQuery) query);
        return query;
    }

    @SuppressWarnings("unchecked")
    private void labelsFound(Tuple... rows) {
        TypedQuery<Tuple> labels = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Tuple.class))).thenReturn(labels);
        when(labels.setParameter(eq("ids"), any())).thenReturn(labels);
        when(labels.getResultList()).thenReturn(List.of(rows));
    }

    private static Tuple tuple(Object... values) {
        Tuple tuple = mock(Tuple.class);
        when(tuple.get(anyInt(), any())).thenAnswer(call -> values[(int) call.getArgument(0)]);
        return tuple;
    }

    @Test
    void tc1705RowsShowTheCatalogueActionCodeTheActorWithRoleAndTheTargetDisplayName() {
        signedInAsSa();
        Instant at = Instant.parse("2026-11-25T08:00:00Z");
        withRows(1, tuple(501L, at, "ACCOUNT_SUSPEND", "AppUser", 12L, "SA", 90L, "Ngô Văn Đức", "duc@x.vn"));
        labelsFound(tuple(12L, "Tran Thi Binh", "binh@x.vn"));

        AuditRow row = search(FROM, TO, null, false, null, null, 0, 20, null).items().get(0);

        assertThat(row.id()).isEqualTo(501L);
        assertThat(row.time()).isEqualTo(at);
        assertThat(row.action()).isEqualTo("ACCOUNT_SUSPENDED");
        assertThat(row.targetType()).isEqualTo("ACCOUNT");
        assertThat(row.targetLabel()).isEqualTo("Tran Thi Binh");
        assertThat(row.actor().name()).isEqualTo("Ngô Văn Đức");
        assertThat(row.actor().initials()).isEqualTo("NĐ");
        assertThat(row.actor().role()).isEqualTo("SA");
    }

    @Test
    void tc1708AJobEntryHasNoActorSoTheRowShowsSystem() {
        signedInAsSa();
        withRows(1, tuple(502L, NOW, "SERVICE_STATUS_JOB", "Farm", 21L, null, null, null, null));
        labelsFound(tuple(21L, "Trai Ba Vi"));

        AuditRow row = search(FROM, TO, null, false, null, null, 0, 20, null).items().get(0);

        assertThat(row.actor()).isNull();
        assertThat(row.action()).isEqualTo("FARM_SERVICE_STATUS_CHANGED");
        assertThat(row.targetLabel()).isEqualTo("Trai Ba Vi");
    }

    @Test
    void tcDuc170104AnActorWithoutANameIsShownAsAMaskedEmailAndAnUnknownTargetAsItsId() {
        signedInAsSa();
        withRows(1, tuple(503L, NOW, "MEMBER_ACCEPT", "FarmMembership", 77L, "MANAGER", 73L, " ", "ngovanduc@gmail.com"));
        labelsFound();

        AuditRow row = search(FROM, TO, null, false, null, null, 0, 20, null).items().get(0);

        assertThat(row.actor().name()).isEqualTo("ng***@gmail.com");
        assertThat(row.actor().initials()).isEqualTo("N");
        assertThat(row.targetLabel()).isEqualTo("#77");
        assertThat(row.action()).isEqualTo("MEMBERSHIP_JOINED");
    }

    @Test
    void tcDuc170105TheDaysAreUtcPlus7CalendarDaysWithBothEndsIncluded() {
        signedInAsSa();
        countQuery(0L);

        search(FROM, TO, null, false, null, null, 0, 20, null);

        verify(cb).greaterThanOrEqualTo(any(Expression.class), eq(Instant.parse("2026-11-19T17:00:00Z")));
        verify(cb).lessThan(any(Expression.class), eq(Instant.parse("2026-11-26T17:00:00Z")));
    }

    @Test
    void tc1711TheNewestEntriesComeFirstByDefaultAndAscendingReversesTimeAndId() {
        signedInAsSa();
        TypedQuery<Tuple> rows = withRows(45, tuple(504L, NOW, "FARM_REGISTER", "Farm", 21L, "OWNER", 11L, "Owner", "o@x.vn"));
        labelsFound();

        AuditPage page = search(FROM, TO, null, false, null, null, 2, 20, null);

        verify(cb, times(2)).desc(any());
        verify(cb, never()).asc(any());
        verify(rows).setFirstResult(40);
        verify(rows).setMaxResults(20);
        assertThat(page.total()).isEqualTo(45);

        withRows(1, tuple(504L, NOW, "FARM_REGISTER", "Farm", 21L, "OWNER", 11L, "Owner", "o@x.vn"));
        labelsFound();
        search(FROM, TO, null, false, null, null, 0, 20, "ASC");
        verify(cb, times(2)).asc(any());
    }

    @Test
    void tc1714TheSystemFilterKeepsOnlyEntriesWithoutAnActor() {
        signedInAsSa();
        countQuery(0L);

        search(FROM, TO, "  ", true, null, null, 0, 20, null);

        verify(cb, atLeastOnce()).isNull(any());
    }

    @Test
    void tc1713FilteringOnPaymentConfirmedAndTargetPaymentMatchesTheStoredPaymentPaidSuffix() {
        signedInAsSa();
        countQuery(0L);

        search(FROM, TO, null, false, "PAYMENT_CONFIRMED", "PAYMENT", 0, 20, null);

        verify(cb).like(any(), eq("%\\_PAYMENT\\_PAID"), eq('\\'));
    }
}
