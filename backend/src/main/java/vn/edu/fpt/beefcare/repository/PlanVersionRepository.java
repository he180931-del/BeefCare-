package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PlanVersion;

/**
 * Spring Data JPA repository for the PlanVersion entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PlanVersionRepository extends JpaRepository<PlanVersion, Long> {}
