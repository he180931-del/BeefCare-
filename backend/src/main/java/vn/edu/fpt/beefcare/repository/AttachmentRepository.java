package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Attachment;
import java.util.Optional;
import vn.edu.fpt.beefcare.domain.enumeration.AttachmentOwnerType;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    Optional<Attachment> findByIdAndFarm_Id(Long id, Long farmId);
    Optional<Attachment> findByOwnerTypeAndOwnerIdAndFarm_Id(AttachmentOwnerType ownerType, Long ownerId, Long farmId);
}
