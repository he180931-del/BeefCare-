package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.RecordRevision;

/**
 * Spring Data JPA repository for the RecordRevision entity.
 */
@SuppressWarnings("unused")
@Repository
public interface RecordRevisionRepository extends JpaRepository<RecordRevision, Long> {}
