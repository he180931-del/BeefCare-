package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Subscription;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for the Subscription entity.
 */
@SuppressWarnings("unused")
@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    Optional<Subscription> findFirstByFarm_Id(Long farmId);

    /**
     * Lock before read: lockByFarmId returns an already loaded Subscription unchanged (it has no @Version to detect a
     * newer row), so callers take the farm and subscription locks before loading it and use this id-only read first.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Subscription s where s.farm.id = :farmId")
    Optional<Subscription> lockByFarmId(@Param("farmId") Long farmId);

    @Query("select s.farm.id from Subscription s where s.id = :id")
    Optional<Long> findFarmIdById(@Param("id") Long id);
}
