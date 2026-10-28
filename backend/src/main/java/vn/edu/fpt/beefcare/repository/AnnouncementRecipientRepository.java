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
}
