package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Payment;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for the Payment entity.
 */
@SuppressWarnings("unused")
@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long>, JpaSpecificationExecutor<Payment> {
    @Query("select p from Payment p where p.subscription.id=:subscriptionId and upper(p.state)='PAID' and p.purchasedStart is not null and p.purchasedEnd is not null order by p.purchasedEnd desc,p.id desc")
    List<Payment> findPaidPeriods(@Param("subscriptionId") Long subscriptionId);
    Optional<Payment> findFirstBySubscription_IdAndStateIgnoreCaseOrderByRequestedAtDesc(Long subscriptionId, String state);
    List<Payment> findAllBySubscription_Farm_IdOrderByRequestedAtDescIdDesc(Long farmId);
    Optional<Payment> findFirstByQuoteRefIgnoreCase(String quoteRef);
    Optional<Payment> findFirstByIdAndSubscription_Farm_Id(Long id, Long farmId);
    Optional<Payment> findFirstByQuoteRefIgnoreCaseAndSubscription_Farm_Id(String quoteRef, Long farmId);
    List<Payment> findAllByStateIgnoreCaseAndExpiresAtBefore(String state, Instant now);
    List<Payment> findAllByOrderByRequestedAtDescIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id = :id")
    Optional<Payment> lockById(@Param("id") Long id);

    /**
     * A request and its farm as ids only. Confirmations read these before taking the farm lock instead of loading the
     * request: its EAGER subscription would stay in the persistence context and lockByFarmId would not refresh it.
     */
    interface RequestFarm {
        Long getId();
        Long getFarmId();
    }

    @Query("select p.id as id, p.subscription.farm.id as farmId from Payment p where p.id = :id")
    Optional<RequestFarm> findRequestFarmById(@Param("id") Long id);

    /** Same case-insensitive match as findFirstByQuoteRefIgnoreCase; the first by id when codes differ only in case. */
    @Query("select p.id as id, p.subscription.farm.id as farmId from Payment p where upper(p.quoteRef) = upper(:quoteRef) order by p.id")
    List<RequestFarm> findRequestFarmsByQuoteRef(@Param("quoteRef") String quoteRef);
}
