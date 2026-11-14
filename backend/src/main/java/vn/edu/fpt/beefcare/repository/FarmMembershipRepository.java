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
    boolean existsByUserIdAndRoleIgnoreCaseAndStatusIgnoreCase(Long userId, String role, String status);
    Optional<FarmMembership> findFirstByFarmIdAndUserId(Long farmId, Long userId);
    List<FarmMembership> findByFarmIdOrderById(Long farmId);

    /**
     * UC-FE03-06 (D30): the target row is locked before any check, so a concurrent command waits and then sees the
     * committed role and status (MSG-FE03-20) instead of overwriting it.
     */
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from FarmMembership m where m.id = :id and m.farm.id = :farmId")
    Optional<FarmMembership> lockByIdAndFarmId(@org.springframework.data.repository.query.Param("id") Long id,
        @org.springframework.data.repository.query.Param("farmId") Long farmId);

    /** SCR-13 (A1): every membership with its account in one query; the inverse platform access is joined to avoid N+1. */
    @EntityGraph(attributePaths = { "user", "user.platformStaffAccess" })
    @Query("select m from FarmMembership m where m.farm.id = :farmId")
    List<FarmMembership> findWithUserByFarmId(@org.springframework.data.repository.query.Param("farmId") Long farmId);
    List<FarmMembership> findByFarm_IdAndStatusIgnoreCase(Long farmId,String status);

    /** SCR-16 "Farms joined" (D31): ACTIVE memberships of a page of accounts per role, in one query; [userId, ROLE, count]. */
    @Query("select m.user.id, upper(m.role), count(m) from FarmMembership m where m.user.id in :userIds and upper(m.status) = 'ACTIVE' group by m.user.id, upper(m.role)")
    List<Object[]> countActiveByUserAndRole(@org.springframework.data.repository.query.Param("userIds") java.util.Collection<Long> userIds);

    /** SCR-16 account detail: names of the farms the account owns (any service status). */
    @Query("select f.name from FarmMembership m join m.farm f where m.user.id = :userId and upper(m.role) = 'OWNER'")
    List<String> findOwnedFarmNames(@org.springframework.data.repository.query.Param("userId") Long userId);
    Optional<FarmMembership> findFirstByFarmIdAndRoleIgnoreCaseAndStatusIgnoreCase(Long farmId, String role, String status);
}
