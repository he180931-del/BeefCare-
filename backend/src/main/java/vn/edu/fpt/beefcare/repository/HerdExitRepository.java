package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HerdExit;

/**
 * Spring Data JPA repository for the HerdExit entity.
 */
@SuppressWarnings("unused")
@Repository
public interface HerdExitRepository extends JpaRepository<HerdExit, Long> {}
