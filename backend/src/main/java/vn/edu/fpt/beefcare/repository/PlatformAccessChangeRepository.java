package vn.edu.fpt.beefcare.repository;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PlatformAccessChange;

/** Append-only history of platform access changes (D33); rows are only inserted. */
@Repository
public interface PlatformAccessChangeRepository extends JpaRepository<PlatformAccessChange, Long> {
    /**
     * A11 role history, newest first. A projection, not entities: loading the acting accounts would also load their
     * inverse platform access one by one (N+1).
     */
    @Query(
        "select c.id as id, c.action as action, c.roleBefore as roleBefore, c.statusBefore as statusBefore, c.roleAfter as roleAfter, " +
        "c.statusAfter as statusAfter, c.reason as reason, b.fullName as byName, b.email as byEmail, c.changedAt as changedAt " +
        "from PlatformAccessChange c left join c.changedBy b where c.account.id = :accountId order by c.changedAt desc, c.id desc"
    )
    List<HistoryRow> findHistory(@Param("accountId") Long accountId, Pageable page);

    interface HistoryRow {
        Long getId();
        String getAction();
        String getRoleBefore();
        String getStatusBefore();
        String getRoleAfter();
        String getStatusAfter();
        String getReason();
        String getByName();
        String getByEmail();
        Instant getChangedAt();
    }
}
