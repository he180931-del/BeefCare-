package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Notification;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA repository for the Notification entity.
 */
@SuppressWarnings("unused")
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(Long userId);
    Optional<Notification> findByEventKeyAndRecipient_Id(String eventKey,Long userId);
    Optional<Notification> findByIdAndRecipient_Id(Long id,Long userId);
}
