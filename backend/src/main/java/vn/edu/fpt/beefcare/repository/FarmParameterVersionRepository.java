package vn.edu.fpt.beefcare.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import java.util.Optional;

@Repository
public interface FarmParameterVersionRepository extends JpaRepository<FarmParameterVersion, Long> {
    Optional<FarmParameterVersion> findFirstByFarm_IdOrderByVersionNoDesc(Long farmId);
}
