package vn.edu.fpt.beefcare.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;

/** Writes the audit_log entry of a command in the command's own transaction. */
@Service
public class AuditService {

    private final AuditLogRepository repository;
    private final FarmClock clock;

    public AuditService(AuditLogRepository repository, FarmClock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * @param action     at most 30 characters, e.g. PEN_MOVE, ENTRY_POST, PAYMENT_RECORD
     * @param targetType entity name, e.g. HerdEntryVoucher
     * @param details    any JSON-serialisable object (may be null)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog log(Farm farm, AppUser actor, String action, String targetType, Long targetId, Object details) {
        AuditLog entry = new AuditLog();
        entry.setFarm(farm);
        entry.setActor(actor);
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setLoggedAt(clock.now());
        entry.setDetails(JsonSupport.toJson(details));
        return repository.save(entry);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public AuditLog log(FarmContext ctx, String action, String targetType, Long targetId, Object details) {
        return log(ctx.farm(), ctx.user(), action, targetType, targetId, details);
    }
}
