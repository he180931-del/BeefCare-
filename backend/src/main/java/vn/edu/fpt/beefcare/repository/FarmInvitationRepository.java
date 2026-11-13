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

    /** D26: effective status, filtering and pagination share the caller's one read clock. */
    @Query("""
        select i from FarmInvitation i where i.farm.id = :farmId
        and (:invitationId is null or i.id = :invitationId)
        and (:status is null or (case when upper(i.status) = 'PENDING' and i.expiresAt <= :now
            then 'EXPIRED' else upper(i.status) end) = :status)
        """)
    org.springframework.data.domain.Page<FarmInvitation> searchInvitations(@Param("farmId") Long farmId,
        @Param("status") String status, @Param("invitationId") Long invitationId, @Param("now") Instant now,
        org.springframework.data.domain.Pageable page);

    interface InvitationCounts {
        Long getPending();
        Long getAccepted();
        Long getExpired();
        Long getCancelled();
    }

    // Conditional aggregates avoid PostgreSQL treating repeated bound CASE expressions as different GROUP BY keys.
    @Query("""
        select coalesce(sum(case when upper(i.status) = 'PENDING' and i.expiresAt > :now then 1 else 0 end), 0) as pending,
            coalesce(sum(case when upper(i.status) = 'ACCEPTED' then 1 else 0 end), 0) as accepted,
            coalesce(sum(case when upper(i.status) = 'EXPIRED' or (upper(i.status) = 'PENDING' and i.expiresAt <= :now) then 1 else 0 end), 0) as expired,
            coalesce(sum(case when upper(i.status) = 'CANCELLED' then 1 else 0 end), 0) as cancelled
        from FarmInvitation i where i.farm.id = :farmId
        """)
    InvitationCounts countInvitationStatuses(@Param("farmId") Long farmId, @Param("now") Instant now);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from FarmInvitation i where upper(i.status) = 'PENDING' and i.expiresAt <= :now order by i.id")
    List<FarmInvitation> lockPendingExpiredBefore(@Param("now") Instant now);

    /** JOB-08: link hashes of finished invitations past expiry; the invitation records and statuses stay. */
    @Query("select i.id from FarmInvitation i where i.expiresAt < :before and upper(i.status) <> 'PENDING' and (i.tokenHash is not null or i.tokenNonce is not null) order by i.id")
    List<Long> findIdsWithLinkExpiredBefore(@Param("before") Instant before, org.springframework.data.domain.Pageable page);

    @Modifying
    @Query("update FarmInvitation i set i.tokenHash = null, i.tokenNonce = null where i.id in :ids")
    int clearLinks(@Param("ids") java.util.Collection<Long> ids);
}
