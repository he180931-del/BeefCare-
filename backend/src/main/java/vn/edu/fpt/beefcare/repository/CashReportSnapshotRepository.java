package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CashReportSnapshot;

/**
 * Spring Data JPA repository for the CashReportSnapshot entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CashReportSnapshotRepository extends JpaRepository<CashReportSnapshot, Long> {}
