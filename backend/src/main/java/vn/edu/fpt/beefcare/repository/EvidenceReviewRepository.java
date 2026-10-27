package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.EvidenceReview;

/**
 * Spring Data JPA repository for the EvidenceReview entity.
 */
@SuppressWarnings("unused")
@Repository
public interface EvidenceReviewRepository extends JpaRepository<EvidenceReview, Long> {}
