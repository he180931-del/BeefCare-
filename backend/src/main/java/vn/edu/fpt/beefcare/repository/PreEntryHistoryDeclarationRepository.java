package vn.edu.fpt.beefcare.repository;

import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration;

@Repository
public interface PreEntryHistoryDeclarationRepository extends JpaRepository<PreEntryHistoryDeclaration, Long> {
    List<PreEntryHistoryDeclaration> findAllByHerdEntryId(Long herdEntryId);
}
