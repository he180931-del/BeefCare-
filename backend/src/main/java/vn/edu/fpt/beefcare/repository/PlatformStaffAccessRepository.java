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
}
