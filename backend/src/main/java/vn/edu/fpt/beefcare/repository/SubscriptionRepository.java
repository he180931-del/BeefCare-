package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Subscription;

/**
 * Spring Data JPA repository for the Subscription entity.
 */
@SuppressWarnings("unused")
@Repository
public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {}
