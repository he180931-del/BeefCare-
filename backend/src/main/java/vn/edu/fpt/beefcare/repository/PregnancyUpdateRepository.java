package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PregnancyUpdate;

/**
 * Spring Data JPA repository for the PregnancyUpdate entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PregnancyUpdateRepository extends JpaRepository<PregnancyUpdate, Long> {}
