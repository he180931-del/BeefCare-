package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.User;
import vn.edu.fpt.beefcare.repository.AppUserRepository;
import vn.edu.fpt.beefcare.repository.UserRepository;

@IntegrationTest
@Timeout(60)
@TestPropertySource(properties = "spring.datasource.hikari.maximum-pool-size=10")
class PasswordAttemptConcurrencyPostgresIT {

    @Autowired IdentityService identityService;
    @Autowired AppUserRepository appUsers;
    @Autowired UserRepository users;
    @Autowired PlatformTransactionManager transactions;
    @Autowired EntityManager entityManager;
    @MockitoSpyBean UserRepository userRepositorySpy;

    private volatile String interleavedEmail;
    private volatile CyclicBarrier legacyReadBarrier;
    private final ThreadLocal<Boolean> workerCall = new ThreadLocal<>();

    @Test
    void concurrentFailedAttemptsReachFiveWithoutLostUpdates() throws Exception {
        String email = givenActivePasswordAccount("password-attempt-race");
        CyclicBarrier attemptsStarted = new CyclicBarrier(5);
        legacyReadBarrier = new CyclicBarrier(5);
        interleavedEmail = email;
        installLegacyReadInterleaving();
        ExecutorService workers = Executors.newFixedThreadPool(5);
        try {
            List<Future<AttemptOutcome>> results = java.util.stream.IntStream.range(0, 5)
                .mapToObj(index -> workers.submit(() -> recordFailedAttempt(attemptsStarted, email)))
                .toList();
            List<AttemptOutcome> outcomes = results.stream().map(this::get).toList();

            assertThat(outcomes).as("worker failures: %s", outcomes).allMatch(AttemptOutcome::successful);
            User stored = readUser(email);
            assertThat(stored.getFailedPasswordAttempts()).isEqualTo(5);
            assertThat(outcomes).filteredOn(outcome -> outcome.lockedUntil() != null).hasSize(1);
            assertThat(stored.getPasswordLockedUntil()).isNotNull();
            assertThat(Duration.between(Instant.now(), stored.getPasswordLockedUntil()))
                .isBetween(Duration.ofMinutes(14).minusSeconds(5), Duration.ofMinutes(15).plusSeconds(5));
        } finally {
            workers.shutdownNow();
            legacyReadBarrier = null;
            interleavedEmail = null;
        }
    }

    @Test
    void lockedIdentityRejectsTheNextPasswordCheckAndExpiredLockClearsState() {
        String email = givenActivePasswordAccount("password-attempt-boundary");
        User locked = readUser(email);
        locked.setFailedPasswordAttempts(5);
        locked.setPasswordLockedUntil(Instant.now().plusSeconds(60));
        users.saveAndFlush(locked);

        assertThatThrownBy(() -> identityService.checkPasswordSignInAllowed(email))
            .isInstanceOfSatisfying(DomainException.class, failure -> {
                assertThat(failure.getCode()).isEqualTo(MessageCodes.FE01_02);
                assertThat(failure.getParams()).containsKey("time");
            });
        assertThat(readUser(email)).satisfies(user -> {
            assertThat(user.getFailedPasswordAttempts()).isEqualTo(5);
            assertThat(user.getPasswordLockedUntil()).isNotNull();
        });

        User expired = readUser(email);
        expired.setPasswordLockedUntil(Instant.now().minusSeconds(1));
        users.saveAndFlush(expired);
        identityService.checkPasswordSignInAllowed(email);
        assertThat(readUser(email)).satisfies(user -> {
            assertThat(user.getFailedPasswordAttempts()).isZero();
            assertThat(user.getPasswordLockedUntil()).isNull();
        });

        identityService.clearFailedPasswordAttempts(email);
        identityService.clearFailedPasswordAttempts(email);
        assertThat(readUser(email)).satisfies(user -> {
            assertThat(user.getFailedPasswordAttempts()).isZero();
            assertThat(user.getPasswordLockedUntil()).isNull();
        });
    }

    private AttemptOutcome recordFailedAttempt(CyclicBarrier attemptsStarted, String email) {
        workerCall.set(true);
        try {
            awaitBarrier(attemptsStarted);
            Optional<Instant> lockedUntil = identityService.recordFailedPasswordAttempt(email);
            return new AttemptOutcome(true, lockedUntil.orElse(null), null);
        } catch (Throwable failure) {
            return new AttemptOutcome(false, null, failure.toString());
        } finally {
            workerCall.remove();
        }
    }

    private void installLegacyReadInterleaving() {
        // This hook only releases the five-way race when the current implementation calls the legacy
        // non-locking email lookup. A future implementation that locks/CASes at the repository boundary
        // can bypass this hook and complete normally; no transaction is held at a test barrier.
        doAnswer(invocation -> {
            String requestedEmail = invocation.getArgument(0, String.class);
            if (
                Boolean.TRUE.equals(workerCall.get()) &&
                interleavedEmail != null &&
                interleavedEmail.equalsIgnoreCase(requestedEmail) &&
                legacyReadBarrier != null
            ) {
                awaitBarrier(legacyReadBarrier);
            }
            return entityManager
                .createQuery("select u from User u where lower(u.email) = lower(:email)", User.class)
                .setParameter("email", requestedEmail)
                .getResultStream()
                .findFirst();
        }).when(userRepositorySpy).findOneByEmailIgnoreCase(anyString());
    }

    private String givenActivePasswordAccount(String label) {
        String email = label + "-" + UUID.randomUUID() + "@example.test";
        identityService.register("Password Attempt Owner", email, "SomeStrongPass9", "SomeStrongPass9", true);
        User user = users.findOneByEmailIgnoreCase(email).orElseThrow();
        user.setActivated(true);
        users.saveAndFlush(user);
        AppUser account = appUsers.findOneByEmailIgnoreCase(email).orElseThrow();
        account.setPasswordLoginEnabled(true);
        account.setPasswordMethodStatus("ACTIVE");
        appUsers.saveAndFlush(account);
        return email;
    }

    private User readUser(String email) {
        return new TransactionTemplate(transactions).execute(status -> users.findOneByEmailIgnoreCase(email).orElseThrow());
    }

    private AttemptOutcome get(Future<AttemptOutcome> result) {
        try {
            return result.get(20, TimeUnit.SECONDS);
        } catch (Exception failure) {
            throw new AssertionError("Concurrent failed-password attempt did not finish", failure);
        }
    }

    private static void awaitBarrier(CyclicBarrier barrier) {
        try {
            barrier.await(15, TimeUnit.SECONDS);
        } catch (Exception failure) {
            throw new AssertionError("All failed-password attempts must reach the barrier", failure);
        }
    }

    private record AttemptOutcome(boolean successful, Instant lockedUntil, String failure) {}
}
