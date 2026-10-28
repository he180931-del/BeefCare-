package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import vn.edu.fpt.beefcare.domain.FeedItem;
import java.util.List;
import java.util.Optional;

@Repository
public interface FeedItemRepository extends JpaRepository<FeedItem, Long> {
    List<FeedItem> findByFarm_IdOrderByNameAsc(Long farmId);

    boolean existsByFarm_IdAndCodeIgnoreCase(Long farmId,String code);

    Optional<FeedItem> findByIdAndFarm_Id(Long id, Long farmId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from FeedItem f where f.id=:id and f.farm.id=:farmId")
    Optional<FeedItem> lockByIdAndFarm(@Param("id") Long id,@Param("farmId") Long farmId);
}
