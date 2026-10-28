package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Pen;

@Repository
public interface PenRepository extends JpaRepository<Pen, Long> {

    Optional<Pen> findByIdAndFarmId(Long id, Long farmId);

    boolean existsByFarmIdAndCodeIgnoreCase(Long farmId, String code);

    List<Pen> findAllByFarmIdOrderByCodeAsc(Long farmId);

    /** Locks the pens in ascending id order (deadlock-free); the caller compares the size with the requested ids. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Pen p where p.farm.id = :farmId and p.id in :ids order by p.id asc")
    List<Pen> lockAllByFarmIdAndIdIn(@Param("farmId") Long farmId, @Param("ids") Collection<Long> ids);
}
