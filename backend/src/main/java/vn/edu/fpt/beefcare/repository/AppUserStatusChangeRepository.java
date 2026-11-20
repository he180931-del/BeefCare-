package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.AppUserStatusChange;

/** Append-only history of account suspensions and restorations (D32); rows are only inserted. */
@Repository
public interface AppUserStatusChangeRepository extends JpaRepository<AppUserStatusChange, Long> {
    List<AppUserStatusChange> findByAccountIdOrderByChangedAtAscIdAsc(Long accountId);
}
