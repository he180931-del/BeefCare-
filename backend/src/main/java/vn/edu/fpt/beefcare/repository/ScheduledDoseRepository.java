package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ScheduledDose;

/**
 * Spring Data JPA repository for the ScheduledDose entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ScheduledDoseRepository extends JpaRepository<ScheduledDose, Long> {}
