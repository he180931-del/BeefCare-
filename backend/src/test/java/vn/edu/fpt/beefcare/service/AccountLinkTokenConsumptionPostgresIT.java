package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.domain.AccountLinkToken;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

@IntegrationTest
@Timeout(50)
class AccountLinkTokenConsumptionPostgresIT {

    @Autowired IdentityService identityService;
    @Autowired AccountLinkTokenRepository tokens;
    @Autowired UserRepository users;
    @Autowired ActionLinkSigner signer;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void concurrentActivationRequestsAllowExactlyOneSuccessAndOneExistingInvalidLink() throws Exception {
        String email = uniqueEmail("token-race");
        AccountLinkToken link = latestLink(email, IdentityService.EMAIL_VERIFICATION);
        String rawToken = rawToken(link, IdentityService.EMAIL_VERIFICATION);
        CyclicBarrier transactionsStarted = new CyclicBarrier(2);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            List<Future<ActivationOutcome>> results = List.of(
                workers.submit(activateInTransaction(transactionsStarted, rawToken)),
                workers.submit(activateInTransaction(transactionsStarted, rawToken))
            );
            List<ActivationOutcome> outcomes = results.stream().map(this::get).toList();

            assertThat(outcomes).filteredOn(ActivationOutcome::success).hasSize(1);
            assertThat(outcomes).filteredOn(outcome -> !outcome.success()).singleElement().satisfies(outcome -> {
                assertThat(outcome.domainException()).isTrue();
                assertThat(outcome.code()).isEqualTo(MessageCodes.FE01_06);
                assertThat(outcome.secretLeaked()).isFalse();
            });
            assertThat(readUsedAt(link)).isNotNull();
        } finally {
            workers.shutdownNow();
        }
    }

    @Test
    void compareAndSetRejectsExpiredAtOrBeforeNowAndAcceptsFutureExpiry() {
        Instant now = Instant.now();
        AccountLinkToken exact = latestLink(uniqueEmail("token-boundary-exact"), IdentityService.EMAIL_VERIFICATION);
        AccountLinkToken past = latestLink(uniqueEmail("token-boundary-past"), IdentityService.EMAIL_VERIFICATION);
        AccountLinkToken future = latestLink(uniqueEmail("token-boundary-future"), IdentityService.EMAIL_VERIFICATION);
        setExpiry(exact, now);
        setExpiry(past, now.minusNanos(1));
        setExpiry(future, now.plusSeconds(1));

        assertThat(claim(exact, now)).isZero();
        assertThat(claim(past, now)).isZero();
        assertThat(claim(future, now)).isEqualTo(1);
        assertThat(readUsedAt(exact)).isNull();
        assertThat(readUsedAt(past)).isNull();
        assertThat(readUsedAt(future)).isNotNull();
    }

    @Test
    void invalidPasswordAfterResetTokenConsumeRollsBackUsedAtAndAllowsRetry() {
        String email = uniqueEmail("token-reset-rollback");
        AccountLinkToken verification = latestLink(email, IdentityService.EMAIL_VERIFICATION);
        identityService.activateEmail(rawToken(verification, IdentityService.EMAIL_VERIFICATION));
        identityService.requestPasswordReset(email);
        AccountLinkToken reset = latestLink(email, IdentityService.PASSWORD_RESET);
        String rawResetToken = rawToken(reset, IdentityService.PASSWORD_RESET);

        assertThatThrownBy(() -> identityService.completePasswordReset(rawResetToken, "short", "short"))
            .isInstanceOfSatisfying(DomainException.class, failure -> assertThat(failure.getCode()).isEqualTo(MessageCodes.FE01_08));
        assertThat(readUsedAt(reset)).isNull();

        identityService.completePasswordReset(rawResetToken, "ValidResetPass9", "ValidResetPass9");
        assertThat(readUsedAt(reset)).isNotNull();
    }

    @Test
    void concurrentResendAndActivationShareUserThenTokenLockWithoutDeadlock() throws Exception {
        String email = uniqueEmail("token-resend-activation");
        AccountLinkToken link = latestLink(email, IdentityService.EMAIL_VERIFICATION);
        ageCreatedAt(link, Instant.now().minusSeconds(61));
        String rawToken = rawToken(link, IdentityService.EMAIL_VERIFICATION);
        long userId = users.findOneByEmailIgnoreCase(email).orElseThrow().getId();
        CyclicBarrier transactionsStarted = new CyclicBarrier(2);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            List<Future<FlowOutcome>> results = List.of(
                workers.submit(() -> runFlow(transactionsStarted, () -> identityService.activateEmail(rawToken))),
                workers.submit(() -> runFlow(transactionsStarted, () -> identityService.resendVerification(email)))
            );
            FlowOutcome activation = getFlow(results.get(0));
            FlowOutcome resend = getFlow(results.get(1));

            assertThat(resend.success()).isTrue();
            assertThat(activation.success() || MessageCodes.FE01_06.equals(activation.code())).isTrue();
            if (activation.success()) {
                assertThat(linksFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
                assertThat(unusedLinksFor(userId, IdentityService.EMAIL_VERIFICATION)).isEmpty();
            } else {
                assertThat(linksFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(2);
                assertThat(unusedLinksFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
            }
            assertThat(usedLinksFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
        } finally {
            workers.shutdownNow();
        }
    }

    @Test
    void concurrentResetIssuanceAndCompletionShareUserThenTokenLockWithoutDeadlock() throws Exception {
        String email = uniqueEmail("token-reset-issuance");
        AccountLinkToken verification = latestLink(email, IdentityService.EMAIL_VERIFICATION);
        identityService.activateEmail(rawToken(verification, IdentityService.EMAIL_VERIFICATION));
        identityService.requestPasswordReset(email);
        AccountLinkToken reset = latestLink(email, IdentityService.PASSWORD_RESET);
        ageCreatedAt(reset, Instant.now().minusSeconds(61));
        String rawResetToken = rawToken(reset, IdentityService.PASSWORD_RESET);
        long userId = users.findOneByEmailIgnoreCase(email).orElseThrow().getId();
        CyclicBarrier transactionsStarted = new CyclicBarrier(2);
        ExecutorService workers = Executors.newFixedThreadPool(2);
        try {
            List<Future<FlowOutcome>> results = List.of(
                workers.submit(() -> runFlow(transactionsStarted, () -> identityService.completePasswordReset(rawResetToken, "ValidResetPass99", "ValidResetPass99"))),
                workers.submit(() -> runFlow(transactionsStarted, () -> identityService.requestPasswordReset(email)))
            );
            List<FlowOutcome> outcomes = results.stream().map(this::getFlow).toList();

            assertThat(outcomes).anyMatch(FlowOutcome::success);
            assertThat(outcomes).allMatch(outcome -> outcome.success() || MessageCodes.FE01_06.equals(outcome.code()));
            assertThat(linksFor(userId, IdentityService.PASSWORD_RESET)).hasSize(2);
            assertThat(unusedLinksFor(userId, IdentityService.PASSWORD_RESET)).hasSize(1);
            assertThat(usedLinksFor(userId, IdentityService.PASSWORD_RESET)).hasSize(1);
        } finally {
            workers.shutdownNow();
        }
    }

    private Callable<ActivationOutcome> activateInTransaction(CyclicBarrier transactionsStarted, String rawToken) {
        return () -> {
            try {
                new TransactionTemplate(transactions).executeWithoutResult(status -> {
                    if (!TransactionSynchronizationManager.isActualTransactionActive()) {
                        throw new AssertionError("The activation worker did not start a transaction");
                    }
                    await(transactionsStarted);
                    identityService.activateEmail(rawToken);
                });
                return new ActivationOutcome(true, false, null, false);
            } catch (DomainException failure) {
                return new ActivationOutcome(false, true, failure.getCode(), failure.getMessage().contains(rawToken) || failure.getParams().containsValue(rawToken));
            }
        };
    }

    private String uniqueEmail(String label) {
        String email = label + "-" + UUID.randomUUID() + "@example.test";
        identityService.register("Token Test Owner", email, "SomeStrongPass9", "SomeStrongPass9", true);
        return email;
    }

    private AccountLinkToken latestLink(String email, String type) {
        var user = users.findOneByEmailIgnoreCase(email).orElseThrow();
        return tokens.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(user.getId(), type).orElseThrow();
    }

    private String rawToken(AccountLinkToken link, String type) {
        return signer.bearer("ACCOUNT_LINK:" + type, link.getId(), link.getTokenNonce());
    }

    private void setExpiry(AccountLinkToken link, Instant expiresAt) {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            AccountLinkToken managed = tokens.findById(link.getId()).orElseThrow();
            managed.setExpiresAt(expiresAt);
            tokens.saveAndFlush(managed);
        });
    }

    private void ageCreatedAt(AccountLinkToken link, Instant createdAt) {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            AccountLinkToken managed = tokens.findById(link.getId()).orElseThrow();
            managed.setCreatedAt(createdAt);
            tokens.saveAndFlush(managed);
        });
    }

    private int claim(AccountLinkToken link, Instant now) {
        return new TransactionTemplate(transactions).execute(status -> tokens.consumeIfValid(link.getTokenHash(), link.getTokenType(), now));
    }

    private Instant readUsedAt(AccountLinkToken link) {
        return new TransactionTemplate(transactions).execute(status -> tokens.findById(link.getId()).orElseThrow().getUsedAt());
    }

    private List<AccountLinkToken> linksFor(long userId, String type) {
        return tokens.findAll().stream().filter(link -> link.getUser().getId().equals(userId)).filter(link -> type.equals(link.getTokenType())).toList();
    }

    private List<AccountLinkToken> unusedLinksFor(long userId, String type) {
        return linksFor(userId, type).stream().filter(link -> link.getUsedAt() == null).toList();
    }

    private List<AccountLinkToken> usedLinksFor(long userId, String type) {
        return linksFor(userId, type).stream().filter(link -> link.getUsedAt() != null).toList();
    }

    private FlowOutcome runFlow(CyclicBarrier barrier, Runnable operation) {
        try {
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                if (!TransactionSynchronizationManager.isActualTransactionActive()) {
                    throw new AssertionError("The cross-flow worker did not start a transaction");
                }
                await(barrier);
                operation.run();
            });
            return new FlowOutcome(true, null);
        } catch (DomainException failure) {
            return new FlowOutcome(false, failure.getCode());
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(10, TimeUnit.SECONDS);
        } catch (Exception failure) {
            throw new AssertionError("Both activation transactions must reach the barrier", failure);
        }
    }

    private ActivationOutcome get(Future<ActivationOutcome> result) {
        try {
            return result.get(15, TimeUnit.SECONDS);
        } catch (Exception failure) {
            throw new AssertionError("Concurrent activation request failed", failure);
        }
    }

    private FlowOutcome getFlow(Future<FlowOutcome> result) {
        try {
            return result.get(15, TimeUnit.SECONDS);
        } catch (Exception failure) {
            throw new AssertionError("Concurrent cross-flow request failed", failure);
        }
    }

    private record ActivationOutcome(boolean success, boolean domainException, String code, boolean secretLeaked) {}

    private record FlowOutcome(boolean success, String code) {}
}
