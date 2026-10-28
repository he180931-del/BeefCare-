package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.BankTransferEvidence;

@Repository
public interface BankTransferEvidenceRepository extends JpaRepository<BankTransferEvidence, Long> {
    Optional<BankTransferEvidence> findFirstByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnId(
        String provider, String environment, String accountNamespace, Long providerTxnId
    );
    boolean existsByPayment_Id(Long paymentId);
    Optional<BankTransferEvidence> findFirstByPayment_Id(Long paymentId);
    List<BankTransferEvidence> findAllByReviewStatusIgnoreCaseOrderByBankPaidAtAscIdAsc(String status);
    @Query("select e from BankTransferEvidence e where upper(e.reviewStatus) in :statuses order by e.bankPaidAt desc, e.id desc")
    List<BankTransferEvidence> findReviewQueue(@Param("statuses") List<String> statuses);
    List<BankTransferEvidence> findAllByPayment_Subscription_Farm_IdOrderByBankPaidAtDescIdDesc(Long farmId);
    List<BankTransferEvidence> findAllByPaymentIsNullOrderByBankPaidAtDescIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from BankTransferEvidence e where e.id = :id")
    Optional<BankTransferEvidence> lockById(@Param("id") Long id);
}
