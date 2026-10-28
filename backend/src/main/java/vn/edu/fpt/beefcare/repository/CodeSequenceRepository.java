package vn.edu.fpt.beefcare.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CodeSequence;
import vn.edu.fpt.beefcare.domain.enumeration.CodeType;

@Repository
public interface CodeSequenceRepository extends JpaRepository<CodeSequence, Long> {

    Optional<CodeSequence> findByFarmIdAndCodeTypeAndPeriodYear(Long farmId, CodeType codeType, Integer periodYear);
}
