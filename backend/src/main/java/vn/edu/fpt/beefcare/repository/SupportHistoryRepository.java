package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.SupportHistory;

/**
 * Spring Data JPA repository for the SupportHistory entity.
 */
@SuppressWarnings("unused")
@Repository
public interface SupportHistoryRepository extends JpaRepository<SupportHistory, Long> {}
