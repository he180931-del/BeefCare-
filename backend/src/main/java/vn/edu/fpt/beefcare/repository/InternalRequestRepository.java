package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.InternalRequest;

/**
 * Spring Data JPA repository for the InternalRequest entity.
 */
@SuppressWarnings("unused")
@Repository
public interface InternalRequestRepository extends JpaRepository<InternalRequest, Long> {}
