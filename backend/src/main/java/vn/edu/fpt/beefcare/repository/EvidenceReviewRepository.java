package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.EvidenceReview;

@Repository
public interface EvidenceReviewRepository extends JpaRepository<EvidenceReview, Long> {
    List<EvidenceReview> findAllByEvidence_IdOrderByReviewedAtDescIdDesc(Long evidenceId);
}
