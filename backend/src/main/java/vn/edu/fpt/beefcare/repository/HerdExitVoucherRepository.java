package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;

@Repository
public interface HerdExitVoucherRepository extends JpaRepository<HerdExitVoucher, Long> {

    Optional<HerdExitVoucher> findByIdAndFarmId(Long id, Long farmId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from HerdExitVoucher v where v.farm.id = :farmId and v.id = :id")
    Optional<HerdExitVoucher> lockByIdAndFarmId(@Param("farmId") Long farmId, @Param("id") Long id);

    @Query("select v from HerdExitVoucher v where v.farm.id = :farmId and v.exitDate between :from and :to order by v.exitDate desc, v.id desc")
    java.util.List<HerdExitVoucher> findAllInPeriod(
        @Param("farmId") Long farmId,
        @Param("from") java.time.LocalDate from,
        @Param("to") java.time.LocalDate to
    );

    long countByFarmIdAndStatus(Long farmId, vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus status);

    Optional<HerdExitVoucher> findFirstBySourceHealthCaseIdAndStatusIn(
        Long healthCaseId,
        java.util.Collection<vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus> statuses
    );
}
