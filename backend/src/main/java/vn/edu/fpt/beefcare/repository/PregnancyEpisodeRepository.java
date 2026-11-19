package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;

/**
 * Spring Data JPA repository for the PregnancyEpisode entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PregnancyEpisodeRepository extends JpaRepository<PregnancyEpisode, Long> {
    java.util.Optional<PregnancyEpisode> findFirstByCattleIdAndStatus(Long cattleId, String status);
}
