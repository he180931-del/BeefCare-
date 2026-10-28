package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CattleProfileChange;

@Repository
public interface CattleProfileChangeRepository extends JpaRepository<CattleProfileChange, Long> {
    List<CattleProfileChange> findAllByCattleIdOrderByEffectiveDateAscIdAsc(Long cattleId);
}
