package vn.edu.fpt.beefcare.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.ReceptionCheck;

/**
 * Pen assignments (GBR-22, BR-D09): at most one OPEN assignment per cattle, periods never overlap, to >= from,
 * an assignment never exceeds pen capacity, and only an ACTIVE pen takes new placements. The same rules are
 * enforced in the database on PostgreSQL (partial unique index, EXCLUDE constraint, capacity trigger).
 * Callers run inside their command transaction; pens are locked (PESSIMISTIC_WRITE) here.
 */
@Service
public class PenAssignmentService {

    private final PenAssignmentRepository repository;
    private final PenCriteriaVersionRepository criteriaVersionRepository;
    private final PenOccupancyService occupancy;
    private final ReceptionCriteriaService receptionCriteria;
    private final FarmClock clock;

    public PenAssignmentService(
        PenAssignmentRepository repository,
        PenCriteriaVersionRepository criteriaVersionRepository,
        PenOccupancyService occupancy,
        ReceptionCriteriaService receptionCriteria,
        FarmClock clock
    ) {
        this.repository = repository;
        this.criteriaVersionRepository = criteriaVersionRepository;
        this.occupancy = occupancy;
        this.receptionCriteria = receptionCriteria;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<PenAssignment> findOpen(Long cattleId) {
        return repository.findFirstByCattleIdAndToDateIsNull(cattleId);
    }

    @Transactional(readOnly = true)
    public List<PenAssignment> history(Long cattleId) {
        return repository.findAllByCattleIdOrderByFromDateAscIdAsc(cattleId);
    }

    /**
     * Opens a placement of an ACTIVE cattle with no open assignment.
     *
     * @param check         result of the reception check against the pen's current criteria (null for no check)
     * @param warningReason required (MSG-FE04-06) when the check has an unmet criterion; stored with the placement
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public PenAssignment openAssignment(
        Cattle cattle,
        Pen pen,
        LocalDate fromDate,
        AssignmentSource source,
        String reason,
        ReceptionCheck check,
        String warningReason,
        AppUser movedBy
    ) {
        if (fromDate == null) {
            throw DomainException.required("fromDate");
        }
        clock.assertNotFuture(fromDate);
        Long farmId = cattle.getFarm().getId();
        if (!farmId.equals(pen.getFarm().getId())) {
            throw DomainException.unprocessable(MessageCodes.COM_08);
        }
        if (cattle.getHerdStatus() != HerdStatus.ACTIVE) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        Pen locked = occupancy.lockPens(farmId, List.of(pen.getId())).get(pen.getId());
        if (locked.getStatus() != ActiveStatus.ACTIVE) {
            throw DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", locked.getCode(), "count", 1, "free", 0);
        }
        if (repository.findFirstByCattleIdAndToDateIsNull(cattle.getId()).isPresent()) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        if (repository.existsOverlappingFrom(cattle.getId(), fromDate)) {
            throw DomainException.unprocessable(MessageCodes.FE04_09, "start_date", latestEnd(cattle.getId()));
        }
        int free = locked.getCapacity() - occupancy.headcount(locked.getId());
        if (free < 1) {
            throw DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", locked.getCode(), "count", 1, "free", Math.max(free, 0));
        }
        String storedWarning = null;
        PenAssignment a = new PenAssignment();
        if (check != null) {
            storedWarning = receptionCriteria.requireWarningReason(check, warningReason, cattle.getDisplayCode());
            if (check.criteriaVersionId() != null) {
                a.setCriteriaVersion(criteriaVersionRepository.getReferenceById(check.criteriaVersionId()));
            }
            a.setReceptionCheck(JsonSupport.toJson(check));
        } else if (warningReason != null && !warningReason.isBlank()) {
            storedWarning = warningReason.trim();
        }
        if (reason != null && reason.length() > 500) {
            throw DomainException.invalid("reason");
        }
        a.setFarm(cattle.getFarm());
        a.setCattle(cattle);
        a.setPen(locked);
        a.setFromDate(fromDate);
        a.setSource(source);
        a.setReason(reason == null || reason.isBlank() ? null : reason.trim());
        a.setWarningReason(storedWarning);
        a.setMovedBy(movedBy);
        a.setRecordedAt(clock.now());
        return repository.saveAndFlush(a);
    }

    /**
     * Closes the OPEN assignment at {@code toDate}: not before its from-date and not in the future (MSG-FE04-09).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public PenAssignment closeAssignment(Cattle cattle, LocalDate toDate) {
        PenAssignment open = repository
            .findFirstByCattleIdAndToDateIsNull(cattle.getId())
            .orElseThrow(() -> DomainException.conflict(MessageCodes.COM_05));
        if (toDate == null) {
            throw DomainException.required("toDate");
        }
        if (toDate.isBefore(open.getFromDate()) || toDate.isAfter(clock.today())) {
            throw DomainException.unprocessable(MessageCodes.FE04_09, "start_date", open.getFromDate());
        }
        open.setToDate(toDate);
        return repository.saveAndFlush(open);
    }

    /**
     * Moves a cattle: closes its open assignment at {@code moveDate} and opens the new one from the same date, in the
     * caller's transaction (GBR-22). A correction of a wrong move is a reverse move with source CORRECTION.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public PenAssignment move(
        Cattle cattle,
        Pen toPen,
        LocalDate moveDate,
        AssignmentSource source,
        String reason,
        ReceptionCheck check,
        String warningReason,
        AppUser movedBy
    ) {
        PenAssignment current = repository
            .findFirstByCattleIdAndToDateIsNull(cattle.getId())
            .orElseThrow(() -> DomainException.conflict(MessageCodes.COM_05));
        if (current.getPen().getId().equals(toPen.getId())) {
            throw DomainException.unprocessable(MessageCodes.FE04_07, "cattle_code", cattle.getDisplayCode(), "pen_code", toPen.getCode());
        }
        // validate the destination (and its reception warning) before touching the open assignment
        if (check != null) {
            receptionCriteria.requireWarningReason(check, warningReason, cattle.getDisplayCode());
        }
        closeAssignment(cattle, moveDate);
        return openAssignment(cattle, toPen, moveDate, source, reason, check, warningReason, movedBy);
    }

    private LocalDate latestEnd(Long cattleId) {
        return repository
            .findAllByCattleIdOrderByFromDateAscIdAsc(cattleId)
            .stream()
            .map(PenAssignment::getToDate)
            .filter(d -> d != null)
            .max(LocalDate::compareTo)
            .orElse(null);
    }
}
