package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;

/**
 * Spring Data JPA repository for the AnnouncementRecipient entity.
 */
@SuppressWarnings("unused")
@Repository
public interface AnnouncementRecipientRepository extends JpaRepository<AnnouncementRecipient, Long> {}
