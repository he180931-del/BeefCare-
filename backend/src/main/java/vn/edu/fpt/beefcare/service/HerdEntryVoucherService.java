package vn.edu.fpt.beefcare.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntrySource;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Header;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Result;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;

/**
 * Draft entry vouchers (UC-FE06-01 save draft, UC-FE06-02 view): a DRAFT only stores header and line data. It never
 * creates cattle, changes a pen, a balance or a reminder (GBR-90). Codes are reserved at creation and never reused.
 */
@Service
public class HerdEntryVoucherService {

    static final int MAX_LINES = 500;

    private final HerdEntryVoucherRepository voucherRepository;
    private final HerdEntryRepository entryRepository;
    private final TradingPartnerRepository partnerRepository;
    private final FarmAccessService access;
    private final CodeSequenceService codes;
    private final AuditService audit;
    private final TradingPartnerService partners;
    private final EntryLineValidator lineValidator;
    private final EntryVoucherRules rules;
    private final EntryVoucherMapper mapper;
    private final PenOccupancyService occupancy;
    private final FarmClock clock;

    public HerdEntryVoucherService(
        HerdEntryVoucherRepository voucherRepository,
        HerdEntryRepository entryRepository,
        TradingPartnerRepository partnerRepository,
        FarmAccessService access,
        CodeSequenceService codes,
        AuditService audit,
        TradingPartnerService partners,
        EntryLineValidator lineValidator,
        EntryVoucherRules rules,
        EntryVoucherMapper mapper,
        PenOccupancyService occupancy,
        FarmClock clock
    ) {
        this.voucherRepository = voucherRepository;
        this.entryRepository = entryRepository;
        this.partnerRepository = partnerRepository;
        this.access = access;
        this.codes = codes;
        this.audit = audit;
        this.partners = partners;
        this.lineValidator = lineValidator;
        this.rules = rules;
        this.mapper = mapper;
        this.occupancy = occupancy;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ commands

    @Transactional
    public EntryDtos.Voucher create(Long farmId, EntryVoucherRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntryVoucher v = createDraft(ctx, req);
        return mapper.voucher(v, true);
    }

    /** Creates the DRAFT with its lines inside the caller's transaction (also used by "Register now" at calving). */
    @Transactional(propagation = Propagation.MANDATORY)
    public HerdEntryVoucher createDraft(FarmContext ctx, EntryVoucherRequest req) {
        if (req == null || req.entryType() == null) {
            throw DomainException.required("entryType");
        }
        HerdEntryVoucher v = new HerdEntryVoucher();
        v.setFarm(ctx.farm());
        v.setEntryType(req.entryType());
        v.setStatus(EntryVoucherStatus.DRAFT);
        v.setCreatedBy(ctx.user());
        v.setCode(codes.nextHerdEntryCode(ctx.farmId()));
        applyHeader(ctx, v, req);
        v = voucherRepository.saveAndFlush(v);
        replaceLines(ctx, v, req.lines());
        voucherRepository.saveAndFlush(v);
        audit.log(ctx, "ENTRY_DRAFT_CREATE", "HerdEntryVoucher", v.getId(), Map.of("code", v.getCode(), "type", v.getEntryType().name()));
        return v;
    }

    @Transactional
    public EntryDtos.Voucher update(Long farmId, Long id, EntryVoucherRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntryVoucher v = lockDraft(farmId, id);
        VersionGuard.requireExpected(v.getVersion(), req.expectedVersion());
        if (req.entryType() != null && req.entryType() != v.getEntryType()) {
            throw DomainException.invalid("entryType");
        }
        applyHeader(ctx, v, req);
        replaceLines(ctx, v, req.lines());
        v = voucherRepository.saveAndFlush(v);
        audit.log(ctx, "ENTRY_DRAFT_UPDATE", "HerdEntryVoucher", v.getId(), Map.of("code", v.getCode(), "lines", entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()).size()));
        return mapper.voucher(v, true);
    }

    /** Discards a DRAFT. Its code stays used (BR-D34). */
    @Transactional
    public void discard(Long farmId, Long id, Integer expectedVersion) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntryVoucher v = lockDraft(farmId, id);
        VersionGuard.requireExpected(v.getVersion(), expectedVersion);
        entryRepository.deleteAll(entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()));
        entryRepository.flush();
        voucherRepository.delete(v);
        voucherRepository.flush();
        audit.log(ctx, "ENTRY_DRAFT_DISCARD", "HerdEntryVoucher", id, Map.of("code", v.getCode()));
    }

    /** Adds already validated lines to a locked DRAFT (Excel import); existing lines keep their numbers. */
    @Transactional(propagation = Propagation.MANDATORY)
    public HerdEntryVoucher appendLines(FarmContext ctx, HerdEntryVoucher v, List<EntryLineRequest> additional) {
        List<EntryLineRequest> all = new ArrayList<>();
        for (HerdEntry l : entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId())) {
            all.add(EntryVoucherRules.dataOf(l));
        }
        all.addAll(additional);
        replaceLines(ctx, v, all);
        return voucherRepository.saveAndFlush(v);
    }

    HerdEntryVoucher lockDraftVoucher(Long farmId, Long id) {
        return lockDraft(farmId, id);
    }

    // ------------------------------------------------------------------ queries

    @Transactional(readOnly = true)
    public EntryDtos.Voucher get(Long farmId, Long id) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        return mapper.voucher(load(farmId, id), true);
    }

    @Transactional(readOnly = true)
    public EntryDtos.VoucherList list(Long farmId, EntryVoucherStatus status, EntryType type, LocalDate from, LocalDate to, Long sellerId) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        if (from != null && to != null && from.isAfter(to)) {
            throw DomainException.badRequest(MessageCodes.COM_11);
        }
        List<HerdEntryVoucher> inPeriod = voucherRepository
            .findAllByFarmIdOrderByEntryDateDescIdDesc(farmId)
            .stream()
            .filter(v -> type == null || v.getEntryType() == type)
            .filter(v -> sellerId == null || (v.getSeller() != null && sellerId.equals(v.getSeller().getId())))
            .filter(v -> from == null || !v.getEntryDate().isBefore(from))
            .filter(v -> to == null || !v.getEntryDate().isAfter(to))
            .toList();
        Map<Long, List<HerdEntry>> linesByVoucher = new LinkedHashMap<>();
        if (!inPeriod.isEmpty()) {
            for (HerdEntry l : entryRepository.findAllByVoucherIdIn(inPeriod.stream().map(HerdEntryVoucher::getId).toList())) {
                linesByVoucher.computeIfAbsent(l.getVoucher().getId(), k -> new ArrayList<>()).add(l);
            }
            linesByVoucher.values().forEach(ls -> ls.sort(java.util.Comparator.comparing(HerdEntry::getLineNo)));
        }

        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("ALL", inPeriod.size());
        for (EntryVoucherStatus s : EntryVoucherStatus.values()) {
            counts.put(s.name(), (int) inPeriod.stream().filter(v -> v.getStatus() == s).count());
        }

        int purchased = 0;
        int farmBorn = 0;
        long purchaseAmount = 0;
        long owed = 0;
        List<EntryDtos.OwedVoucher> owedVouchers = new ArrayList<>();
        for (HerdEntryVoucher v : inPeriod) {
            if (v.getStatus() != EntryVoucherStatus.POSTED) {
                continue;
            }
            int valid = (int) linesByVoucher.getOrDefault(v.getId(), List.of()).stream().filter(l -> l.getStatus() == EntryLineStatus.VALID).count();
            if (v.getEntryType() == EntryType.PURCHASE) {
                purchased += valid;
                purchaseAmount += v.getTotalPayable();
                if (v.getOutstandingAmount() > 0) {
                    owed += v.getOutstandingAmount();
                    owedVouchers.add(new EntryDtos.OwedVoucher(v.getId(), v.getCode(), v.getOutstandingAmount()));
                }
            } else {
                farmBorn += valid;
            }
        }
        EntryDtos.Tiles tiles = new EntryDtos.Tiles(
            counts.get("POSTED"),
            counts.get("DRAFT"),
            purchased + farmBorn,
            purchased,
            farmBorn,
            purchaseAmount,
            owed,
            owedVouchers
        );
        List<EntryDtos.Row> rows = inPeriod
            .stream()
            .filter(v -> status == null || v.getStatus() == status)
            .map(v -> mapper.row(v, linesByVoucher.getOrDefault(v.getId(), List.of())))
            .toList();
        return new EntryDtos.VoucherList(tiles, counts, rows);
    }

    /** Pre-save checks panel of a DRAFT: ear tags, criteria per line, aggregated capacity (before -> after), warnings. */
    @Transactional(readOnly = true)
    public EntryDtos.Checks checks(Long farmId, Long id) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        HerdEntryVoucher v = load(farmId, id);
        if (v.getStatus() != EntryVoucherStatus.DRAFT) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        List<HerdEntry> lines = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId());
        EntryVoucherRules.Validation val = rules.validate(v, lines);
        EntryVoucherRules.CapacityView cap = rules.capacityIssues(farmId, val.incomingByPen(), occupancy);

        List<EntryLineValidator.Issue> all = new ArrayList<>(val.issues());
        all.addAll(cap.issues());
        List<EntryDtos.Issue> errors = all.stream().filter(i -> i.severity() == EntryLineValidator.Severity.ERROR).map(mapper::issue).toList();
        List<EntryDtos.Issue> warnings = all.stream().filter(i -> i.severity() == EntryLineValidator.Severity.WARNING).map(mapper::issue).toList();

        List<EntryDtos.LineCheck> lineChecks = new ArrayList<>();
        BigDecimal weight = BigDecimal.ZERO;
        int estimated = 0;
        for (EntryLineValidator.Resolved r : val.lines()) {
            List<Map<String, Object>> receptionRows = new ArrayList<>();
            if (r.check() != null) {
                r.check()
                    .results()
                    .forEach(c -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("criterion", c.criterion().name());
                        m.put("outcome", c.outcome().name());
                        m.put("expected", c.expected());
                        m.put("actual", c.actual());
                        receptionRows.add(m);
                    });
            }
            boolean lineOk = all.stream().noneMatch(i -> i.severity() == EntryLineValidator.Severity.ERROR && i.lineNo() != null && i.lineNo() == r.lineNo());
            lineChecks.add(new EntryDtos.LineCheck(r.lineNo(), r.earTag(), lineOk, receptionRows));
            if (r.weight() != null) {
                weight = weight.add(r.weight());
                if (r.basis() == WeightBasis.ESTIMATED) {
                    estimated++;
                }
            }
        }
        List<EntryDtos.OccupancyChange> occ = cap
            .occupancy()
            .stream()
            .map(o -> new EntryDtos.OccupancyChange(o.penId(), o.penCode(), o.capacity(), o.before(), o.after(), o.willBeFull()))
            .toList();
        return new EntryDtos.Checks(v.getId(), v.getCode(), errors.isEmpty(), lines.size(), weight, estimated, occ, lineChecks, errors, warnings);
    }

    /** Proposed life stage for the "Voucher Cattle Line" form (GBR-25). */
    public Map<String, Object> proposeLifeStage(LocalDate birthDate, Integer ageMonths, LocalDate entryDate) {
        LocalDate entry = entryDate == null ? clock.today() : entryDate;
        LocalDate birth = birthDate;
        if (birth == null && ageMonths != null) {
            birth = entry.minusMonths(ageMonths).withDayOfMonth(1);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("birthDate", birth);
        out.put("ageMonths", EntryLineValidator.ageMonths(birth, entry));
        out.put("lifeStage", EntryLineValidator.proposeLifeStage(birth, entry));
        return out;
    }

    // ------------------------------------------------------------------ internals

    HerdEntryVoucher load(Long farmId, Long id) {
        return voucherRepository.findByIdAndFarmId(id, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "voucher_id", id));
    }

    private HerdEntryVoucher lockDraft(Long farmId, Long id) {
        HerdEntryVoucher v = voucherRepository.lockByIdAndFarmId(farmId, id).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "voucher_id", id));
        if (v.getStatus() != EntryVoucherStatus.DRAFT) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        return v;
    }

    private void applyHeader(FarmContext ctx, HerdEntryVoucher v, EntryVoucherRequest req) {
        boolean purchase = v.getEntryType() == EntryType.PURCHASE;
        v.setEntryDate(req.entryDate() == null ? clock.today() : req.entryDate());
        v.setQuarantineCertNo(clean(req.quarantineCertNo()));
        v.setVehiclePlate(clean(req.vehiclePlate()));
        v.setNote(clean(req.note()));
        if (purchase) {
            v.setPricingBasis(req.pricingBasis() == null ? PricingBasis.PER_KG : req.pricingBasis());
            v.setTransportFee(req.transportFee() == null ? 0L : req.transportFee());
            v.setAmountPaid(req.amountPaid() == null ? 0L : req.amountPaid());
            v.setPaymentMethod(req.paymentMethod());
            v.setPaymentDueDate(req.paymentDueDate());
            if (req.sellerId() != null && req.newSeller() != null) {
                throw DomainException.invalid("seller");
            }
            if (req.newSeller() != null) {
                v.setSeller(partners.createInlineSeller(ctx, req.newSeller()));
            } else if (req.sellerId() != null) {
                TradingPartner seller = partnerRepository
                    .findByIdAndFarmId(req.sellerId(), ctx.farmId())
                    .orElseThrow(() -> DomainException.unprocessable(MessageCodes.COM_08, "field", "seller"));
                v.setSeller(seller);
            } else {
                v.setSeller(null);
            }
        } else {
            if (req.sellerId() != null || req.newSeller() != null || nonZero(req.transportFee()) || nonZero(req.amountPaid()) || req.pricingBasis() != null) {
                throw DomainException.invalid("amounts");
            }
            v.setSeller(null);
            v.setPricingBasis(null);
            v.setTransportFee(0L);
            v.setAmountPaid(0L);
            v.setCattleAmount(0L);
            v.setPaymentMethod(null);
            v.setPaymentDueDate(null);
            v.setQuarantineCertNo(null);
        }
    }

    private static boolean nonZero(Long n) {
        return n != null && n != 0L;
    }

    private void replaceLines(FarmContext ctx, HerdEntryVoucher v, List<EntryLineRequest> requested) {
        List<EntryLineRequest> lines = requested == null ? List.of() : requested;
        if (lines.size() > MAX_LINES) {
            throw DomainException.invalid("lines");
        }
        List<HerdEntry> old = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId());
        if (!old.isEmpty()) {
            entryRepository.deleteAll(old);
            entryRepository.flush();
        }
        boolean purchase = v.getEntryType() == EntryType.PURCHASE;
        Header header = new Header(ctx.farmId(), v.getEntryType(), v.getEntryDate(), v.getPricingBasis() == null ? PricingBasis.PER_KG : v.getPricingBasis());
        Set<String> tags = new HashSet<>();
        Set<Long> calves = new HashSet<>();
        long cattleAmount = 0;
        int lineNo = 0;
        for (EntryLineRequest raw : lines) {
            lineNo++;
            Result r = lineValidator.validate(header, lineNo, raw, tags, false);
            if (r.hasErrors()) {
                throw r.firstError().toException();
            }
            EntryLineValidator.Resolved res = r.resolved();
            if (!purchase && !calves.add(res.calf().getId())) {
                throw DomainException.invalid("calfOutcomeId");
            }
            HerdEntry e = new HerdEntry();
            e.setFarm(ctx.farm());
            e.setVoucher(v);
            e.setLineNo(lineNo);
            e.setStatus(EntryLineStatus.DRAFT);
            e.setSource(purchase ? EntrySource.EXTERNAL : EntrySource.FARM_BORN);
            e.setEntryDate(purchase ? v.getEntryDate() : res.entryDate());
            e.setEntryWeightKg(res.weight());
            e.setWeightBasis(res.basis());
            e.setUnitPrice(res.unitPrice());
            e.setLineAmount(res.lineAmount());
            e.setQuarantineUntil(res.quarantineUntil());
            e.setInitialPen(res.pen());
            e.setCalfOutcome(res.calf());
            e.setDraftData(JsonSupport.toJson(res.data()));
            entryRepository.save(e);
            cattleAmount += res.lineAmount();
        }
        entryRepository.flush();
        v.setCattleAmount(purchase ? cattleAmount : 0L);
    }

    static String clean(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
