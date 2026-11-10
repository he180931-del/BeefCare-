package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
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
    /** API-03 period lookup: which listed SePay transactions are already stored as evidence (BR-D24 identity). */
    List<BankTransferEvidence> findAllByProviderAndEnvironmentAndAccountNamespaceAndProviderTxnIdIn(
        String provider, String environment, String accountNamespace, List<Long> providerTxnIds);
    List<BankTransferEvidence> findAllByPaymentIsNullOrderByBankPaidAtDescIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from BankTransferEvidence e where e.id = :id")
    Optional<BankTransferEvidence> lockById(@Param("id") Long id);

    /**
     * UC8 AF1: one more authenticated delivery of stored evidence. A bulk update leaves the entity version alone, so a
     * PM's open decision stays valid; an unknown legacy count (null) stays unknown.
     */
    @Modifying(flushAutomatically = true)
    @Query("update BankTransferEvidence e set e.deliveryAttempts = e.deliveryAttempts + 1 where e.id = :id and e.deliveryAttempts is not null")
    int countRepeatedDelivery(@Param("id") Long id);
}
