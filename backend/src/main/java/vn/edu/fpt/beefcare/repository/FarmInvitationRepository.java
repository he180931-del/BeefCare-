package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FarmInvitation;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.time.Instant;

/**
 * Spring Data JPA repository for the FarmInvitation entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmInvitationRepository extends JpaRepository<FarmInvitation, Long> {
    Optional<FarmInvitation> findFirstByFarmIdAndInvitedEmailIgnoreCaseAndStatusIgnoreCase(Long farmId, String email, String status);
    Optional<FarmInvitation> findOneByTokenHash(String tokenHash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from FarmInvitation i where i.tokenHash = :hash")
    Optional<FarmInvitation> lockByTokenHash(@Param("hash") String tokenHash);
    List<FarmInvitation> findByFarmIdOrderByCreatedAtDesc(Long farmId);
    @Modifying
    @Query("update FarmInvitation i set i.status = 'EXPIRED', i.tokenHash = null where upper(i.status) = 'PENDING' and i.expiresAt <= :now")
    int expirePending(@Param("now") Instant now);
}
