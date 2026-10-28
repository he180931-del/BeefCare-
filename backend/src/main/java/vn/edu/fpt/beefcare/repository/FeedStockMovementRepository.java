package vn.edu.fpt.beefcare.repository;

import java.util.List;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedStockMovement;

@Repository
public interface FeedStockMovementRepository extends JpaRepository<FeedStockMovement,Long> {
    List<FeedStockMovement> findByFarm_IdAndFeedItem_IdOrderByOccurredAtDescIdDesc(Long farmId,Long feedItemId);
    boolean existsByFeedItem_Id(Long feedItemId);
    List<FeedStockMovement> findByFarm_IdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(Long farmId,Instant from,Instant to);
}
