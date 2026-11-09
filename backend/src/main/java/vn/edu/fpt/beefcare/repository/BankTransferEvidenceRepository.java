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
    /** Evidence allocated to any of the given payments, lowest id first, for one batch per Owner read. */
    List<BankTransferEvidence> findAllByPayment_IdInOrderByIdAsc(List<Long> paymentIds);
    /** Callers pass upper-case references; upper(quote_ref) is served by ix_evidence_quote_ref_upper on PostgreSQL. */
    @Query("select e from BankTransferEvidence e where upper(e.quoteRef) in :quoteRefs order by e.id asc")
    List<BankTransferEvidence> findAllByUpperQuoteRefIn(@Param("quoteRefs") List<String> quoteRefs);
    List<BankTransferEvidence> findAllByReviewStatusIgnoreCaseOrderByBankPaidAtAscIdAsc(String status);
    List<BankTransferEvidence> findAllByPayment_Subscription_Farm_IdOrderByBankPaidAtDescIdDesc(Long farmId);
    List<BankTransferEvidence> findAllByPaymentIsNullOrderByBankPaidAtDescIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from BankTransferEvidence e where e.id = :id")
    Optional<BankTransferEvidence> lockById(@Param("id") Long id);
}
