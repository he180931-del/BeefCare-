package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HealthObservation;

/**
 * Spring Data JPA repository for the HealthObservation entity.
 */
@SuppressWarnings("unused")
@Repository
public interface HealthObservationRepository extends JpaRepository<HealthObservation, Long> {}
