package vn.edu.fpt.beefcare.repository;
import java.util.List;import org.springframework.data.jpa.repository.JpaRepository;import org.springframework.stereotype.Repository;import vn.edu.fpt.beefcare.domain.FeedRationComponent;
@Repository public interface FeedRationComponentRepository extends JpaRepository<FeedRationComponent,Long>{List<FeedRationComponent> findByRationVersion_Id(Long rationVersionId);boolean existsByFeedItem_Id(Long feedId);}
