package vn.edu.fpt.beefcare.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.FarmServiceFacts;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccessService;
import vn.edu.fpt.beefcare.service.PlatformContext;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.Page;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.SubscriptionRow;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main function of UC-FE19-04:
 * {@link PlatformSubscriptionQueryService#subscriptions}. The JPQL queries are mocked; the test checks the parameters the
 * service binds and how it derives each row at one fixed read time.
 */
@ExtendWith(MockitoExtension.class)
class PlatformSubscriptionQueryServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");

    @Mock EntityManager em;
    @Mock PlatformAccessService platformAccess;
    @Mock FarmServiceFacts facts;

    private PlatformSubscriptionQueryService service;
    private TypedQuery<Long> count;
    private TypedQuery<Farm> farms;
    private TypedQuery<Payment> paid;
    private long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new PlatformSubscriptionQueryService(em, platformAccess, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), facts);
    }

    private void signedInAsPm() {
        when(platformAccess.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(null, null, PlatformRole.PM));
    }

    @SuppressWarnings("unchecked")
    private void found(long total, List<Farm> page, List<Payment> paidRows) {
        count = mock(TypedQuery.class);
        farms = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Long.class))).thenReturn(count);
        when(count.getSingleResult()).thenReturn(total);
        when(em.createQuery(anyString(), eq(Farm.class))).thenReturn(farms);
        when(farms.setFirstResult(anyInt())).thenReturn(farms);
        when(farms.setMaxResults(anyInt())).thenReturn(farms);
        when(farms.getResultList()).thenReturn(page);
        if (!page.isEmpty()) {
            paid = mock(TypedQuery.class);
            when(em.createQuery(anyString(), eq(Payment.class))).thenReturn(paid);
            when(paid.setParameter(eq("ids"), org.mockito.ArgumentMatchers.any())).thenReturn(paid);
            when(paid.getResultList()).thenReturn(paidRows);
        }
    }

    private static Farm farm(long id, String name, String status) {
        Farm farm = new Farm();
        farm.setId(id);
        farm.setName(name);
        farm.setServiceStatus(status);
        return farm;
    }

    private Payment paidPeriod(Farm farm, Instant start, Instant end) {
        Subscription subscription = new Subscription();
        subscription.setFarm(farm);
        Payment payment = new Payment();
        payment.setId(nextId++);
        payment.setQuoteRef("BC" + payment.getId());
        payment.setState("PAID");
        payment.setSubscription(subscription);
        payment.setPurchasedStart(start);
        payment.setPurchasedEnd(end);
        payment.setAmountVnd(BigDecimal.valueOf(1_200_000));
        return payment;
    }

    @Test
    void tc1950OnlyAnActivePlatformManagerCanReadTheSubscriptions() {
        when(platformAccess.requireRole(PlatformRole.PM)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.subscriptions(null, null, null, null, null, 0, 20))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(em, facts);
    }

    @Test
    void tc1954InvalidInputGetsMsgCom10WithItsFieldAndAReversedEndRangeGetsMsgCom11() {
        signedInAsPm();
        LocalDate day = LocalDate.of(2027, 1, 1);
        Map<String, Runnable> calls = new LinkedHashMap<>();
        calls.put("q", () -> service.subscriptions("x".repeat(101), null, null, null, null, 0, 20));
        calls.put("coverage", () -> service.subscriptions(null, "SOME", null, null, null, 0, 20));
        calls.put("serviceStatus", () -> service.subscriptions(null, null, "DELETED", null, null, 0, 20));
        calls.put("sort", () -> service.subscriptions(null, null, null, null, null, "farmName", "desc", 0, 20));
        calls.put("dir", () -> service.subscriptions(null, null, null, null, null, "confirmedUntil", "DESC", 0, 20));
        calls.put("size", () -> service.subscriptions(null, null, null, null, null, 0, 101));
        calls.put("page", () -> service.subscriptions(null, null, null, null, null, Integer.MAX_VALUE / 20 + 1, 20));
        calls.forEach((field, call) -> assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", field);
            }));
        assertThatThrownBy(() -> service.subscriptions(null, null, null, day.plusDays(1), day, 0, 20))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_11);
                assertThat(error.getParams()).containsEntry("field", "endTo");
            });
        verifyNoInteractions(em);
    }

    @Test
    void tc1951EachRowDerivesItsServiceStatusAndCurrentPeriodAtTheReadTime() {
        signedInAsPm();
        Farm active = farm(1L, "Trai A", "ACTIVE");
        Farm lapsed = farm(2L, "Trai B", "ACTIVE");
        Farm fresh = farm(3L, "Trai C", "PENDING_PAYMENT");
        Farm suspended = farm(4L, "Trai D", "SUSPENDED");
        Payment current = paidPeriod(active, NOW.minus(Duration.ofDays(10)), NOW.plus(Duration.ofDays(355)));
        Payment next = paidPeriod(active, NOW.plus(Duration.ofDays(355)), NOW.plus(Duration.ofDays(720)));
        Payment past = paidPeriod(lapsed, NOW.minus(Duration.ofDays(400)), NOW.minus(Duration.ofDays(35)));
        Payment suspendedCurrent = paidPeriod(suspended, NOW.minus(Duration.ofDays(5)), NOW.plus(Duration.ofDays(5)));
        found(4, List.of(active, lapsed, fresh, suspended), List.of(current, next, past, suspendedCurrent));
        AppUser owner = new AppUser();
        owner.setFullName("Nguyen Van Duc");
        owner.setEmail("owner@x.vn");
        when(facts.owners(List.of(1L, 2L, 3L, 4L))).thenReturn(Map.of(1L, owner));

        Page<SubscriptionRow> page = service.subscriptions(null, null, null, null, null, 0, 20);

        assertThat(page.items()).extracting(SubscriptionRow::serviceStatus).containsExactly("ACTIVE", "EXPIRED", "PENDING_PAYMENT", "SUSPENDED");
        SubscriptionRow first = page.items().get(0);
        assertThat(first.currentStart()).isEqualTo(current.getPurchasedStart());
        assertThat(first.currentEnd()).isEqualTo(current.getPurchasedEnd());
        assertThat(first.confirmedUntil()).isEqualTo(next.getPurchasedEnd());
        assertThat(first.paymentCodes()).containsExactlyInAnyOrder(current.getQuoteRef(), next.getQuoteRef());
        assertThat(first.ownerEmail()).isEqualTo("owner@x.vn");
        assertThat(page.items().get(1).currentEnd()).isNull();
        assertThat(page.items().get(2).confirmedUntil()).isNull();
        assertThat(page.items().get(3).currentEnd()).isEqualTo(suspendedCurrent.getPurchasedEnd());
        assertThat(page.total()).isEqualTo(4);
    }

    @Test
    void tc1953EndFiltersUseTheLastCoveredUtcPlus7DayWithIndependentInclusiveBounds() {
        signedInAsPm();
        found(0, List.of(), List.of());

        service.subscriptions(null, null, null, LocalDate.of(2027, 1, 1), LocalDate.of(2027, 1, 1), 0, 20);

        verify(count).setParameter("endFrom", Instant.parse("2026-12-31T17:00:00Z"));
        verify(count).setParameter("endTo", Instant.parse("2027-01-01T17:00:00Z"));
        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);
        verify(em).createQuery(jpql.capture(), eq(Long.class));
        assertThat(jpql.getValue()).contains(">:endFrom").contains("<=:endTo");
    }

    @Test
    void tc1952TheSearchMatchesTheFarmNameOrAPaidCodeAndTreatsWildcardsLiterally() {
        signedInAsPm();
        found(0, List.of(), List.of());

        service.subscriptions("  50%_Off!  ", null, null, null, null, 0, 20);

        verify(count).setParameter("q", "%50!%!_off!!%");
        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);
        verify(em).createQuery(jpql.capture(), eq(Long.class));
        assertThat(jpql.getValue()).contains("lower(f.name) like :q escape '!'").contains("lower(p.quoteRef) like :q escape '!'")
            .contains("upper(p.state)='PAID'");
    }

    @Test
    void tcDuc190401CoverageAndStatusFiltersBindTheSingleReadTimeAndWithoutFiltersNothingIsBound() {
        signedInAsPm();
        found(0, List.of(), List.of());
        service.subscriptions(null, "current", "expired", null, null, 0, 20);
        verify(count).setParameter("now", NOW);
        verify(count).setParameter("state", "EXPIRED");

        found(0, List.of(), List.of());
        service.subscriptions(null, " ", " ", null, null, 0, 20);
        verify(count, never()).setParameter(anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void tcDuc190402RowsAreReadForTheRequestedPageWithEndsNullLastAndTheChosenDirection() {
        signedInAsPm();
        found(45, List.of(), List.of());

        Page<SubscriptionRow> page = service.subscriptions(null, null, null, null, null, "confirmedUntil", "asc", 2, 20);

        verify(farms).setFirstResult(40);
        verify(farms).setMaxResults(20);
        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);
        verify(em).createQuery(jpql.capture(), eq(Farm.class));
        assertThat(jpql.getValue()).contains("is null then 1 else 0 end").contains(" asc, f.id asc");
        assertThat(page.total()).isEqualTo(45);
        assertThat(page.items()).isEmpty();
        verify(em, never()).createQuery(anyString(), eq(Payment.class));
    }
}
