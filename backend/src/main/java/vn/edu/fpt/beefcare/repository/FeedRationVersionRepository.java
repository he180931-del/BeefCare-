package vn.edu.fpt.beefcare.repository;
import java.time.LocalDate;import java.util.List;import java.util.Optional;import org.springframework.data.jpa.repository.JpaRepository;import org.springframework.stereotype.Repository;import vn.edu.fpt.beefcare.domain.FeedRationVersion;
@Repository public interface FeedRationVersionRepository extends JpaRepository<FeedRationVersion,Long>{
 List<FeedRationVersion> findByFarm_IdOrderByEffectiveFromDescVersionNoDesc(Long farmId);
 List<FeedRationVersion> findByFarm_IdAndRationCodeOrderByVersionNoDesc(Long farmId,String code);
}
