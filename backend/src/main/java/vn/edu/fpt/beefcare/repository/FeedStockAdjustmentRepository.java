package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedStockAdjustment;

@Repository
public interface FeedStockAdjustmentRepository extends JpaRepository<FeedStockAdjustment,Long> {
    List<FeedStockAdjustment> findByFarm_IdOrderByCountDateDescIdDesc(Long farmId);
    Optional<FeedStockAdjustment> findByIdAndFarm_Id(Long id,Long farmId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from FeedStockAdjustment a where a.id=:id and a.farm.id=:farmId")
    Optional<FeedStockAdjustment> lockByIdAndFarm(@Param("id") Long id,@Param("farmId") Long farmId);
}
