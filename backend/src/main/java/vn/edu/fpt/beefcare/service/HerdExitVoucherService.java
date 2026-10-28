package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HealthCaseRepository;
import vn.edu.fpt.beefcare.repository.HerdExitQueryRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.HerdExitVoucherRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.repository.ScheduledDoseRepository;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.HerdExitCheckService.Collected;
import vn.edu.fpt.beefcare.service.ReceptionCriteriaService.ReceptionCheck;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.AssignmentRef;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.CattleCheck;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.CattleEffects;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.ChecksResult;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.ConfirmResult;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Detail;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.DismissResult;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.HistoryEvent;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.LatestWeight;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.ListResult;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Message;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Occupancy;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.PenOption;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Ref;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Row;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.SelectableCattle;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.StoredLine;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.Tiles;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.VoidCattle;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.VoidCheck;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO.VoidResult;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherRequests;
import vn.edu.fpt.beefcare.service.dto.PaymentSummaryDTO;
import vn.edu.fpt.beefcare.service.dto.VoucherPaymentDTO;

/**
 * Herd exit vouchers (FE-13): Owner-only create / edit / confirm / dismiss / void (GBR-34, GBR-94); Managers may read.
 * Every command is one transaction. The confirmation applies GBR-35 to every line or to none; a PENDING death voucher
 * proposed from a health case is created through {@link #createPendingLossVoucher} in the health-case transaction.
 */
@Service
public class HerdExitVoucherService {

    static final String REMINDER_RULE = HerdExitCheckService.REM_12;
    static final String TARGET = "HerdExitVoucher";
    private static final BigDecimal MIN_WEIGHT = BigDecimal.ONE;
    private static final BigDecimal MAX_WEIGHT = new BigDecimal("1500");

    private final FarmAccessService access;
    private final FarmClock clock;
    private final HerdExitVoucherRepository vouchers;
    private final HerdExitRepository lines;
    private final CattleRepository cattleRepository;
    private final CattleQrTagRepository qrTags;
    private final TradingPartnerRepository partners;
    private final PenRepository penRepository;
    private final HealthCaseRepository healthCases;
    private final ScheduledDoseRepository doseRepository;
    private final ReminderRepository reminderRepository;
    private final VoucherPaymentRepository paymentRepository;
    private final HerdExitQueryRepository queries;
    private final CattleGuardService guard;
    private final PenAssignmentService penAssignments;
    private final PenOccupancyService occupancy;
    private final ReceptionCriteriaService criteria;
    private final CodeSequenceService codes;
    private final AuditService audit;
    private final RecordRevisionService revisions;
    private final VoucherPaymentService payments;
    private final HerdExitCheckService checks;

    public HerdExitVoucherService(
        FarmAccessService access,
        FarmClock clock,
        HerdExitVoucherRepository vouchers,
        HerdExitRepository lines,
        CattleRepository cattleRepository,
        CattleQrTagRepository qrTags,
        TradingPartnerRepository partners,
        PenRepository penRepository,
        HealthCaseRepository healthCases,
        ScheduledDoseRepository doseRepository,
        ReminderRepository reminderRepository,
        VoucherPaymentRepository paymentRepository,
        HerdExitQueryRepository queries,
        CattleGuardService guard,
        PenAssignmentService penAssignments,
        PenOccupancyService occupancy,
        ReceptionCriteriaService criteria,
        CodeSequenceService codes,
        AuditService audit,
        RecordRevisionService revisions,
        VoucherPaymentService payments,
        HerdExitCheckService checks
    ) {
        this.access = access;
        this.clock = clock;
        this.vouchers = vouchers;
        this.lines = lines;
        this.cattleRepository = cattleRepository;
        this.qrTags = qrTags;
        this.partners = partners;
        this.penRepository = penRepository;
        this.healthCases = healthCases;
        this.doseRepository = doseRepository;
        this.reminderRepository = reminderRepository;
        this.paymentRepository = paymentRepository;
        this.queries = queries;
        this.guard = guard;
        this.penAssignments = penAssignments;
        this.occupancy = occupancy;
        this.criteria = criteria;
        this.codes = codes;
        this.audit = audit;
        this.revisions = revisions;
        this.payments = payments;
        this.checks = checks;
    }

    // ================================================================== queries

    /** SCR-41: summary tiles, status counts and rows for the period (default: previous quarter start to today). */
    @Transactional(readOnly = true)
    public ListResult list(Long farmId, Collection<ExitVoucherStatus> statuses, ExitType type, LocalDate from, LocalDate to) {
        access.require(farmId, FarmAction.VIEW_EXIT_VOUCHERS);
        LocalDate today = clock.today();
        LocalDate end = to == null ? today : to;
        LocalDate start = from == null ? previousQuarterStart(today) : from;
        if (start.isAfter(end)) {
            throw DomainException.badRequest(MessageCodes.COM_11);
        }
        List<HerdExitVoucher> inPeriod = vouchers
            .findAllInPeriod(farmId, start, end)
            .stream()
            .filter(v -> type == null || v.getExitType() == type)
            .toList();
        Map<Long, List<HerdExit>> linesByVoucher = new HashMap<>();
        if (!inPeriod.isEmpty()) {
            for (HerdExit l : lines.findAllByVoucherIdInAndStatusNot(inPeriod.stream().map(HerdExitVoucher::getId).toList(), ExitLineStatus.REMOVED)) {
                linesByVoucher.computeIfAbsent(l.getVoucher().getId(), k -> new ArrayList<>()).add(l);
            }
        }
        Map<Long, Set<String>> pens = queries.pensOfVouchers(inPeriod.stream().map(HerdExitVoucher::getId).toList());

        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("ALL", inPeriod.size());
        for (ExitVoucherStatus s : ExitVoucherStatus.values()) {
            counts.put(s.name(), (int) inPeriod.stream().filter(v -> v.getStatus() == s).count());
        }

        Map<ExitType, Integer> byType = new EnumMap<>(ExitType.class);
        for (ExitType t : ExitType.values()) {
            byType.put(t, 0);
        }
        long revenue = 0;
        long toCollect = 0;
        int toCollectVouchers = 0;
        for (HerdExitVoucher v : inPeriod) {
            if (v.getStatus() != ExitVoucherStatus.CONFIRMED) {
                continue;
            }
            byType.merge(v.getExitType(), linesByVoucher.getOrDefault(v.getId(), List.of()).size(), Integer::sum);
            if (!isLoss(v)) {
                if (v.getExitType() == ExitType.SALE || v.getExitType() == ExitType.CULL) {
                    revenue += v.getTotalReceivable();
                }
                if (v.getOutstandingAmount() > 0) {
                    toCollect += v.getOutstandingAmount();
                    toCollectVouchers++;
                }
            }
        }
        Tiles tiles = new Tiles(
            byType,
            byType.values().stream().mapToInt(Integer::intValue).sum(),
            revenue,
            toCollect,
            toCollectVouchers,
            (int) vouchers.countByFarmIdAndStatus(farmId, ExitVoucherStatus.PENDING)
        );

        List<Row> rows = inPeriod
            .stream()
            .filter(v -> statuses == null || statuses.isEmpty() || statuses.contains(v.getStatus()))
            .map(v -> row(v, linesByVoucher.getOrDefault(v.getId(), List.of()), pens.getOrDefault(v.getId(), Set.of())))
            .toList();
        return new ListResult(start, end, tiles, counts, rows);
    }

    @Transactional(readOnly = true)
    public Detail get(Long farmId, Long id) {
        access.require(farmId, FarmAction.VIEW_EXIT_VOUCHERS);
        return detail(find(farmId, id));
    }

    /** Per-cattle checks and pen occupancy before / after (GBR-94); saved with the lines when the voucher is confirmed. */
    @Transactional(readOnly = true)
    public ChecksResult checks(Long farmId, Long id) {
        access.require(farmId, FarmAction.VIEW_EXIT_VOUCHERS);
        HerdExitVoucher v = find(farmId, id);
        List<HerdExit> ls = activeLines(v);
        List<CattleCheck> result = new ArrayList<>();
        for (HerdExit l : ls) {
            result.add(isOpen(v) ? checks.toCheck(checks.collect(l.getCattle(), v.getExitDate()), v.getExitType(), v.getExitDate()) : stored(l).check());
        }
        return new ChecksResult(v.getId(), v.getCode(), v.getVersion(), v.getExitDate(), result, isOpen(v) ? occupancyOf(farmId, ls) : List.of());
    }

    /** The popup "Select Cattle for Exit Voucher": ACTIVE cattle on no DRAFT / PENDING / CONFIRMED exit line (BR-D35). */
    @Transactional(readOnly = true)
    public List<SelectableCattle> selectableCattle(Long farmId, String q, Long penId, String herdGroup, BigDecimal minWeightKg) {
        access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        String pattern = "%" + (q == null ? "" : q.trim().toLowerCase(java.util.Locale.ROOT)) + "%";
        List<Cattle> found = queries.selectableCattle(farmId, pattern, penId);
        Map<Long, Growth> weights = queries.latestGrowth(found.stream().map(Cattle::getId).toList());
        LocalDate today = clock.today();
        List<SelectableCattle> result = new ArrayList<>();
        for (Cattle c : found) {
            String group = herdGroup(c);
            if (herdGroup != null && !herdGroup.isBlank() && !herdGroup.equalsIgnoreCase(group)) {
                continue;
            }
            Growth g = weights.get(c.getId());
            if (minWeightKg != null && (g == null || g.getWeightKg().compareTo(minWeightKg) < 0)) {
                continue;
            }
            Pen pen = penAssignments.findOpen(c.getId()).map(PenAssignment::getPen).orElse(null);
            LocalDate withdrawal = queries.withdrawalEnd(c.getId()).filter(d -> !d.isBefore(today)).orElse(null);
            Long openCase = queries.openCases(c.getId()).stream().map(HealthCase::getId).findFirst().orElse(null);
            result.add(
                new SelectableCattle(
                    c.getId(),
                    c.getDisplayCode(),
                    c.getEarTagNumber(),
                    c.getName(),
                    c.getBreed() == null ? null : c.getBreed().getName(),
                    c.getSex(),
                    c.getLifeStage(),
                    group,
                    pen == null ? null : pen.getId(),
                    pen == null ? null : pen.getCode(),
                    ageMonths(c, today),
                    g == null ? null : new LatestWeight(g.getWeightKg(), g.getCheckDate(), basisOf(g.getWeightType())),
                    withdrawal,
                    openCase
                )
            );
        }
        return result;
    }

    // ================================================================== draft commands

    @Transactional
    public Detail create(Long farmId, ExitVoucherRequests.Save req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        if (req == null || req.exitType() == null) {
            throw DomainException.required("exitType");
        }
        HerdExitVoucher v = new HerdExitVoucher();
        v.setFarm(ctx.farm());
        v.setReportedBy(ctx.user());
        v.setStatus(ExitVoucherStatus.DRAFT);
        v.setCode(codes.nextHerdExitCode(farmId));
        resolveType(v, req.exitType(), req.lossKind());
        v.setExitDate(req.exitDate() == null ? clock.today() : req.exitDate());
        applyHeader(ctx, v, req);
        vouchers.saveAndFlush(v);
        if (req.lines() != null && !req.lines().isEmpty()) {
            syncLines(ctx, v, req.lines());
        }
        finishDraft(ctx, v);
        audit.log(ctx, "EXIT_CREATE", TARGET, v.getId(), Map.of("code", v.getCode(), "exitType", v.getExitType()));
        return detail(v);
    }

    @Transactional
    public Detail update(Long farmId, Long id, ExitVoucherRequests.Save req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        HerdExitVoucher v = lock(farmId, id);
        VersionGuard.check(v.getVersion(), req == null ? null : req.expectedVersion());
        if (req == null) {
            throw DomainException.required("body");
        }
        if (v.getStatus() == ExitVoucherStatus.PENDING) {
            completePending(ctx, v, req);
            audit.log(ctx, "EXIT_UPDATE", TARGET, v.getId(), Map.of("code", v.getCode(), "status", v.getStatus()));
            return detail(v);
        }
        if (v.getStatus() != ExitVoucherStatus.DRAFT) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        if (isLoss(v)) {
            if (req.exitType() != null && req.exitType() != ExitType.DEATH && req.exitType() != ExitType.OTHER) {
                throw DomainException.invalid("exitType");
            }
            resolveType(v, ExitType.DEATH, req.lossKind() == null ? v.getLossKind() : req.lossKind());
        } else if (req.exitType() != null && req.exitType() != v.getExitType()) {
            throw DomainException.invalid("exitType");
        }
        if (req.exitDate() == null) {
            throw DomainException.required("exitDate");
        }
        v.setExitDate(req.exitDate());
        applyHeader(ctx, v, req);
        if (req.lines() != null) {
            syncLines(ctx, v, req.lines());
        }
        finishDraft(ctx, v);
        audit.log(ctx, "EXIT_UPDATE", TARGET, v.getId(), Map.of("code", v.getCode(), "status", v.getStatus()));
        return detail(v);
    }

    /** Discards a DRAFT (the code is never reused). */
    @Transactional
    public void delete(Long farmId, Long id, Integer expectedVersion) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        HerdExitVoucher v = lock(farmId, id);
        VersionGuard.check(v.getVersion(), expectedVersion);
        if (v.getStatus() != ExitVoucherStatus.DRAFT) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        audit.log(ctx, "EXIT_DISCARD", TARGET, v.getId(), Map.of("code", v.getCode()));
        lines.deleteAll(lines.findAllByVoucherIdOrderByLineNoAsc(v.getId()));
        lines.flush();
        vouchers.delete(v);
        vouchers.flush();
    }

    /** Adds cattle by id (popup) or by scanned QR tag code to a DRAFT voucher. */
    @Transactional
    public Detail addCattle(Long farmId, Long id, ExitVoucherRequests.AddCattle req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        HerdExitVoucher v = lock(farmId, id);
        VersionGuard.check(v.getVersion(), req == null ? null : req.expectedVersion());
        if (v.getStatus() != ExitVoucherStatus.DRAFT) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        Set<Long> ids = new java.util.LinkedHashSet<>();
        if (req != null && req.cattleIds() != null) {
            ids.addAll(req.cattleIds());
        }
        if (req != null && req.tagCode() != null && !req.tagCode().isBlank()) {
            CattleQrTag tag = qrTags
                .findByTagCode(req.tagCode().trim())
                .filter(t -> t.getCattle().getFarm().getId().equals(farmId))
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "tag_code", req.tagCode()));
            ids.add(tag.getCattle().getId());
        }
        if (ids.isEmpty()) {
            throw DomainException.required("cattleIds");
        }
        List<ExitVoucherRequests.Line> all = new ArrayList<>();
        Set<Long> present = new HashSet<>();
        for (HerdExit l : activeLines(v)) {
            all.add(new ExitVoucherRequests.Line(l.getCattle().getId(), null, null, null));
            present.add(l.getCattle().getId());
        }
        for (Long cattleId : ids) {
            if (!present.contains(cattleId)) {
                all.add(new ExitVoucherRequests.Line(cattleId, null, null, null));
            }
        }
        syncLines(ctx, v, all);
        recalc(v);
        touch(v);
        audit.log(ctx, "EXIT_ADD_CATTLE", TARGET, v.getId(), Map.of("code", v.getCode(), "cattleIds", ids));
        return detail(v);
    }

    // ================================================================== confirm

    /**
     * GBR-35 in one transaction for every line; repeating the call on a CONFIRMED voucher returns the first result
     * and changes nothing (GBR-29, section 6).
     */
    @Transactional
    public ConfirmResult confirm(Long farmId, Long id, ExitVoucherRequests.Confirm req, String idempotencyKey) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        HerdExitVoucher v = lock(farmId, id);
        if (v.getStatus() == ExitVoucherStatus.CONFIRMED) {
            List<CattleEffects> first = activeLines(v).stream().map(l -> stored(l).effects()).filter(Objects::nonNull).toList();
            return new ConfirmResult(detail(v), confirmedMessage(v), true, first);
        }
        if (req == null || !Boolean.TRUE.equals(req.acknowledged())) {
            throw DomainException.badRequest(MessageCodes.COM_16);
        }
        VersionGuard.check(v.getVersion(), req.expectedVersion());
        if (v.getStatus() != ExitVoucherStatus.DRAFT && v.getStatus() != ExitVoucherStatus.PENDING) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        List<HerdExit> ls = activeLines(v);
        if (ls.isEmpty()) {
            throw DomainException.unprocessable(MessageCodes.FE06_16);
        }
        boolean loss = isLoss(v);

        List<Long> cattleIds = ls.stream().map(l -> l.getCattle().getId()).sorted().toList();
        Map<Long, Cattle> locked = new HashMap<>();
        for (Cattle c : cattleRepository.lockAllByFarmIdAndIdIn(farmId, cattleIds)) {
            locked.put(c.getId(), c);
        }
        for (HerdExit l : ls) {
            Cattle c = locked.get(l.getCattle().getId());
            if (c == null || c.getHerdStatus() != HerdStatus.ACTIVE) {
                throw DomainException.conflict(MessageCodes.COM_05, "cattle_code", l.getCattle().getDisplayCode());
            }
            Optional<HerdExit> open = guard.openExitLine(c.getId());
            if (open.isEmpty() || !open.get().getId().equals(l.getId())) {
                throw DomainException.conflict(MessageCodes.COM_05, "cattle_code", c.getDisplayCode());
            }
        }
        validateForConfirm(v, ls, loss);
        assertExitDate(v, locked.values());

        LocalDate exitDate = v.getExitDate();
        Map<Long, CattleCheck> checkByCattle = new HashMap<>();
        Map<Long, Collected> collected = new HashMap<>();
        for (HerdExit l : ls) {
            Collected col = checks.collect(locked.get(l.getCattle().getId()), exitDate);
            collected.put(l.getId(), col);
            checkByCattle.put(l.getId(), checks.toCheck(col, v.getExitType(), exitDate));
        }

        resolveReminder(farmId, v, "RESOLVED");
        List<CattleEffects> effects = new ArrayList<>();
        for (HerdExit l : ls) {
            Cattle c = locked.get(l.getCattle().getId());
            CattleEffects e = applyExit(v, c, exitDate, collected.get(l.getId()));
            l.setLastPen(collected.get(l.getId()).pen());
            l.setStatus(ExitLineStatus.CONFIRMED);
            l.setCheckResults(JsonSupport.toJson(new StoredLine(checkByCattle.get(l.getId()), e)));
            lines.save(l);
            effects.add(e);
        }
        v.setStatus(ExitVoucherStatus.CONFIRMED);
        v.setConfirmedBy(ctx.user());
        v.setConfirmedAt(clock.now());
        recalc(v);
        touch(v);
        if (!loss && v.getAmountCollected() > 0) {
            payments.recordInitialCollection(ctx, v, v.getAmountCollected(), v.getPaymentMethod(), null);
        }
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("code", v.getCode());
        details.put("cattle", ls.stream().map(l -> l.getCattle().getDisplayCode()).toList());
        details.put("exitDate", exitDate);
        details.put("idempotencyKey", idempotencyKey);
        audit.log(ctx, "EXIT_CONFIRM", TARGET, v.getId(), details);
        return new ConfirmResult(detail(v), confirmedMessage(v), false, effects);
    }

    private CattleEffects applyExit(HerdExitVoucher v, Cattle cattle, LocalDate exitDate, Collected col) {
        PenAssignment closed = penAssignments.closeAssignment(cattle, exitDate);
        cattle.setHerdStatus(HerdStatus.EXITED);
        cattle.setExitType(v.getExitType());
        cattle.setExitDate(exitDate);
        cattleRepository.save(cattle);

        col.doses().forEach(d -> d.setStatus("CANCELLED"));
        doseRepository.saveAll(col.doses());
        col.reminders().forEach(r -> r.setStatus("CANCELLED"));
        reminderRepository.saveAll(col.reminders());
        col.openCases().forEach(h -> {
            h.setStatus("CLOSED");
            h.setOutcome("CLOSED_BY_EXIT");
            h.setClosedDate(exitDate);
        });
        healthCases.saveAll(col.openCases());
        Long pregnancyId = null;
        if (col.pregnancy() != null) {
            col.pregnancy().setStatus("LOST");
            col.pregnancy().setCloseReason("DAM_EXITED");
            col.pregnancy().setClosedDate(exitDate);
            pregnancyId = col.pregnancy().getId();
        }
        return new CattleEffects(
            cattle.getId(),
            cattle.getDisplayCode(),
            new AssignmentRef(closed.getPen().getId(), closed.getPen().getCode(), closed.getFromDate(), closed.getToDate()),
            col.doses().stream().map(d -> d.getId()).toList(),
            col.reminders().stream().map(Reminder::getId).toList(),
            col.openCases().stream().map(HealthCase::getId).toList(),
            pregnancyId,
            col.draftCalves().stream().map(c -> c.getId()).toList()
        );
    }

    private void validateForConfirm(HerdExitVoucher v, List<HerdExit> ls, boolean loss) {
        if (loss) {
            if (isBlank(v.getDeathCause())) {
                throw DomainException.required("deathCause");
            }
            if (v.getLossKind() == LossKind.DIED && isBlank(v.getCarcassDisposal())) {
                throw DomainException.required("carcassDisposal");
            }
            return;
        }
        if (v.getBuyer() == null && isBlank(v.getDestination())) {
            throw DomainException.required("buyerOrDestination");
        }
        if (v.getPricingBasis() == null) {
            throw DomainException.required("pricingBasis");
        }
        if (v.getPricingBasis() == PricingBasis.PER_KG) {
            for (HerdExit l : ls) {
                if (l.getExitWeightKg() == null) {
                    throw DomainException.badRequest(MessageCodes.COM_06, "field", "exitWeightKg", "cattle_code", l.getCattle().getDisplayCode());
                }
            }
        }
        recalc(v);
        validateMoney(v);
    }

    // ================================================================== dismiss

    /** Dismisses a PENDING death voucher: the cattle stays ACTIVE and the health case keeps its outcome (GBR-95). */
    @Transactional
    public DismissResult dismiss(Long farmId, Long id, ExitVoucherRequests.Dismiss req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        HerdExitVoucher v = lock(farmId, id);
        VersionGuard.check(v.getVersion(), req == null ? null : req.expectedVersion());
        if (v.getStatus() != ExitVoucherStatus.PENDING) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        String reason = req == null ? null : req.reason();
        if (isBlank(reason)) {
            throw DomainException.required("reason");
        }
        List<HerdExit> ls = activeLines(v);
        for (HerdExit l : ls) {
            l.setStatus(ExitLineStatus.DISMISSED);
            lines.save(l);
        }
        v.setStatus(ExitVoucherStatus.DISMISSED);
        v.setCloseReason(reason.trim());
        v.setClosedBy(ctx.user());
        v.setClosedAt(clock.now());
        resolveReminder(farmId, v, "RESOLVED");
        touch(v);
        audit.log(ctx, "EXIT_DISMISS", TARGET, v.getId(), Map.of("code", v.getCode(), "reason", reason.trim()));
        String cattleCode = ls.isEmpty() ? "" : ls.get(0).getCattle().getDisplayCode();
        return new DismissResult(detail(v), checks.message(MessageCodes.FE13_04, "voucher_code", v.getCode(), "cattle_code", cattleCode));
    }

    // ================================================================== void

    @Transactional(readOnly = true)
    public VoidCheck voidCheck(Long farmId, Long id) {
        access.require(farmId, FarmAction.VIEW_EXIT_VOUCHERS);
        HerdExitVoucher v = find(farmId, id);
        List<HerdExit> ls = activeLines(v);
        boolean voidable = v.getStatus() == ExitVoucherStatus.CONFIRMED && ls.stream().allMatch(l -> l.getCattle().getHerdStatus() == HerdStatus.EXITED);
        Map<Long, Pen> pens = loadPens(farmId, penIdsOf(ls, Map.of()), false);
        VoidPlan plan = planVoid(ls, Map.of(), pens, occupancy.headcounts(pens.keySet()));
        Message message = !voidable
            ? checks.message(MessageCodes.COM_05)
            : plan.failing().isEmpty() ? null : checks.message(MessageCodes.FE13_09, "pen", plan.firstFailingPen());
        return new VoidCheck(v.getId(), v.getCode(), v.getVersion(), voidable, plan.info(), plan.occupancyAfter(), reviewList(ls), message);
    }

    /** GBR-36: every cattle back to ACTIVE with a new placement from today; closed items are listed, never restored. */
    @Transactional
    public VoidResult voidVoucher(Long farmId, Long id, ExitVoucherRequests.Void req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_EXIT_VOUCHERS);
        HerdExitVoucher v = lock(farmId, id);
        VersionGuard.check(v.getVersion(), req == null ? null : req.expectedVersion());
        if (v.getStatus() != ExitVoucherStatus.CONFIRMED) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        String reason = req == null ? null : req.reason();
        if (isBlank(reason)) {
            throw DomainException.required("reason");
        }
        List<HerdExit> ls = activeLines(v);
        Map<Long, Long> overrides = req.penOverrides() == null ? Map.of() : req.penOverrides();
        Map<Long, String> warnings = req.warningReasons() == null ? Map.of() : req.warningReasons();
        Set<Long> onVoucher = new HashSet<>();
        ls.forEach(l -> onVoucher.add(l.getCattle().getId()));
        if (!onVoucher.containsAll(overrides.keySet())) {
            throw DomainException.invalid("penOverrides");
        }

        List<Long> cattleIds = ls.stream().map(l -> l.getCattle().getId()).sorted().toList();
        Map<Long, Cattle> locked = new HashMap<>();
        for (Cattle c : cattleRepository.lockAllByFarmIdAndIdIn(farmId, cattleIds)) {
            locked.put(c.getId(), c);
        }
        for (HerdExit l : ls) {
            Cattle c = locked.get(l.getCattle().getId());
            if (c == null || c.getHerdStatus() != HerdStatus.EXITED) {
                throw DomainException.conflict(MessageCodes.COM_05, "cattle_code", l.getCattle().getDisplayCode());
            }
            Optional<HerdExit> other = lines
                .findAllByCattleIdAndStatusIn(c.getId(), List.of(ExitLineStatus.DRAFT, ExitLineStatus.PENDING, ExitLineStatus.CONFIRMED))
                .stream()
                .filter(x -> !x.getVoucher().getId().equals(v.getId()))
                .findFirst();
            if (other.isPresent()) {
                throw DomainException.unprocessable(MessageCodes.FE13_08, "cattle_code", c.getDisplayCode(), "voucher_code", other.get().getVoucher().getCode());
            }
        }

        Map<Long, Pen> pens = loadPens(farmId, penIdsOf(ls, overrides), true);
        VoidPlan plan = planVoid(ls, overrides, pens, occupancy.headcounts(pens.keySet()));
        if (!plan.failing().isEmpty()) {
            throw DomainException.unprocessable(MessageCodes.FE13_09, "pen", plan.firstFailingPen(), "cattle_codes", plan.failing());
        }

        Map<String, Object> before = voucherSnapshot(v, ls);
        LocalDate today = clock.today();
        // reception warnings of the chosen pens need a reason (MSG-FE04-06): validate everything before changing anything
        Map<Long, ReceptionCheck> receptionChecks = new HashMap<>();
        for (HerdExit l : ls) {
            Cattle c = locked.get(l.getCattle().getId());
            if (overrides.containsKey(c.getId())) {
                ReceptionCheck check = criteria.check(plan.penByCattle().get(c.getId()), c, today);
                criteria.requireWarningReason(check, warnings.get(c.getId()), c.getDisplayCode());
                receptionChecks.put(c.getId(), check);
            }
        }
        for (HerdExit l : ls) {
            Cattle c = locked.get(l.getCattle().getId());
            c.setHerdStatus(HerdStatus.ACTIVE);
            c.setExitType(null);
            c.setExitDate(null);
            cattleRepository.saveAndFlush(c);
            Pen pen = plan.penByCattle().get(c.getId());
            ReceptionCheck check = receptionChecks.get(c.getId());
            penAssignments.openAssignment(
                c,
                pen,
                today,
                AssignmentSource.CORRECTION,
                "Exit voucher " + v.getCode() + " voided",
                check,
                warnings.get(c.getId()),
                ctx.user()
            );
            l.setStatus(ExitLineStatus.VOIDED);
            lines.save(l);
        }
        v.setStatus(ExitVoucherStatus.VOIDED);
        v.setCloseReason(reason.trim());
        v.setClosedBy(ctx.user());
        v.setClosedAt(clock.now());
        touch(v);
        revisions.record(ctx, TARGET, v.getId(), RecordRevisionService.VOID, reason.trim(), before, voucherSnapshot(v, ls));
        audit.log(ctx, "EXIT_VOID", TARGET, v.getId(), Map.of("code", v.getCode(), "reason", reason.trim(), "cattle", ls.size()));
        return new VoidResult(
            detail(v),
            checks.message(MessageCodes.FE13_05, "voucher_code", v.getCode(), "count", ls.size()),
            reviewList(ls)
        );
    }

    private record VoidPlan(Map<Long, Pen> penByCattle, List<VoidCattle> info, List<String> failing, String firstFailingPen, List<Occupancy> occupancyAfter) {}

    private VoidPlan planVoid(List<HerdExit> ls, Map<Long, Long> overrides, Map<Long, Pen> pens, Map<Long, Integer> headcount) {
        Map<Long, Integer> remaining = new HashMap<>();
        pens.values().forEach(p -> remaining.put(p.getId(), p.getStatus() == ActiveStatus.ACTIVE ? Math.max(0, p.getCapacity() - headcount.getOrDefault(p.getId(), 0)) : 0));
        Map<Long, Pen> assigned = new HashMap<>();
        List<VoidCattle> info = new ArrayList<>();
        List<String> failing = new ArrayList<>();
        String firstFailing = null;
        Map<Long, Integer> incoming = new TreeMap<>();
        for (HerdExit l : ls) {
            Cattle c = l.getCattle();
            Long target = overrides.containsKey(c.getId()) ? overrides.get(c.getId()) : l.getLastPen() == null ? null : l.getLastPen().getId();
            Pen pen = target == null ? null : pens.get(target);
            boolean ok = pen != null && pen.getStatus() == ActiveStatus.ACTIVE && remaining.getOrDefault(pen.getId(), 0) > 0;
            if (ok) {
                remaining.merge(pen.getId(), -1, Integer::sum);
                assigned.put(c.getId(), pen);
                incoming.merge(pen.getId(), 1, Integer::sum);
            } else {
                failing.add(c.getDisplayCode());
                if (firstFailing == null) {
                    firstFailing = pen != null ? pen.getCode() : l.getLastPen() != null ? l.getLastPen().getCode() : String.valueOf(target);
                }
            }
            Pen last = l.getLastPen() == null ? null : pens.getOrDefault(l.getLastPen().getId(), l.getLastPen());
            PenOption option = last == null
                ? null
                : new PenOption(
                    last.getId(),
                    last.getCode(),
                    last.getStatus() == ActiveStatus.ACTIVE,
                    last.getStatus() == ActiveStatus.ACTIVE ? Math.max(0, last.getCapacity() - headcount.getOrDefault(last.getId(), 0)) : 0
                );
            info.add(new VoidCattle(c.getId(), c.getDisplayCode(), option, !ok));
        }
        List<Occupancy> after = new ArrayList<>();
        incoming.forEach((penId, n) -> {
            Pen p = pens.get(penId);
            int before = headcount.getOrDefault(penId, 0);
            after.add(new Occupancy(penId, p.getCode(), p.getCapacity(), before, before + n));
        });
        return new VoidPlan(assigned, info, failing, firstFailing, after);
    }

    private Set<Long> penIdsOf(List<HerdExit> ls, Map<Long, Long> overrides) {
        Set<Long> ids = new java.util.TreeSet<>();
        for (HerdExit l : ls) {
            if (l.getLastPen() != null) {
                ids.add(l.getLastPen().getId());
            }
        }
        ids.addAll(overrides.values());
        return ids;
    }

    private Map<Long, Pen> loadPens(Long farmId, Set<Long> ids, boolean lock) {
        if (lock) {
            return occupancy.lockPens(farmId, ids);
        }
        Map<Long, Pen> pens = new TreeMap<>();
        for (Pen p : penRepository.findAllById(ids)) {
            if (p.getFarm().getId().equals(farmId)) {
                pens.put(p.getId(), p);
            }
        }
        return pens;
    }

    // ================================================================== loss vouchers (GBR-47, GBR-95)

    /**
     * Called by the health-case closing feature in the SAME transaction when a case is closed as DIED / MISSING:
     * exactly one PENDING voucher per case, REM-12 for the Owner, the cattle stays ACTIVE but exit-pending. A cattle
     * on a DRAFT exit line is taken off that draft first (the loss report wins, BR-D35).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public HerdExitVoucher createPendingLossVoucher(HealthCase healthCase, AppUser reportedBy, LocalDate date, LossKind lossKind) {
        Optional<HerdExitVoucher> existing = vouchers.findFirstBySourceHealthCaseIdAndStatusIn(
            healthCase.getId(),
            List.of(ExitVoucherStatus.PENDING, ExitVoucherStatus.CONFIRMED)
        );
        if (existing.isPresent()) {
            return existing.get();
        }
        if (lossKind == null) {
            throw DomainException.required("lossKind");
        }
        Farm farm = healthCase.getCattle().getFarm();
        Cattle cattle = guard.lockCattle(farm.getId(), healthCase.getCattle().getId());
        guard.assertActive(cattle);
        LocalDate lossDate = date == null ? clock.today() : date;
        clock.assertNotFuture(lossDate);
        guard.openExitLine(cattle.getId()).ifPresent(open -> {
            if (open.getStatus() != ExitLineStatus.DRAFT) {
                throw DomainException.unprocessable(MessageCodes.FE13_08, "cattle_code", cattle.getDisplayCode(), "voucher_code", open.getVoucher().getCode());
            }
            open.setStatus(ExitLineStatus.REMOVED);
            lines.saveAndFlush(open);
            HerdExitVoucher draft = open.getVoucher();
            recalc(draft);
            touch(draft);
        });
        HerdExitVoucher v = new HerdExitVoucher();
        v.setFarm(farm);
        v.setCode(codes.nextHerdExitCode(farm.getId()));
        resolveType(v, ExitType.DEATH, lossKind);
        v.setExitDate(lossDate);
        v.setStatus(ExitVoucherStatus.PENDING);
        v.setReportedBy(reportedBy);
        v.setSourceHealthCase(healthCase);
        if (lossKind == LossKind.MISSING) {
            v.setNotes("Missing");
        }
        vouchers.saveAndFlush(v);
        HerdExit line = newLine(v, cattle, 1);
        line.setStatus(ExitLineStatus.PENDING);
        lines.saveAndFlush(line);

        Reminder reminder = new Reminder();
        reminder.setFarm(farm);
        reminder.setCattle(cattle);
        reminder.setRuleType(REMINDER_RULE);
        reminder.setSourceRecord(reminderSource(v));
        reminder.setDueTime(clock.now());
        reminder.setStatus("ACTIVE");
        reminderRepository.save(reminder);
        audit.log(farm, reportedBy, "EXIT_PENDING", TARGET, v.getId(), Map.of("code", v.getCode(), "healthCaseId", healthCase.getId(), "lossKind", lossKind));
        return v;
    }

    /** The case closure was corrected: the PENDING voucher is withdrawn and REM-12 cancelled (Appendix F). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelPendingLossVoucher(HealthCase healthCase, AppUser actor, String reason) {
        vouchers
            .findFirstBySourceHealthCaseIdAndStatusIn(healthCase.getId(), List.of(ExitVoucherStatus.PENDING))
            .ifPresent(v -> {
                for (HerdExit l : activeLines(v)) {
                    l.setStatus(ExitLineStatus.DISMISSED);
                    lines.save(l);
                }
                v.setStatus(ExitVoucherStatus.DISMISSED);
                v.setCloseReason(isBlank(reason) ? "Health case closure corrected" : reason.trim());
                v.setClosedBy(actor);
                v.setClosedAt(clock.now());
                resolveReminder(v.getFarm().getId(), v, "CANCELLED");
                touch(v);
                audit.log(v.getFarm(), actor, "EXIT_PENDING_CANCEL", TARGET, v.getId(), Map.of("code", v.getCode()));
            });
    }

    private void completePending(FarmContext ctx, HerdExitVoucher v, ExitVoucherRequests.Save req) {
        if (req.exitDate() == null) {
            throw DomainException.required("exitDate");
        }
        v.setExitDate(req.exitDate());
        v.setDeathCause(trimToNull(req.deathCause()));
        v.setCarcassDisposal(v.getLossKind() == LossKind.DIED ? trimToNull(req.carcassDisposal()) : null);
        v.setNotes(trimToNull(req.note()) == null ? v.getNotes() : trimToNull(req.note()));
        touch(v);
        assertExitDate(v, activeLines(v).stream().map(HerdExit::getCattle).toList());
    }

    // ================================================================== draft helpers

    private void resolveType(HerdExitVoucher v, ExitType requested, LossKind lossKind) {
        if (requested == ExitType.DEATH || (requested == ExitType.OTHER && lossKind == LossKind.MISSING)) {
            LossKind kind = lossKind == null ? LossKind.DIED : lossKind;
            v.setLossKind(kind);
            v.setExitType(kind == LossKind.MISSING ? ExitType.OTHER : ExitType.DEATH);
        } else {
            v.setLossKind(null);
            v.setExitType(requested);
        }
    }

    /** Header fields of a DRAFT (PUT replaces them as a whole). */
    private void applyHeader(FarmContext ctx, HerdExitVoucher v, ExitVoucherRequests.Save req) {
        v.setTransportCertNo(trimToNull(req.transportCertNo()));
        v.setVehiclePlate(trimToNull(req.vehiclePlate()));
        v.setNotes(trimToNull(req.note()));
        if (isLoss(v)) {
            v.setBuyer(null);
            v.setDestination(null);
            v.setDeathCause(trimToNull(req.deathCause()));
            v.setCarcassDisposal(v.getLossKind() == LossKind.DIED ? trimToNull(req.carcassDisposal()) : null);
            v.setPricingBasis(null);
            v.setDeductions(0L);
            v.setAmountCollected(0L);
            v.setPaymentMethod(null);
            v.setCollectionDueDate(null);
            return;
        }
        v.setDeathCause(null);
        v.setCarcassDisposal(null);
        v.setBuyer(req.buyerId() == null ? null : buyer(ctx.farmId(), req.buyerId()));
        v.setDestination(trimToNull(req.destination()));
        v.setPricingBasis(req.pricingBasis() == null ? PricingBasis.PER_KG : req.pricingBasis());
        v.setDeductions(req.deductions() == null ? 0L : req.deductions());
        v.setAmountCollected(req.depositCollected() == null ? 0L : req.depositCollected());
        v.setPaymentMethod(req.paymentMethod());
        v.setCollectionDueDate(req.collectionDueDate());
    }

    private TradingPartner buyer(Long farmId, Long partnerId) {
        TradingPartner p = partners
            .findByIdAndFarmId(partnerId, farmId)
            .orElseThrow(() -> DomainException.unprocessable(MessageCodes.COM_08, "partner_id", partnerId));
        if (!p.isBuyer() || p.getStatus() != ActiveStatus.ACTIVE) {
            throw DomainException.unprocessable(MessageCodes.COM_08, "partner_id", partnerId);
        }
        return p;
    }

    private void finishDraft(FarmContext ctx, HerdExitVoucher v) {
        recalc(v);
        validateMoney(v);
        List<HerdExit> ls = activeLines(v);
        if (!ls.isEmpty()) {
            assertExitDate(v, ls.stream().map(HerdExit::getCattle).toList());
        } else if (v.getExitDate().isAfter(clock.today())) {
            throw DomainException.unprocessable(MessageCodes.COM_07);
        }
        touch(v);
    }

    /** Replaces the lines of a DRAFT by the requested ones; a cattle keeps its line and values when it stays. */
    private void syncLines(FarmContext ctx, HerdExitVoucher v, List<ExitVoucherRequests.Line> requested) {
        boolean loss = isLoss(v);
        Map<Long, ExitVoucherRequests.Line> desired = new LinkedHashMap<>();
        for (ExitVoucherRequests.Line l : requested) {
            if (l == null || l.cattleId() == null) {
                throw DomainException.required("cattleId");
            }
            if (desired.put(l.cattleId(), l) != null) {
                throw DomainException.invalid("lines");
            }
        }
        Map<Long, HerdExit> existing = new HashMap<>();
        for (HerdExit e : activeLines(v)) {
            existing.put(e.getCattle().getId(), e);
        }
        for (HerdExit e : existing.values()) {
            if (!desired.containsKey(e.getCattle().getId())) {
                e.setStatus(ExitLineStatus.REMOVED);
                lines.saveAndFlush(e);
            }
        }
        Map<Long, Cattle> cattle = new HashMap<>();
        for (Cattle c : cattleRepository.lockAllByFarmIdAndIdIn(ctx.farmId(), desired.keySet())) {
            cattle.put(c.getId(), c);
        }
        if (cattle.size() != desired.size()) {
            throw DomainException.unprocessable(MessageCodes.COM_08);
        }
        int lineNo = lines.maxLineNo(v.getId());
        for (Map.Entry<Long, ExitVoucherRequests.Line> entry : desired.entrySet()) {
            Cattle c = cattle.get(entry.getKey());
            HerdExit line = existing.get(entry.getKey());
            boolean isNew = line == null;
            if (isNew) {
                guard.assertCanJoinExitVoucher(c, v.getId());
                line = newLine(v, c, ++lineNo);
            }
            if (loss) {
                line.setExitWeightKg(null);
                line.setWeightBasis(null);
                line.setUnitPrice(null);
            } else {
                applyLineValues(line, entry.getValue(), c, isNew);
            }
            lines.saveAndFlush(line);
        }
    }

    private HerdExit newLine(HerdExitVoucher v, Cattle cattle, int lineNo) {
        HerdExit line = new HerdExit();
        line.setFarm(v.getFarm());
        line.setVoucher(v);
        line.setCattle(cattle);
        line.setLineNo(lineNo);
        line.setStatus(ExitLineStatus.DRAFT);
        line.setLineAmount(0L);
        return line;
    }

    private void applyLineValues(HerdExit line, ExitVoucherRequests.Line req, Cattle cattle, boolean isNew) {
        BigDecimal weight = req.exitWeightKg();
        if (weight != null) {
            if (weight.compareTo(MIN_WEIGHT) < 0 || weight.compareTo(MAX_WEIGHT) > 0) {
                throw DomainException.invalid("exitWeightKg");
            }
            line.setExitWeightKg(weight.setScale(2, RoundingMode.HALF_UP));
            line.setWeightBasis(req.weightBasis() == null ? WeightBasis.MEASURED : req.weightBasis());
        } else if (isNew || line.getExitWeightKg() == null) {
            Optional<BigDecimal> latest = criteria.latestWeightKg(cattle.getId());
            line.setExitWeightKg(latest.orElse(null));
            line.setWeightBasis(latest.isPresent() ? WeightBasis.ESTIMATED : null);
        }
        if (req.unitPrice() != null) {
            line.setUnitPrice(req.unitPrice());
        }
    }

    private void recalc(HerdExitVoucher v) {
        List<HerdExit> ls = activeLines(v);
        if (isLoss(v)) {
            ls.forEach(l -> l.setLineAmount(0L));
            v.setCattleAmount(0L);
            return;
        }
        long sum = 0;
        for (HerdExit l : ls) {
            l.setLineAmount(MoneyCalculator.lineAmount(v.getPricingBasis(), l.getUnitPrice(), l.getExitWeightKg()));
            sum += l.getLineAmount();
        }
        lines.saveAll(ls);
        v.setCattleAmount(sum);
    }

    private void validateMoney(HerdExitVoucher v) {
        if (isLoss(v)) {
            return;
        }
        if (v.getDeductions() > v.getCattleAmount()) {
            throw DomainException.invalid("deductions");
        }
        long total = v.getTotalReceivable();
        if (v.getAmountCollected() > total) {
            throw DomainException.unprocessable(MessageCodes.FE06_13, "amount", total);
        }
        if (v.getAmountCollected() > 0 && v.getPaymentMethod() == null) {
            throw DomainException.required("paymentMethod");
        }
    }

    /** GBR-34: not in the future, not before the latest recorded event of any cattle on the voucher (MSG-FE13-03). */
    private void assertExitDate(HerdExitVoucher v, Collection<Cattle> cattle) {
        LocalDate date = v.getExitDate();
        Optional<LocalDate> earliest = checks.earliestExitDate(cattle);
        if (earliest.isPresent()) {
            if (date.isBefore(earliest.get()) || date.isAfter(clock.today())) {
                throw DomainException.unprocessable(MessageCodes.FE13_03, "earliest_date", earliest.get());
            }
        } else if (date.isAfter(clock.today())) {
            throw DomainException.unprocessable(MessageCodes.COM_07);
        }
    }

    private void touch(HerdExitVoucher v) {
        v.setUpdatedAt(clock.now());
        vouchers.saveAndFlush(v);
    }

    private void resolveReminder(Long farmId, HerdExitVoucher v, String status) {
        queries
            .activeReminder(farmId, REMINDER_RULE, reminderSource(v))
            .ifPresent(r -> {
                r.setStatus(status);
                reminderRepository.save(r);
            });
    }

    private static String reminderSource(HerdExitVoucher v) {
        return TARGET + ":" + v.getId();
    }

    // ================================================================== read model

    private HerdExitVoucher find(Long farmId, Long id) {
        return vouchers.findByIdAndFarmId(id, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private HerdExitVoucher lock(Long farmId, Long id) {
        return vouchers.lockByIdAndFarmId(farmId, id).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
    }

    private List<HerdExit> activeLines(HerdExitVoucher v) {
        return lines.findAllByVoucherIdAndStatusNotOrderByLineNoAsc(v.getId(), ExitLineStatus.REMOVED);
    }

    static boolean isLoss(HerdExitVoucher v) {
        return v.getLossKind() != null || v.getExitType() == ExitType.DEATH;
    }

    private static boolean isOpen(HerdExitVoucher v) {
        return v.getStatus() == ExitVoucherStatus.DRAFT || v.getStatus() == ExitVoucherStatus.PENDING;
    }

    private StoredLine stored(HerdExit line) {
        StoredLine s = JsonSupport.fromJson(line.getCheckResults(), StoredLine.class);
        return s == null ? new StoredLine(null, null) : s;
    }

    private List<CattleEffects> reviewList(List<HerdExit> ls) {
        return ls.stream().map(l -> stored(l).effects()).filter(Objects::nonNull).toList();
    }

    private Message confirmedMessage(HerdExitVoucher v) {
        return checks.message(MessageCodes.FE13_02, "voucher_code", v.getCode(), "count", activeLines(v).size());
    }

    private Map<String, Object> voucherSnapshot(HerdExitVoucher v, List<HerdExit> ls) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", v.getStatus());
        m.put("closeReason", v.getCloseReason());
        List<Map<String, Object>> cattle = new ArrayList<>();
        for (HerdExit l : ls) {
            Cattle c = l.getCattle();
            Map<String, Object> one = new LinkedHashMap<>();
            one.put("cattleId", c.getId());
            one.put("herdStatus", c.getHerdStatus());
            one.put("exitType", c.getExitType());
            one.put("exitDate", c.getExitDate());
            one.put("lineStatus", l.getStatus());
            cattle.add(one);
        }
        m.put("cattle", cattle);
        return m;
    }

    private List<Occupancy> occupancyOf(Long farmId, List<HerdExit> ls) {
        Map<Long, Integer> leaving = new TreeMap<>();
        for (HerdExit l : ls) {
            penAssignments.findOpen(l.getCattle().getId()).ifPresent(a -> leaving.merge(a.getPen().getId(), -1, Integer::sum));
        }
        return occupancy
            .preview(farmId, leaving)
            .stream()
            .map(o -> new Occupancy(o.penId(), o.penCode(), o.capacity(), o.before(), o.after()))
            .toList();
    }

    private Row row(HerdExitVoucher v, List<HerdExit> ls, Set<String> pens) {
        boolean loss = isLoss(v);
        BigDecimal weight = ls.stream().map(HerdExit::getExitWeightKg).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean estimated = ls.stream().anyMatch(l -> l.getWeightBasis() == WeightBasis.ESTIMATED);
        return new Row(
            v.getId(),
            v.getCode(),
            v.getExitDate(),
            v.getExitType(),
            v.getStatus(),
            loss,
            v.getBuyer() == null ? null : new Ref(v.getBuyer().getId(), v.getBuyer().getName()),
            v.getDestination(),
            v.getTransportCertNo(),
            v.getLossKind(),
            v.getDeathCause(),
            sourceRef(v),
            List.copyOf(pens),
            ls.size(),
            weight,
            estimated,
            loss ? null : v.getTotalReceivable(),
            loss ? null : v.getOutstandingAmount(),
            v.getCloseReason(),
            v.getVersion()
        );
    }

    private static Ref sourceRef(HerdExitVoucher v) {
        return v.getSourceHealthCase() == null ? null : new Ref(v.getSourceHealthCase().getId(), "HC-" + v.getSourceHealthCase().getId());
    }

    private static Ref userRef(AppUser u) {
        return u == null ? null : new Ref(u.getId(), u.getFullName());
    }

    private Detail detail(HerdExitVoucher v) {
        boolean loss = isLoss(v);
        boolean open = isOpen(v);
        List<HerdExit> ls = activeLines(v);
        LocalDate today = clock.today();
        List<ExitVoucherDTO.Line> dtoLines = new ArrayList<>();
        BigDecimal totalWeight = BigDecimal.ZERO;
        int estimated = 0;
        for (HerdExit l : ls) {
            Cattle c = l.getCattle();
            Pen pen = open ? penAssignments.findOpen(c.getId()).map(PenAssignment::getPen).orElse(null) : l.getLastPen();
            StoredLine st = stored(l);
            CattleCheck check = open ? checks.toCheck(checks.collect(c, v.getExitDate()), v.getExitType(), v.getExitDate()) : st.check();
            if (l.getExitWeightKg() != null) {
                totalWeight = totalWeight.add(l.getExitWeightKg());
            }
            boolean isEstimated = l.getWeightBasis() == WeightBasis.ESTIMATED;
            if (isEstimated) {
                estimated++;
            }
            dtoLines.add(
                new ExitVoucherDTO.Line(
                    l.getId(),
                    l.getLineNo(),
                    c.getId(),
                    c.getDisplayCode(),
                    c.getEarTagNumber(),
                    c.getBreed() == null ? null : c.getBreed().getName(),
                    c.getSex(),
                    c.getLifeStage(),
                    c.getHerdStatus(),
                    l.getStatus() == ExitLineStatus.PENDING,
                    pen == null ? null : pen.getId(),
                    pen == null ? null : pen.getCode(),
                    l.getExitWeightKg(),
                    l.getWeightBasis(),
                    isEstimated,
                    l.getUnitPrice(),
                    l.getLineAmount(),
                    l.getStatus(),
                    check
                )
            );
        }
        List<VoucherPayment> pays = loss ? List.of() : paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(v.getId());
        PaymentSummaryDTO summary = null;
        if (!loss) {
            long total = v.getTotalReceivable();
            long paid = paymentRepository.sumByExitVoucher(v.getId(), PaymentRecordStatus.RECORDED);
            summary = new PaymentSummaryDTO(
                "EXIT",
                v.getId(),
                v.getCode(),
                total,
                paid,
                MoneyCalculator.outstanding(total, paid),
                MoneyCalculator.overpaid(total, paid),
                MoneyCalculator.paymentState(total, paid),
                v.getVersion()
            );
        }
        return new Detail(
            v.getId(),
            v.getCode(),
            v.getExitType(),
            v.getStatus(),
            loss,
            v.getExitDate(),
            v.getBuyer() == null ? null : new Ref(v.getBuyer().getId(), v.getBuyer().getName()),
            v.getDestination(),
            v.getTransportCertNo(),
            v.getVehiclePlate(),
            v.getNotes(),
            v.getLossKind(),
            v.getDeathCause(),
            v.getCarcassDisposal(),
            sourceRef(v),
            v.getPricingBasis(),
            loss ? null : v.getCattleAmount(),
            loss ? null : v.getDeductions(),
            loss ? null : v.getTotalReceivable(),
            loss ? null : v.getAmountCollected(),
            loss ? null : v.getOutstandingAmount(),
            v.getPaymentMethod(),
            v.getCollectionDueDate(),
            userRef(v.getReportedBy()),
            userRef(v.getConfirmedBy()),
            v.getConfirmedAt(),
            v.getCloseReason(),
            userRef(v.getClosedBy()),
            v.getClosedAt(),
            v.getCreatedAt(),
            v.getUpdatedAt(),
            v.getVersion(),
            ls.size(),
            totalWeight,
            estimated,
            dtoLines,
            open ? occupancyOf(v.getFarm().getId(), ls) : List.of(),
            summary,
            pays.stream().map(VoucherPaymentDTO::from).toList(),
            history(v, ls, pays)
        );
    }

    private List<HistoryEvent> history(HerdExitVoucher v, List<HerdExit> ls, List<VoucherPayment> pays) {
        List<HistoryEvent> events = new ArrayList<>();
        events.add(new HistoryEvent(v.getCreatedAt(), "CREATED", v.getReportedBy() == null ? null : v.getReportedBy().getFullName(), "Voucher created", sourceData(v)));
        if (v.getConfirmedAt() != null) {
            events.add(new HistoryEvent(v.getConfirmedAt(), "CONFIRMED", v.getConfirmedBy() == null ? null : v.getConfirmedBy().getFullName(), "Voucher confirmed", Map.of()));
            int doses = 0;
            int reminders = 0;
            for (HerdExit l : ls) {
                CattleEffects e = stored(l).effects();
                if (e != null) {
                    doses += e.cancelledDoseIds().size();
                    reminders += e.cancelledReminderIds().size();
                }
            }
            events.add(new HistoryEvent(v.getConfirmedAt(), "ITEMS_CANCELLED", "system", "Doses and reminders cancelled by the exit", Map.of("doses", doses, "reminders", reminders)));
        }
        for (VoucherPayment p : pays) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("paymentId", p.getId());
            data.put("amount", p.getAmount());
            data.put("method", p.getMethod());
            events.add(new HistoryEvent(p.getRecordedAt(), "COLLECTION_RECORDED", p.getRecordedBy().getFullName(), "Collection recorded", data));
            if (p.getStatus() == PaymentRecordStatus.VOIDED && p.getVoidedAt() != null) {
                Map<String, Object> voided = new LinkedHashMap<>(data);
                voided.put("reason", p.getVoidReason());
                events.add(new HistoryEvent(p.getVoidedAt(), "COLLECTION_VOIDED", null, "Collection voided", voided));
            }
        }
        if (v.getClosedAt() != null) {
            String type = v.getStatus() == ExitVoucherStatus.DISMISSED ? "DISMISSED" : "VOIDED";
            events.add(new HistoryEvent(v.getClosedAt(), type, v.getClosedBy() == null ? null : v.getClosedBy().getFullName(), "Voucher " + type.toLowerCase(java.util.Locale.ROOT), Map.of("reason", String.valueOf(v.getCloseReason()))));
        }
        events.sort(Comparator.comparing(HistoryEvent::time, Comparator.nullsLast(Comparator.naturalOrder())));
        return events;
    }

    private static Map<String, Object> sourceData(HerdExitVoucher v) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (v.getSourceHealthCase() != null) {
            m.put("healthCaseId", v.getSourceHealthCase().getId());
        }
        return m;
    }

    // ================================================================== small helpers

    private static LocalDate previousQuarterStart(LocalDate today) {
        int quarterStartMonth = ((today.getMonthValue() - 1) / 3) * 3 + 1;
        return LocalDate.of(today.getYear(), quarterStartMonth, 1).minusMonths(3);
    }

    /** GBR-24 herd group: first match of Calves, Fattening, Breeding bulls, Breeding females, Young stock, Other. */
    static String herdGroup(Cattle c) {
        PurposeType type = c.getPurpose() == null ? null : c.getPurpose().getPurposeType();
        if (c.getLifeStage() == LifeStage.UNWEANED_CALF || c.getLifeStage() == LifeStage.WEANED_CALF) {
            return "CALVES";
        }
        if (type == PurposeType.FATTENING) {
            return "FATTENING";
        }
        if (c.getSex() == Sex.MALE && type == PurposeType.SIRE) {
            return "BREEDING_BULLS";
        }
        if (c.getSex() == Sex.FEMALE && c.getLifeStage() == LifeStage.ADULT && type == PurposeType.BREEDING) {
            return "BREEDING_FEMALES";
        }
        if (c.getLifeStage() == LifeStage.YOUNG_STOCK) {
            return "YOUNG_STOCK";
        }
        return "OTHER";
    }

    private static Integer ageMonths(Cattle c, LocalDate today) {
        if (c.getBirthDate() == null) {
            return null;
        }
        Period p = Period.between(c.getBirthDate(), today);
        return p.getYears() * 12 + p.getMonths();
    }

    private static WeightBasis basisOf(String type) {
        try {
            return type == null ? null : WeightBasis.valueOf(type);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
