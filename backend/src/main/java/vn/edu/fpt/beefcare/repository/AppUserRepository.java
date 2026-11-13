package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.repository.query.Param;
import vn.edu.fpt.beefcare.domain.AppUser;

/**
 * Spring Data JPA repository for the AppUser entity.
 */
@SuppressWarnings("unused")
@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long>, JpaSpecificationExecutor<AppUser> {
    Optional<AppUser> findOneByEmailIgnoreCase(String email);
    Optional<AppUser> findOneByGoogleSubject(String googleSubject);

    /** Existence hint for one invitation; does not load the account (and its inverse one-to-one platform access). */
    boolean existsByEmailIgnoreCase(String email);

    /** Only the existence hint for one visible invitation page; never expose platform account state. */
    @Query("select lower(u.email) from AppUser u where lower(u.email) in :emails")
    java.util.Set<String> findExistingInvitationEmails(@Param("emails") java.util.Collection<String> emails);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AppUser u where u.id = :id")
    Optional<AppUser> findByIdForUpdate(@Param("id") Long id);
}
