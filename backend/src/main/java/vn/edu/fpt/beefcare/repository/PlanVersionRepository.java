package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.edu.fpt.beefcare.domain.PlanVersion;

/**
 * Spring Data JPA repository for the PlanVersion entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PlanVersionRepository extends JpaRepository<PlanVersion, Long> {
    Optional<PlanVersion> findFirstByWithdrawnAtIsNullAndEffectiveAtLessThanEqualOrderByEffectiveAtDescIdDesc(Instant at);
    Optional<PlanVersion> findFirstByWithdrawnAtIsNullAndEffectiveAtGreaterThanOrderByEffectiveAtAscIdAsc(Instant at);
    Optional<PlanVersion> findFirstByWithdrawnAtIsNullAndEffectiveAt(Instant at);
    /**
     * Publisher and withdrawer are fetched with the page (one query, not one per user). AppUser's inverse
     * {@code @OneToOne(mappedBy)} platformStaffAccess cannot be proxied, so it is joined here instead of selected per user.
     */
    @EntityGraph(attributePaths = {"publishedBy", "publishedBy.platformStaffAccess", "withdrawnBy", "withdrawnBy.platformStaffAccess"})
    @Query(value = "select p from PlanVersion p order by p.publishedAt desc nulls last, p.id desc", countQuery = "select count(p) from PlanVersion p")
    Page<PlanVersion> publicationHistory(Pageable page);
}
