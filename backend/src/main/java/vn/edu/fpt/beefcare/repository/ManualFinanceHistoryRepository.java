package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.fpt.beefcare.domain.ManualFinanceHistory;

public interface ManualFinanceHistoryRepository extends JpaRepository<ManualFinanceHistory, Long> {
    List<ManualFinanceHistory> findAllByRecord_IdOrderByChangedAtAscIdAsc(Long recordId);
}
