package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FarmMembershipChange;

/** Append-only history of membership changes (D30); rows are only inserted. */
@Repository
public interface FarmMembershipChangeRepository extends JpaRepository<FarmMembershipChange, Long> {
    List<FarmMembershipChange> findByMembershipIdOrderByChangedAtAscIdAsc(Long membershipId);
}
