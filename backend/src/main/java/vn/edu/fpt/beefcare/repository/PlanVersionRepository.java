package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import vn.edu.fpt.beefcare.domain.PlanVersion;

/**
 * Spring Data JPA repository for the PlanVersion entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PlanVersionRepository extends JpaRepository<PlanVersion, Long> {
    Optional<PlanVersion> findFirstByEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(Instant at);
    List<PlanVersion> findAllByOrderByEffectiveAtDescIdDesc();
    boolean existsByEffectiveAt(Instant at);
}
