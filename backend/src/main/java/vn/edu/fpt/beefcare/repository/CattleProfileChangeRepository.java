package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CattleProfileChange;

/**
 * Spring Data JPA repository for the CattleProfileChange entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CattleProfileChangeRepository extends JpaRepository<CattleProfileChange, Long> {}
