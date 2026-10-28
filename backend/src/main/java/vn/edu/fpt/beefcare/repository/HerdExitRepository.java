package vn.edu.fpt.beefcare.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;

@Repository
public interface HerdExitRepository extends JpaRepository<HerdExit, Long> {

    List<HerdExit> findAllByVoucherIdOrderByLineNoAsc(Long voucherId);

    Optional<HerdExit> findFirstByCattleIdAndStatus(Long cattleId, ExitLineStatus status);

    Optional<HerdExit> findFirstByCattleIdAndStatusIn(Long cattleId, Collection<ExitLineStatus> statuses);

    List<HerdExit> findAllByCattleIdAndStatusIn(Long cattleId, Collection<ExitLineStatus> statuses);

    List<HerdExit> findAllByVoucherIdAndStatusNotOrderByLineNoAsc(Long voucherId, ExitLineStatus status);

    @Query("select l from HerdExit l where l.voucher.id in :voucherIds and l.status <> :excluded order by l.voucher.id, l.lineNo")
    List<HerdExit> findAllByVoucherIdInAndStatusNot(
        @org.springframework.data.repository.query.Param("voucherIds") Collection<Long> voucherIds,
        @org.springframework.data.repository.query.Param("excluded") ExitLineStatus excluded
    );

    @Query("select coalesce(max(l.lineNo), 0) from HerdExit l where l.voucher.id = :voucherId")
    int maxLineNo(@org.springframework.data.repository.query.Param("voucherId") Long voucherId);
}
