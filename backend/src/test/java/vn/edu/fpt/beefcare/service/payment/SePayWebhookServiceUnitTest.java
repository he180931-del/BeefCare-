package vn.edu.fpt.beefcare.service.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.BankEvidenceJob;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;
import vn.edu.fpt.beefcare.domain.EvidenceReview;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.Payment;
import vn.edu.fpt.beefcare.domain.SePayWebhookRejection;
import vn.edu.fpt.beefcare.domain.Subscription;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.BankEvidenceJobRepository;
import vn.edu.fpt.beefcare.repository.BankTransferEvidenceRepository;
import vn.edu.fpt.beefcare.repository.EvidenceReviewRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.repository.ManualFinanceRecordRepository;
import vn.edu.fpt.beefcare.repository.PaymentRepository;
import vn.edu.fpt.beefcare.repository.SePayWebhookRejectionRepository;
import vn.edu.fpt.beefcare.repository.SubscriptionRepository;
import vn.edu.fpt.beefcare.service.AuditService;
import vn.edu.fpt.beefcare.service.DomainException;
import vn.edu.fpt.beefcare.service.FarmClock;
import vn.edu.fpt.beefcare.service.MailService;
import vn.edu.fpt.beefcare.service.MessageCodes;
import vn.edu.fpt.beefcare.service.NotificationService;
import vn.edu.fpt.beefcare.service.PlatformAccessService;
import vn.edu.fpt.beefcare.service.PlatformContext;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.EvidenceDTO;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.ReviewCommand;
import vn.edu.fpt.beefcare.service.payment.SePayWebhookService.WebhookResult;

/**
 * Unit tests (Mockito, no Spring context, no database) for the main functions of UC-FE19-06 and UC-FE19-08:
 * {@link SePayWebhookService#review} (PM reconciliation decision) and {@link SePayWebhookService#receive} (SePay webhook).
 * Repositories, the signature verifier and the transaction manager are mocks; the transaction template therefore runs
 * its callback directly. The farm clock is fixed per test; business dates are UTC+7.
 */
@ExtendWith(MockitoExtension.class)
class SePayWebhookServiceUnitTest {

    private static final ZoneOffset VN = ZoneOffset.ofHours(7);
    private static final long FARM_ID = 301L;
    private static final long PAYMENT_ID = 900L;
    private static final long EVIDENCE_ID = 41L;

    @Mock SePaySignatureVerifier signatures;
    @Mock SePayTransactionLookupClient lookupClient;
    @Mock PaymentRepository payments;
    @Mock ManualFinanceRecordRepository manualFinanceRecords;
    @Mock SubscriptionRepository subscriptions;
    @Mock FarmRepository farms;
    @Mock FarmMembershipRepository memberships;
    @Mock BankTransferEvidenceRepository evidenceRepository;
    @Mock BankEvidenceJobRepository processingJobs;
    @Mock SePayWebhookRejectionRepository rejectedDeliveries;
    @Mock MailService mail;
    @Mock EvidenceReviewRepository reviews;
    @Mock AuditService audit;
    @Mock NotificationService notifications;
    @Mock ReconciliationNoticeService reconciliationNotices;
    @Mock PlatformAccessService platformAccess;
    @Mock PlatformTransactionManager transactionManager;

    private AppUser pm;

    @BeforeEach
    void setUp() {
        pm = new AppUser();
        pm.setId(5L);
        pm.setFullName("Platform Manager");
    }

    private SePayWebhookService service(Instant now) {
        return new SePayWebhookService(signatures, lookupClient, new ObjectMapper(), payments, manualFinanceRecords, subscriptions, farms,
            memberships, evidenceRepository, processingJobs, rejectedDeliveries, mail, reviews, audit, notifications, reconciliationNotices,
            platformAccess, new FarmClock(Clock.fixed(now, ZoneOffset.UTC)), "MOCK", "LOCAL-MOCK", "0123456789", transactionManager);
    }

    private static Instant vn(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute).toInstant(VN);
    }

    // ================================================================== UC-FE19-06 review()

    @Nested
    class Review {

        private final Instant now = vn(2026, 11, 26, 10, 0);
        private final Instant requested = vn(2026, 11, 25, 9, 0);
        private BankTransferEvidence evidence;
        private Payment payment;
        private Farm farm;
        private Subscription subscription;
        private PaymentRepository.RequestFarm requestFarm;
        private AppUser owner;

        @BeforeEach
        void evidenceUnderReview() {
            lenient().when(platformAccess.requireRole(PlatformRole.PM)).thenReturn(new PlatformContext(pm, null, PlatformRole.PM));
            evidence = new BankTransferEvidence();
            evidence.setId(EVIDENCE_ID);
            evidence.setVersion(3L);
            evidence.setProvider("SEPAY");
            evidence.setEnvironment("MOCK");
            evidence.setAccountNamespace("LOCAL-MOCK");
            evidence.setProviderTxnId(123_456L);
            evidence.setAmount(BigDecimal.valueOf(1_200_000));
            evidence.setBankPaidAt(requested.plus(Duration.ofHours(2)));
            evidence.setTransferDirection("IN");
            evidence.setReceivingAccount("0123 456 789");
            evidence.setReviewStatus("NEEDS_REVIEW");
            evidence.setQuoteRef("BC1A2B3C4D5E6X");
            lenient().when(evidenceRepository.lockById(EVIDENCE_ID)).thenReturn(Optional.of(evidence));
            lenient().when(evidenceRepository.saveAndFlush(any(BankTransferEvidence.class))).thenAnswer(call -> call.getArgument(0));
            lenient().when(reviews.saveAndFlush(any(EvidenceReview.class))).thenAnswer(call -> {
                EvidenceReview review = call.getArgument(0);
                review.setId(77L);
                return review;
            });

            farm = new Farm();
            farm.setId(FARM_ID);
            farm.setName("Trai Ba Vi");
            farm.setServiceStatus("PENDING_PAYMENT");
            subscription = new Subscription();
            subscription.setId(55L);
            subscription.setFarm(farm);
            payment = new Payment();
            payment.setId(PAYMENT_ID);
            payment.setQuoteRef("BC1A2B3C4D5E6F");
            payment.setState("PENDING");
            payment.setDurationYears(1);
            payment.setAmountVnd(BigDecimal.valueOf(1_200_000));
            payment.setRequestedAt(requested);
            payment.setExpiresAt(requested.plus(Duration.ofHours(24)));
            payment.setReceivingEnvironment("MOCK");
            payment.setReceivingAccountNamespace("LOCAL-MOCK");
            payment.setReceivingAccount("0123456789");
            requestFarm = requestFarm(PAYMENT_ID, FARM_ID);
            owner = new AppUser();
            owner.setId(11L);
        }

        private PaymentRepository.RequestFarm requestFarm(long id, long farmId) {
            PaymentRepository.RequestFarm row = mock(PaymentRepository.RequestFarm.class);
            lenient().when(row.getId()).thenReturn(id);
            lenient().when(row.getFarmId()).thenReturn(farmId);
            return row;
        }

        private void acceptable() {
            lenient().when(payments.findRequestFarmById(PAYMENT_ID)).thenReturn(Optional.of(requestFarm));
            lenient().when(farms.lockById(FARM_ID)).thenReturn(Optional.of(farm));
            lenient().when(subscriptions.lockByFarmId(FARM_ID)).thenReturn(Optional.of(subscription));
            lenient().when(payments.lockById(PAYMENT_ID)).thenReturn(Optional.of(payment));
            FarmMembership ownerRow = new FarmMembership();
            ownerRow.setUser(owner);
            lenient().when(memberships.findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(FARM_ID, "OWNER", "ACTIVE")).thenReturn(Optional.of(ownerRow));
        }

        private ReviewCommand accept(Long paymentId) {
            return new ReviewCommand("ACCEPT", paymentId, "Khach ghi sai ma, doi chieu sao ke", 3L);
        }

        private void nothingConfirmed() {
            verify(payments, never()).saveAndFlush(any());
            verify(reviews, never()).saveAndFlush(any());
            verify(evidenceRepository, never()).saveAndFlush(any());
            verifyNoInteractions(audit, notifications, mail);
        }

        @Test
        void tc1973DecisionReasonAndVersionRulesRefuseTheReviewBeforeAnyWrite() {
            Map<String, ReviewCommand> refused = new LinkedHashMap<>();
            refused.put(MessageCodes.COM_06 + " decision", new ReviewCommand(" ", null, "Ly do", 3L));
            refused.put(MessageCodes.COM_10 + " decision", new ReviewCommand("APPROVE", null, "Ly do", 3L));
            refused.put(MessageCodes.COM_06 + " reason", new ReviewCommand("HOLD", null, "   ", 3L));
            refused.put(MessageCodes.COM_10 + " reason", new ReviewCommand("REJECT", null, "R".repeat(1001), 3L));
            refused.put(MessageCodes.COM_06 + " version", new ReviewCommand("HOLD", null, "Ly do", null));
            refused.put(MessageCodes.COM_05 + " version", new ReviewCommand("HOLD", null, "Ly do", 2L));
            refused.forEach((expected, command) -> assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, command))
                .as(expected)
                .isInstanceOfSatisfying(DomainException.class, error -> {
                    assertThat(error.getCode()).isEqualTo(expected.split(" ")[0]);
                    assertThat(error.getParams()).containsEntry("field", expected.split(" ")[1]);
                }));

            when(evidenceRepository.lockById(99L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service(now).review(99L, new ReviewCommand("HOLD", null, "Ly do", 3L)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getCode()).isEqualTo(MessageCodes.COM_08));
            nothingConfirmed();
        }

        @Test
        void tcDuc190601HoldStoresTheTrimmedReasonOneReviewRowAndAnAuditWithoutTouchingPayments() {
            String reason = "  " + "R".repeat(1000) + "  ";

            EvidenceDTO dto = service(now).review(EVIDENCE_ID, new ReviewCommand("hold", null, reason, 3L));

            assertThat(dto.reviewStatus()).isEqualTo("HOLD");
            assertThat(dto.reviewReason()).hasSize(1000);
            ArgumentCaptor<EvidenceReview> review = ArgumentCaptor.forClass(EvidenceReview.class);
            verify(reviews).saveAndFlush(review.capture());
            assertThat(review.getValue().getDecision()).isEqualTo("HOLD");
            assertThat(review.getValue().getPmUser()).isSameAs(pm);
            assertThat(review.getValue().getReviewedAt()).isEqualTo(now);
            verify(audit).logAt(isNull(), eq(pm), eq("EVIDENCE_REVIEW"), eq("EvidenceReview"), eq(77L), any(), eq(now));
            verifyNoInteractions(payments, subscriptions, farms, notifications, mail);
        }

        @Test
        void tcDuc190602RejectKeepsTheConsideredRequestOnTheReviewRow() {
            when(payments.findById(PAYMENT_ID)).thenReturn(Optional.of(payment));

            EvidenceDTO dto = service(now).review(EVIDENCE_ID, new ReviewCommand("REJECT", PAYMENT_ID, "Khong phai tien goi dich vu", 3L));

            assertThat(dto.reviewStatus()).isEqualTo("REJECTED");
            assertThat(dto.paymentId()).isNull();
            ArgumentCaptor<EvidenceReview> review = ArgumentCaptor.forClass(EvidenceReview.class);
            verify(reviews).saveAndFlush(review.capture());
            assertThat(review.getValue().getRelatedPayment()).isSameAs(payment);
            assertThat(payment.getState()).isEqualTo("PENDING");
        }

        @Test
        void tc1922EvidenceLockedForReturnOrAlreadyAllocatedCannotBeReviewed() {
            evidence.setLockedForReturn(true);
            assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, accept(PAYMENT_ID)))
                .isInstanceOfSatisfying(DomainException.class, error -> {
                    assertThat(error.getCode()).isEqualTo(MessageCodes.FE19_11);
                    assertThat(error.getParams()).containsEntry("reason", "LOCKED_FOR_RETURN");
                });
            evidence.setLockedForReturn(false);
            evidence.setPayment(payment);
            assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, new ReviewCommand("HOLD", null, "Ly do", 3L)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("reason", "EVIDENCE_ALLOCATED"));
            nothingConfirmed();
        }

        @Test
        void tc1917AMistypedCodeWithoutAChosenRequestGetsMsgFe1911NoCandidate() {
            when(payments.findRequestFarmsByQuoteRef("BC1A2B3C4D5E6X")).thenReturn(List.of());

            assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, accept(null)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("reason", "NO_CANDIDATE"));
            nothingConfirmed();
        }

        @Test
        void tcDuc190603AnOutgoingTransferCannotFundARequest() {
            acceptable();
            evidence.setTransferDirection("OUT");

            assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, accept(PAYMENT_ID)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("reason", "OUTGOING"));
            nothingConfirmed();
        }

        @Test
        void tc1980AnExactCodeOfOneFarmCannotFundARequestOfAnotherFarm() {
            acceptable();
            evidence.setQuoteRef("BC9Z9Z9Z9Z9Z9Z");
            PaymentRepository.RequestFarm otherFarm = requestFarm(901L, 777L);
            when(payments.findRequestFarmsByQuoteRef("BC9Z9Z9Z9Z9Z9Z")).thenReturn(List.of(otherFarm));

            assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, accept(PAYMENT_ID)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("reason", "OTHER_FARM"));
            verify(farms, never()).lockById(anyLong());
            nothingConfirmed();
        }

        @Test
        void tc1972EachFundingRuleBlocksTheAcceptanceWithItsReason() {
            acceptable();
            Map<String, Runnable> cases = new LinkedHashMap<>();
            cases.put("AMOUNT_MISMATCH", () -> evidence.setAmount(BigDecimal.valueOf(1_199_999)));
            cases.put("OUTSIDE_WINDOW", () -> evidence.setBankPaidAt(payment.getExpiresAt()));
            cases.put("ACCOUNT_MISMATCH", () -> evidence.setReceivingAccount("999888777"));
            cases.put("REQUEST_NOT_PENDING", () -> payment.setState("PAID"));
            cases.put("REQUEST_ALLOCATED", () -> when(evidenceRepository.existsByPayment_Id(PAYMENT_ID)).thenReturn(true));
            cases.forEach((reason, breakRule) -> {
                evidenceUnderReview();
                acceptable();
                breakRule.run();
                assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, accept(PAYMENT_ID)))
                    .as(reason)
                    .isInstanceOfSatisfying(DomainException.class, error -> {
                        assertThat(error.getCode()).isEqualTo(MessageCodes.FE19_11);
                        assertThat(error.getParams()).containsEntry("reason", reason);
                    });
            });
            verify(payments, never()).saveAndFlush(any());
            verifyNoInteractions(audit, notifications, mail);
        }

        @Test
        void tc1919ATransferAlreadyPostedAsManualIncomeCannotBeAccepted() {
            acceptable();
            when(manualFinanceRecords.existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase("SEPAY:MOCK:LOCAL-MOCK:123456", "INCOME", "POSTED")).thenReturn(true);

            assertThatThrownBy(() -> service(now).review(EVIDENCE_ID, accept(PAYMENT_ID)))
                .isInstanceOfSatisfying(DomainException.class, error -> assertThat(error.getParams()).containsEntry("reason", "MANUAL_INCOME"));
            nothingConfirmed();
        }

        @Test
        void tc1918AcceptingAChosenRequestMakesItPaidByThePmWithAPeriodReceiptReviewAuditAndOwnerNotice() {
            acceptable();

            EvidenceDTO dto = service(now).review(EVIDENCE_ID, accept(PAYMENT_ID));

            assertThat(payment.getState()).isEqualTo("PAID");
            assertThat(payment.getConfirmationSource()).isEqualTo("PM");
            assertThat(payment.getConfirmedAt()).isEqualTo(now);
            assertThat(payment.getPurchasedStart()).isEqualTo(now);
            assertThat(payment.getPurchasedEnd()).isEqualTo(vn(2027, 11, 26, 10, 0));
            assertThat(payment.getReceiptCode()).isEqualTo("RC-26-000900");
            assertThat(subscription.getLatestEnd()).isEqualTo(payment.getPurchasedEnd());
            assertThat(subscription.getEntitlementStatus()).isEqualTo("ACTIVE");
            assertThat(farm.getServiceStatus()).isEqualTo("ACTIVE");
            assertThat(dto.reviewStatus()).isEqualTo("ACCEPTED");
            assertThat(dto.paymentId()).isEqualTo(PAYMENT_ID);
            verify(audit).logAt(eq(farm), eq(pm), eq("PM_ACCEPT_PAYMENT_PAID"), eq("Payment"), eq(PAYMENT_ID), any(), any());
            verify(audit).logAt(eq(farm), eq(pm), eq("EVIDENCE_REVIEW"), eq("EvidenceReview"), eq(77L), eq(Map.of(
                "decision", "ACCEPT", "evidenceId", EVIDENCE_ID, "paymentId", PAYMENT_ID, "relatedPaymentId", PAYMENT_ID,
                "reason", "Khach ghi sai ma, doi chieu sao ke")), eq(now));
            verify(notifications).notify(eq(owner), eq("subscription"), eq("SUBSCRIPTION"), eq(FARM_ID), anyString(), anyString(), eq("PAYMENT_PAID:900"));
            verify(mail).queuePaymentReceipt(payment, owner);
        }

        @Test
        void tc1971AnExactCodeNeedsNoChosenRequest() {
            acceptable();
            evidence.setQuoteRef(" BC1A2B3C4D5E6F ");
            when(payments.findRequestFarmsByQuoteRef("BC1A2B3C4D5E6F")).thenReturn(List.of(requestFarm));

            assertThat(service(now).review(EVIDENCE_ID, accept(null)).paymentId()).isEqualTo(PAYMENT_ID);
            verify(payments, never()).findRequestFarmById(anyLong());
        }

        @Test
        void tc1970ASuspendedFarmStaysSuspendedAfterThePaymentIsAccepted() {
            acceptable();
            farm.setServiceStatus("SUSPENDED");

            service(now).review(EVIDENCE_ID, accept(PAYMENT_ID));

            assertThat(payment.getState()).isEqualTo("PAID");
            assertThat(farm.getServiceStatus()).isEqualTo("SUSPENDED");
        }

        private Payment paidPeriod(Instant start, Instant end) {
            Payment period = new Payment();
            period.setPurchasedStart(start);
            period.setPurchasedEnd(end);
            return period;
        }

        private void confirmAt(Instant confirmation) {
            payment.setRequestedAt(confirmation.minus(Duration.ofHours(20)));
            payment.setExpiresAt(confirmation.plus(Duration.ofHours(4)));
            evidence.setBankPaidAt(confirmation.minus(Duration.ofHours(10)));
        }

        @Test
        void tc1914ARenewalBeforeTheCurrentEndStartsAtThatEndAndKeepsTheAnniversary() {
            acceptable();
            Instant confirmation = vn(2027, 2, 1, 9, 0);
            confirmAt(confirmation);
            subscription.setLatestEnd(vn(2027, 3, 15, 0, 0));
            when(payments.findPaidPeriods(55L)).thenReturn(List.of(paidPeriod(vn(2026, 3, 15, 0, 0), vn(2027, 3, 15, 0, 0))));

            service(confirmation).review(EVIDENCE_ID, accept(PAYMENT_ID));

            assertThat(payment.getPurchasedStart()).isEqualTo(vn(2027, 3, 15, 0, 0));
            assertThat(payment.getPurchasedEnd()).isEqualTo(vn(2028, 3, 15, 0, 0));
        }

        @Test
        void tc1915AContinuousRenewalFromTheTwentyNinthOfFebruaryEndsOnTheTwentyEighthInACommonYear() {
            acceptable();
            Instant confirmation = vn(2028, 1, 15, 9, 0);
            confirmAt(confirmation);
            subscription.setLatestEnd(vn(2028, 2, 29, 0, 0));
            when(payments.findPaidPeriods(55L)).thenReturn(List.of(paidPeriod(vn(2027, 2, 28, 0, 0), vn(2028, 2, 29, 0, 0))));

            service(confirmation).review(EVIDENCE_ID, accept(PAYMENT_ID));

            assertThat(payment.getPurchasedStart()).isEqualTo(vn(2028, 2, 29, 0, 0));
            assertThat(payment.getPurchasedEnd()).isEqualTo(vn(2029, 2, 28, 0, 0));
        }

        @Test
        void tc1988AChainThatStartedOnTheTwentyNinthOfFebruaryGetsItBackInTheNextLeapYear() {
            acceptable();
            Instant confirmation = vn(2027, 1, 20, 9, 0);
            confirmAt(confirmation);
            subscription.setLatestEnd(vn(2027, 2, 28, 0, 0));
            when(payments.findPaidPeriods(55L)).thenReturn(List.of(
                paidPeriod(vn(2026, 2, 28, 0, 0), vn(2027, 2, 28, 0, 0)),
                paidPeriod(vn(2025, 2, 28, 0, 0), vn(2026, 2, 28, 0, 0)),
                paidPeriod(vn(2024, 2, 29, 0, 0), vn(2025, 2, 28, 0, 0))));

            service(confirmation).review(EVIDENCE_ID, accept(PAYMENT_ID));

            assertThat(payment.getPurchasedEnd()).isEqualTo(vn(2028, 2, 29, 0, 0));
        }

        @Test
        void tc1916AfterTheServiceLapsedTheNewPeriodStartsAtTheConfirmation() {
            acceptable();
            Instant confirmation = vn(2027, 2, 10, 14, 30);
            confirmAt(confirmation);
            subscription.setLatestEnd(vn(2027, 1, 1, 0, 0));

            service(confirmation).review(EVIDENCE_ID, accept(PAYMENT_ID));

            assertThat(payment.getPurchasedStart()).isEqualTo(confirmation);
            assertThat(payment.getPurchasedEnd()).isEqualTo(vn(2028, 2, 10, 14, 30));
            verify(payments, never()).findPaidPeriods(anyLong());
        }
    }

    // ================================================================== UC-FE19-08 receive()

    @Nested
    class Receive {

        private final Instant now = vn(2026, 11, 26, 10, 5);

        private byte[] body(long id, String amount, String date, String type, String code, String content, String account) {
            return ("{\"id\":" + id + ",\"gateway\":\"MBBank\",\"transactionDate\":\"" + date + "\",\"accountNumber\":\"" + account + "\","
                + "\"code\":" + (code == null ? "null" : "\"" + code + "\"") + ",\"content\":\"" + content + "\",\"transferType\":\"" + type + "\","
                + "\"transferAmount\":" + amount + ",\"referenceCode\":\"FT123\",\"description\":\"BankAPINotify\"}").getBytes(StandardCharsets.UTF_8);
        }

        private byte[] valid() {
            return body(7_001L, "1200000", "2026-11-26 10:00:00", "in", null, "thanh toan bc1a2b3c4d5e6f", "0123456789");
        }

        private WebhookResult deliver(byte[] body) {
            return service(now).receive("1764126300", "v1=good", body);
        }

        private void nothingStored() {
            verify(evidenceRepository, never()).saveAndFlush(any());
            verifyNoInteractions(processingJobs, payments, audit);
        }

        private List<BankTransferEvidence> storeNew() {
            List<BankTransferEvidence> stored = new java.util.ArrayList<>();
            when(evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId("SEPAY", "MOCK", "LOCAL-MOCK", 7_001L))
                .thenReturn(Optional.empty());
            when(evidenceRepository.saveAndFlush(any(BankTransferEvidence.class))).thenAnswer(call -> {
                BankTransferEvidence evidence = call.getArgument(0);
                evidence.setId(EVIDENCE_ID);
                stored.add(evidence);
                return evidence;
            });
            return stored;
        }

        @Test
        void tc1984AnInvalidSignatureOrTimestampGets401AndOnlyRestrictedRejectionMetadata() {
            byte[] body = valid();
            when(signatures.verify("1764126300", "v1=bad", body)).thenReturn(false);
            ArgumentCaptor<SePayWebhookRejection> rejected = ArgumentCaptor.forClass(SePayWebhookRejection.class);

            assertThatThrownBy(() -> service(now).receive("1764126300", "v1=bad", body))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));

            verify(rejectedDeliveries).save(rejected.capture());
            assertThat(rejected.getValue().getReason()).isEqualTo("INVALID_AUTHENTICATION");
            assertThat(rejected.getValue().getBodyBytes()).isEqualTo(body.length);
            assertThat(rejected.getValue().getReceivedAt()).isEqualTo(now);
            nothingStored();
        }

        @Test
        void tc1996WhenTheRejectionMetadataCannotBeStoredTheCallIsStillUnauthorized() {
            byte[] body = valid();
            when(signatures.verify("1764126300", "v1=bad", body)).thenReturn(false);
            doThrow(new IllegalStateException("database down")).when(rejectedDeliveries).save(any());

            assertThatThrownBy(() -> service(now).receive("1764126300", "v1=bad", body))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
            nothingStored();
        }

        @Test
        void tcDuc190801MalformedJsonOrWrongFieldTypesGet400WithoutEvidence() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            List<byte[]> bodies = List.of(
                "{not json".getBytes(StandardCharsets.UTF_8),
                "{\"id\":\"7001\",\"transferAmount\":1200000,\"transactionDate\":\"2026-11-26 10:00:00\",\"transferType\":\"in\"}".getBytes(StandardCharsets.UTF_8),
                "{\"id\":7001,\"transactionDate\":\"2026-11-26 10:00:00\",\"transferType\":\"in\"}".getBytes(StandardCharsets.UTF_8),
                "{\"id\":7001,\"transferAmount\":1200000,\"transactionDate\":\"2026-11-26 10:00:00\",\"transferType\":\"in\",\"code\":12}".getBytes(StandardCharsets.UTF_8));
            for (byte[] body : bodies) {
                assertThatThrownBy(() -> deliver(body))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
            }
            nothingStored();
        }

        @Test
        void tcDuc190802AZeroAmountOrAnUnknownDirectionGets400WithoutEvidence() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);

            for (byte[] body : List.of(body(7_001L, "0", "2026-11-26 10:00:00", "in", null, "x", "0123456789"),
                body(7_001L, "1200000", "2026-11-26 10:00:00", "sideways", null, "x", "0123456789"),
                body(7_001L, "1200000", "26/11/2026", "in", null, "x", "0123456789"))) {
                assertThatThrownBy(() -> deliver(body))
                    .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
            }
            nothingStored();
        }

        @Test
        void tc1983AValidDeliveryIsAcknowledgedAfterStoringReceivedEvidenceAndOnePendingJobWithoutPayingYet() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            List<BankTransferEvidence> stored = storeNew();
            ArgumentCaptor<BankEvidenceJob> job = ArgumentCaptor.forClass(BankEvidenceJob.class);

            WebhookResult result = deliver(valid());

            assertThat(result).isEqualTo(new WebhookResult(true, false, EVIDENCE_ID, "RECEIVED", null));
            BankTransferEvidence evidence = stored.get(0);
            assertThat(evidence.getProvider()).isEqualTo("SEPAY");
            assertThat(evidence.getEnvironment()).isEqualTo("MOCK");
            assertThat(evidence.getAccountNamespace()).isEqualTo("LOCAL-MOCK");
            assertThat(evidence.getAuthOutcome()).isEqualTo("VERIFIED");
            assertThat(evidence.getDeliveryAttempts()).isEqualTo(1);
            assertThat(evidence.getFirstReceivedAt()).isEqualTo(now);
            assertThat(evidence.getTransferDirection()).isEqualTo("IN");
            assertThat(evidence.getAmount()).isEqualByComparingTo("1200000");
            verify(processingJobs).saveAndFlush(job.capture());
            assertThat(job.getValue().getStatus()).isEqualTo("PENDING");
            assertThat(job.getValue().getAvailableAt()).isEqualTo(now);
            assertThat(job.getValue().getLeaseUntil()).isNull();
            assertThat(job.getValue().getEvidence()).isSameAs(evidence);
            verifyNoInteractions(payments, subscriptions, farms, audit, mail);
        }

        @Test
        void tcDuc190803ThePaymentCodeIsReadCaseInsensitivelyAndALocalBankTimeIsUtcPlus7() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            List<BankTransferEvidence> stored = storeNew();

            deliver(valid());

            assertThat(stored.get(0).getQuoteRef()).isEqualTo("BC1A2B3C4D5E6F");
            assertThat(stored.get(0).getBankPaidAt()).isEqualTo(vn(2026, 11, 26, 10, 0));
            assertThat(stored.get(0).isConflictingReferences()).isFalse();
        }

        @Test
        void tc1989TwoDifferentCodesInOneTransferChooseNoRequest() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            List<BankTransferEvidence> stored = storeNew();

            deliver(body(7_001L, "1200000", "2026-11-26T03:00:00Z", "IN", "BC1A2B3C4D5E6F", "BC9Z9Z9Z9Z9Z9Z chuyen tien", "0123456789"));

            assertThat(stored.get(0).getQuoteRef()).isNull();
            assertThat(stored.get(0).isConflictingReferences()).isTrue();
        }

        @Test
        void tc1985ARepeatedDeliveryReturnsTheStoredEvidenceAndOnlyCountsTheAttempt() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            BankTransferEvidence existing = new BankTransferEvidence();
            existing.setId(EVIDENCE_ID);
            existing.setPayloadHash("hash-of-the-first-text");
            existing.setAmount(new BigDecimal("1200000.00"));
            existing.setTransferDirection("IN");
            existing.setBankPaidAt(vn(2026, 11, 26, 10, 0));
            existing.setReceivingAccount("0123-456-789");
            existing.setReviewStatus("ACCEPTED");
            when(evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId("SEPAY", "MOCK", "LOCAL-MOCK", 7_001L))
                .thenReturn(Optional.of(existing));
            when(evidenceRepository.lockById(EVIDENCE_ID)).thenReturn(Optional.of(existing));

            WebhookResult result = deliver(valid());

            assertThat(result.duplicate()).isTrue();
            assertThat(result.evidenceId()).isEqualTo(EVIDENCE_ID);
            assertThat(result.reviewStatus()).isEqualTo("ACCEPTED");
            verify(evidenceRepository).countRepeatedDelivery(EVIDENCE_ID);
            verify(evidenceRepository, never()).saveAndFlush(any());
            verifyNoInteractions(processingJobs);
        }

        @Test
        void tcDuc190804TheSameTransactionIdWithAnotherAmountGets409() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            BankTransferEvidence existing = new BankTransferEvidence();
            existing.setId(EVIDENCE_ID);
            existing.setPayloadHash("hash-of-the-first-text");
            existing.setAmount(BigDecimal.valueOf(1_000_000));
            existing.setTransferDirection("IN");
            existing.setBankPaidAt(vn(2026, 11, 26, 10, 0));
            existing.setReceivingAccount("0123456789");
            when(evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId("SEPAY", "MOCK", "LOCAL-MOCK", 7_001L))
                .thenReturn(Optional.of(existing));
            when(evidenceRepository.lockById(EVIDENCE_ID)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> deliver(valid()))
                .isInstanceOfSatisfying(ResponseStatusException.class, error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
            verify(evidenceRepository, never()).countRepeatedDelivery(anyLong());
            verify(evidenceRepository, never()).saveAndFlush(any());
        }

        @Test
        void tcDuc190805AConcurrentFirstDeliveryThatWinsTheUniqueKeyIsAnsweredAsAReplay() {
            when(signatures.verify(eq("1764126300"), eq("v1=good"), any())).thenReturn(true);
            BankTransferEvidence winner = new BankTransferEvidence();
            winner.setId(EVIDENCE_ID);
            winner.setAmount(BigDecimal.valueOf(1_200_000));
            winner.setTransferDirection("IN");
            winner.setBankPaidAt(vn(2026, 11, 26, 10, 0));
            winner.setReceivingAccount("0123456789");
            winner.setReviewStatus("RECEIVED");
            when(evidenceRepository.findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId("SEPAY", "MOCK", "LOCAL-MOCK", 7_001L))
                .thenReturn(Optional.empty(), Optional.of(winner));
            when(evidenceRepository.saveAndFlush(any(BankTransferEvidence.class))).thenThrow(new DataIntegrityViolationException("duplicate key"));
            when(evidenceRepository.lockById(EVIDENCE_ID)).thenReturn(Optional.of(winner));

            WebhookResult result = deliver(valid());

            assertThat(result.duplicate()).isTrue();
            assertThat(result.evidenceId()).isEqualTo(EVIDENCE_ID);
            verify(evidenceRepository).countRepeatedDelivery(EVIDENCE_ID);
        }
    }
}
