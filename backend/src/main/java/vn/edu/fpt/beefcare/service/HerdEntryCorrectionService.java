package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.VoucherPayment;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationCategory;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PreEntryHistoryDeclarationRepository;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Header;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Resolved;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Result;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Corrections and voids after posting (GBR-33, UC-FE06-03, UC-FE06-05): correct one herd entry with a mandatory reason,
 * void one entry, void a whole voucher. A void is allowed only when the cattle has no recorded event other than its
 * entry and first pen placement. Every change keeps before / after values (BR-D15) and runs in one transaction.
 */
@Service
public class HerdEntryCorrectionService {

    @PersistenceContext
    private EntityManager em;

    private final HerdEntryVoucherRepository voucherRepository;
    private final HerdEntryRepository entryRepository;
    private final CattleRepository cattleRepository;
    private final CattleQrTagRepository qrRepository;
    private final PenAssignmentRepository assignmentRepository;
    private final PreEntryHistoryDeclarationRepository declarationRepository;
    private final TradingPartnerRepository partnerRepository;
    private final VoucherPaymentRepository paymentRepository;
    private final FarmAccessService access;
    private final CattleGuardService guard;
    private final CattleEventProbe probe;
    private final PenAssignmentService penAssignments;
    private final HerdEntryPostingService posting;
    private final EntryLineValidator lineValidator;
    private final EntryCatalogLookup catalog;
    private final EntryReminderService reminders;
    private final RecordRevisionService revisions;
    private final AuditService audit;
    private final EntryVoucherMapper mapper;
    private final FarmClock clock;

    public HerdEntryCorrectionService(
        HerdEntryVoucherRepository voucherRepository,
        HerdEntryRepository entryRepository,
        CattleRepository cattleRepository,
        CattleQrTagRepository qrRepository,
        PenAssignmentRepository assignmentRepository,
        PreEntryHistoryDeclarationRepository declarationRepository,
        TradingPartnerRepository partnerRepository,
        VoucherPaymentRepository paymentRepository,
        FarmAccessService access,
        CattleGuardService guard,
        CattleEventProbe probe,
        PenAssignmentService penAssignments,
        HerdEntryPostingService posting,
        EntryLineValidator lineValidator,
        EntryCatalogLookup catalog,
        EntryReminderService reminders,
        RecordRevisionService revisions,
        AuditService audit,
        EntryVoucherMapper mapper,
        FarmClock clock
    ) {
        this.voucherRepository = voucherRepository;
        this.entryRepository = entryRepository;
        this.cattleRepository = cattleRepository;
        this.qrRepository = qrRepository;
        this.assignmentRepository = assignmentRepository;
        this.declarationRepository = declarationRepository;
        this.partnerRepository = partnerRepository;
        this.paymentRepository = paymentRepository;
        this.access = access;
        this.guard = guard;
        this.probe = probe;
        this.penAssignments = penAssignments;
        this.posting = posting;
        this.lineValidator = lineValidator;
        this.catalog = catalog;
        this.reminders = reminders;
        this.revisions = revisions;
        this.audit = audit;
        this.mapper = mapper;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ void checks

    /** Popup "Void Herd Entry Voucher": per cattle the events after entry and whether it can be voided. */
    @Transactional(readOnly = true)
    public EntryDtos.VoidCheck voidCheck(Long farmId, Long voucherId) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        HerdEntryVoucher v = voucherRepository.findByIdAndFarmId(voucherId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "voucher_id", voucherId));
        List<EntryDtos.VoidCheckRow> rows = new ArrayList<>();
        if (v.getStatus() == EntryVoucherStatus.POSTED) {
            for (HerdEntry line : entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId())) {
                if (line.getStatus() == EntryLineStatus.VALID) {
                    rows.add(voidRow(line));
                }
            }
        }
        boolean canVoid = v.getStatus() == EntryVoucherStatus.POSTED && rows.stream().allMatch(EntryDtos.VoidCheckRow::canVoid);
        String blockedCodes = rows.stream().filter(r -> !r.canVoid()).map(EntryDtos.VoidCheckRow::cattleCode).collect(Collectors.joining(", "));
        return new EntryDtos.VoidCheck(
            v.getId(),
            v.getCode(),
            v.getEntryType().name(),
            v.getEntryDate(),
            rows.size(),
            v.getSeller() == null ? null : v.getSeller().getName(),
            v.getAmountPaid(),
            canVoid,
            rows,
            mapper.notice(MessageCodes.FE06_20, "voucher_code", v.getCode(), "count", rows.size(), "paid", v.getAmountPaid()),
            blockedCodes.isEmpty() ? null : mapper.notice(MessageCodes.FE06_21, "voucher_code", v.getCode(), "cattle_codes", blockedCodes)
        );
    }

    @Transactional(readOnly = true)
    public EntryDtos.VoidCheckRow entryVoidCheck(Long farmId, Long entryId) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        HerdEntry line = entryRepository.findByIdAndFarmId(entryId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "entry_id", entryId));
        return voidRow(line);
    }

    private EntryDtos.VoidCheckRow voidRow(HerdEntry line) {
        Cattle c = line.getCattle();
        if (c == null) {
            return new EntryDtos.VoidCheckRow(line.getId(), line.getLineNo(), null, null, List.of(), false, "NO_CATTLE");
        }
        List<String> labels = probe.labels(probe.events(c.getId()));
        boolean active = c.getHerdStatus() == HerdStatus.ACTIVE;
        boolean ok = active && labels.isEmpty() && line.getStatus() == EntryLineStatus.VALID;
        String reason = ok ? null : !active ? "CATTLE_" + c.getHerdStatus() : line.getStatus() != EntryLineStatus.VALID ? "LINE_" + line.getStatus() : "HAS_EVENTS";
        return new EntryDtos.VoidCheckRow(line.getId(), line.getLineNo(), c.getId(), c.getDisplayCode(), labels, ok, reason);
    }

    // ------------------------------------------------------------------ void a whole voucher

    @Transactional
    public EntryDtos.VoidResult voidVoucher(Long farmId, Long voucherId, EntryActionRequests.VoidRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntryVoucher v = voucherRepository.lockByIdAndFarmId(farmId, voucherId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "voucher_id", voucherId));
        if (v.getStatus() != EntryVoucherStatus.POSTED) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        VersionGuard.check(v.getVersion(), req.expectedVersion());
        String reason = requireReason(req.reason());

        List<HerdEntry> valid = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()).stream().filter(l -> l.getStatus() == EntryLineStatus.VALID).toList();
        Map<Long, Cattle> cattle = lockCattle(farmId, valid);
        List<String> blocked = new ArrayList<>();
        for (HerdEntry line : valid) {
            Cattle c = cattle.get(line.getCattle().getId());
            if (c.getHerdStatus() != HerdStatus.ACTIVE || !probe.events(c.getId()).isEmpty()) {
                blocked.add(c.getDisplayCode());
            }
        }
        if (!blocked.isEmpty()) {
            throw DomainException.unprocessable(MessageCodes.FE06_21, "voucher_code", v.getCode(), "cattle_codes", String.join(", ", blocked));
        }

        Map<String, Object> before = voucherSnapshot(v);
        for (HerdEntry line : valid) {
            voidLineEffects(line, cattle.get(line.getCattle().getId()), reason);
        }
        v.setStatus(EntryVoucherStatus.VOIDED);
        v.setVoidReason(reason);
        v.setVoidedBy(ctx.user());
        v.setVoidedAt(clock.now());
        voucherRepository.saveAndFlush(v);
        revisions.record(ctx, "HerdEntryVoucher", v.getId(), RecordRevisionService.VOID, reason, before, voucherSnapshot(v));
        audit.log(ctx, "ENTRY_VOID", "HerdEntryVoucher", v.getId(), Map.of("code", v.getCode(), "count", valid.size(), "reason", reason, "paidKept", v.getAmountPaid()));
        return new EntryDtos.VoidResult(mapper.voucher(v, true), mapper.notice(MessageCodes.FE06_22, "voucher_code", v.getCode()));
    }

    // ------------------------------------------------------------------ void one herd entry

    @Transactional
    public EntryDtos.EntryVoidResult voidEntry(Long farmId, Long entryId, EntryActionRequests.VoidRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntry found = entryRepository.findByIdAndFarmId(entryId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "entry_id", entryId));
        HerdEntryVoucher v = voucherRepository.lockByIdAndFarmId(farmId, found.getVoucher().getId()).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        HerdEntry entry = entryRepository.findByIdAndFarmId(entryId, farmId).orElseThrow();
        if (v.getStatus() != EntryVoucherStatus.POSTED || entry.getStatus() != EntryLineStatus.VALID || entry.getCattle() == null) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        VersionGuard.check(entry.getVersion(), req.expectedVersion());
        String reason = requireReason(req.reason());
        Cattle cattle = guard.lockCattle(farmId, entry.getCattle().getId());
        guard.assertActive(cattle);
        List<String> events = probe.labels(probe.events(cattle.getId()));
        if (!events.isEmpty()) {
            throw DomainException.unprocessable(MessageCodes.FE06_09, "cattle_code", cattle.getDisplayCode(), "events", String.join(", ", events));
        }
        List<HerdEntry> lines = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId());
        long validCount = lines.stream().filter(l -> l.getStatus() == EntryLineStatus.VALID).count();
        if (validCount <= 1) {
            // last VALID line: the whole voucher must be voided instead (UC-FE06-03 AF1)
            throw DomainException.unprocessable(MessageCodes.FE06_20, "voucher_code", v.getCode(), "count", validCount, "paid", v.getAmountPaid(), "action", "VOID_VOUCHER");
        }

        Map<String, Object> before = entrySnapshot(entry, cattle);
        before.put("voucher", voucherSnapshot(v));
        voidLineEffects(entry, cattle, reason);
        entryRepository.flush();
        v.setCattleAmount(entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()).stream().filter(l -> l.getStatus() == EntryLineStatus.VALID).mapToLong(HerdEntry::getLineAmount).sum());
        voucherRepository.saveAndFlush(v);
        Map<String, Object> after = entrySnapshot(entry, cattle);
        after.put("voucher", voucherSnapshot(v));
        revisions.record(ctx, "HerdEntry", entry.getId(), RecordRevisionService.VOID, reason, before, after);
        audit.log(ctx, "ENTRY_LINE_VOID", "HerdEntry", entry.getId(), Map.of("voucher", v.getCode(), "cattle", cattle.getDisplayCode(), "reason", reason));
        long overpaid = MoneyCalculator.overpaid(v.getTotalPayable(), v.getAmountPaid());
        return new EntryDtos.EntryVoidResult(
            mapper.voucher(v, true),
            mapper.line(v, entry, true),
            mapper.notice(MessageCodes.FE06_12, "cattle_code", cattle.getDisplayCode()),
            overpaid > 0 ? mapper.notice(MessageCodes.FE06_23, "amount", overpaid) : null,
            overpaid
        );
    }

    /** Line VOID, cattle VOIDED, pen assignment closed, QR tag RETIRED, REM-03 cancelled, farm-born calf back to pending. */
    private void voidLineEffects(HerdEntry line, Cattle cattle, String reason) {
        line.setStatus(EntryLineStatus.VOID);
        entryRepository.save(line);
        cattle.setHerdStatus(HerdStatus.VOIDED);
        cattle.setVoidReason(reason);
        cattle.setUpdatedAt(clock.now());
        cattleRepository.save(cattle);
        if (penAssignments.findOpen(cattle.getId()).isPresent()) {
            penAssignments.closeAssignment(cattle, clock.today());
        }
        qrRepository
            .findFirstByCattleIdAndStatus(cattle.getId(), QrTagStatus.ACTIVE)
            .ifPresent(tag -> {
                tag.setStatus(QrTagStatus.RETIRED);
                tag.setClosedAt(clock.now());
                qrRepository.save(tag);
            });
        reminders.cancelEntryReminders(line);
        CalfOutcome calf = line.getCalfOutcome();
        if (calf != null) {
            calf.setRegistrationState("PENDING_CONFIRMATION");
            calf.setRegisteredCattle(null);
            em.merge(calf);
            reminders.raiseCalfReminder(calf, calf.getCalving().getDam());
        }
    }

    // ------------------------------------------------------------------ correct one herd entry

    @Transactional
    public EntryDtos.CorrectionResult correct(Long farmId, Long entryId, EntryActionRequests.CorrectEntryRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntry found = entryRepository.findByIdAndFarmId(entryId, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "entry_id", entryId));
        HerdEntryVoucher v = voucherRepository.lockByIdAndFarmId(farmId, found.getVoucher().getId()).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        HerdEntry entry = entryRepository.findByIdAndFarmId(entryId, farmId).orElseThrow();
        if (v.getStatus() != EntryVoucherStatus.POSTED || entry.getStatus() != EntryLineStatus.VALID || entry.getCattle() == null) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        VersionGuard.check(entry.getVersion(), req.expectedVersion());
        VersionGuard.check(v.getVersion(), req.voucherVersion());
        String reason = requireReason(req.reason());
        EntryActionRequests.Changes ch = req.changes();
        boolean purchase = v.getEntryType() == EntryType.PURCHASE;

        List<HerdEntry> validLines = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()).stream().filter(l -> l.getStatus() == EntryLineStatus.VALID).toList();
        boolean dateChange = purchase && ch.entryDate() != null && !ch.entryDate().equals(v.getEntryDate());
        Map<Long, Cattle> locked = dateChange ? lockCattle(farmId, validLines) : lockCattle(farmId, List.of(entry));
        Cattle cattle = locked.get(entry.getCattle().getId());
        guard.assertActive(cattle);

        if (!purchase) {
            boolean other = ch.entryDate() != null || ch.sellerId() != null || ch.quarantineCertNo() != null || ch.vehiclePlate() != null || ch.unitPrice() != null || ch.breedId() != null || ch.sex() != null || ch.birthDate() != null || ch.birthDateAccuracy() != null || ch.ageMonths() != null || ch.vaccination() != null || ch.disease() != null || ch.reproduction() != null;
            if (other) {
                throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "FARM_BORN_DATA_COMES_FROM_THE_CALVING");
            }
        }

        EntryLineRequest current = EntryVoucherRules.dataOf(entry);
        LocalDate newEntryDate = dateChange ? ch.entryDate() : v.getEntryDate();
        if (dateChange) {
            checkEntryDateChange(v, validLines, locked, newEntryDate, cattle, ch);
        }

        // merge the requested changes into the stored line and run the same line rules as at posting
        Map<String, Object> before = new LinkedHashMap<>();
        Map<String, Object> after = new LinkedHashMap<>();
        EntryLineRequest merged = purchase ? merge(current, cattle, entry, ch) : null;
        Resolved res = null;
        if (purchase) {
            Header header = new Header(farmId, EntryType.PURCHASE, newEntryDate, v.getPricingBasis() == null ? PricingBasis.PER_KG : v.getPricingBasis());
            Result result = lineValidator.validate(header, entry.getLineNo(), merged, new HashSet<>(), true, false);
            if (result.hasErrors()) {
                EntryLineValidator.Issue first = result.firstError();
                if (MessageCodes.FE06_03.equals(first.code())) {
                    throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "BIRTH_DATE_AFTER_ENTRY_DATE");
                }
                throw first.toException();
            }
            res = result.resolved();
        }

        // sex change only without reproductive events and without a declared reproduction history
        if (purchase && res.sex() != cattle.getSex()) {
            List<String> repro = probe.events(cattle.getId()).stream().map(CattleEventProbe.Event::type).filter(t -> List.of("REPRODUCTION", "PREGNANCY", "CALVING", "OFFSPRING").contains(t)).distinct().toList();
            if (!repro.isEmpty()) {
                throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "SEX_CHANGE_WITH_REPRODUCTIVE_EVENTS", "events", String.join(", ", repro));
            }
        }

        BigDecimal newWeight = purchase ? res.weight() : (ch.entryWeightKg() != null ? ch.entryWeightKg() : entry.getEntryWeightKg());
        WeightBasis newBasis = purchase ? res.basis() : (ch.weightBasis() != null ? ch.weightBasis() : entry.getWeightBasis());
        if (!purchase && newWeight != null && newBasis == null) {
            throw DomainException.required("weightBasis");
        }
        Long newPrice = purchase ? res.unitPrice() : null;
        long newAmount = purchase ? res.lineAmount() : 0L;

        if (dateChange) {
            before.put("entryDate", v.getEntryDate());
            after.put("entryDate", newEntryDate);
        }
        if (purchase) {
            if (ch.sellerId() != null && (v.getSeller() == null || !ch.sellerId().equals(v.getSeller().getId()))) {
                TradingPartner seller = partnerRepository
                    .findByIdAndFarmId(ch.sellerId(), farmId)
                    .filter(p -> p.isSeller() && p.getStatus() == ActiveStatus.ACTIVE)
                    .orElseThrow(() -> DomainException.unprocessable(MessageCodes.COM_08, "field", "seller"));
                before.put("sellerId", v.getSeller() == null ? null : v.getSeller().getId());
                after.put("sellerId", seller.getId());
                v.setSeller(seller);
            }
            if (ch.quarantineCertNo() != null && !Objects.equals(HerdEntryVoucherService.clean(ch.quarantineCertNo()), v.getQuarantineCertNo())) {
                before.put("quarantineCertNo", v.getQuarantineCertNo());
                after.put("quarantineCertNo", HerdEntryVoucherService.clean(ch.quarantineCertNo()));
                v.setQuarantineCertNo(HerdEntryVoucherService.clean(ch.quarantineCertNo()));
            }
            if (ch.vehiclePlate() != null && !Objects.equals(HerdEntryVoucherService.clean(ch.vehiclePlate()), v.getVehiclePlate())) {
                before.put("vehiclePlate", v.getVehiclePlate());
                after.put("vehiclePlate", HerdEntryVoucherService.clean(ch.vehiclePlate()));
                v.setVehiclePlate(HerdEntryVoucherService.clean(ch.vehiclePlate()));
            }
            if (!sameWeight(newWeight, entry.getEntryWeightKg()) || newBasis != entry.getWeightBasis()) {
                before.put("entryWeightKg", entry.getEntryWeightKg());
                before.put("weightBasis", entry.getWeightBasis());
                after.put("entryWeightKg", newWeight);
                after.put("weightBasis", newBasis);
            }
            if (!Objects.equals(newPrice, entry.getUnitPrice())) {
                before.put("unitPrice", entry.getUnitPrice());
                after.put("unitPrice", newPrice);
            }
            if (!res.breed().getId().equals(cattle.getBreed().getId())) {
                if (!Boolean.TRUE.equals(res.breed().getAvailable())) {
                    throw DomainException.unprocessable(HerdEntryCodes.FE18_08, "field", "breed");
                }
                before.put("breedId", cattle.getBreed().getId());
                after.put("breedId", res.breed().getId());
            }
            if (res.sex() != cattle.getSex()) {
                before.put("sex", cattle.getSex());
                after.put("sex", res.sex());
            }
            if (!Objects.equals(res.birthDate(), cattle.getBirthDate()) || res.accuracy() != cattle.getBirthDateAccuracy()) {
                before.put("birthDate", cattle.getBirthDate());
                before.put("birthDateAccuracy", cattle.getBirthDateAccuracy());
                after.put("birthDate", res.birthDate());
                after.put("birthDateAccuracy", res.accuracy());
            }
            boolean historyChange = ch.vaccination() != null || ch.disease() != null || ch.reproduction() != null || res.sex() != cattle.getSex();
            if (historyChange) {
                boolean differs = !Objects.equals(JsonSupport.toJson(historyOf(current)), JsonSupport.toJson(historyOf(res.data()))) || res.sex() != cattle.getSex();
                if (differs) {
                    before.put("history", historyOf(current));
                    after.put("history", historyOf(res.data()));
                }
            }
        } else if (!sameWeight(newWeight, entry.getEntryWeightKg()) || newBasis != entry.getWeightBasis()) {
            before.put("entryWeightKg", entry.getEntryWeightKg());
            before.put("weightBasis", entry.getWeightBasis());
            after.put("entryWeightKg", newWeight);
            after.put("weightBasis", newBasis);
        }
        if (after.isEmpty()) {
            throw DomainException.required("changes");
        }

        long totalBefore = v.getTotalPayable();
        long cattleAmountBefore = v.getCattleAmount();

        // apply
        if (dateChange) {
            for (HerdEntry l : validLines) {
                l.setEntryDate(newEntryDate);
                entryRepository.save(l);
                shiftFirstPlacement(l.getCattle().getId(), newEntryDate);
                reminders.rescheduleEntryReminder(l);
            }
            v.setEntryDate(newEntryDate);
        }
        entry.setEntryWeightKg(newWeight);
        entry.setWeightBasis(newBasis);
        if (purchase) {
            entry.setUnitPrice(newPrice);
            entry.setLineAmount(newAmount);
            Sex oldSex = cattle.getSex();
            int oldEarlier = declaredEarlier(entry);
            cattle.setBreed(res.breed());
            cattle.setSex(res.sex());
            cattle.setBirthDate(res.birthDate());
            cattle.setBirthDateAccuracy(res.accuracy());
            if (after.containsKey("history")) {
                replaceHistory(ctx, entry, cattle, res);
                int newEarlier = res.sex() == Sex.FEMALE && res.data().reproduction().status() == DeclarationStatus.KNOWN && res.data().reproduction().earlierCalvings() != null ? res.data().reproduction().earlierCalvings() : 0;
                int parity = (cattle.getDeclaredParity() == null ? 0 : cattle.getDeclaredParity()) - (oldSex == Sex.FEMALE ? oldEarlier : 0) + newEarlier;
                cattle.setDeclaredParity(Math.max(0, parity));
                boolean pregnant = res.sex() == Sex.FEMALE && res.data().reproduction().status() == DeclarationStatus.KNOWN && res.data().reproduction().pregnantAtEntry() == YesNoUnknown.YES;
                if (pregnant) {
                    reminders.pregnancyCheckAtEntry(entry, cattle);
                } else {
                    reminders.cancelEntryReminders(entry);
                }
            }
            entry.setDraftData(JsonSupport.toJson(res.data()));
        }
        entry.setCorrected(true);
        entryRepository.saveAndFlush(entry);
        cattle.setUpdatedAt(clock.now());
        cattleRepository.saveAndFlush(cattle);
        if (purchase) {
            v.setCattleAmount(entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId()).stream().filter(l -> l.getStatus() == EntryLineStatus.VALID).mapToLong(HerdEntry::getLineAmount).sum());
        }
        voucherRepository.saveAndFlush(v);

        if (v.getCattleAmount() != cattleAmountBefore || v.getTotalPayable() != totalBefore) {
            before.put("voucherCattleAmount", cattleAmountBefore);
            before.put("voucherTotalPayable", totalBefore);
            after.put("voucherCattleAmount", v.getCattleAmount());
            after.put("voucherTotalPayable", v.getTotalPayable());
        }
        var revision = revisions.record(ctx, "HerdEntry", entry.getId(), RecordRevisionService.CORRECT, reason, before, after);
        audit.log(ctx, "ENTRY_LINE_CORRECT", "HerdEntry", entry.getId(), Map.of("voucher", v.getCode(), "cattle", cattle.getDisplayCode(), "fields", after.keySet(), "reason", reason));
        long overpaid = MoneyCalculator.overpaid(v.getTotalPayable(), v.getAmountPaid());
        return new EntryDtos.CorrectionResult(
            mapper.voucher(v, true),
            mapper.line(v, entry, true),
            mapper.notice(MessageCodes.FE06_06, "cattle_code", cattle.getDisplayCode()),
            overpaid > 0 ? mapper.notice(MessageCodes.FE06_23, "amount", overpaid) : null,
            overpaid,
            revision.getId()
        );
    }

    /** The merged line input: stored values overridden by the requested changes (history blocks, birth, weight, price, breed, sex). */
    private EntryLineRequest merge(EntryLineRequest current, Cattle cattle, HerdEntry entry, EntryActionRequests.Changes ch) {
        boolean birthChanged = ch.birthDate() != null || ch.ageMonths() != null || ch.birthDateAccuracy() != null;
        return new EntryLineRequest(
            null,
            current.name(),
            current.photoUrl(),
            current.colourMarkings(),
            ch.breedId() != null ? ch.breedId() : cattle.getBreed().getId(),
            ch.sex() != null ? ch.sex() : cattle.getSex(),
            birthChanged ? ch.birthDate() : cattle.getBirthDate(),
            birthChanged ? ch.birthDateAccuracy() : cattle.getBirthDateAccuracy(),
            birthChanged ? ch.ageMonths() : null,
            cattle.getLifeStage(),
            cattle.getPurpose().getId(),
            ch.entryWeightKg() != null ? ch.entryWeightKg() : entry.getEntryWeightKg(),
            ch.weightBasis() != null ? ch.weightBasis() : entry.getWeightBasis(),
            entry.getInitialPen().getId(),
            ch.unitPrice() != null ? ch.unitPrice() : entry.getUnitPrice(),
            entry.getQuarantineUntil(),
            current.warningReason(),
            ch.vaccination() != null ? ch.vaccination() : current.vaccination(),
            ch.disease() != null ? ch.disease() : current.disease(),
            ch.reproduction() != null ? ch.reproduction() : current.reproduction(),
            null
        );
    }

    private void checkEntryDateChange(HerdEntryVoucher v, List<HerdEntry> validLines, Map<Long, Cattle> locked, LocalDate newDate, Cattle target, EntryActionRequests.Changes ch) {
        if (newDate.isAfter(clock.today())) {
            throw DomainException.unprocessable(MessageCodes.FE06_03);
        }
        for (HerdEntry l : validLines) {
            Cattle c = locked.get(l.getCattle().getId());
            guard.assertActive(c);
            LocalDate birth = c.getId().equals(target.getId()) && (ch.birthDate() != null || ch.ageMonths() != null) ? ch.birthDate() : c.getBirthDate();
            if (birth != null && newDate.isBefore(birth)) {
                throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "ENTRY_DATE_BEFORE_BIRTH_DATE", "cattle_code", c.getDisplayCode());
            }
            LocalDate earliest = probe.earliestEventDate(c.getId());
            if (earliest != null && newDate.isAfter(earliest)) {
                throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "EVENT_BEFORE_ENTRY_DATE", "cattle_code", c.getDisplayCode(), "date", earliest);
            }
        }
        for (VoucherPayment p : paymentRepository.findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(v.getId())) {
            if (p.getStatus() == PaymentRecordStatus.RECORDED && p.getPaymentDate().isBefore(newDate)) {
                throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "PAYMENT_BEFORE_ENTRY_DATE", "date", p.getPaymentDate());
            }
        }
    }

    private void shiftFirstPlacement(Long cattleId, LocalDate newDate) {
        penAssignments
            .history(cattleId)
            .stream()
            .filter(a -> a.getSource() == AssignmentSource.HERD_ENTRY)
            .findFirst()
            .ifPresent(a -> {
                if (a.getToDate() != null && a.getToDate().isBefore(newDate)) {
                    throw DomainException.unprocessable(MessageCodes.FE06_07, "reason", "ENTRY_DATE_AFTER_FIRST_PLACEMENT_END");
                }
                a.setFromDate(newDate);
                assignmentRepository.saveAndFlush(a);
            });
    }

    // ------------------------------------------------------------------ histories

    private static Map<String, Object> historyOf(EntryLineRequest d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vaccination", d.vaccination());
        m.put("disease", d.disease());
        m.put("reproduction", d.reproduction());
        return m;
    }

    private int declaredEarlier(HerdEntry entry) {
        return declarationRepository
            .findAllByHerdEntryId(entry.getId())
            .stream()
            .filter(d -> d.getCategory() == DeclarationCategory.REPRODUCTION && d.getStatus() == DeclarationStatus.KNOWN && d.getEarlierCalvings() != null)
            .mapToInt(PreEntryHistoryDeclaration::getEarlierCalvings)
            .sum();
    }

    /** Replaces the declarations and the HISTORICAL vaccinations of the entry by the corrected ones (the old values stay in the revision). */
    private void replaceHistory(FarmContext ctx, HerdEntry entry, Cattle cattle, Resolved res) {
        declarationRepository.deleteAll(declarationRepository.findAllByHerdEntryId(entry.getId()));
        declarationRepository.flush();
        em.createQuery("delete from Vaccination v where v.cattle.id = :id and v.source = 'HISTORICAL'").setParameter("id", cattle.getId()).executeUpdate();
        posting.createDeclarations(ctx, entry, cattle, res);
    }

    // ------------------------------------------------------------------ helpers

    private Map<Long, Cattle> lockCattle(Long farmId, List<HerdEntry> lines) {
        List<Long> ids = lines.stream().map(l -> l.getCattle().getId()).distinct().sorted().toList();
        Map<Long, Cattle> out = new LinkedHashMap<>();
        if (ids.isEmpty()) {
            return out;
        }
        for (Cattle c : cattleRepository.lockAllByFarmIdAndIdIn(farmId, ids)) {
            out.put(c.getId(), c);
        }
        if (out.size() != ids.size()) {
            throw DomainException.notFound(MessageCodes.COM_08);
        }
        return out;
    }

    private static String requireReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw DomainException.required("reason");
        }
        if (reason.trim().length() > 500) {
            throw DomainException.invalid("reason");
        }
        return reason.trim();
    }

    private static boolean sameWeight(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static Map<String, Object> voucherSnapshot(HerdEntryVoucher v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", v.getStatus());
        m.put("entryDate", v.getEntryDate());
        m.put("cattleAmount", v.getCattleAmount());
        m.put("transportFee", v.getTransportFee());
        m.put("totalPayable", v.getTotalPayable());
        m.put("amountPaid", v.getAmountPaid());
        m.put("voidReason", v.getVoidReason());
        return m;
    }

    private static Map<String, Object> entrySnapshot(HerdEntry e, Cattle c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("lineStatus", e.getStatus());
        m.put("lineAmount", e.getLineAmount());
        m.put("cattleCode", c.getDisplayCode());
        m.put("herdStatus", c.getHerdStatus());
        m.put("voidReason", c.getVoidReason());
        return m;
    }
}
