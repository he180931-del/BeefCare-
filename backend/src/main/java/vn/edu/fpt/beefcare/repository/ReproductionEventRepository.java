package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;

/**
 * Spring Data JPA repository for the ReproductionEvent entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ReproductionEventRepository extends JpaRepository<ReproductionEvent, Long> {}
