package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PenReceptionCriteria;

/**
 * Spring Data JPA repository for the PenReceptionCriteria entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PenReceptionCriteriaRepository extends JpaRepository<PenReceptionCriteria, Long> {}
