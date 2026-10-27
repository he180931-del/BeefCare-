package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CattleQrTag;

/**
 * Spring Data JPA repository for the CattleQrTag entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CattleQrTagRepository extends JpaRepository<CattleQrTag, Long> {}
