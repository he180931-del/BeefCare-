package vn.edu.fpt.beefcare.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.ReceptionCheck;
import vn.edu.fpt.beefcare.service.dto.ApiMessage;
import vn.edu.fpt.beefcare.service.dto.PenHistoryDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveResultDTO;

/**
 * Pen moves (UC-FE04-05, GBR-20..22, BR-D09): one transaction, pens and cattle locked in ascending id order, capacity
 * checked for the cattle that really move, criteria advisory (warning reason stored on the new assignment).
 */
@Service
public class PenMoveService {

    static final String PEN_MOVE_REMINDER = "REM-08";
    static final String CORRECTION = "correction";

    private final FarmAccessService access;
    private final FarmClock clock;
    private final PenService penService;
    private final PenOccupancyService occupancy;
    private final PenAssignmentService assignments;
    private final ReceptionCriteriaService receptionCriteria;
    private final CattleGuardService cattleGuard;
    private final CattleRepository cattleRepository;
    private final FarmMembershipRepository membershipRepository;
    private final PenCriteriaVersionRepository criteriaRepository;
    private final ReminderRepository reminderRepository;
    private final AuditService audit;

    public PenMoveService(
        FarmAccessService access,
        FarmClock clock,
        PenService penService,
        PenOccupancyService occupancy,
        PenAssignmentService assignments,
        ReceptionCriteriaService receptionCriteria,
        CattleGuardService cattleGuard,
        CattleRepository cattleRepository,
        FarmMembershipRepository membershipRepository,
        PenCriteriaVersionRepository criteriaRepository,
        ReminderRepository reminderRepository,
        AuditService audit
    ) {
        this.access = access;
        this.clock = clock;
        this.penService = penService;
        this.occupancy = occupancy;
        this.assignments = assignments;
        this.receptionCriteria = receptionCriteria;
        this.cattleGuard = cattleGuard;
        this.cattleRepository = cattleRepository;
        this.membershipRepository = membershipRepository;
        this.criteriaRepository = criteriaRepository;
        this.reminderRepository = reminderRepository;
        this.audit = audit;
    }

    /** Dry run for the Move Pen popup: the reception-check table per cattle; writes nothing. */
    @Transactional(readOnly = true)
    public PenMoveCheckDTO check(Long farmId, PenMoveCheckRequest request) {
        access.require(farmId, FarmAction.MOVE_CATTLE);
        Pen toPen = penService.findPen(farmId, request.toPenId());
        LocalDate moveDate = request.moveDate() == null ? clock.today() : request.moveDate();
        int headcount = occupancy.headcount(toPen.getId());
        int free = Math.max(0, toPen.getCapacity() - headcount);
        boolean active = toPen.getStatus() == ActiveStatus.ACTIVE;
        Integer versionNo = receptionCriteria.currentVersion(toPen.getId()).map(PenCriteriaVersion::getVersionNo).orElse(null);
        List<PenMoveCheckDTO.CattleCheck> rows = new ArrayList<>();
        int moving = 0;
        for (Long id : new LinkedHashSet<>(request.cattleIds())) {
            Cattle cattle = cattleRepository.findByIdAndFarmId(id, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "cattle_id", id));
            Optional<PenAssignment> open = assignments.findOpen(id);
            ApiMessage error = null;
            try {
                cattleGuard.assertWritable(cattle);
                if (open.isEmpty()) {
                    throw DomainException.conflict(MessageCodes.COM_05);
                }
                if (moveDate.isAfter(clock.today()) || moveDate.isBefore(open.get().getFromDate())) {
                    throw DomainException.unprocessable(MessageCodes.FE04_09, "start_date", open.get().getFromDate());
                }
            } catch (DomainException e) {
                error = new ApiMessage(e.getCode(), e.getParams());
            }
            boolean already = open.isPresent() && open.get().getPen().getId().equals(toPen.getId());
            if (!already) {
                moving++;
            }
            ReceptionCheck rc = receptionCriteria.check(toPen, cattle, moveDate);
            ApiMessage warning = rc.allMet()
                ? null
                : new ApiMessage(
                    MessageCodes.FE04_06,
                    DomainException.params("cattle_code", cattle.getDisplayCode(), "pen_code", toPen.getCode(), "criteria", rc.unmetSummary())
                );
            rows.add(
                new PenMoveCheckDTO.CattleCheck(
                    id,
                    cattle.getDisplayCode(),
                    open.map(a -> a.getPen().getId()).orElse(null),
                    open.map(a -> a.getPen().getCode()).orElse(null),
                    open.map(PenAssignment::getFromDate).orElse(null),
                    already,
                    error,
                    rc.allMet(),
                    !rc.allMet(),
                    warning,
                    rc.results()
                )
            );
        }
        boolean blocked = moving > 0 && (!active || moving > free);
        ApiMessage block = blocked
            ? new ApiMessage(MessageCodes.FE04_05, DomainException.params("pen_code", toPen.getCode(), "count", moving, "free", active ? free : 0))
            : null;
        return new PenMoveCheckDTO(toPen.getId(), toPen.getCode(), active, toPen.getCapacity(), headcount, free, moving, blocked, block, versionNo, rows);
    }

    /** UC-FE04-05: confirms the move of one or several cattle; all or nothing. */
    @Transactional
    public PenMoveResultDTO move(Long farmId, PenMoveRequest request) {
        FarmContext ctx = access.require(farmId, FarmAction.MOVE_CATTLE);
        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();
        if (reason == null) {
            throw DomainException.required("reason");
        }
        if (reason.length() > 500) {
            throw DomainException.invalid("reason");
        }
        LocalDate moveDate = request.moveDate() == null ? clock.today() : request.moveDate();
        penService.findPen(farmId, request.toPenId());
        AppUser performer = performer(ctx, request.performedBy());
        Map<Long, String> warnings = request.warningReasons() == null ? Map.of() : request.warningReasons();
        Map<Long, Integer> versions = request.cattleVersions() == null ? Map.of() : request.cattleVersions();

        Set<Long> ids = new TreeSet<>(request.cattleIds());
        Map<Long, Cattle> cattle = new LinkedHashMap<>();
        Map<Long, PenAssignment> current = new LinkedHashMap<>();
        for (Long id : ids) {
            Cattle c = cattleGuard.lockWritable(farmId, id);
            VersionGuard.requireExpected(c.getVersion(), versions.get(id));
            cattle.put(id, c);
            current.put(id, assignments.findOpen(id).orElseThrow(() -> DomainException.conflict(MessageCodes.COM_05, "cattle_code", c.getDisplayCode())));
        }
        Set<Long> penIds = new TreeSet<>();
        penIds.add(request.toPenId());
        current.values().forEach(a -> penIds.add(a.getPen().getId()));
        Pen toPen = occupancy.lockPens(farmId, penIds).get(request.toPenId());

        List<PenMoveResultDTO.Skipped> skipped = new ArrayList<>();
        List<Long> moving = new ArrayList<>();
        for (Long id : ids) {
            if (current.get(id).getPen().getId().equals(toPen.getId())) {
                skipped.add(
                    new PenMoveResultDTO.Skipped(
                        id,
                        cattle.get(id).getDisplayCode(),
                        new ApiMessage(MessageCodes.FE04_07, DomainException.params("cattle_code", cattle.get(id).getDisplayCode(), "pen_code", toPen.getCode()))
                    )
                );
            } else {
                moving.add(id);
            }
        }
        if (!moving.isEmpty()) {
            occupancy.assertCanReceive(farmId, Map.of(toPen.getId(), moving.size()));
        }
        Map<Long, ReceptionCheck> checks = new LinkedHashMap<>();
        for (Long id : moving) {
            PenAssignment open = current.get(id);
            if (moveDate.isAfter(clock.today()) || moveDate.isBefore(open.getFromDate())) {
                throw DomainException.unprocessable(MessageCodes.FE04_09, "start_date", open.getFromDate());
            }
            ReceptionCheck check = receptionCriteria.check(toPen, cattle.get(id), moveDate);
            receptionCriteria.requireWarningReason(check, warnings.get(id), cattle.get(id).getDisplayCode());
            checks.put(id, check);
        }

        AssignmentSource source = CORRECTION.equalsIgnoreCase(reason) ? AssignmentSource.CORRECTION : AssignmentSource.MOVE;
        List<PenMoveResultDTO.Moved> moved = new ArrayList<>();
        for (Long id : moving) {
            Cattle c = cattle.get(id);
            Pen from = current.get(id).getPen();
            PenAssignment created = assignments.move(c, toPen, moveDate, source, reason, checks.get(id), warnings.get(id), performer);
            moved.add(
                new PenMoveResultDTO.Moved(id, c.getDisplayCode(), created.getId(), from.getId(), from.getCode(), toPen.getId(), toPen.getCode(), moveDate, source.name())
            );
            audit.log(
                ctx,
                "PEN_MOVE",
                "Cattle",
                id,
                DomainException.params(
                    "from_pen",
                    from.getCode(),
                    "to_pen",
                    toPen.getCode(),
                    "move_date",
                    moveDate,
                    "reason",
                    reason,
                    "source",
                    source,
                    "warning_reason",
                    created.getWarningReason(),
                    "criteria_version",
                    checks.get(id).criteriaVersionNo()
                )
            );
        }
        resolveSuggestions(farmId, moving);
        ApiMessage message = moved.isEmpty()
            ? null
            : new ApiMessage(MessageCodes.FE04_08, DomainException.params("moved", moved.size(), "pen_code", toPen.getCode()));
        return new PenMoveResultDTO(moved, skipped, message, penService.toDto(toPen));
    }

    /** Current pen and the pen history of a cattle, newest first (SCR-20 Pen History tab). */
    @Transactional(readOnly = true)
    public PenHistoryDTO history(Long farmId, Long cattleId) {
        access.require(farmId, FarmAction.VIEW_PENS);
        Cattle cattle = cattleRepository.findByIdAndFarmId(cattleId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "cattle_id", cattleId));
        List<PenAssignment> all = assignments.history(cattleId);
        List<PenHistoryDTO.Row> rows = all
            .stream()
            .sorted(Comparator.comparing(PenAssignment::getFromDate).thenComparing(PenAssignment::getId).reversed())
            .map(a ->
                new PenHistoryDTO.Row(
                    a.getId(),
                    a.getPen().getId(),
                    a.getPen().getCode(),
                    a.getPen().getName(),
                    a.getFromDate(),
                    a.getToDate(),
                    a.getSource().name(),
                    a.getReason(),
                    a.getWarningReason(),
                    a.getCriteriaVersion() == null ? null : a.getCriteriaVersion().getVersionNo(),
                    a.getMovedBy() == null ? null : a.getMovedBy().getId(),
                    a.getMovedBy() == null ? null : a.getMovedBy().getFullName(),
                    a.getRecordedAt()
                )
            )
            .toList();
        PenHistoryDTO.Current current = all
            .stream()
            .filter(a -> a.getToDate() == null)
            .findFirst()
            .map(a -> {
                Pen pen = a.getPen();
                PenCriteriaVersion v = criteriaRepository.findFirstByPenIdOrderByVersionNoDesc(pen.getId()).orElse(null);
                return new PenHistoryDTO.Current(
                    pen.getId(),
                    pen.getCode(),
                    pen.getName(),
                    a.getFromDate(),
                    occupancy.headcount(pen.getId()),
                    pen.getCapacity(),
                    PenService.acceptsSummary(v),
                    v == null ? null : v.getVersionNo()
                );
            })
            .orElse(null);
        return new PenHistoryDTO(cattle.getId(), cattle.getDisplayCode(), cattle.getHerdStatus().name(), current, rows);
    }

    private AppUser performer(FarmContext ctx, Long performedBy) {
        if (performedBy == null || performedBy.equals(ctx.user().getId())) {
            return ctx.user();
        }
        return membershipRepository
            .findFirstByFarmIdAndUserIdAndStatusIgnoreCase(ctx.farmId(), performedBy, FarmAccessService.ACTIVE)
            .map(m -> m.getUser())
            .orElseThrow(() -> DomainException.invalid("performedBy"));
    }

    private void resolveSuggestions(Long farmId, List<Long> movedCattleIds) {
        if (movedCattleIds.isEmpty()) {
            return;
        }
        List<Reminder> reminders = reminderRepository.findAllByFarmIdAndCattleIdInAndRuleTypeAndStatus(farmId, movedCattleIds, PEN_MOVE_REMINDER, "ACTIVE");
        reminders.forEach(r -> r.setStatus("RESOLVED"));
        reminderRepository.saveAll(reminders);
    }
}
