package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Cattle;

/**
 * Spring Data JPA repository for the Cattle entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CattleRepository extends JpaRepository<Cattle, Long> {}
