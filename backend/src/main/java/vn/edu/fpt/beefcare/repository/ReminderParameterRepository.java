package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ReminderParameter;

/**
 * Spring Data JPA repository for the ReminderParameter entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ReminderParameterRepository extends JpaRepository<ReminderParameter, Long> {}
