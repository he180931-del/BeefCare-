package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;

/**
 * Spring Data JPA repository for the PlatformStaffAccess entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PlatformStaffAccessRepository extends JpaRepository<PlatformStaffAccess, Long> {}
