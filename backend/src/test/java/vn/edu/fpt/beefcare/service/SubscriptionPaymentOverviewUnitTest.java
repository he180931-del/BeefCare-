package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.PlanVersion;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.PlanVersionRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;

class SubscriptionPaymentOverviewUnitTest {
    private static final Long FARM_ID = 1935L;
    private static final Instant NOW = Instant.parse("2026-10-01T00:00:00Z");

    @Test
    void tc1935IncludesOnlyPaidPeriodsAndUsesTheLatestFuturePaidPeriod() {
        Payment past = payment(1L, "PAID-PAST", "PAID", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z", NOW);
        Payment current = payment(2L, "PAID-CURRENT", "PAID", "2026-09-15T00:00:00Z", "2026-10-15T00:00:00Z", NOW);
        Payment future = payment(3L, "PAID-FUTURE", "PAID", "2026-10-15T00:00:00Z", "2027-10-15T00:00:00Z", NOW);
        Payment pending = payment(4L, "REQUEST-PENDING", "PENDING", null, null, NOW.plusSeconds(3600));
        Payment expired = payment(5L, "REQUEST-EXPIRED", "EXPIRED", null, null, NOW.minusSeconds(3600));

        var overview = service(List.of(past, current, future, pending, expired), false, NOW).overview(FARM_ID);

        assertThat(overview.periods()).extracting(SubscriptionPaymentService.PurchasedPeriod::paymentCode)
            .containsExactly("PAID-FUTURE", "PAID-CURRENT", "PAID-PAST");
        assertThat(overview.periods()).extracting(SubscriptionPaymentService.PurchasedPeriod::status)
            .containsExactly("FUTURE", "CURRENT", "PAST");
        assertThat(overview.latestEnd()).isEqualTo(Instant.parse("2027-10-15T00:00:00Z"));
        assertThat(overview.futurePeriods()).extracting(SubscriptionPaymentService.PurchasedPeriod::paymentCode)
            .containsExactly("PAID-FUTURE");
        assertThat(overview.pendingPayment().quoteRef()).isEqualTo("REQUEST-PENDING");
    }

    @Test
    void tc1936CountsWholeDaysWithoutLettingSuspensionStopTheCountdown() {
        Instant end = NOW.plusSeconds(24 * 3600L);
        var suspended = service(List.of(payment(6L, "PAID-24H", "PAID", NOW.minusSeconds(3600).toString(), end.toString(), NOW)), true, NOW)
            .overview(FARM_ID);
        assertThat(suspended.serviceStatus()).isEqualTo("SUSPENDED");
        assertThat(suspended.daysRemaining()).isEqualTo(1L);

        Instant endIn23Hours = NOW.plusSeconds(23 * 3600L);
        var under24Hours = service(List.of(payment(7L, "PAID-23H", "PAID", NOW.minusSeconds(3600).toString(), endIn23Hours.toString(), NOW)), false, NOW)
            .overview(FARM_ID);
        assertThat(under24Hours.daysRemaining()).isEqualTo(0L);

        var noCurrentPeriod = service(List.of(payment(8L, "PAID-FUTURE", "PAID", endIn23Hours.toString(), end.plusSeconds(3600).toString(), NOW)), false, NOW)
            .overview(FARM_ID);
        assertThat(noCurrentPeriod.currentPeriod()).isNull();
        assertThat(noCurrentPeriod.daysRemaining()).isNull();
    }

    @Test
    void tc1938ExcludesPendingPaymentAtItsExactExpiryWhenTheLifecycleJobHasNotRun() {
        Payment pendingBeforeExpiry = payment(9L, "PENDING-VALID", "PENDING", null, null, NOW.plusNanos(1));
        Payment pendingAtExpiry = payment(10L, "PENDING-EXPIRED-AT-READ", "PENDING", null, null, NOW);

        var overview = service(List.of(pendingBeforeExpiry, pendingAtExpiry), false, NOW).overview(FARM_ID);

        assertThat(overview.pendingPayment()).isNotNull();
        assertThat(overview.pendingPayment().quoteRef()).isEqualTo("PENDING-VALID");
        assertThat(overview.pendingPayment().state()).isEqualTo("PENDING");
    }

    private static SubscriptionPaymentService service(List<Payment> requests, boolean suspended, Instant now) {
        Farm farm = new Farm();
        farm.setId(FARM_ID);
        farm.setName("Unit farm");
        farm.setServiceStatus(suspended ? "SUSPENDED" : "ACTIVE");
        FarmContext context = new FarmContext(farm, new AppUser(), FarmRole.OWNER);

        FarmAccessService farmAccess = mock(FarmAccessService.class);
        when(farmAccess.require(FARM_ID, FarmAction.VIEW_FARM_INFORMATION)).thenReturn(context);
        PaymentRepository payments = mock(PaymentRepository.class);
        when(payments.findAllBySubscription_Farm_IdOrderByRequestedAtDescIdDesc(FARM_ID)).thenReturn(requests);
        FarmClock clock = mock(FarmClock.class);
        when(clock.now()).thenReturn(now);
        PlanVersionRepository plans = mock(PlanVersionRepository.class);
        when(plans.findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(now)).thenReturn(Optional.empty());
        BankTransferEvidenceRepository evidences = mock(BankTransferEvidenceRepository.class);
        when(evidences.findAllByPayment_IdInOrderByIdAsc(anyList())).thenReturn(List.of());
        when(evidences.findAllByUpperQuoteRefIn(anyList())).thenReturn(List.of());
        FarmServiceFacts facts = mock(FarmServiceFacts.class);
        when(facts.lastSuspension(List.of(FARM_ID))).thenReturn(Map.of());

        return new SubscriptionPaymentService(
            farmAccess,
            mock(FarmRepository.class),
            mock(SubscriptionRepository.class),
            payments,
            plans,
            mock(AuditService.class),
            evidences,
            clock,
            facts,
            "MB",
            "1234567890",
            "UNIT FARM",
            "UNIT",
            "MOCK"
        );
    }

    private static Payment payment(long id, String quoteRef, String state, String start, String end, Instant expiresAt) {
        PlanVersion priceVersion = new PlanVersion();
        priceVersion.setId(1L);
        Payment payment = new Payment();
        payment.setId(id);
        payment.setQuoteRef(quoteRef);
        payment.setDurationYears(1);
        payment.setAmountVnd(new BigDecimal("1200000"));
        payment.setState(state);
        payment.setExpiresAt(expiresAt);
        payment.setPurchasedStart(start == null ? null : Instant.parse(start));
        payment.setPurchasedEnd(end == null ? null : Instant.parse(end));
        payment.setRequestedAt(NOW.minusSeconds(7200));
        payment.setPriceVersion(priceVersion);
        return payment;
    }
}
