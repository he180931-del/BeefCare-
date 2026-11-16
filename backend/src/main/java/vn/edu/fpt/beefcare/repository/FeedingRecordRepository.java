package vn.edu.fpt.beefcare.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FeedingRecord;

@Repository
public interface FeedingRecordRepository extends JpaRepository<FeedingRecord, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from FeedingRecord r where r.id=:id and r.farm.id=:farmId")
    Optional<FeedingRecord> lockByIdAndFarm(@Param("id") Long id, @Param("farmId") Long farmId);

    Optional<FeedingRecord> findByFarm_IdAndPen_IdAndFeedingDateAndSessionNo(Long farmId, Long penId, LocalDate date, Integer sessionNo);
    Optional<FeedingRecord> findFirstByFarm_IdAndPen_IdAndFeedingDateAndSessionNoAndStatus(
        Long farmId, Long penId, LocalDate date, Integer sessionNo, String status
    );
    List<FeedingRecord> findByFarm_IdAndFeedingDateBetweenOrderByFeedingDateDescSessionNoAsc(Long farmId, LocalDate from, LocalDate to);
}
