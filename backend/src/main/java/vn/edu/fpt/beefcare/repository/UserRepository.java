package vn.edu.fpt.beefcare.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.User;

/**
 * Spring Data JPA repository for the {@link User} entity.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findOneByActivationKey(String activationKey);
    List<User> findAllByActivatedIsFalseAndActivationKeyIsNotNullAndCreatedDateBefore(Instant dateTime);
    Optional<User> findOneByResetKey(String resetKey);
    Optional<User> findOneByEmailIgnoreCase(String email);

    /** Serializes account-link issuance and other per-identity security transitions. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    /** Acquires the identity lock before resend eligibility is evaluated, avoiding a stale pre-lock snapshot. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findOneByEmailIgnoreCaseForUpdate(@Param("email") String email);

    /** Acquires the same identity lock when the public login is the username rather than the email. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where lower(u.login) = lower(:login)")
    Optional<User> findOneByLoginForUpdate(@Param("login") String login);
    Optional<User> findOneByEmailIgnoreCaseAndActivatedTrue(String email);
    Optional<User> findOneByLogin(String login);

    @EntityGraph(attributePaths = "authorities")
    Optional<User> findOneWithAuthoritiesByLogin(String login);

    @EntityGraph(attributePaths = "authorities")
    Optional<User> findOneWithAuthoritiesByEmailIgnoreCase(String email);

    Page<User> findAllByIdNotNullAndActivatedIsTrue(Pageable pageable);

    /** SCR-16 (D31): which of these lower-cased emails belong to a verified (activated) sign-in identity, in one query. */
    @org.springframework.data.jpa.repository.Query("select lower(u.email) from User u where u.activated = true and lower(u.email) in :emails")
    java.util.Set<String> findActivatedEmails(@org.springframework.data.repository.query.Param("emails") java.util.Collection<String> emails);
}
