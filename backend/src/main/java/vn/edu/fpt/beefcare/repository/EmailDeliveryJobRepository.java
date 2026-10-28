package vn.edu.fpt.beefcare.repository;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.EmailDeliveryJob;

@Repository
public interface EmailDeliveryJobRepository extends JpaRepository<EmailDeliveryJob, Long> {
    long countByRecipientIgnoreCaseAndTemplateKeyAndCreatedAtAfter(String recipient, String templateKey, Instant after);

    boolean existsByRecipientIgnoreCaseAndTemplateKeyAndLinkSourceIdAndContextRoleAndContextName(
        String recipient, String templateKey, Long linkSourceId, String contextRole, String contextName);

    List<EmailDeliveryJob> findByStatusAndAvailableAtLessThanEqualOrderByCreatedAtAsc(String status, Instant now, Pageable pageable);

    @Modifying
    @Query("update EmailDeliveryJob j set j.leaseUntil = :leaseUntil, j.attempts = j.attempts + 1 where j.id = :id and j.status = 'PENDING' and j.availableAt <= :now and (j.leaseUntil is null or j.leaseUntil <= :now)")
    int claim(@Param("id") Long id, @Param("now") Instant now, @Param("leaseUntil") Instant leaseUntil);

    @Modifying
    @Query("update EmailDeliveryJob j set j.status = 'CANCELLED', j.leaseUntil = null where j.linkSource = :source and j.linkSourceId = :sourceId and j.status = 'PENDING'")
    int cancelForLink(@Param("source") String source, @Param("sourceId") Long sourceId);
}
