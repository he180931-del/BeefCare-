package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import vn.edu.fpt.beefcare.domain.FarmMembership;

/**
 * Spring Data JPA repository for the FarmMembership entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmMembershipRepository extends JpaRepository<FarmMembership, Long> {
    Optional<FarmMembership> findFirstByFarmIdAndUserIdAndStatusIgnoreCase(Long farmId, Long userId, String status);
}
