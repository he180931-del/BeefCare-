package vn.edu.fpt.beefcare.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.PlatformAccessService;
import vn.edu.fpt.beefcare.service.PlatformContext;
import vn.edu.fpt.beefcare.service.payment.PlatformPaymentQueryService.EvidenceRow;
import vn.edu.fpt.beefcare.service.payment.PlatformSubscriptionQueryService.Page;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main function of UC-FE19-05:
 * {@link PlatformPaymentQueryService#evidence(String, LocalDate, LocalDate, int, int)}, the SCR-62 bank evidence list.
 * The JPQL queries are mocked; review status and match result are derived by the real service code.
 */
@ExtendWith(MockitoExtension.class)
class PlatformPaymentQueryServiceUnitTest {

    private static final Instant NOW = Instant.parse("2026-11-26T03:00:00Z");
    private static final Instant REQUESTED = Instant.parse("2026-11-25T01:00:00Z");
    private static final Instant EXPIRES = REQUESTED.plus(Duration.ofHours(24));

    @Mock EntityManager em;
    @Mock PlatformAccessService access;

    private PlatformPaymentQueryService service;
    private TypedQuery<Long> count;
    private TypedQuery<BankTransferEvidence> rows;
    private TypedQuery<Payment> references;
    private long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new PlatformPaymentQueryService(em, access, new FarmClock(Clock.fixed(NOW, ZoneOffset.UTC)), new ObjectMapper(),
            "0123456789", "mock", "LOCAL-MOCK");
    }

    private void signedInAsPm() {
        when(access.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(null, null, PlatformRole.PM));
    }

    @SuppressWarnings("unchecked")
    private void found(long total, List<BankTransferEvidence> page, List<Payment> referenced) {
        count = mock(TypedQuery.class);
        rows = mock(TypedQuery.class);
        when(em.createQuery(anyString(), eq(Long.class))).thenReturn(count);
        when(count.getSingleResult()).thenReturn(total);
        when(em.createQuery(anyString(), eq(BankTransferEvidence.class))).thenReturn(rows);
        when(rows.setFirstResult(anyInt())).thenReturn(rows);
        when(rows.setMaxResults(anyInt())).thenReturn(rows);
        when(rows.getResultList()).thenReturn(page);
        references = mock(TypedQuery.class);
        lenient().when(em.createQuery(anyString(), eq(Payment.class))).thenReturn(references);
        lenient().when(references.setParameter(eq("codes"), any())).thenReturn(references);
        lenient().when(references.getResultList()).thenReturn(referenced);
    }

    private BankTransferEvidence evidence(String code, String account, Instant bankPaidAt, long amount) {
        BankTransferEvidence evidence = new BankTransferEvidence();
        evidence.setId(nextId++);
        evidence.setProviderTxnId(98_765_432L);
        evidence.setProvider("SEPAY");
        evidence.setEnvironment("MOCK");
        evidence.setAccountNamespace("LOCAL-MOCK");
        evidence.setReceivingAccount(account);
        evidence.setAmount(BigDecimal.valueOf(amount));
        evidence.setTransferDirection("IN");
        evidence.setBankPaidAt(bankPaidAt);
        evidence.setReviewStatus("NEEDS_REVIEW");
        evidence.setQuoteRef(code);
        evidence.setVersion(1L);
        return evidence;
    }

    private BankTransferEvidence incoming(String code) {
        return evidence(code, "0123456789", REQUESTED.plus(Duration.ofHours(2)), 1_200_000);
    }

    private Payment request(String code) {
        Payment payment = new Payment();
        payment.setId(nextId++);
        payment.setQuoteRef(code);
        payment.setState("PENDING");
        payment.setRequestedAt(REQUESTED);
        payment.setExpiresAt(EXPIRES);
        payment.setAmountVnd(BigDecimal.valueOf(1_200_000));
        payment.setReceivingAccount("0123456789");
        payment.setReceivingEnvironment("MOCK");
        payment.setReceivingAccountNamespace("LOCAL-MOCK");
        return payment;
    }

    private EvidenceRow only(BankTransferEvidence evidence, Payment... referenced) {
        found(1, List.of(evidence), List.of(referenced));
        return service.evidence(null, null, null, 0, 20).items().get(0);
    }

    // ------------------------------------------------------------------ access and input

    @Test
    void tc1958OnlyAnActivePlatformManagerCanReadTheEvidence() {
        when(access.requireRole(PlatformRole.PM)).thenThrow(DomainException.forbidden(MessageCodes.COM_01));

        assertThatThrownBy(() -> service.evidence(null, null, null, 0, 20))
            .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_01));
        verifyNoInteractions(em);
    }

    @Test
    void tc1964AnUnknownStatusOrInvalidPagingGetsMsgCom10AndAReversedBankRangeGetsMsgCom11() {
        signedInAsPm();
        Map<String, Runnable> calls = new LinkedHashMap<>();
        calls.put("status", () -> service.evidence("OPEN", null, null, 0, 20));
        calls.put("size", () -> service.evidence(null, null, null, 0, 0));
        calls.put("size ", () -> service.evidence(null, null, null, 0, 101));
        calls.put("page", () -> service.evidence(null, null, null, -1, 20));
        calls.forEach((field, call) -> assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_10);
                assertThat(error.getParams()).containsEntry("field", field.trim());
            }));
        assertThatThrownBy(() -> service.evidence(null, LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 1), 0, 20))
            .isInstanceOfSatisfying(DomainException.class, error -> {
                assertThat(error.getCode()).isEqualTo(MessageCodes.COM_11);
                assertThat(error.getParams()).containsEntry("field", "bankTo");
            });
        verifyNoInteractions(em);
    }

    @Test
    void tc1960BankDaysAreInclusiveUtcPlus7DaysPagesAreOffsetAndTransactionIdsAreMasked() {
        signedInAsPm();
        found(23, List.of(incoming(null)), List.of());

        Page<EvidenceRow> page = service.evidence(" all ", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), 1, 20);

        verify(count).setParameter("from", Instant.parse("2026-10-31T17:00:00Z"));
        verify(count).setParameter("to", Instant.parse("2026-11-30T17:00:00Z"));
        verify(rows).setFirstResult(20);
        verify(rows).setMaxResults(20);
        assertThat(page.total()).isEqualTo(23);
        assertThat(page.items().get(0).maskedTransactionId()).isEqualTo("****5432");
        verify(em, never()).persist(any());
        verify(em, never()).merge(any());
        verify(em, never()).flush();
    }

    @Test
    void tc1959TheToReviewFilterExcludesLockedAndOutgoingTransfersAndHoldIncludesTheHeldAlias() {
        signedInAsPm();
        ArgumentCaptor<String> jpql = ArgumentCaptor.forClass(String.class);

        found(0, List.of(), List.of());
        service.evidence("to_review", null, null, 0, 20);
        found(0, List.of(), List.of());
        service.evidence("HOLD", null, null, 0, 20);

        verify(em, org.mockito.Mockito.times(2)).createQuery(jpql.capture(), eq(Long.class));
        assertThat(jpql.getAllValues().get(0))
            .contains("not (e.lockedForReturn=true or upper(e.reviewStatus)='LOCKED_FOR_RETURN')")
            .contains("(e.transferDirection is null or upper(e.transferDirection)='IN')")
            .contains("in ('UNMATCHED','NEEDS_REVIEW')");
        assertThat(jpql.getAllValues().get(1)).contains("in ('HOLD','HELD')");
    }

    // ------------------------------------------------------------------ review status

    @Test
    void tc1968StoredStatesMapToTheDeclaredReviewStatusesAndUnknownOnesShowAsProcessing() {
        signedInAsPm();
        BankTransferEvidence received = incoming(null);
        received.setReviewStatus("RECEIVED");
        BankTransferEvidence unknown = incoming(null);
        unknown.setReviewStatus("WEIRD");
        BankTransferEvidence outgoing = incoming(null);
        outgoing.setTransferDirection("OUT");
        BankTransferEvidence held = incoming(null);
        held.setReviewStatus("HELD");
        BankTransferEvidence locked = incoming(null);
        locked.setLockedForReturn(true);
        BankTransferEvidence allocated = incoming(null);
        allocated.setPayment(request("BCALLOC"));
        found(6, List.of(received, unknown, outgoing, held, locked, allocated), List.of());

        List<EvidenceRow> items = service.evidence(null, null, null, 0, 20).items();

        assertThat(items).extracting(EvidenceRow::reviewStatus).containsExactly("PROCESSING", "PROCESSING", "NO_ACTION", "HOLD", "LOCKED", "ACCEPTED");
    }

    // ------------------------------------------------------------------ match result

    @Test
    void tc1963AnExactCodeInTheBankWindowMatchesCaseInsensitivelyAndOneQueryReadsAllReferencedRequests() {
        signedInAsPm();
        Payment open = request("BCABC123");
        found(2, List.of(incoming("bcabc123"), incoming("BCABC123")), List.of(open));

        List<EvidenceRow> items = service.evidence(null, null, null, 0, 20).items();

        assertThat(items).extracting(EvidenceRow::matchResult).containsExactly("EXACT_CODE", "EXACT_CODE");
        assertThat(items).extracting(EvidenceRow::receivingAccountMatches).containsExactly(true, true);
        verify(references).setParameter("codes", List.of("BCABC123"));
    }

    @Test
    void tcDuc190501TheBankTimeAmountAndWindowDecideTheMatchResult() {
        signedInAsPm();
        Payment open = request("BCABC123");
        BankTransferEvidence atExpiry = evidence("BCABC123", "0123456789", EXPIRES, 1_200_000);
        BankTransferEvidence beforeRequest = evidence("BCABC123", "0123456789", REQUESTED.minusSeconds(1), 1_200_000);
        BankTransferEvidence oneDongShort = evidence("BCABC123", "0123456789", REQUESTED.plusSeconds(60), 1_199_999);
        BankTransferEvidence lastSecond = evidence("BCABC123", "0123456789", EXPIRES.minusSeconds(1), 1_200_000);
        found(4, List.of(atExpiry, beforeRequest, oneDongShort, lastSecond), List.of(open));

        List<EvidenceRow> items = service.evidence(null, null, null, 0, 20).items();

        assertThat(items).extracting(EvidenceRow::matchResult).containsExactly("REQUEST_EXPIRED", "OUTSIDE_WINDOW", "AMOUNT_MISMATCH", "EXACT_CODE");
    }

    @Test
    void tc1967AccountsMatchIgnoringSeparatorsAndCaseWhileAnotherAccountIsAMismatch() {
        signedInAsPm();
        Payment open = request("BCABC123");
        open.setReceivingAccount("0123 456 789");
        BankTransferEvidence formatted = evidence("BCABC123", "0123-456.789", REQUESTED.plusSeconds(60), 1_200_000);
        BankTransferEvidence other = evidence("BCABC123", "999888777", REQUESTED.plusSeconds(60), 1_200_000);
        found(2, List.of(formatted, other), List.of(open));

        List<EvidenceRow> items = service.evidence(null, null, null, 0, 20).items();

        assertThat(items).extracting(EvidenceRow::receivingAccountMatches).containsExactly(true, false);
        assertThat(items).extracting(EvidenceRow::matchResult).containsExactly("EXACT_CODE", "ACCOUNT_MISMATCH");
    }

    @Test
    void tcDuc190502WithoutACodeOrWithAnUnknownCodeTheEvidenceIsCheckedAgainstTheConfiguredAccount() {
        signedInAsPm();
        found(2, List.of(incoming(" "), incoming("BCUNKNOWN")), List.of());

        List<EvidenceRow> items = service.evidence(null, null, null, 0, 20).items();

        assertThat(items).extracting(EvidenceRow::matchResult).containsExactly("CODE_MISMATCH", "NO_REQUEST");
        assertThat(items).extracting(EvidenceRow::receivingAccountMatches).containsExactly(true, true);
    }

    @Test
    void tc19105MoneyBankedAtOrAfterTheCancellationShowsRequestCancelled() {
        signedInAsPm();
        Payment cancelled = request("BCABC123");
        cancelled.setState("CANCELLED");
        cancelled.setCancelledAt(REQUESTED.plus(Duration.ofHours(1)));
        BankTransferEvidence atCancel = evidence("BCABC123", "0123456789", REQUESTED.plus(Duration.ofHours(1)), 1_200_000);
        BankTransferEvidence before = evidence("BCABC123", "0123456789", REQUESTED.plus(Duration.ofMinutes(59)), 1_200_000);
        found(2, List.of(atCancel, before), List.of(cancelled));

        assertThat(service.evidence(null, null, null, 0, 20).items()).extracting(EvidenceRow::matchResult)
            .containsExactly("REQUEST_CANCELLED", "EXACT_CODE");
    }

    @Test
    void tcDuc190503AllocatedPaidEvidenceShowsItsConfirmationSourceAndOutgoingTransfersAreOutgoing() {
        signedInAsPm();
        List<BankTransferEvidence> page = new ArrayList<>();
        for (String source : List.of("SEPAY", "PM")) {
            Payment paid = request("BC" + source);
            paid.setState("PAID");
            paid.setConfirmationSource(source);
            BankTransferEvidence allocated = incoming(paid.getQuoteRef());
            allocated.setPayment(paid);
            page.add(allocated);
        }
        BankTransferEvidence outgoing = incoming(null);
        outgoing.setTransferDirection("OUT");
        page.add(outgoing);
        found(3, page, List.of());

        List<EvidenceRow> items = service.evidence(null, null, null, 0, 20).items();

        assertThat(items).extracting(EvidenceRow::matchResult).containsExactly("PAID_AUTO", "PAID_PM", "OUTGOING");
        assertThat(items.get(0).paymentCode()).isEqualTo("BCSEPAY");
        assertThat(items.get(1).paymentId()).isNotNull();
        assertThat(items.get(2).paymentId()).isNull();
    }

    @Test
    void tcDuc190504ARowWithAStoredPaidRequestThatIsNotItsAllocationIsAlreadyAllocated() {
        signedInAsPm();
        Payment alreadyPaid = request("BCABC123");
        alreadyPaid.setState("PAID");

        assertThat(only(incoming("BCABC123"), alreadyPaid).matchResult()).isEqualTo("ALREADY_ALLOCATED");
    }
}
