package vn.edu.fpt.beefcare.repository;
import java.util.List;import org.springframework.data.jpa.repository.JpaRepository;import org.springframework.stereotype.Repository;import vn.edu.fpt.beefcare.domain.FeedRationPen;
@Repository public interface FeedRationPenRepository extends JpaRepository<FeedRationPen,Long>{List<FeedRationPen> findByRationVersion_Id(Long rationVersionId);List<FeedRationPen> findByPen_Id(Long penId);}
