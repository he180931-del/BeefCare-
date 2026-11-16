package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.AnnouncementMemberSelector;

/** Draft audience selectors by named FarmMembership. */
@Repository
public interface AnnouncementMemberSelectorRepository extends JpaRepository<AnnouncementMemberSelector, Long> {
    List<AnnouncementMemberSelector> findByAnnouncement_IdOrderByMembership_Id(Long announcementId);
    void deleteByAnnouncement_Id(Long announcementId);
}
