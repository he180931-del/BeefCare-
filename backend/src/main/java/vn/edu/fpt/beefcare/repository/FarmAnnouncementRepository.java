package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FarmAnnouncement;

/**
 * Spring Data JPA repository for the FarmAnnouncement entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmAnnouncementRepository extends JpaRepository<FarmAnnouncement, Long> {}
