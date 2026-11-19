package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CalvingEvent;

/**
 * Spring Data JPA repository for the CalvingEvent entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CalvingEventRepository extends JpaRepository<CalvingEvent, Long> {}
