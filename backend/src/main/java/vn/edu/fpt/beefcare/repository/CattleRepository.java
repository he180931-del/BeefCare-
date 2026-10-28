package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;

@Repository
public interface CattleRepository extends JpaRepository<Cattle, Long> {

    Optional<Cattle> findByIdAndFarmId(Long id, Long farmId);

    boolean existsByFarmIdAndEarTagNumberIgnoreCaseAndHerdStatus(Long farmId, String earTagNumber, HerdStatus herdStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cattle c where c.farm.id = :farmId and c.id = :id")
    Optional<Cattle> lockByIdAndFarmId(@Param("farmId") Long farmId, @Param("id") Long id);

    /** Locks the cattle rows in ascending id order. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cattle c where c.farm.id = :farmId and c.id in :ids order by c.id asc")
    List<Cattle> lockAllByFarmIdAndIdIn(@Param("farmId") Long farmId, @Param("ids") Collection<Long> ids);
}
