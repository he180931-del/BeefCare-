package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;

/**
 * Spring Data JPA repository for the PlatformStaffAccess entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PlatformStaffAccessRepository extends JpaRepository<PlatformStaffAccess, Long> {
    Optional<PlatformStaffAccess> findOneByUserId(Long userId);

    Optional<PlatformStaffAccess> findOneByUserIdAndStatusIgnoreCase(Long userId, String status);

    List<PlatformStaffAccess> findAllByRoleIgnoreCaseAndStatusIgnoreCase(String role, String status);

    long countByRoleIgnoreCaseAndStatusIgnoreCase(String role, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from PlatformStaffAccess a where a.user.id = :userId")
    Optional<PlatformStaffAccess> findOneByUserIdForUpdate(@Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<PlatformStaffAccess> findAllByRoleIgnoreCaseAndStatusIgnoreCaseOrderById(String role, String status);

    /**
     * BR-D06 (D32): ACTIVE SA access held by an ACTIVE account other than {@code excludedUserId}. A scalar query reads the
     * committed rows, not accounts already loaded in the persistence context, so it sees a change that committed while
     * this transaction waited for its row locks.
     */
    @Query(
        "select count(a) from PlatformStaffAccess a where upper(a.role) = 'SA' and upper(a.status) = 'ACTIVE' " +
        "and upper(a.user.accountStatus) = 'ACTIVE' and a.user.id <> :excludedUserId"
    )
    long countOtherActiveAdministrators(@Param("excludedUserId") Long excludedUserId);

    /** Whether {@code userId} still holds ACTIVE SA access on an ACTIVE account, read from the database (D32). */
    @Query(
        "select count(a) > 0 from PlatformStaffAccess a where upper(a.role) = 'SA' and upper(a.status) = 'ACTIVE' " +
        "and upper(a.user.accountStatus) = 'ACTIVE' and a.user.id = :userId"
    )
    boolean isActiveAdministrator(@Param("userId") Long userId);
}
