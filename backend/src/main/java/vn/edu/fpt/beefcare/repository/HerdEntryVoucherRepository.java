package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;

@Repository
public interface HerdEntryVoucherRepository extends JpaRepository<HerdEntryVoucher, Long> {

    Optional<HerdEntryVoucher> findByIdAndFarmId(Long id, Long farmId);

    List<HerdEntryVoucher> findAllByFarmIdOrderByEntryDateDescIdDesc(Long farmId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from HerdEntryVoucher v where v.farm.id = :farmId and v.id = :id")
    Optional<HerdEntryVoucher> lockByIdAndFarmId(@Param("farmId") Long farmId, @Param("id") Long id);
}
