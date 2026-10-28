package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration;
import vn.edu.fpt.beefcare.domain.Vaccination;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationCategory;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.repository.CattleRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.repository.HerdEntryVoucherRepository;
import vn.edu.fpt.beefcare.repository.PreEntryHistoryDeclarationRepository;
import vn.edu.fpt.beefcare.repository.VaccinationRepository;
import vn.edu.fpt.beefcare.service.EntryLineValidator.Resolved;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;

/**
 * Posting of a DRAFT entry voucher (UC-FE06-01 step 8, GBR-32, GBR-90): in one transaction it rechecks header and lines,
 * checks the aggregated pen capacity and creates for each line the cattle, herd entry, history declarations, HISTORICAL
 * vaccinations, first pen assignment, QR tag and (declared pregnancy) REM-03. Any failure persists nothing. A repeated
 * post returns the first result.
 */
@Service
public class HerdEntryPostingService {

    @PersistenceContext
    private EntityManager em;

    private final HerdEntryVoucherRepository voucherRepository;
    private final HerdEntryRepository entryRepository;
    private final CattleRepository cattleRepository;
    private final CattleQrTagRepository qrRepository;
    private final PreEntryHistoryDeclarationRepository declarationRepository;
    private final VaccinationRepository vaccinationRepository;
    private final FarmAccessService access;
    private final EntryVoucherRules rules;
    private final EntryCatalogLookup catalog;
    private final PenOccupancyService occupancy;
    private final PenAssignmentService penAssignments;
    private final CodeSequenceService codes;
    private final VoucherPaymentService payments;
    private final EntryReminderService reminders;
    private final AuditService audit;
    private final EntryVoucherMapper mapper;
    private final FarmClock clock;
    private final AttachmentService attachments;

    public HerdEntryPostingService(
        HerdEntryVoucherRepository voucherRepository,
        HerdEntryRepository entryRepository,
        CattleRepository cattleRepository,
        CattleQrTagRepository qrRepository,
        PreEntryHistoryDeclarationRepository declarationRepository,
        VaccinationRepository vaccinationRepository,
        FarmAccessService access,
        EntryVoucherRules rules,
        EntryCatalogLookup catalog,
        PenOccupancyService occupancy,
        PenAssignmentService penAssignments,
        CodeSequenceService codes,
        VoucherPaymentService payments,
        EntryReminderService reminders,
        AuditService audit,
        EntryVoucherMapper mapper,
        FarmClock clock,
        AttachmentService attachments
    ) {
        this.voucherRepository = voucherRepository;
        this.entryRepository = entryRepository;
        this.cattleRepository = cattleRepository;
        this.qrRepository = qrRepository;
        this.declarationRepository = declarationRepository;
        this.vaccinationRepository = vaccinationRepository;
        this.access = access;
        this.rules = rules;
        this.catalog = catalog;
        this.occupancy = occupancy;
        this.penAssignments = penAssignments;
        this.codes = codes;
        this.payments = payments;
        this.reminders = reminders;
        this.audit = audit;
        this.mapper = mapper;
        this.clock = clock;
        this.attachments = attachments;
    }

    /** POST /entry-vouchers/{id}/post. Idempotent: a POSTED voucher returns its first result and creates nothing. */
    @Transactional
    public EntryDtos.PostResult post(Long farmId, Long voucherId, EntryActionRequests.PostRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        HerdEntryVoucher v = voucherRepository.lockByIdAndFarmId(farmId, voucherId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "voucher_id", voucherId));
        boolean printQr = req != null && Boolean.TRUE.equals(req.printQr());
        if (v.getStatus() == EntryVoucherStatus.POSTED) {
            return existingResult(v, printQr);
        }
        if (v.getStatus() != EntryVoucherStatus.DRAFT) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        VersionGuard.requireExpected(v.getVersion(), req == null ? null : req.expectedVersion());
        return postLocked(ctx, v, printQr);
    }

    /** Posts a locked DRAFT inside the caller's transaction (also used by "Register now" at calving). */
    @Transactional(propagation = Propagation.MANDATORY)
    public EntryDtos.PostResult postLocked(FarmContext ctx, HerdEntryVoucher v, boolean printQr) {
        Long farmId = ctx.farmId();
        List<HerdEntry> lines = entryRepository.findAllByVoucherIdOrderByLineNoAsc(v.getId());
        boolean purchase = v.getEntryType() == EntryType.PURCHASE;
        if (!purchase) {
            new TreeSet<>(lines.stream().map(l -> l.getCalfOutcome() == null ? null : l.getCalfOutcome().getId()).filter(id -> id != null).toList())
                .forEach(id -> catalog.lockCalf(farmId, id));
        }

        EntryVoucherRules.Validation val = rules.validate(v, lines);
        if (val.hasErrors()) {
            throw val.firstError().toException();
        }
        List<PenOccupancyService.Occupancy> occ = occupancy.assertCanReceive(farmId, val.incomingByPen());

        List<EntryLineValidator.Issue> warnings = new ArrayList<>(val.issues().stream().filter(i -> i.severity() == EntryLineValidator.Severity.WARNING).toList());
        for (PenOccupancyService.Occupancy o : occ) {
            if (o.willBeFull()) {
                warnings.add(EntryLineValidator.warning(0, MessageCodes.FE06_17, "penId", "pen", o.penCode(), "count", o.after(), "capacity", o.capacity()));
            }
        }

        long intendedPaid = purchase ? v.getAmountPaid() : 0L;
        List<Cattle> created = new ArrayList<>();
        long cattleAmount = 0;
        for (int i = 0; i < lines.size(); i++) {
            HerdEntry line = lines.get(i);
            Resolved r = val.lines().get(i);
            Cattle cattle = createCattle(ctx, v, r);
            created.add(cattle);
            line.setCattle(cattle);
            line.setStatus(EntryLineStatus.VALID);
            line.setEntryDate(r.entryDate());
            line.setLineAmount(r.lineAmount());
            line.setDraftData(JsonSupport.toJson(r.data()));
            entryRepository.saveAndFlush(line);
            attachments.transferEntryPhoto(farmId, line.getId(), cattle);
            cattleAmount += r.lineAmount();

            if (purchase) {
                createDeclarations(ctx, line, cattle, r);
            }
            penAssignments.openAssignment(cattle, r.pen(), r.entryDate(), AssignmentSource.HERD_ENTRY, null, r.check(), r.warningReason(), ctx.user());
            issueQrTag(ctx, cattle, r);
            if (purchase && r.data().reproduction() != null && r.data().reproduction().status() == DeclarationStatus.KNOWN && r.data().reproduction().pregnantAtEntry() == YesNoUnknown.YES) {
                reminders.pregnancyCheckAtEntry(line, cattle);
            }
            if (!purchase) {
                CalfOutcome calf = r.calf();
                calf.setRegistrationState("REGISTERED");
                calf.setRegisteredCattle(cattle);
                em.merge(calf);
                reminders.resolveCalfReminder(calf);
            }
        }

        v.setStatus(EntryVoucherStatus.POSTED);
        v.setPostedBy(ctx.user());
        v.setPostedAt(clock.now());
        v.setCattleAmount(purchase ? cattleAmount : 0L);
        v.setAmountPaid(0L);
        voucherRepository.saveAndFlush(v);
        if (purchase && intendedPaid > 0) {
            payments.recordInitialPayment(ctx, v, intendedPaid, v.getPaymentMethod(), null);
        }
        voucherRepository.saveAndFlush(v);

        List<String> codesCreated = created.stream().map(Cattle::getDisplayCode).toList();
        audit.log(ctx, "ENTRY_POST", "HerdEntryVoucher", v.getId(), Map.of("code", v.getCode(), "count", created.size(), "cattle", codesCreated, "amountPaid", intendedPaid));
        return result(v, created, false, printQr, warnings);
    }

    private EntryDtos.PostResult existingResult(HerdEntryVoucher v, boolean printQr) {
        List<Cattle> cattle = entryRepository
            .findAllByVoucherIdOrderByLineNoAsc(v.getId())
            .stream()
            .filter(l -> l.getStatus() == EntryLineStatus.VALID && l.getCattle() != null)
            .map(HerdEntry::getCattle)
            .toList();
        return result(v, cattle, true, printQr, List.of());
    }

    private EntryDtos.PostResult result(HerdEntryVoucher v, List<Cattle> cattle, boolean already, boolean printQr, List<EntryLineValidator.Issue> warnings) {
        List<String> cattleCodes = cattle.stream().map(Cattle::getDisplayCode).toList();
        String first = cattleCodes.isEmpty() ? null : cattleCodes.get(0);
        String last = cattleCodes.isEmpty() ? null : cattleCodes.get(cattleCodes.size() - 1);
        List<EntryDtos.MatchingSchedule> schedules = already ? List.of() : matchingSchedules(v.getFarm().getId(), cattle);
        return new EntryDtos.PostResult(
            mapper.voucher(v, true),
            cattleCodes,
            first,
            last,
            already,
            printQr,
            mapper.notice(MessageCodes.FE06_01, "voucher_code", v.getCode(), "count", cattleCodes.size(), "first_code", first, "last_code", last),
            warnings.stream().map(mapper::issue).toList(),
            schedules,
            schedules.isEmpty() ? null : mapper.notice(MessageCodes.FE06_05, "count", schedules.size(), "voucher_code", v.getCode())
        );
    }

    // ------------------------------------------------------------------ per-line creation

    private Cattle createCattle(FarmContext ctx, HerdEntryVoucher v, Resolved r) {
        Cattle c = new Cattle();
        c.setFarm(ctx.farm());
        c.setDisplayCode(codes.nextCattleCode(ctx.farmId()));
        c.setEarTagNumber(r.earTag());
        c.setName(r.data().name());
        c.setSex(r.sex());
        c.setBirthDate(r.birthDate());
        c.setBirthDateAccuracy(r.accuracy());
        c.setColourMarkings(r.data().colourMarkings());
        c.setPhotoUrl(r.data().photoUrl());
        c.setLifeStage(r.lifeStage());
        c.setHerdStatus(HerdStatus.ACTIVE);
        c.setBreed(r.breed());
        c.setPurpose(r.purpose());
        c.setDam(r.dam());
        c.setCreatedBy(ctx.user());
        c.setCreatedAt(clock.now());
        c.setUpdatedAt(clock.now());
        EntryLineRequest.ReproductionDeclaration repro = r.data().reproduction();
        int earlier = repro != null && repro.status() == DeclarationStatus.KNOWN && repro.earlierCalvings() != null && r.sex() == Sex.FEMALE ? repro.earlierCalvings() : 0;
        c.setDeclaredParity(earlier);
        return cattleRepository.saveAndFlush(c);
    }

    /** Declarations per category (GBR-30); known vaccinations also become HISTORICAL vaccination records without doses. */
    void createDeclarations(FarmContext ctx, HerdEntry line, Cattle cattle, Resolved r) {
        EntryLineRequest d = r.data();
        EntryLineRequest.VaccinationDeclaration vacc = d.vaccination();
        saveDeclaration(ctx, line, DeclarationCategory.VACCINATION, vacc.status(), vacc.status() == DeclarationStatus.KNOWN ? JsonSupport.toJson(vacc.items()) : null, vacc.informationSource(), null, null, null);
        if (vacc.status() == DeclarationStatus.KNOWN && vacc.items() != null) {
            for (EntryLineRequest.VaccinationItem item : vacc.items()) {
                recordHistoricalVaccination(cattle, item, vacc.informationSource(), r.entryDate());
            }
        }
        EntryLineRequest.DiseaseDeclaration disease = d.disease();
        saveDeclaration(ctx, line, DeclarationCategory.DISEASE, disease.status(), disease.status() == DeclarationStatus.KNOWN ? JsonSupport.toJson(Map.of("description", disease.description())) : null, null, null, null, null);
        if (r.sex() == Sex.FEMALE) {
            EntryLineRequest.ReproductionDeclaration repro = d.reproduction();
            Map<String, Object> items = new LinkedHashMap<>();
            items.put("description", repro.description());
            saveDeclaration(
                ctx,
                line,
                DeclarationCategory.REPRODUCTION,
                repro.status(),
                repro.status() == DeclarationStatus.KNOWN ? JsonSupport.toJson(items) : null,
                null,
                repro.earlierCalvings(),
                repro.pregnantAtEntry(),
                repro.estMonthsPregnant()
            );
        }
    }

    void saveDeclaration(
        FarmContext ctx,
        HerdEntry line,
        DeclarationCategory category,
        DeclarationStatus status,
        String items,
        String source,
        Integer earlierCalvings,
        YesNoUnknown pregnant,
        Integer months
    ) {
        PreEntryHistoryDeclaration p = new PreEntryHistoryDeclaration();
        p.setFarm(ctx.farm());
        p.setHerdEntry(line);
        p.setCategory(category);
        p.setStatus(status);
        p.setItems(items);
        p.setInformationSource(source);
        p.setEarlierCalvings(earlierCalvings);
        p.setPregnantAtEntry(pregnant);
        p.setEstMonthsPregnant(months);
        declarationRepository.save(p);
    }

    void recordHistoricalVaccination(Cattle cattle, EntryLineRequest.VaccinationItem item, String declarationSource, LocalDate entryDate) {
        if (item.vaccineId() == null) {
            return;
        }
        var vaccine = catalog.vaccine(cattle.getFarm().getId(), item.vaccineId()).orElse(null);
        if (vaccine == null) {
            return;
        }
        Vaccination vac = new Vaccination();
        vac.setCattle(cattle);
        vac.setVaccine(vaccine);
        vac.setVaccinationDate(item.date() != null ? item.date() : entryDate);
        vac.setEntryTime(clock.now());
        vac.setDose(vaccine.getDose());
        vac.setSource("HISTORICAL");
        vac.setVaccinator("Pre-entry declaration");
        String info = item.informationSource() != null ? item.informationSource() : declarationSource;
        vac.setInformationSource(item.date() == null ? (info == null ? "" : info + "; ") + "date unknown (entry date used)" : info);
        vaccinationRepository.save(vac);
    }

    private void issueQrTag(FarmContext ctx, Cattle cattle, Resolved r) {
        String code = r.calf() != null && r.calf().getTagCode() != null && !r.calf().getTagCode().isBlank() ? r.calf().getTagCode().trim() : null;
        if (code != null && qrRepository.existsByTagCode(code)) {
            throw DomainException.unprocessable(HerdEntryCodes.FE12_08, "tag_code", code);
        }
        CattleQrTag tag = new CattleQrTag();
        tag.setFarm(ctx.farm());
        tag.setCattle(cattle);
        tag.setTagCode(code != null ? code : codes.nextQrTagCode(ctx.farmId()));
        tag.setStatus(QrTagStatus.ACTIVE);
        tag.setIssuedBy(ctx.user());
        tag.setIssuedAt(clock.now());
        qrRepository.saveAndFlush(tag);
    }

    // ------------------------------------------------------------------ vaccination schedules that match the new cattle

    /** GBR-24 herd group of an ACTIVE cattle: the first match of Calves, Fattening, Breeding bulls, Breeding females, Young stock, Other. */
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
        return c.getLifeStage() == LifeStage.YOUNG_STOCK ? "YOUNG_STOCK" : "OTHER";
    }

    private List<EntryDtos.MatchingSchedule> matchingSchedules(Long farmId, List<Cattle> cattle) {
        List<VaccinationSchedule> schedules = em
            .createQuery("select s from VaccinationSchedule s where s.farm.id = :farm and upper(s.status) = 'ACTIVE' order by s.id", VaccinationSchedule.class)
            .setParameter("farm", farmId)
            .getResultList();
        List<EntryDtos.MatchingSchedule> out = new ArrayList<>();
        for (VaccinationSchedule s : schedules) {
            String target = s.getTargetGroup() == null ? "" : s.getTargetGroup().trim().toUpperCase(Locale.ROOT).replace(' ', '_').replace('-', '_');
            boolean all = target.equals("ALL") || target.equals("ALL_CATTLE") || target.equals("ALL_HERD");
            List<String> matched = cattle.stream().filter(c -> all || herdGroup(c).equals(target)).map(Cattle::getDisplayCode).sorted(Comparator.naturalOrder()).toList();
            if (!matched.isEmpty()) {
                out.add(new EntryDtos.MatchingSchedule(s.getId(), s.getVaccine() == null ? null : s.getVaccine().getName(), s.getTargetGroup(), matched));
            }
        }
        return out;
    }
}
