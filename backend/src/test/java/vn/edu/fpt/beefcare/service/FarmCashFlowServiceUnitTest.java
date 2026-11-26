package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.lang.reflect.Parameter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.service.dto.FarmCashFlowDtos.FarmCashFlowView;
import vn.edu.fpt.beefcare.web.rest.FarmDashboardResource;

class FarmCashFlowServiceUnitTest {
    private static final Long FARM_ID = 86L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 26);
    private static final Instant NOW = Instant.parse("2026-11-26T05:00:00Z");

    private EntityManager em;
    private FarmAccessService access;
    private FarmCashFlowService service;
    private TypedQuery<Object[]> voucherRows;
    private TypedQuery<Object[]> subscriptionRows;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        em = mock(EntityManager.class);
        access = mock(FarmAccessService.class);
        FarmClock clock = new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC));
        voucherRows = mock(TypedQuery.class);
        subscriptionRows = mock(TypedQuery.class);
        when(em.createQuery(contains("from VoucherPayment"), eq(Object[].class))).thenReturn(voucherRows);
        when(em.createQuery(contains("from Payment p, BankTransferEvidence e"), eq(Object[].class))).thenReturn(subscriptionRows);
        when(voucherRows.setParameter(anyString(), any())).thenReturn(voucherRows);
        when(subscriptionRows.setParameter(anyString(), any())).thenReturn(subscriptionRows);
        Farm farm = new Farm();
        when(access.require(FARM_ID, FarmAction.VIEW_REPORTS)).thenReturn(new FarmContext(farm, null, FarmRole.OWNER));
        service = new FarmCashFlowService(em, access, clock);
    }

    @Test
    void includesEachRecordedVoucherPaymentAndTotalsTheWholeFilteredPeriodAcrossPages() {
        when(voucherRows.getResultList()).thenReturn(List.of(
            exitPayment(2L, 45L, "PX-45", 125_000L, TODAY.minusDays(1)),
            entryPayment(3L, 31L, "PN-31", 20_000L, TODAY.minusDays(1)),
            feedPayment(4L, 12L, "PNA-12", 10_000L, TODAY.minusDays(1))
        ));
        when(subscriptionRows.getResultList()).thenReturn(List.of());

        FarmCashFlowView firstPage = service.cashFlow(FARM_ID, TODAY.minusDays(30), TODAY, null, null, 0, 2);
        FarmCashFlowView secondPage = service.cashFlow(FARM_ID, TODAY.minusDays(30), TODAY, null, null, 1, 2);

        assertThat(firstPage.totalIncome()).isEqualByComparingTo("125000.00");
        assertThat(firstPage.totalExpense()).isEqualByComparingTo("30000.00");
        assertThat(firstPage.netCashFlow()).isEqualByComparingTo("95000.00");
        assertThat(firstPage.totalElements()).isEqualTo(3);
        assertThat(firstPage.items()).hasSize(2);
        assertThat(secondPage.items()).hasSize(1);
        assertThat(firstPage.items()).extracting(item -> item.id()).doesNotContain(secondPage.items().get(0).id());
    }

    @Test
    void usesTheLinkedBankReceiptTimeInUtcPlusSevenForOwnerSubscriptionRows() {
        when(voucherRows.getResultList()).thenReturn(List.of());
        when(subscriptionRows.getResultList()).thenReturn(List.<Object[]>of(new Object[] {
            86_19L, new BigDecimal("750000.50"), "BC-86-19", Instant.parse("2026-11-25T17:30:00Z")
        }));

        FarmCashFlowView report = service.cashFlow(FARM_ID, TODAY, TODAY, "SUBSCRIPTION", null, 0, 20);

        assertThat(report.totalExpense()).isEqualByComparingTo("750000.50");
        assertThat(report.items()).singleElement().satisfies(item -> {
            assertThat(item.source()).isEqualTo("SUBSCRIPTION");
            assertThat(item.direction()).isEqualTo("OUT");
            assertThat(item.cashDate()).isEqualTo(TODAY);
            assertThat(item.documentId()).isEqualTo(86_19L);
            assertThat(item.documentCode()).isEqualTo("BC-86-19");
        });
        verify(em).createQuery(org.mockito.ArgumentMatchers.contains("BankTransferEvidence"), eq(Object[].class));
    }

    @Test
    void doesNotQueryOrReturnSubscriptionTotalsForManager() {
        Farm farm = new Farm();
        when(access.require(FARM_ID, FarmAction.VIEW_REPORTS)).thenReturn(new FarmContext(farm, null, FarmRole.MANAGER));
        when(voucherRows.getResultList()).thenReturn(List.of());

        FarmCashFlowView report = service.cashFlow(FARM_ID, TODAY.minusDays(7), TODAY, null, null, 0, 20);

        assertThat(report.totalExpense()).isZero();
        assertThat(report.items()).isEmpty();
        verify(em, never()).createQuery(org.mockito.ArgumentMatchers.contains("BankTransferEvidence"), eq(Object[].class));

        FarmCashFlowView selectedSubscription = service.cashFlow(FARM_ID, TODAY.minusDays(7), TODAY, "SUBSCRIPTION", null, 0, 20);
        assertThat(selectedSubscription.totalElements()).isZero();
        verify(em, never()).createQuery(org.mockito.ArgumentMatchers.contains("BankTransferEvidence"), eq(Object[].class));
    }

    @Test
    void farmAccessDenialStopsBeforeReadingAnyPaymentSource() {
        DomainException denied = mock(DomainException.class);
        when(access.require(FARM_ID, FarmAction.VIEW_REPORTS)).thenThrow(denied);

        assertThatThrownBy(() -> service.cashFlow(FARM_ID, TODAY.minusDays(1), TODAY, null, null, 0, 20)).isSameAs(denied);
        verify(em, never()).createQuery(anyString(), eq(Object[].class));
    }

    @Test
    void exposesTheFarmScopedCashFlowGetContractWithValidatedDatesAndDefaultPaging() throws Exception {
        Method endpoint = FarmDashboardResource.class.getMethod("cashFlow", Long.class, LocalDate.class, LocalDate.class, String.class, String.class, int.class, int.class);
        GetMapping mapping = endpoint.getAnnotation(GetMapping.class);
        Parameter[] parameters = endpoint.getParameters();

        assertThat(FarmDashboardResource.class.getAnnotation(RequestMapping.class).value()).containsExactly("/api/farms/{farmId}/dashboard");
        assertThat(mapping.value()).containsExactly("/cash-flow");
        assertThat(endpoint.getReturnType().getSimpleName()).isEqualTo("FarmCashFlowView");
        assertThat(parameters[1].getAnnotation(RequestParam.class).required()).isTrue();
        assertThat(parameters[2].getAnnotation(RequestParam.class).required()).isTrue();
        assertThat(parameters[5].getAnnotation(RequestParam.class).defaultValue()).isEqualTo("0");
        assertThat(parameters[6].getAnnotation(RequestParam.class).defaultValue()).isEqualTo("20");
    }

    @Test
    void rejectsFutureDatesPeriodsOverTwentyFourMonthsAndInvalidPagingBeforeQuerying() {
        assertThatThrownBy(() -> service.cashFlow(FARM_ID, TODAY, TODAY.plusDays(1), null, null, 0, 20)).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> service.cashFlow(FARM_ID, TODAY.minusMonths(24).minusDays(1), TODAY, null, null, 0, 20)).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> service.cashFlow(FARM_ID, TODAY.minusDays(1), TODAY, null, null, -1, 20)).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> service.cashFlow(FARM_ID, TODAY.minusDays(1), TODAY, null, null, 0, 101)).isInstanceOf(DomainException.class);
        verify(em, never()).createQuery(anyString(), eq(Object[].class));
    }

    private static Object[] exitPayment(Long paymentId, Long documentId, String code, Long amount, LocalDate date) {
        return new Object[] { paymentId, PaymentDirection.COLLECT, date, amount, PaymentMethod.CASH, documentId, code, null, null, null, null };
    }

    private static Object[] entryPayment(Long paymentId, Long documentId, String code, Long amount, LocalDate date) {
        return new Object[] { paymentId, PaymentDirection.PAY, date, amount, PaymentMethod.BANK_TRANSFER, null, null, documentId, code, null, null };
    }

    private static Object[] feedPayment(Long paymentId, Long documentId, String code, Long amount, LocalDate date) {
        return new Object[] { paymentId, PaymentDirection.PAY, date, amount, PaymentMethod.CASH, null, null, null, null, documentId, code };
    }
}
