package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.PaymentDTO;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.PaymentRequest;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.PurchasedPeriod;
import vn.edu.fpt.beefcare.service.SubscriptionPaymentService.SubscriptionOverview;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE19-01..03:
 * {@link SubscriptionPaymentService#overview}, {@link SubscriptionPaymentService#requestPayment} and
 * {@link SubscriptionPaymentService#history}. The farm clock is fixed; the receiving account is a test configuration.
 */
@ExtendWith(MockitoExtension.class)
class SubscriptionPaymentServiceUnitTest {

    /** 2026-10-01 10:00 in UTC+7. */
    private static final Instant NOW = Instant.parse("2026-10-01T03:00:00Z");
    private static final long FARM_ID = 301L;

    @Mock FarmAccessService farmAccess;
    @Mock FarmRepository farms;
    @Mock SubscriptionRepository subscriptions;
    @Mock PaymentRepository payments;
    @Mock PlanVersionRepository plans;
    @Mock AuditService audit;
    @Mock BankTransferEvidenceRepository evidences;
    @Mock FarmServiceFacts serviceFacts;

    private Farm farm;
    private AppUser owner;
    private PlanVersion v1;
    private long nextId = 1;

    @BeforeEach
    void setUp() {
        farm = new Farm();
        farm.setId(FARM_ID);
        farm.setName("Trai Ba Vi");
        farm.setServiceStatus("ACTIVE");
        owner = new AppUser();
        owner.setId(11L);
        v1 = price(1L, 1_200_000, 2_200_000, 3_000_000);
    }

    private SubscriptionPaymentService service(String bankCode, String account) {
        return new SubscriptionPaymentService(farmAccess, farms, subscriptions, payments, plans, audit, evidences,
            new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), serviceFacts, bankCode, account, "CONG TY BEEFCARE", "LOCAL-MOCK", "mock");
    }

    private SubscriptionPaymentService service() {
        return service("MB", "0123 456 789");
    }

    private static PlanVersion price(long id, long oneYear, long twoYears, long threeYears) {
        PlanVersion price = new PlanVersion();
        price.setId(id);
        price.setPrice1y(BigDecimal.valueOf(oneYear));
        price.setPrice2y(BigDecimal.valueOf(twoYears));
        price.setPrice3y(BigDecimal.valueOf(threeYears));
        price.setEffectiveAt(Instant.parse("2026-01-01T00:00:00Z"));
        return price;
    }

    private Payment payment(String state, Instant start, Instant end, Instant expiresAt) {
        Payment payment = new Payment();
        payment.setId(nextId++);
        payment.setQuoteRef("BCPAY" + payment.getId());
        payment.setDurationYears(1);
        payment.setAmountVnd(BigDecimal.valueOf(1_200_000));
        payment.setState(state);
        payment.setRequestedAt(NOW.minus(Duration.ofDays(400)));
        payment.setExpiresAt(expiresAt);
        payment.setPurchasedStart(start);
        payment.setPurchasedEnd(end);
        payment.setPriceVersion(v1);
        payment.setReceivingEnvironment("MOCK");
        payment.setReceivingAccountNamespace("LOCAL-MOCK");
        payment.setReceivingAccount("0123456789");
        payment.setReceivingBankCode("MB");
        return payment;
    }

    private Payment paid(Instant start, Instant end) {
        return payment("PAID", start, end, start);
    }

    private void owns(FarmAction action) {
        when(farmAccess.require(FARM_ID, action)).thenReturn(new FarmContext(farm, owner, FarmRole.OWNER));
    }

    private void requests(Payment... rows) {
        when(payments.findAllBySubscription_Farm_IdOrderByRequestedAtDescIdDesc(FARM_ID)).thenReturn(List.of(rows));
    }

    private void currentPrice(PlanVersion price) {
        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(NOW)).thenReturn(Optional.ofNullable(price));
    }

    // ------------------------------------------------------------------ UC-FE19-01 overview()

    @Test
    void tc1934ANewFarmWithoutPaymentsHasNoPeriodEndOrRenewalDateAndNothingIsWritten() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        requests();
        currentPrice(v1);

        SubscriptionOverview overview = service().overview(FARM_ID);

        assertThat(overview.serviceStatus()).isEqualTo("PENDING_PAYMENT");
        assertThat(overview.entitlementStatus()).isEqualTo("NONE");
        assertThat(overview.latestEnd()).isNull();
        assertThat(overview.renewalOpensAt()).isNull();
        assertThat(overview.currentPeriod()).isNull();
        assertThat(overview.daysRemaining()).isNull();
        assertThat(overview.periods()).isEmpty();
        assertThat(overview.eligibility().ok()).isTrue();
        verify(payments, never()).saveAndFlush(any());
        verifyNoInteractions(subscriptions, audit);
    }

    @Test
    void tc1935PaidPeriodsAreClassifiedPastCurrentAndFutureWithTheLatestEndAndRenewalDate() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        Payment past = paid(Instant.parse("2024-09-30T17:00:00Z"), Instant.parse("2025-09-30T17:00:00Z"));
        Payment current = paid(Instant.parse("2025-09-30T17:00:00Z"), Instant.parse("2026-12-30T17:00:00Z"));
        Payment future = paid(Instant.parse("2026-12-30T17:00:00Z"), Instant.parse("2027-12-30T17:00:00Z"));
        Payment expiredRequest = payment("EXPIRED", null, null, NOW.minus(Duration.ofDays(2)));
        requests(expiredRequest, future, current, past);
        currentPrice(v1);

        SubscriptionOverview overview = service().overview(FARM_ID);

        assertThat(overview.periods()).extracting(PurchasedPeriod::status).containsExactly("FUTURE", "CURRENT", "PAST");
        assertThat(overview.currentPeriod().paymentCode()).isEqualTo(current.getQuoteRef());
        assertThat(overview.futurePeriods()).extracting(PurchasedPeriod::paymentCode).containsExactly(future.getQuoteRef());
        assertThat(overview.latestEnd()).isEqualTo(Instant.parse("2027-12-30T17:00:00Z"));
        assertThat(overview.renewalOpensAt()).isEqualTo(Instant.parse("2027-10-01T17:00:00Z"));
        assertThat(overview.serviceStatus()).isEqualTo("ACTIVE");
        assertThat(overview.entitlementStatus()).isEqualTo("CURRENT");
        assertThat(overview.pendingPayment()).isNull();
        assertThat(overview.eligibility().reason()).isEqualTo("OUTSIDE_WINDOW");
        assertThat(overview.eligibility().opensAt()).isEqualTo(overview.renewalOpensAt());
    }

    @Test
    void tc1936DaysRemainingCountsWholeDaysSoTwentyFourHoursIsOneAndTwentyThreeHoursIsZero() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        currentPrice(v1);
        requests(paid(NOW.minus(Duration.ofDays(30)), NOW.plus(Duration.ofHours(24))));
        assertThat(service().overview(FARM_ID).daysRemaining()).isEqualTo(1);

        requests(paid(NOW.minus(Duration.ofDays(30)), NOW.plus(Duration.ofHours(23))));
        SubscriptionOverview overview = service().overview(FARM_ID);
        assertThat(overview.daysRemaining()).isZero();
        assertThat(overview.entitlementStatus()).isEqualTo("CURRENT");
    }

    @Test
    void tc1937RenewalIsBlockedJustBeforeTheOpeningInstantAndAllowedExactlyAtIt() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        currentPrice(v1);
        requests(paid(NOW.minus(Duration.ofDays(30)), NOW.plus(Duration.ofDays(90)).plusSeconds(1)));
        assertThat(service().overview(FARM_ID).eligibility().reason()).isEqualTo("OUTSIDE_WINDOW");

        requests(paid(NOW.minus(Duration.ofDays(30)), NOW.plus(Duration.ofDays(90))));
        SubscriptionOverview overview = service().overview(FARM_ID);
        assertThat(overview.renewalOpensAt()).isEqualTo(NOW);
        assertThat(overview.eligibility().ok()).isTrue();
    }

    @Test
    void tc1938OnlyAnUnexpiredPendingRequestIsShownAsTheRequestInProgress() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        currentPrice(v1);
        Payment due = payment("PENDING", null, null, NOW);
        requests(due);
        assertThat(service().overview(FARM_ID).pendingPayment()).isNull();

        Payment open = payment("PENDING", null, null, NOW.plusSeconds(1));
        requests(open);
        assertThat(service().overview(FARM_ID).pendingPayment().quoteRef()).isEqualTo(open.getQuoteRef());
        assertThat(due.getState()).isEqualTo("PENDING");
    }

    @Test
    void tc1939WithoutAnEffectivePriceTheOverviewHasNoPricesAndCannotRequestAPayment() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        requests();
        currentPrice(null);

        SubscriptionOverview overview = service().overview(FARM_ID);

        assertThat(overview.currentPrices()).isNull();
        assertThat(overview.eligibility().ok()).isFalse();
        assertThat(overview.eligibility().reason()).isEqualTo("PRICE_UNAVAILABLE");
    }

    @Test
    void tc1932ASuspendedFarmShowsItsSuspensionDateAndKeepsCountingItsCurrentPeriod() {
        farm.setServiceStatus("SUSPENDED");
        owns(FarmAction.VIEW_FARM_INFORMATION);
        currentPrice(v1);
        requests(paid(NOW.minus(Duration.ofDays(30)), NOW.plus(Duration.ofDays(200))));
        Instant since = Instant.parse("2026-09-20T02:00:00Z");
        when(serviceFacts.lastSuspension(List.of(FARM_ID))).thenReturn(Map.of(FARM_ID, new FarmServiceFacts.Suspension(since, "PM", "Vi pham")));

        SubscriptionOverview overview = service().overview(FARM_ID);

        assertThat(overview.serviceStatus()).isEqualTo("SUSPENDED");
        assertThat(overview.suspended()).isTrue();
        assertThat(overview.suspendedSince()).isEqualTo(since);
        assertThat(overview.daysRemaining()).isEqualTo(200);
        assertThat(overview.eligibility().reason()).isEqualTo("SUSPENDED");
    }

    @Test
    void tc1933SomeoneWhoIsNotTheOwnerOfTheFarmCannotReadItsSubscription() {
        when(farmAccess.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service().overview(FARM_ID))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(payments, plans, serviceFacts);
    }

    // ------------------------------------------------------------------ UC-FE19-02 requestPayment()

    private void requestable(Payment... existing) {
        owns(FarmAction.MANAGE_FARM_INFORMATION);
        when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
        requests(existing);
        lenient().when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(NOW)).thenReturn(Optional.of(v1));
        lenient().when(subscriptions.lockByFarmId(FARM_ID)).thenReturn(Optional.empty());
        lenient().when(subscriptions.saveAndFlush(any(Subscription.class))).thenAnswer(call -> call.getArgument(0));
        lenient().when(payments.saveAndFlush(any(Payment.class))).thenAnswer(call -> {
            Payment saved = call.getArgument(0);
            saved.setId(900L);
            return saved;
        });
    }

    @Test
    void tc1902AOneYearRequestIsPendingFor24HoursWithAUniqueCodeTheCurrentAmountAndANewSubscription() {
        requestable();
        ArgumentCaptor<Subscription> created = ArgumentCaptor.forClass(Subscription.class);

        PaymentDTO dto = service().requestPayment(FARM_ID, new PaymentRequest(1, 1L));

        assertThat(dto.state()).isEqualTo("PENDING");
        assertThat(dto.expiresAt()).isEqualTo(NOW.plus(Duration.ofHours(24)));
        assertThat(dto.quoteRef()).matches("BC[0-9A-F]{12}");
        assertThat(dto.amountVnd()).isEqualByComparingTo("1200000");
        assertThat(dto.priceVersionId()).isEqualTo(1L);
        assertThat(dto.accountNumber()).isEqualTo("0123 456 789");
        assertThat(dto.qrImageUrl()).contains("acc=0123").contains("amount=1200000").contains("des=" + dto.quoteRef());
        assertThat(dto.reopened()).isFalse();
        verify(subscriptions).saveAndFlush(created.capture());
        assertThat(created.getValue().getEntitlementStatus()).isEqualTo("PENDING");
        verify(audit).logAt(eq(farm), eq(owner), eq("PAYMENT_REQUEST"), eq("Payment"), eq(900L), any(), eq(NOW));
    }

    @Test
    void tcDuc190201TwoAndThreeYearRequestsUseTheTwoAndThreeYearPrices() {
        requestable();

        assertThat(service().requestPayment(FARM_ID, new PaymentRequest(2, 1L)).amountVnd()).isEqualByComparingTo("2200000");
        assertThat(service().requestPayment(FARM_ID, new PaymentRequest(3, 1L)).amountVnd()).isEqualByComparingTo("3000000");
    }

    @Test
    void tc1903AnUnexpiredPendingRequestIsReopenedInsteadOfCreatingANewOneEvenWhenSuspended() {
        farm.setServiceStatus("SUSPENDED");
        Payment open = payment("PENDING", null, null, NOW.plus(Duration.ofHours(3)));
        requestable(open);

        PaymentDTO dto = service().requestPayment(FARM_ID, new PaymentRequest(2, 99L));

        assertThat(dto.id()).isEqualTo(open.getId());
        assertThat(dto.reopened()).isTrue();
        verify(payments, never()).saveAndFlush(any());
        verifyNoInteractions(subscriptions, audit);
    }

    @Test
    void tc1904APriceSeenBeforeANewPublicationGetsMsgFe1902WithTheSeenAndCurrentAmounts() {
        requestable();
        PlanVersion v2 = price(2L, 1_500_000, 2_800_000, 4_000_000);
        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(NOW)).thenReturn(Optional.of(v2));
        when(plans.findById(1L)).thenReturn(Optional.of(v1));

        assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-FE19-02");
                assertThat(error.getParams()).containsEntry("seen", Map.of("version", 1L, "term", 1, "amountVnd", BigDecimal.valueOf(1_200_000)));
                assertThat(error.getParams()).containsEntry("current", Map.of("version", 2L, "term", 1, "amountVnd", BigDecimal.valueOf(1_500_000)));
            });
        verify(payments, never()).saveAndFlush(any());
        verifyNoInteractions(subscriptions, audit);
    }

    @Test
    void tc1905ARenewalBeforeNinetyDaysAheadOfTheConfirmedEndGetsMsgFe1903WithTheOpeningDate() {
        Instant end = Instant.parse("2026-12-30T17:00:00Z"); // 31/12/2026 00:00 in UTC+7
        requestable(paid(Instant.parse("2025-12-30T17:00:00Z"), end));

        assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-FE19-03");
                assertThat(error.getParams()).containsEntry("opensAt", Instant.parse("2026-10-01T17:00:00Z"));
                assertThat(error.getParams()).containsEntry("confirmedEnd", end);
            });
        verify(payments, never()).saveAndFlush(any());
    }

    @Test
    void tcDuc190202ARenewalExactlyNinetyDaysBeforeTheConfirmedEndIsAccepted() {
        requestable(paid(NOW.minus(Duration.ofDays(275)), NOW.plus(Duration.ofDays(90))));

        assertThat(service().requestPayment(FARM_ID, new PaymentRequest(1, 1L)).state()).isEqualTo("PENDING");
    }

    @Test
    void tc1906ASuspendedFarmWithoutAnOpenRequestGetsMsgFe1909() {
        farm.setServiceStatus("SUSPENDED");
        requestable();

        assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("MSG-FE19-09");
                assertThat(error.getParams()).containsEntry("farmName", "Trai Ba Vi");
            });
        verify(payments, never()).saveAndFlush(any());
    }

    @Test
    void tcDuc190203WithoutAnEffectivePriceOrReceivingAccountTheRequestGetsMsgFe1904() {
        requestable();
        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(NOW)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo("MSG-FE19-04"));

        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(NOW)).thenReturn(Optional.of(v1));
        assertThatThrownBy(() -> service("MB", " ").requestPayment(FARM_ID, new PaymentRequest(1, 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo("MSG-FE19-04"));
        verify(payments, never()).saveAndFlush(any());
    }

    @Test
    void tcDuc190204AnUnsupportedTermGetsMsgCom10AndAMissingReviewedPriceGetsMsgCom06BeforeTheFarmIsLocked() {
        owns(FarmAction.MANAGE_FARM_INFORMATION);

        for (Integer years : java.util.Arrays.asList(null, 0, 4)) {
            assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(years, 1L)))
                .isInstanceOfSatisfying(DomainException.class, error -> {
                    assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                    assertThat(error.getParams()).containsEntry("field", "durationYears");
                });
        }
        for (Long version : java.util.Arrays.asList(null, 0L)) {
            assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, version)))
                .isInstanceOfSatisfying(DomainException.class, error -> {
                    assertThat(error.getCode()).isEqualTo(MessageCodes.COM_06);
                    assertThat(error.getParams()).containsEntry("field", "reviewedPriceVersion");
                });
        }
        verifyNoInteractions(farms, payments, subscriptions, audit);
    }

    @Test
    void tc1901AManagerCannotRequestAPayment() {
        when(farmAccess.require(FARM_ID, FarmAction.MANAGE_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, 1L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(farms, payments, subscriptions, audit);
    }

    @Test
    void tcDuc190205AnOverduePendingRequestIsExpiredAndTheExistingSubscriptionIsReused() {
        Payment overdue = payment("PENDING", null, null, NOW.minusSeconds(1));
        requestable(overdue);
        Subscription existing = new Subscription();
        existing.setId(55L);
        when(subscriptions.lockByFarmId(FARM_ID)).thenReturn(Optional.of(existing));
        ArgumentCaptor<Payment> saved = ArgumentCaptor.forClass(Payment.class);

        service().requestPayment(FARM_ID, new PaymentRequest(1, 1L));

        assertThat(overdue.getState()).isEqualTo("EXPIRED");
        verify(subscriptions, never()).saveAndFlush(any());
        verify(payments).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getSubscription()).isSameAs(existing);
        assertThat(saved.getValue().getReceivingEnvironment()).isEqualTo("MOCK");
        assertThat(saved.getValue().getReceivingAccount()).isEqualTo("0123 456 789");
    }

    @Test
    void tcDuc190206AnUnknownReviewedPriceVersionGetsMsgCom10() {
        requestable();
        when(plans.findById(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().requestPayment(FARM_ID, new PaymentRequest(1, 42L)))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("field", "reviewedPriceVersion"));
    }

    // ------------------------------------------------------------------ UC-FE19-03 history()

    @Test
    void tc1944InvalidSearchStatusDatesSortDirectionOrPageAreRejectedBeforeAnyRead() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        LocalDate day = LocalDate.of(2026, 9, 1);
        Map<String, Runnable> calls = new LinkedHashMap<>();
        calls.put("q", () -> service().history(FARM_ID, "x".repeat(101), null, null, null, "requestedAt", "desc", 0));
        calls.put("status", () -> service().history(FARM_ID, null, "OPEN", null, null, "requestedAt", "desc", 0));
        calls.put("from", () -> service().history(FARM_ID, null, null, day.plusDays(1), day, "requestedAt", "desc", 0));
        calls.put("sort", () -> service().history(FARM_ID, null, null, null, null, "amountVnd", "desc", 0));
        calls.put("dir", () -> service().history(FARM_ID, null, null, null, null, "requestedAt", "DESC", 0));
        calls.put("page", () -> service().history(FARM_ID, null, null, null, null, "requestedAt", "desc", SubscriptionPaymentService.MAX_HISTORY_PAGE + 1));
        calls.forEach((field, call) -> assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo("from".equals(field) ? MessageCodes.COM_11 : MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", field);
            }));
        verifyNoInteractions(payments, evidences);
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<Pageable> historyPage(List<Payment> rows) {
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        when(payments.findAll(any(Specification.class), pageable.capture())).thenAnswer(call -> new PageImpl<>(rows, call.getArgument(1), rows.size()));
        return pageable;
    }

    @Test
    void tc1942PagesHaveTwentyRowsSortedByTheChosenTimeThenId() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        ArgumentCaptor<Pageable> pageable = historyPage(List.of());

        var page = service().history(FARM_ID, null, null, null, null, "expiresAt", "asc", 1);

        assertThat(pageable.getValue().getPageNumber()).isEqualTo(1);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
        assertThat(pageable.getValue().getSort()).containsExactly(Sort.Order.asc("expiresAt"), Sort.Order.asc("id"));
        assertThat(page.content()).isEmpty();
        verifyNoInteractions(evidences);
    }

    @Test
    void tcDuc190301AOneHundredCharacterSearchAndTheLastAllowedPageAreAccepted() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        historyPage(List.of());

        var page = service().history(FARM_ID, "x".repeat(100), "PAID", LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 1), "requestedAt", "desc",
            SubscriptionPaymentService.MAX_HISTORY_PAGE);

        assertThat(page.number()).isEqualTo(SubscriptionPaymentService.MAX_HISTORY_PAGE);
    }

    @Test
    void tc1943APendingRequestDueExactlyNowIsListedAsExpiredWithoutChangingItsStoredState() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        Payment due = payment("PENDING", null, null, NOW);
        historyPage(List.of(due));

        PaymentDTO row = service().history(FARM_ID, null, null, null, null, "requestedAt", "desc", 0).content().get(0);

        assertThat(row.state()).isEqualTo("EXPIRED");
        assertThat(due.getState()).isEqualTo("PENDING");
        verify(payments, never()).saveAndFlush(any());
    }

    @Test
    void tc1948EachRowGetsTheBankTimesOfItsOwnEvidenceFromTwoQueriesForTheWholePage() {
        owns(FarmAction.VIEW_FARM_INFORMATION);
        Payment allocatedRow = payment("PAID", null, null, NOW);
        Payment unallocatedRow = payment("PENDING", null, null, NOW.plus(Duration.ofHours(5)));
        Payment wrongAccountRow = payment("PENDING", null, null, NOW.plus(Duration.ofHours(5)));
        historyPage(List.of(allocatedRow, unallocatedRow, wrongAccountRow));
        BankTransferEvidence allocated = evidence(allocatedRow.getQuoteRef(), "0123456789", Instant.parse("2026-09-30T01:00:00Z"));
        allocated.setPayment(allocatedRow);
        BankTransferEvidence lowerCase = evidence(unallocatedRow.getQuoteRef().toLowerCase(), "0123 456 789", Instant.parse("2026-09-30T02:00:00Z"));
        BankTransferEvidence otherAccount = evidence(wrongAccountRow.getQuoteRef(), "999999", Instant.parse("2026-09-30T03:00:00Z"));
        when(evidences.findAllByPayment_IdInOrderByIdAsc(anyList())).thenReturn(List.of(allocated));
        when(evidences.findAllByUpperQuoteRefIn(anyList())).thenReturn(List.of(allocated, lowerCase, otherAccount));

        List<PaymentDTO> rows = service().history(FARM_ID, null, null, null, null, "requestedAt", "desc", 0).content();

        assertThat(rows.get(0).bankPaidAt()).isEqualTo(Instant.parse("2026-09-30T01:00:00Z"));
        assertThat(rows.get(1).receivedAt()).isEqualTo(Instant.parse("2026-09-30T02:00:00Z"));
        assertThat(rows.get(2).receivedAt()).isNull();
        verify(evidences).findAllByPayment_IdInOrderByIdAsc(List.of(allocatedRow.getId(), unallocatedRow.getId(), wrongAccountRow.getId()));
        verify(evidences).findAllByUpperQuoteRefIn(List.of(allocatedRow.getQuoteRef(), unallocatedRow.getQuoteRef(), wrongAccountRow.getQuoteRef()));
    }

    @Test
    void tc1940SomeoneWhoIsNotTheOwnerCannotReadThePaymentHistory() {
        when(farmAccess.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service().history(FARM_ID, null, null, null, null, "requestedAt", "desc", 0))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(payments, evidences);
    }

    private BankTransferEvidence evidence(String quoteRef, String account, Instant at) {
        BankTransferEvidence evidence = new BankTransferEvidence();
        evidence.setId(nextId++);
        evidence.setQuoteRef(quoteRef);
        evidence.setAuthOutcome("VERIFIED");
        evidence.setTransferDirection("IN");
        evidence.setEnvironment("MOCK");
        evidence.setAccountNamespace("LOCAL-MOCK");
        evidence.setReceivingAccount(account);
        evidence.setFirstReceivedAt(at);
        evidence.setBankPaidAt(at);
        return evidence;
    }
}
