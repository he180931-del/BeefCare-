package vn.edu.fpt.beefcare.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.TradingPartner;

@Repository
public interface TradingPartnerRepository extends JpaRepository<TradingPartner, Long> {

    Optional<TradingPartner> findByIdAndFarmId(Long id, Long farmId);

    boolean existsByFarmIdAndNameIgnoreCase(Long farmId, String name);

    boolean existsByFarmIdAndNameIgnoreCaseAndIdNot(Long farmId, String name, Long id);

    List<TradingPartner> findAllByFarmIdOrderByNameAsc(Long farmId);
}
