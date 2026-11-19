package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedLotAllocation;

@Repository
public interface FeedLotAllocationRepository extends JpaRepository<FeedLotAllocation,Long> {
    List<FeedLotAllocation> findByFeedingRecordLine_IdAndReversedAtIsNullOrderByIdAsc(Long lineId);
}
