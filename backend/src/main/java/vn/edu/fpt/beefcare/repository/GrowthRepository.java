package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import vn.edu.fpt.beefcare.domain.Growth;

/**
 * Spring Data JPA repository for the Growth entity.
 */
@SuppressWarnings("unused")
@Repository
public interface GrowthRepository extends JpaRepository<Growth, Long> {

    Optional<Growth> findFirstByCattleIdAndStatusNotOrderByCheckDateDescEntryTimeDesc(Long cattleId, String status);
}
