package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.RecordRevision;

@Repository
public interface RecordRevisionRepository extends JpaRepository<RecordRevision, Long> {
    List<RecordRevision> findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc(String sourceType, Long sourceId);
}
