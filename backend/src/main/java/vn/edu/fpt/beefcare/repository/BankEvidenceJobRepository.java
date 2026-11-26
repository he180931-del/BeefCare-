package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import vn.edu.fpt.beefcare.domain.BankEvidenceJob;

public interface BankEvidenceJobRepository extends JpaRepository<BankEvidenceJob, Long> {
    Optional<BankEvidenceJob> findByEvidence_Id(Long evidenceId);

    @Query("select j.id from BankEvidenceJob j where j.status='PENDING' and j.availableAt<=:now and (j.leaseUntil is null or j.leaseUntil<=:now) order by j.availableAt,j.id")
    List<Long> findDue(@Param("now") Instant now, Pageable page);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update BankEvidenceJob j set j.leaseUntil=:lease, j.attempts=j.attempts+1 where j.id=:id and j.status='PENDING' and j.availableAt<=:now and (j.leaseUntil is null or j.leaseUntil<=:now)")
    int claim(@Param("id") Long id, @Param("now") Instant now, @Param("lease") Instant lease);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from BankEvidenceJob j where j.id=:id")
    Optional<BankEvidenceJob> lockById(@Param("id") Long id);
}
