package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Vaccine;

/**
 * Spring Data JPA repository for the Vaccine entity.
 */
@SuppressWarnings("unused")
@Repository
public interface VaccineRepository extends JpaRepository<Vaccine, Long> {}
