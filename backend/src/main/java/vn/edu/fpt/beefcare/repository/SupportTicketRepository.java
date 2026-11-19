package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.SupportTicket;

/**
 * Spring Data JPA repository for the SupportTicket entity.
 */
@SuppressWarnings("unused")
@Repository
public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {}
