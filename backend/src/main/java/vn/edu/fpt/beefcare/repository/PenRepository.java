package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Pen;

/**
 * Spring Data JPA repository for the Pen entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PenRepository extends JpaRepository<Pen, Long> {}
