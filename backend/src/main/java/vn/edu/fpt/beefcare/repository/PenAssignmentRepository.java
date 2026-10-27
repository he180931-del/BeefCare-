package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PenAssignment;

/**
 * Spring Data JPA repository for the PenAssignment entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PenAssignmentRepository extends JpaRepository<PenAssignment, Long> {}
