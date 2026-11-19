package vn.edu.fpt.beefcare.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;

/**
 * BR-D15: corrections, exclusions and voids never overwrite the original values; a revision with the before / after
 * values, reason, actor and time is saved in the same transaction as the change. Revisions are append-only.
 */
@Service
public class RecordRevisionService {

    public static final String CORRECT = "CORRECT";
    public static final String VOID = "VOID";

    private final RecordRevisionRepository repository;
    private final FarmClock clock;

    public RecordRevisionService(RecordRevisionRepository repository, FarmClock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * @param action CORRECT or VOID
     * @param before snapshot (JSON-serialisable object, Map or null) of the values before the change
     * @param after  snapshot after the change
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public RecordRevision record(FarmContext ctx, String sourceType, Long sourceId, String action, String reason, Object before, Object after) {
        if (reason == null || reason.isBlank()) {
            throw DomainException.required("reason");
        }
        if (reason.length() > 500) {
            throw DomainException.invalid("reason");
        }
        RecordRevision revision = new RecordRevision();
        revision.setFarm(ctx.farm());
        revision.setActor(ctx.user());
        revision.setSourceType(sourceType);
        revision.setSourceId(sourceId);
        revision.setAction(action);
        revision.setReason(reason.trim());
        revision.setBeforeSnapshot(JsonSupport.toJson(before));
        revision.setAfterSnapshot(JsonSupport.toJson(after));
        revision.setChangedAt(clock.now());
        return repository.save(revision);
    }
}
