package vn.edu.fpt.beefcare.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;

@Repository
public interface HerdEntryRepository extends JpaRepository<HerdEntry, Long> {

    List<HerdEntry> findAllByVoucherIdOrderByLineNoAsc(Long voucherId);

    Optional<HerdEntry> findByCattleIdAndStatus(Long cattleId, EntryLineStatus status);

    List<HerdEntry> findAllByVoucherIdIn(Collection<Long> voucherIds);

    Optional<HerdEntry> findByIdAndFarmId(Long id, Long farmId);

    Optional<HerdEntry> findFirstByCalfOutcomeIdAndStatus(Long calfOutcomeId, EntryLineStatus status);
}
