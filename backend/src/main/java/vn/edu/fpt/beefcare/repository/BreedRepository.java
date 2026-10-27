package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.Breed;

/**
 * Spring Data JPA repository for the Breed entity.
 */
@SuppressWarnings("unused")
@Repository
public interface BreedRepository extends JpaRepository<Breed, Long> {}
