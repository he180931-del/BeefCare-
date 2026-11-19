package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.TicketMessage;

/**
 * Spring Data JPA repository for the TicketMessage entity.
 */
@SuppressWarnings("unused")
@Repository
public interface TicketMessageRepository extends JpaRepository<TicketMessage, Long> {}
