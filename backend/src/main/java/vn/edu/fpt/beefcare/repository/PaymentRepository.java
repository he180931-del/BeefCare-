package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Payment;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;

/**
 * Spring Data JPA repository for the Payment entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findFirstBySubscription_IdAndStateIgnoreCaseOrderByRequestedAtDesc(Long subscriptionId, String state);
    List<Payment> findAllBySubscription_Farm_IdOrderByRequestedAtDescIdDesc(Long farmId);
    Optional<Payment> findFirstByQuoteRefIgnoreCase(String quoteRef);
    Optional<Payment> findFirstByIdAndSubscription_Farm_IdAndRequestedBy_Id(Long id, Long farmId, Long requestedById);
    Optional<Payment> findFirstByQuoteRefIgnoreCaseAndSubscription_Farm_Id(String quoteRef, Long farmId);
    List<Payment> findAllByStateIgnoreCaseAndExpiresAtBefore(String state, Instant now);
    List<Payment> findAllBySubscription_Farm_IdAndRequestedBy_IdOrderByRequestedAtDescIdDesc(Long farmId, Long requestedById);
    List<Payment> findAllByOrderByRequestedAtDescIdDesc();

    @Query("select p from Payment p where upper(p.state) in ('PENDING','EXPIRED') and p.amountVnd = :amount and p.requestedAt <= :paidAt and p.expiresAt > :paidAt order by p.requestedAt desc")
    List<Payment> findEligibleAt(@Param("amount") BigDecimal amount, @Param("paidAt") Instant paidAt);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id = :id")
    Optional<Payment> lockById(@Param("id") Long id);
}
