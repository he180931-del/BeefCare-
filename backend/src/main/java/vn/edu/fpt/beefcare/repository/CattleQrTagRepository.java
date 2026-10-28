package vn.edu.fpt.beefcare.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;

@Repository
public interface CattleQrTagRepository extends JpaRepository<CattleQrTag, Long> {

    Optional<CattleQrTag> findByTagCode(String tagCode);

    Optional<CattleQrTag> findFirstByCattleIdAndStatus(Long cattleId, QrTagStatus status);

    boolean existsByTagCode(String tagCode);
}
