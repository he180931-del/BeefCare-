package vn.edu.fpt.beefcare.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import vn.edu.fpt.beefcare.domain.FeedReceipt;

@Repository
public interface FeedReceiptRepository extends JpaRepository<FeedReceipt,Long> {
    List<FeedReceipt> findByFarm_IdOrderByReceiptDateDescIdDesc(Long farmId);
    Optional<FeedReceipt> findByIdAndFarm_Id(Long id, Long farmId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from FeedReceipt r where r.id=:id and r.farm.id=:farmId")
    Optional<FeedReceipt> lockByIdAndFarm(@Param("id") Long id,@Param("farmId") Long farmId);
}
