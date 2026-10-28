package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedStockAdjustmentLine;

@Repository
public interface FeedStockAdjustmentLineRepository extends JpaRepository<FeedStockAdjustmentLine,Long> {
    List<FeedStockAdjustmentLine> findByAdjustment_IdOrderByIdAsc(Long adjustmentId);
}
