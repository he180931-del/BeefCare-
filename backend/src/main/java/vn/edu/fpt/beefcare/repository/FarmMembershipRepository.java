package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;
import vn.edu.fpt.beefcare.domain.FarmMembership;

/**
 * Spring Data JPA repository for the FarmMembership entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmMembershipRepository extends JpaRepository<FarmMembership, Long> {
    Optional<FarmMembership> findFirstByFarmIdAndUserIdAndStatusIgnoreCase(Long farmId, Long userId, String status);
    Optional<FarmMembership> findFirstByFarmIdAndUserId(Long farmId, Long userId);
    List<FarmMembership> findByFarmIdOrderById(Long farmId);
    List<FarmMembership> findByFarm_IdAndStatusIgnoreCase(Long farmId,String status);
    Optional<FarmMembership> findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(Long farmId, String role, String status);
}
