package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;

/**
 * Spring Data JPA repository for the BankTransferEvidence entity.
 */
@SuppressWarnings("unused")
@Repository
public interface BankTransferEvidenceRepository extends JpaRepository<BankTransferEvidence, Long> {}
