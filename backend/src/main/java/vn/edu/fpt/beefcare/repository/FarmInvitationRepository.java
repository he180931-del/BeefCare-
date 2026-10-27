package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FarmInvitation;

/**
 * Spring Data JPA repository for the FarmInvitation entity.
 */
@SuppressWarnings("unused")
@Repository
public interface FarmInvitationRepository extends JpaRepository<FarmInvitation, Long> {}
