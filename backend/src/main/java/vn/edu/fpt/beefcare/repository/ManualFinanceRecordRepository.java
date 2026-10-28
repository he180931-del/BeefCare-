package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ManualFinanceRecord;

/**
 * Spring Data JPA repository for the ManualFinanceRecord entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ManualFinanceRecordRepository extends JpaRepository<ManualFinanceRecord, Long>, JpaSpecificationExecutor<ManualFinanceRecord> {
    boolean existsBySourceReferenceAndTypeIgnoreCaseAndStateIgnoreCase(String sourceReference, String type, String state);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ManualFinanceRecord r where r.id = :id")
    Optional<ManualFinanceRecord> lockById(@Param("id") Long id);
}
