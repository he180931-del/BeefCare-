package vn.edu.fpt.beefcare.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;

@Repository
public interface PenCriteriaVersionRepository extends JpaRepository<PenCriteriaVersion, Long> {

    Optional<PenCriteriaVersion> findFirstByPenIdOrderByVersionNoDesc(Long penId);

    List<PenCriteriaVersion> findAllByPenIdOrderByVersionNoDesc(Long penId);

    List<PenCriteriaVersion> findAllByPenIdIn(java.util.Collection<Long> penIds);
}
