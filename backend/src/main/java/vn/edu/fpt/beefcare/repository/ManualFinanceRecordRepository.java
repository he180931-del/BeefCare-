package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ManualFinanceRecord;

/**
 * Spring Data JPA repository for the ManualFinanceRecord entity.
 */
@SuppressWarnings("unused")
@Repository
public interface ManualFinanceRecordRepository extends JpaRepository<ManualFinanceRecord, Long> {}
