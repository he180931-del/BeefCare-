package vn.edu.fpt.beefcare.repository;
import java.util.List;import org.springframework.data.jpa.repository.JpaRepository;import org.springframework.stereotype.Repository;import vn.edu.fpt.beefcare.domain.FeedingRecordLine;
@Repository public interface FeedingRecordLineRepository extends JpaRepository<FeedingRecordLine,Long>{List<FeedingRecordLine> findByFeedingRecord_Id(Long recordId);}
