package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;

/**
 * Spring Data JPA repository for the VaccinationSchedule entity.
 */
@SuppressWarnings("unused")
@Repository
public interface VaccinationScheduleRepository extends JpaRepository<VaccinationSchedule, Long> {}
