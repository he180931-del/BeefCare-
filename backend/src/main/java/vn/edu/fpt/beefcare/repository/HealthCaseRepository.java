package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HealthCase;

/**
 * Spring Data JPA repository for the HealthCase entity.
 */
@SuppressWarnings("unused")
@Repository
public interface HealthCaseRepository extends JpaRepository<HealthCase, Long> {}
