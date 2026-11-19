package vn.edu.fpt.beefcare.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.ManualFinanceBankClaim;

@Repository
public interface ManualFinanceBankClaimRepository extends JpaRepository<ManualFinanceBankClaim, String> {
    Optional<ManualFinanceBankClaim> findFirstByRecord_Id(Long recordId);
}
