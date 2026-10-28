package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PenCriteriaVersion;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenCriteriaVersionRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.repository.PregnancyEpisodeRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.service.dto.ApiMessage;
import vn.edu.fpt.beefcare.service.dto.PenAvailabilityRequest;
import vn.edu.fpt.beefcare.service.dto.PenCattleDTO;
import vn.edu.fpt.beefcare.service.dto.PenCriteriaDTO;
import vn.edu.fpt.beefcare.service.dto.PenCriteriaVersionDTO;
import vn.edu.fpt.beefcare.service.dto.PenDTO;
import vn.edu.fpt.beefcare.service.dto.PenListDTO;
import vn.edu.fpt.beefcare.service.dto.PenRequest;

/**
 * Pens of a farm (FE-04): list / detail, create, edit with criteria versioning (GBR-21), stop / resume (GBR-20).
 * Pens with assignment history are never deleted (GBR-19): there is no delete command.
 */
@Service
public class PenService {

    static final String ACTION_CREATE = "PEN_CREATE";
    static final String ACTION_UPDATE = "PEN_UPDATE";
    static final String ACTION_AVAILABILITY = "PEN_AVAILABILITY";

    private final FarmAccessService access;
    private final FarmClock clock;
    private final PenRepository penRepository;
    private final PenCriteriaVersionRepository criteriaRepository;
    private final PenAssignmentRepository assignmentRepository;
    private final PenOccupancyService occupancy;
    private final ReceptionCriteriaService receptionCriteria;
    private final CattleGuardService cattleGuard;
    private final PregnancyEpisodeRepository pregnancyRepository;
    private final ReminderRepository reminderRepository;
    private final AuditService audit;

    public PenService(
        FarmAccessService access,
        FarmClock clock,
        PenRepository penRepository,
        PenCriteriaVersionRepository criteriaRepository,
        PenAssignmentRepository assignmentRepository,
        PenOccupancyService occupancy,
        ReceptionCriteriaService receptionCriteria,
        CattleGuardService cattleGuard,
        PregnancyEpisodeRepository pregnancyRepository,
        ReminderRepository reminderRepository,
        AuditService audit
    ) {
        this.access = access;
        this.clock = clock;
        this.penRepository = penRepository;
        this.criteriaRepository = criteriaRepository;
        this.assignmentRepository = assignmentRepository;
        this.occupancy = occupancy;
        this.receptionCriteria = receptionCriteria;
        this.cattleGuard = cattleGuard;
        this.pregnancyRepository = pregnancyRepository;
        this.reminderRepository = reminderRepository;
        this.audit = audit;
    }

    // ---- queries -------------------------------------------------------------------------------------------

    /** UC-FE04-01: pens with occupancy; the header counts ACTIVE pens only. */
    @Transactional(readOnly = true)
    public PenListDTO list(Long farmId, ActiveStatus status, String q) {
        access.require(farmId, FarmAction.VIEW_PENS);
        List<Pen> all = penRepository.findAllByFarmIdOrderByCodeAsc(farmId);
        List<Long> ids = all.stream().map(Pen::getId).toList();
        Map<Long, Integer> headcounts = occupancy.headcounts(ids);
        Map<Long, PenCriteriaVersion> current = currentVersions(ids);
        int used = 0;
        int total = 0;
        for (Pen p : all) {
            if (p.getStatus() == ActiveStatus.ACTIVE) {
                used += headcounts.get(p.getId());
                total += p.getCapacity();
            }
        }
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        List<PenDTO> pens = all
            .stream()
            .filter(p -> status == null || p.getStatus() == status)
            .filter(p -> needle.isEmpty() || p.getCode().toLowerCase(Locale.ROOT).contains(needle) || p.getName().toLowerCase(Locale.ROOT).contains(needle))
            .map(p -> toDto(p, headcounts.get(p.getId()), current.get(p.getId())))
            .toList();
        return new PenListDTO(pens, pens.size(), used, total);
    }

    /** Pen detail: criteria version history and the cattle currently in the pen. */
    @Transactional(readOnly = true)
    public PenDTO get(Long farmId, Long penId) {
        access.require(farmId, FarmAction.VIEW_PENS);
        Pen pen = findPen(farmId, penId);
        return detail(pen, null);
    }

    // ---- commands ------------------------------------------------------------------------------------------

    /** UC-FE04-02: creates the pen and criteria version 1 (MSG-FE04-01). */
    @Transactional
    public PenDTO create(Long farmId, PenRequest request) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_PENS);
        String code = request.code().trim();
        if (penRepository.existsByFarmIdAndCodeIgnoreCase(farmId, code)) {
            throw DomainException.unprocessable(MessageCodes.FE04_02, "pen_code", code);
        }
        Pen pen = new Pen();
        pen.setFarm(ctx.farm());
        pen.setCode(code);
        pen.setName(request.name().trim());
        pen.setCapacity(request.capacity());
        pen.setDescription(blankToNull(request.description()));
        pen.setStatus(request.initialStatus() == null ? ActiveStatus.ACTIVE : request.initialStatus());
        pen.setStatusEffectiveDate(clock.today());
        pen.setCreatedBy(ctx.user());
        pen = saveUnique(pen, code);
        PenCriteriaVersion v = newVersion(pen, 1, request.criteria(), ctx.user());
        audit.log(ctx, ACTION_CREATE, "Pen", pen.getId(), Map.of("code", code, "capacity", pen.getCapacity(), "status", pen.getStatus(), "criteria", criteriaDto(v)));
        return detail(pen, saved(pen));
    }

    /** UC-FE04-03: edits the pen; changed criteria become a new version from today (GBR-21). */
    @Transactional
    public PenDTO update(Long farmId, Long penId, PenRequest request) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_PENS);
        Pen pen = occupancy.lockPens(farmId, List.of(requirePenId(farmId, penId))).get(penId);
        VersionGuard.check(pen.getVersion(), request.expectedVersion());
        String code = request.code().trim();
        if (!code.equalsIgnoreCase(pen.getCode()) && penRepository.existsByFarmIdAndCodeIgnoreCase(farmId, code)) {
            throw DomainException.unprocessable(MessageCodes.FE04_02, "pen_code", code);
        }
        int headcount = occupancy.headcount(penId);
        if (request.capacity() < headcount) {
            throw DomainException.unprocessable(MessageCodes.FE04_03, "min_capacity", Math.max(1, headcount), "headcount", headcount);
        }
        PenCriteriaVersion before = criteriaRepository.findFirstByPenIdOrderByVersionNoDesc(penId).orElse(null);
        Map<String, Object> beforeSnapshot = Map.of("code", pen.getCode(), "name", pen.getName(), "capacity", pen.getCapacity(), "criteria", criteriaDto(before));
        pen.setCode(code);
        pen.setName(request.name().trim());
        pen.setCapacity(request.capacity());
        pen.setDescription(blankToNull(request.description()));
        pen.setUpdatedAt(clock.now());
        pen = saveUnique(pen, code);
        PenCriteriaVersion after = before;
        if (request.criteria() != null && !sameCriteria(before, request.criteria())) {
            after = newVersion(pen, before == null ? 1 : before.getVersionNo() + 1, request.criteria(), ctx.user());
        }
        audit.log(
            ctx,
            ACTION_UPDATE,
            "Pen",
            pen.getId(),
            Map.of("before", beforeSnapshot, "after", Map.of("code", code, "name", pen.getName(), "capacity", pen.getCapacity(), "criteria", criteriaDto(after)), "newCriteriaVersion", after != before)
        );
        return detail(pen, saved(pen));
    }

    /** UC-FE04-04: stops / resumes new placements; the cattle already in the pen stay (MSG-FE04-04). */
    @Transactional
    public PenDTO changeAvailability(Long farmId, Long penId, PenAvailabilityRequest request) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_PENS);
        Pen pen = occupancy.lockPens(farmId, List.of(requirePenId(farmId, penId))).get(penId);
        VersionGuard.check(pen.getVersion(), request.expectedVersion());
        if (request.reason() == null || request.reason().isBlank()) {
            throw DomainException.required("reason");
        }
        clock.assertNotFuture(request.effectiveDate());
        if (request.status() == pen.getStatus()) {
            throw DomainException.conflict(MessageCodes.COM_05, "pen_code", pen.getCode(), "status", pen.getStatus());
        }
        ActiveStatus previous = pen.getStatus();
        pen.setStatus(request.status());
        pen.setStatusEffectiveDate(request.effectiveDate());
        pen.setStatusReason(request.reason().trim());
        pen.setUpdatedAt(clock.now());
        penRepository.saveAndFlush(pen);
        audit.log(
            ctx,
            ACTION_AVAILABILITY,
            "Pen",
            pen.getId(),
            Map.of("from", previous, "to", request.status(), "effectiveDate", request.effectiveDate(), "reason", pen.getStatusReason())
        );
        return detail(pen, new ApiMessage(MessageCodes.FE04_04, DomainException.params("pen_code", pen.getCode(), "status", pen.getStatus())));
    }

    // ---- views shared with the move service --------------------------------------------------------------

    @Transactional(readOnly = true)
    public PenDTO toDto(Pen pen) {
        return toDto(pen, occupancy.headcount(pen.getId()), criteriaRepository.findFirstByPenIdOrderByVersionNoDesc(pen.getId()).orElse(null));
    }

    PenDTO toDto(Pen pen, int headcount, PenCriteriaVersion current) {
        int free = Math.max(0, pen.getCapacity() - headcount);
        PenCriteriaVersionDTO c = current == null ? null : versionDto(current);
        return new PenDTO(
            pen.getId(),
            pen.getCode(),
            pen.getName(),
            pen.getCapacity(),
            pen.getDescription(),
            pen.getStatus(),
            pen.getStatusEffectiveDate(),
            pen.getStatusReason(),
            headcount,
            free,
            free == 0,
            acceptsSummary(current),
            c,
            pen.getVersion(),
            null,
            null,
            null
        );
    }

    /** "All" when no criterion is set, else e.g. "BREEDING/FATTENING | ADULT | FEMALE | age >= 12 | weight >= 250". */
    public static String acceptsSummary(PenCriteriaVersion v) {
        List<String> rows = criteriaRows(v);
        return rows.isEmpty() ? "All" : String.join(" | ", rows);
    }

    private PenDTO detail(Pen pen, ApiMessage message) {
        List<PenCriteriaVersion> versions = criteriaRepository.findAllByPenIdOrderByVersionNoDesc(pen.getId());
        PenCriteriaVersion current = versions.isEmpty() ? null : versions.get(0);
        PenDTO base = toDto(pen, occupancy.headcount(pen.getId()), current);
        List<PenCattleDTO> cattle = assignmentRepository
            .findAllByPenIdAndToDateIsNull(pen.getId())
            .stream()
            .sorted(Comparator.comparing((PenAssignment a) -> a.getCattle().getDisplayCode()))
            .map(this::cattleInPen)
            .toList();
        return new PenDTO(
            base.id(),
            base.code(),
            base.name(),
            base.capacity(),
            base.description(),
            base.status(),
            base.statusEffectiveDate(),
            base.statusReason(),
            base.headcount(),
            base.freePlaces(),
            base.full(),
            base.acceptsSummary(),
            base.currentCriteria(),
            base.version(),
            versions.stream().map(this::versionDto).toList(),
            cattle,
            message
        );
    }

    private PenCattleDTO cattleInPen(PenAssignment a) {
        Cattle c = a.getCattle();
        List<ApiMessage> hints = new ArrayList<>();
        boolean exitPending = cattleGuard.isExitPending(c.getId());
        if (exitPending) {
            hints.add(new ApiMessage("EXIT_PENDING", Map.of()));
        }
        pregnancyRepository
            .findFirstByCattleIdAndStatus(c.getId(), "OPEN")
            .ifPresent(p -> hints.add(new ApiMessage("PREGNANT", DomainException.params("expectedCalvingDate", p.getExpectedCalvingDate()))));
        if (!reminderRepository.findAllByFarmIdAndCattleIdInAndRuleTypeAndStatus(c.getFarm().getId(), List.of(c.getId()), PenMoveService.PEN_MOVE_REMINDER, "ACTIVE").isEmpty()) {
            hints.add(new ApiMessage("PEN_MOVE_SUGGESTED", Map.of()));
        }
        BigDecimal weight = receptionCriteria.latestWeightKg(c.getId()).orElse(null);
        return new PenCattleDTO(c.getId(), c.getDisplayCode(), c.getEarTagNumber(), c.getName(), c.getSex(), c.getLifeStage(), a.getFromDate(), weight, exitPending, hints);
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    Pen findPen(Long farmId, Long penId) {
        return penRepository.findByIdAndFarmId(penId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "pen_id", penId));
    }

    private Long requirePenId(Long farmId, Long penId) {
        findPen(farmId, penId);
        return penId;
    }

    private Pen saveUnique(Pen pen, String code) {
        try {
            return penRepository.saveAndFlush(pen);
        } catch (DataIntegrityViolationException e) {
            throw DomainException.unprocessable(MessageCodes.FE04_02, "pen_code", code);
        }
    }

    private ApiMessage saved(Pen pen) {
        return new ApiMessage(MessageCodes.FE04_01, DomainException.params("pen_code", pen.getCode()));
    }

    private PenCriteriaVersion newVersion(Pen pen, int versionNo, PenCriteriaDTO c, AppUser by) {
        PenCriteriaVersion v = new PenCriteriaVersion();
        v.setFarm(pen.getFarm());
        v.setPen(pen);
        v.setVersionNo(versionNo);
        if (c != null) {
            v.setPurposeTypes(nullIfEmpty(c.purposeTypes()));
            v.setLifeStages(nullIfEmpty(c.lifeStages()));
            v.setSex(c.sex());
            v.setMinAgeMonths(c.minAgeMonths());
            v.setMinWeightKg(c.minWeightKg());
        }
        v.setEffectiveFrom(clock.today());
        v.setChangedBy(by);
        v.setCreatedAt(clock.now());
        return criteriaRepository.saveAndFlush(v);
    }

    private static boolean sameCriteria(PenCriteriaVersion v, PenCriteriaDTO c) {
        Set<PurposeType> purposes = v == null || v.getPurposeTypes() == null ? Set.of() : v.getPurposeTypes();
        Set<LifeStage> stages = v == null || v.getLifeStages() == null ? Set.of() : v.getLifeStages();
        return (
            purposes.equals(c.purposeTypes() == null ? Set.of() : c.purposeTypes()) &&
            stages.equals(c.lifeStages() == null ? Set.of() : c.lifeStages()) &&
            Objects.equals(v == null ? null : v.getSex(), c.sex()) &&
            Objects.equals(v == null ? null : v.getMinAgeMonths(), c.minAgeMonths()) &&
            sameDecimal(v == null ? null : v.getMinWeightKg(), c.minWeightKg())
        );
    }

    private static boolean sameDecimal(BigDecimal a, BigDecimal b) {
        return a == null || b == null ? a == b : a.compareTo(b) == 0;
    }

    private static <E extends Enum<E>> Set<E> nullIfEmpty(Set<E> set) {
        return set == null || set.isEmpty() ? null : EnumSet.copyOf(set);
    }

    private Map<Long, PenCriteriaVersion> currentVersions(Collection<Long> penIds) {
        Map<Long, PenCriteriaVersion> result = new HashMap<>();
        if (penIds.isEmpty()) {
            return result;
        }
        for (PenCriteriaVersion v : criteriaRepository.findAllByPenIdIn(penIds)) {
            result.merge(v.getPen().getId(), v, (a, b) -> a.getVersionNo() >= b.getVersionNo() ? a : b);
        }
        return result;
    }

    private PenCriteriaDTO criteriaDto(PenCriteriaVersion v) {
        if (v == null) {
            return new PenCriteriaDTO(null, null, null, null, null);
        }
        return new PenCriteriaDTO(
            v.getPurposeTypes() == null || v.getPurposeTypes().isEmpty() ? null : new java.util.TreeSet<>(v.getPurposeTypes()),
            v.getLifeStages() == null || v.getLifeStages().isEmpty() ? null : new java.util.TreeSet<>(v.getLifeStages()),
            v.getSex(),
            v.getMinAgeMonths(),
            v.getMinWeightKg()
        );
    }

    PenCriteriaVersionDTO versionDto(PenCriteriaVersion v) {
        return new PenCriteriaVersionDTO(
            v.getId(),
            v.getVersionNo(),
            v.getEffectiveFrom(),
            v.getChangedBy().getId(),
            v.getChangedBy().getFullName(),
            criteriaDto(v),
            criteriaRows(v)
        );
    }

    private static List<String> criteriaRows(PenCriteriaVersion v) {
        List<String> rows = new ArrayList<>();
        if (v == null) {
            return rows;
        }
        if (v.getPurposeTypes() != null && !v.getPurposeTypes().isEmpty()) {
            rows.add(v.getPurposeTypes().stream().sorted().map(Enum::name).collect(Collectors.joining("/")));
        }
        if (v.getLifeStages() != null && !v.getLifeStages().isEmpty()) {
            rows.add(v.getLifeStages().stream().sorted().map(Enum::name).collect(Collectors.joining("/")));
        }
        if (v.getSex() != null) {
            rows.add(v.getSex().name());
        }
        if (v.getMinAgeMonths() != null) {
            rows.add("age >= " + v.getMinAgeMonths() + " months");
        }
        if (v.getMinWeightKg() != null) {
            rows.add("weight >= " + v.getMinWeightKg().stripTrailingZeros().toPlainString() + " kg");
        }
        return rows;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
