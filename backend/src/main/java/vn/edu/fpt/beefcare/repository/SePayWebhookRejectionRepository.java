package vn.edu.fpt.beefcare.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.edu.fpt.beefcare.domain.SePayWebhookRejection;

public interface SePayWebhookRejectionRepository extends JpaRepository<SePayWebhookRejection, Long> {
    /** JOB-08: restricted metadata of rejected (unauthenticated) calls older than the cutoff, oldest first. */
    @Query("select r.id from SePayWebhookRejection r where r.receivedAt < :before order by r.id")
    List<Long> findIdsReceivedBefore(@Param("before") Instant before, Pageable page);

    @Modifying
    @Query("delete from SePayWebhookRejection r where r.id in :ids")
    int deleteByIdIn(@Param("ids") Collection<Long> ids);
}
