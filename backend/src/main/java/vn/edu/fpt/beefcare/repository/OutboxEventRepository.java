package vn.edu.fpt.beefcare.repository;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.OutboxEvent;

@Repository
public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {
    @Query("select e from OutboxEvent e where e.publishedAt is null and e.availableAt <= :now and (e.claimedUntil is null or e.claimedUntil < :now) order by e.id")
    List<OutboxEvent> findDue(@Param("now") Instant now, org.springframework.data.domain.Pageable pageable);

    @Modifying
    @Query("update OutboxEvent e set e.claimedUntil = :until, e.attempts = e.attempts + 1 where e.id = :id and e.publishedAt is null and e.availableAt <= :now and (e.claimedUntil is null or e.claimedUntil < :now)")
    int claim(@Param("id") Long id, @Param("now") Instant now, @Param("until") Instant until);
}
