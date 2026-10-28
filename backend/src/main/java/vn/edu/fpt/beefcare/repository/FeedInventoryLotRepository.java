package vn.edu.fpt.beefcare.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedInventoryLot;

@Repository
public interface FeedInventoryLotRepository extends JpaRepository<FeedInventoryLot,Long> {
    List<FeedInventoryLot> findByFarm_IdAndFeedItem_Id(Long farmId,Long feedItemId);
    Optional<FeedInventoryLot> findByReceiptLine_Id(Long receiptLineId);
}
