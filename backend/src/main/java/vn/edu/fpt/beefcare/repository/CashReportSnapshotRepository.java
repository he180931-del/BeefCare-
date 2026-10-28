package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CashReportSnapshot;

/**
 * Spring Data JPA repository for the CashReportSnapshot entity.
 */
@SuppressWarnings("unused")
@Repository
public interface CashReportSnapshotRepository extends JpaRepository<CashReportSnapshot, Long> {
    /** JOB-08: snapshots past their 30-day availability. */
    @org.springframework.data.jpa.repository.Query("select s.id from CashReportSnapshot s where s.expiresAt <= :now order by s.id")
    java.util.List<Long> findIdsExpiredAt(@org.springframework.data.repository.query.Param("now") java.time.Instant now, org.springframework.data.domain.Pageable page);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("delete from CashReportSnapshot s where s.id in :ids")
    int deleteByIdIn(@org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);
}
