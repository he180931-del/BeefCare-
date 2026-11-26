package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;

/**
 * Spring Data JPA repository for the AnnouncementRecipient entity.
 */
@SuppressWarnings("unused")
@Repository
public interface AnnouncementRecipientRepository extends JpaRepository<AnnouncementRecipient, Long> {
    java.util.List<AnnouncementRecipient> findByMembership_IdOrderByDeliveredTimeDesc(Long membershipId);
    java.util.Optional<AnnouncementRecipient> findByIdAndMembership_Id(Long id,Long membershipId);
    boolean existsByVersion_IdAndMembership_Id(Long versionId,Long membershipId);
    java.util.List<AnnouncementRecipient> findByVersion_Id(Long versionId);

    /**
     * JOB-07 reads the immutable recipient snapshot and rechecks each membership before creating a notice.
     * Load the current access fields in one query so delivery does not depend on N+1 lazy reads.
     */
    @EntityGraph(attributePaths = {
        "version", "version.announcement", "version.announcement.farm"
    })
    java.util.List<AnnouncementRecipient> findSnapshotByVersion_Id(Long versionId);

    boolean existsByVersion_Announcement_IdAndMembership_Id(Long announcementId, Long membershipId);
}
