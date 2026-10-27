package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.HerdEntry;

/**
 * Spring Data JPA repository for the HerdEntry entity.
 */
@SuppressWarnings("unused")
@Repository
public interface HerdEntryRepository extends JpaRepository<HerdEntry, Long> {}
