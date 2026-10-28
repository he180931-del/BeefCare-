package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;

/**
 * Spring Data JPA repository for the AnnouncementVersion entity.
 */
@SuppressWarnings("unused")
@Repository
public interface AnnouncementVersionRepository extends JpaRepository<AnnouncementVersion, Long> {
    java.util.List<AnnouncementVersion> findByAnnouncement_IdOrderByVersionNoDesc(Long announcementId);
}
