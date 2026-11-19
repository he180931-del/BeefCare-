package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ManagerPermission;

/**
 * Spring Data JPA repository for the ManagerPermission entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ManagerPermissionRepository extends JpaRepository<ManagerPermission, Long> {}
