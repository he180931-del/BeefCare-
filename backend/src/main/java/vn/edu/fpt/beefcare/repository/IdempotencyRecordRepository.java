package vn.edu.fpt.beefcare.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.IdempotencyRecord;

@Repository
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, Long> {
    Optional<IdempotencyRecord> findByActorIdAndFarmScopeAndActionAndIdempotencyKey(
        Long actorId, Long farmScope, String action, String idempotencyKey
    );
}
