package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Farm;

/**
 * Spring Data JPA repository for the Farm entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmRepository extends JpaRepository<Farm, Long> {}
