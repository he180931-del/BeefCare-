package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.domain.AccountLinkToken;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.EmailDeliveryJob;
import vn.edu.fpt.beefcare.repository.AccountLinkTokenRepository;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.EmailDeliveryJobRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;
import vn.edu.fpt.beefcare.service.email.ActionLinkSigner;

@IntegrationTest
@Timeout(90)
class AccountLinkTokenIssuancePostgresIT {

    @Autowired IdentityService identityService;
    @Autowired AccountLinkTokenRepository tokens;
    @Autowired EmailDeliveryJobRepository jobs;
    @Autowired UserRepository users;
    @Autowired AppUserRepository appUsers;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ActionLinkSigner signer;
    @SpyBean EmailDeliveryJobRepository jobSpy;

    @Test
    void concurrentVerificationResendsAfterCooldownCreateOneReplacementAndJob() throws Exception {
        String email = register("verification-race");
        long userId = userId(email);
        ageLatest(userId, IdentityService.EMAIL_VERIFICATION);
        CyclicBarrier requestsStarted = new CyclicBarrier(8);

        List<CallOutcome> outcomes = invokeConcurrently(8, requestsStarted, () -> identityService.resendVerification(email));

        assertThat(outcomes).allMatch(CallOutcome::successful);
        assertThat(tokensFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(2);
        assertThat(unusedTokensFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
        assertThat(jobCount(email, "VERIFY_EMAIL")).isEqualTo(2);
    }

    @Test
    void freshVerificationResendReturnsCooldownDeadlineWithoutIssuingAnotherLink() {
        String email = register("verification-cooldown");
        long userId = userId(email);
        Instant expected = tokens.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(userId, IdentityService.EMAIL_VERIFICATION).orElseThrow().getCreatedAt().plusSeconds(60);

        Instant retryAt = identityService.resendVerification(email);

        assertThat(retryAt).isBetween(expected.minusMillis(100), expected.plusMillis(100));
        assertThat(tokensFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
        assertThat(unusedTokensFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
        assertThat(jobCount(email, "VERIFY_EMAIL")).isEqualTo(1);
    }

    @Test
    void activatedAccountGetsGenericResendCooldownAndNoVerificationLink() {
        String email = register("verification-activated");
        long userId = userId(email);
        identityService.activateEmail(latest(email, IdentityService.EMAIL_VERIFICATION));
        Instant before = Instant.now();

        Instant retryAt = identityService.resendVerification(email);

        assertThat(retryAt).isBetween(before.plusSeconds(59), before.plusSeconds(61));
        assertThat(tokensFor(userId, IdentityService.EMAIL_VERIFICATION)).hasSize(1);
        assertThat(jobCount(email, "VERIFY_EMAIL")).isEqualTo(1);
    }

    @Test
    void concurrentResetRequestsAtFifthHourlyDecisionCreateNoSixthTokenOrJob() throws Exception {
        String email = register("reset-quota-race");
        identityService.activateEmail(latest(email, IdentityService.EMAIL_VERIFICATION));
        long userId = userId(email);
        identityService.requestPasswordReset(email);
        for (int sent = 1; sent < 4; sent++) {
            ageLatest(userId, IdentityService.PASSWORD_RESET);
            identityService.requestPasswordReset(email);
        }
        ageLatest(userId, IdentityService.PASSWORD_RESET);
        assertThat(tokensFor(userId, IdentityService.PASSWORD_RESET)).hasSize(4);

        CyclicBarrier requestsStarted = new CyclicBarrier(8);
        List<CallOutcome> outcomes = invokeConcurrently(8, requestsStarted, () -> identityService.requestPasswordReset(email));

        assertThat(outcomes).allMatch(CallOutcome::successful);
        assertThat(tokensFor(userId, IdentityService.PASSWORD_RESET)).hasSize(5);
        assertThat(unusedTokensFor(userId, IdentityService.PASSWORD_RESET)).hasSize(1);
        assertThat(jobCount(email, "RESET_PASSWORD")).isEqualTo(5);
    }

    @Test
    void outboxFailureRollsBackReplacementTokenAndInvalidation() {
        String email = register("reset-outbox-rollback");
        identityService.activateEmail(latest(email, IdentityService.EMAIL_VERIFICATION));
        long userId = userId(email);
        identityService.requestPasswordReset(email);
        ageLatest(userId, IdentityService.PASSWORD_RESET);
        int tokensBefore = tokensFor(userId, IdentityService.PASSWORD_RESET).size();
        int jobsBefore = jobsFor(email, "RESET_PASSWORD").size();
        doThrow(new IllegalStateException("injected outbox failure")).when(jobSpy).save(any(EmailDeliveryJob.class));

        assertThatThrownBy(() -> identityService.requestPasswordReset(email)).hasRootCauseInstanceOf(IllegalStateException.class);

        assertThat(tokensFor(userId, IdentityService.PASSWORD_RESET)).hasSize(tokensBefore);
        assertThat(unusedTokensFor(userId, IdentityService.PASSWORD_RESET)).hasSize(1);
        assertThat(jobsFor(email, "RESET_PASSWORD")).hasSize(jobsBefore);
    }

    @Test
    void registerOutboxFailureRollsBackIdentityTokenAndJob() {
        String email = "register-outbox-" + UUID.randomUUID() + "@example.test";
        doThrow(new IllegalStateException("injected registration outbox failure")).when(jobSpy).save(any(EmailDeliveryJob.class));

        assertThatThrownBy(() -> identityService.register("Registration Rollback", email, "SomeStrongPass9", "SomeStrongPass9", true))
            .hasRootCauseInstanceOf(IllegalStateException.class);

        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            assertThat(users.findOneByEmailIgnoreCase(email)).isEmpty();
            assertThat(appUsers.findOneByEmailIgnoreCase(email)).isEmpty();
            assertThat(tokens.findAll().stream().filter(link -> link.getUser() != null && email.equalsIgnoreCase(link.getUser().getEmail()))).isEmpty();
            assertThat(jobsFor(email, "VERIFY_EMAIL")).isEmpty();
        });
    }

    @Test
    void concurrentGoogleOnlyAdviceAtFifthHourlyDecisionCreateNoSixthJob() throws Exception {
        String email = googleOnly("google-advice-race");
        for (int sent = 0; sent < 4; sent++) identityService.requestPasswordReset(email);
        assertThat(adviceJobCount(email)).isEqualTo(4);
        CyclicBarrier requestsStarted = new CyclicBarrier(8);

        List<CallOutcome> outcomes = invokeConcurrently(8, requestsStarted, () -> identityService.requestPasswordReset(email));

        assertThat(outcomes).allMatch(CallOutcome::successful);
        assertThat(adviceJobCount(email)).isEqualTo(5);
    }

    private String register(String label) {
        String email = label + "-" + UUID.randomUUID() + "@example.test";
        identityService.register("Issuance Test Owner", email, "SomeStrongPass9", "SomeStrongPass9", true);
        return email;
    }

    private long userId(String email) {
        return users.findOneByEmailIgnoreCase(email).orElseThrow().getId();
    }

    private String latest(String email, String type) {
        AccountLinkToken link = tokens.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(userId(email), type).orElseThrow();
        return signer.bearer("ACCOUNT_LINK:" + type, link.getId(), link.getTokenNonce());
    }

    private void ageLatest(long userId, String type) {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            AccountLinkToken link = tokens.findFirstByUserIdAndTokenTypeOrderByCreatedAtDesc(userId, type).orElseThrow();
            link.setCreatedAt(Instant.now().minusSeconds(61));
            tokens.saveAndFlush(link);
        });
    }

    private List<AccountLinkToken> tokensFor(long userId, String type) {
        return tokens.findAll().stream().filter(link -> link.getUser().getId().equals(userId)).filter(link -> type.equals(link.getTokenType())).toList();
    }

    private List<AccountLinkToken> unusedTokensFor(long userId, String type) {
        return tokensFor(userId, type).stream().filter(link -> link.getUsedAt() == null).toList();
    }

    private List<EmailDeliveryJob> jobsFor(String email, String template) {
        return jobs.findAll().stream().filter(job -> email.equalsIgnoreCase(job.getRecipient())).filter(job -> template.equals(job.getTemplateKey())).toList();
    }

    private long jobCount(String email, String template) {
        return jobs.countByRecipientIgnoreCaseAndTemplateKeyAndCreatedAtAfter(email, template, Instant.EPOCH);
    }

    private long adviceJobCount(String email) {
        return jobCount(email, "GOOGLE_SIGN_IN_ADVICE");
    }

    private String googleOnly(String label) {
        String email = register(label);
        AppUser account = appUsers.findOneByEmailIgnoreCase(email).orElseThrow();
        account.setGoogleSubject("google-" + UUID.randomUUID());
        account.setPasswordLoginEnabled(false);
        appUsers.saveAndFlush(account);
        return email;
    }

    private List<CallOutcome> invokeConcurrently(int workers, CyclicBarrier barrier, ThrowingCall call) {
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        try {
            return java.util.stream.IntStream.range(0, workers).mapToObj(index -> executor.submit(() -> {
                try {
                    return new TransactionTemplate(transactions).execute(status -> {
                        if (!TransactionSynchronizationManager.isActualTransactionActive()) throw new AssertionError("request transaction missing");
                        await(barrier);
                        call.run();
                        return new CallOutcome(true, null);
                    });
                } catch (Throwable failure) {
                    return new CallOutcome(false, failure);
                }
            })).toList().stream().map(future -> {
                try {
                    return future.get(30, TimeUnit.SECONDS);
                } catch (Exception failure) {
                    throw new AssertionError("Concurrent issuance request failed", failure);
                }
            }).toList();
        } finally {
            executor.shutdownNow();
        }
    }

    private static void await(CyclicBarrier barrier) {
        try {
            barrier.await(20, TimeUnit.SECONDS);
        } catch (Exception failure) {
            throw new AssertionError("All issuance requests must reach the barrier", failure);
        }
    }

    @FunctionalInterface
    private interface ThrowingCall { void run(); }

    private record CallOutcome(boolean successful, Throwable failure) {}

}
