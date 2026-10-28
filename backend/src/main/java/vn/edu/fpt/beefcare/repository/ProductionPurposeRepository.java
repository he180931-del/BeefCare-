package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;

/**
 * Spring Data JPA repository for the ProductionPurpose entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ProductionPurposeRepository extends JpaRepository<ProductionPurpose, Long> {}
