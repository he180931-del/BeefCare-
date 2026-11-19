package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedReceiptLine;

@Repository
public interface FeedReceiptLineRepository extends JpaRepository<FeedReceiptLine,Long> {
    List<FeedReceiptLine> findByReceipt_IdOrderByIdAsc(Long receiptId);
    List<FeedReceiptLine> findByFeedItem_IdOrderByExpiryDateAsc(Long feedItemId);
}
