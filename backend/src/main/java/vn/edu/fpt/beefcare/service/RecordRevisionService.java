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
    /** D62: mở lại ca sức khỏe đã đóng. */
    public static final String REOPEN = "REOPEN";
    private static final int MAX_REASON_LENGTH = 500;

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
        return save(ctx, sourceType, sourceId, action, reason, before, after);
    }

    /**
     * Giống {@link #record} nhưng lý do là <b>ghi chú tùy chọn</b> (FE-08: sửa / xóa bản ghi cân không bắt buộc lý do).
     * Vẫn lưu đủ giá trị trước / sau, người và thời điểm; ghi chú trống được lưu là {@code null}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public RecordRevision recordWithOptionalNote(
        FarmContext ctx,
        String sourceType,
        Long sourceId,
        String action,
        String note,
        Object before,
        Object after
    ) {
        return save(ctx, sourceType, sourceId, action, note, before, after);
    }

    private RecordRevision save(FarmContext ctx, String sourceType, Long sourceId, String action, String reason, Object before, Object after) {
        if (reason != null && reason.length() > MAX_REASON_LENGTH) {
            throw DomainException.invalid("reason");
        }
        RecordRevision revision = new RecordRevision();
        revision.setFarm(ctx.farm());
        revision.setActor(ctx.user());
        revision.setSourceType(sourceType);
        revision.setSourceId(sourceId);
        revision.setAction(action);
        revision.setReason(reason == null || reason.isBlank() ? null : reason.trim());
        revision.setBeforeSnapshot(JsonSupport.toJson(before));
        revision.setAfterSnapshot(JsonSupport.toJson(after));
        revision.setChangedAt(clock.now());
        return repository.save(revision);
    }

    @Transactional(readOnly = true)
    public java.util.List<RecordRevision> history(String sourceType, Long sourceId) {
        return repository.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc(sourceType, sourceId);
    }
}
