package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Treatment;

/**
 * Spring Data JPA repository for the Treatment entity.
 */
@SuppressWarnings("unused")
@Repository
public interface TreatmentRepository extends JpaRepository<Treatment, Long> {}
