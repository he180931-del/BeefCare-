package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import vn.edu.fpt.beefcare.domain.Farm;

/**
 * Spring Data JPA repository for the Farm entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmRepository extends JpaRepository<Farm, Long>, JpaSpecificationExecutor<Farm> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Farm f where f.id = :id")
    Optional<Farm> lockById(@Param("id") Long id);
}
