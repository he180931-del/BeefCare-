package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CalfOutcome;

/**
 * Spring Data JPA repository for the CalfOutcome entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CalfOutcomeRepository extends JpaRepository<CalfOutcome, Long> {}
