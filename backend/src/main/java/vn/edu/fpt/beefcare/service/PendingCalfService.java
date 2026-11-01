package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.repository.HerdEntryRepository;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;

/**
 * Farm-born calves (GBR-31, GBR-58, GBR-93): the pending (draft) calves, "died before registration" and the
 * "Register now" hook that the calving feature calls inside its own transaction.
 */
@Service
public class PendingCalfService {

    @PersistenceContext
    private EntityManager em;

    private final FarmAccessService access;
    private final EntryCatalogLookup catalog;
    private final HerdEntryRepository entryRepository;
    private final HerdEntryVoucherService vouchers;
    private final HerdEntryPostingService posting;
    private final EntryReminderService reminders;
    private final AuditService audit;
    private final EntryVoucherMapper mapper;
    private final FarmClock clock;

    public PendingCalfService(
        FarmAccessService access,
        EntryCatalogLookup catalog,
        HerdEntryRepository entryRepository,
        HerdEntryVoucherService vouchers,
        HerdEntryPostingService posting,
        EntryReminderService reminders,
        AuditService audit,
        EntryVoucherMapper mapper,
        FarmClock clock
    ) {
        this.access = access;
        this.catalog = catalog;
        this.entryRepository = entryRepository;
        this.vouchers = vouchers;
        this.posting = posting;
        this.reminders = reminders;
        this.audit = audit;
        this.mapper = mapper;
        this.clock = clock;
    }

    /** Live calves still PENDING_CONFIRMATION (SCR-25 "Select pending calves", the "Pending calves (n)" button). */
    @Transactional(readOnly = true)
    public List<EntryDtos.PendingCalf> pending(Long farmId) {
        access.require(farmId, FarmAction.VIEW_ENTRY_VOUCHERS);
        Long defaultPurpose = catalog.defaultUndecidedPurpose(farmId).map(p -> p.getId()).orElse(null);
        List<CalfOutcome> calves = em
            .createQuery(
                "select o from CalfOutcome o where o.calving.dam.farm.id = :farm and upper(o.outcome) = 'LIVE' and o.registrationState = 'PENDING_CONFIRMATION' and upper(o.status)='VALID' order by o.calving.birthTime, o.id",
                CalfOutcome.class
            )
            .setParameter("farm", farmId)
            .getResultList();
        return calves
            .stream()
            .map(c -> {
                var dam = c.getAssignedDam() != null ? c.getAssignedDam() : c.getCalving().getDam();
                Parentage parentage = parentage(c);
                HerdEntry draft = entryRepository.findFirstByCalfOutcomeIdAndStatus(c.getId(), EntryLineStatus.DRAFT).orElse(null);
                return new EntryDtos.PendingCalf(
                    c.getId(),
                    c.getCalving().getId(),
                    dam.getId(),
                    dam.getDisplayCode(),
                    dam.getHerdStatus() == HerdStatus.ACTIVE,
                    c.getAssignedSire() != null ? c.getAssignedSire().getId() : (c.getCalving().getEpisode() == null || c.getCalving().getEpisode().getLinkedBreeding() == null || c.getCalving().getEpisode().getLinkedBreeding().getSire() == null ? null : c.getCalving().getEpisode().getLinkedBreeding().getSire().getId()),
                    parentage.sireCode(),
                    parentage.sireSource(),
                    parentage.externalSireName(),
                    parentage.semenBatch(),
                    parentage.sireBreedCode(),
                    c.getSex(),
                    clock.toFarmDate(c.getCalving().getBirthTime()),
                    c.getBirthWeight(),
                    c.getTagCode(),
                    c.getProposedPen() == null ? null : c.getProposedPen().getId(),
                    c.getProposedPen() == null ? null : c.getProposedPen().getCode(),
                    defaultPurpose,
                    c.getRegistrationState(),
                    draft == null ? null : draft.getVoucher().getId()
                );
            })
            .toList();
    }

    private record Parentage(String sireCode, String sireSource, String externalSireName, String semenBatch, String sireBreedCode) {}

    private static Parentage parentage(CalfOutcome calf) {
        if (calf.getAssignedSire() != null) return new Parentage(calf.getAssignedSire().getDisplayCode(), "INTERNAL", null, null, calf.getAssignedSire().getBreed() == null ? null : calf.getAssignedSire().getBreed().getCode());
        if (calf.getAssignedSireSource() != null && "AI".equalsIgnoreCase(calf.getAssignedSireSource())) return new Parentage(calf.getAssignedExternalSireCode(), "AI", calf.getAssignedExternalSireCode(), null, null);
        var episode = calf.getCalving() == null ? null : calf.getCalving().getEpisode();
        var breeding = episode == null ? null : episode.getLinkedBreeding();
        if (breeding == null) return new Parentage("Không rõ", null, null, null, null);
        String code = breeding.getSire() != null ? breeding.getSire().getDisplayCode()
            : breeding.getExternalSireName() != null && !breeding.getExternalSireName().isBlank() ? breeding.getExternalSireName()
            : breeding.getSemenBatch();
        return new Parentage(code == null || code.isBlank() ? "Không rõ" : code, breeding.getSireSource(), breeding.getExternalSireName(), breeding.getSemenBatch(), breeding.getSireBreed() == null ? null : breeding.getSireBreed().getCode());
    }

    /** "Mark died before registration" (reason required): the calf leaves the pending list and REM-09 is resolved. */
    @Transactional
    public EntryDtos.PendingCalf diedBeforeRegistration(Long farmId, Long calfId, String reason) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        if (reason == null || reason.isBlank()) {
            throw DomainException.required("reason");
        }
        if (reason.trim().length() > 500) {
            throw DomainException.invalid("reason");
        }
        CalfOutcome calf = catalog.lockCalf(farmId, calfId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calf_id", calfId));
        if (!"VALID".equalsIgnoreCase(calf.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        if ("REGISTERED".equalsIgnoreCase(calf.getRegistrationState())) {
            throw DomainException.conflict(MessageCodes.FE06_02, "cattle_code", calf.getRegisteredCattle() == null ? null : calf.getRegisteredCattle().getDisplayCode());
        }
        if (!"LIVE".equalsIgnoreCase(calf.getOutcome())) {
            throw DomainException.unprocessable(MessageCodes.FE06_04);
        }
        if (!"PENDING_CONFIRMATION".equalsIgnoreCase(calf.getRegistrationState())) {
            throw DomainException.conflict(MessageCodes.COM_05);
        }
        calf.setRegistrationState("DIED_BEFORE_REGISTRATION");
        calf.setDiedReason(reason.trim());
        em.merge(calf);
        reminders.resolveCalfReminder(calf);
        audit.log(ctx, "CALF_DIED", "CalfOutcome", calf.getId(), Map.of("reason", reason.trim(), "dam", calf.getCalving().getDam().getDisplayCode()));
        return new EntryDtos.PendingCalf(
            calf.getId(),
            calf.getCalving().getId(),
            calf.getCalving().getDam().getId(),
            calf.getCalving().getDam().getDisplayCode(),
            calf.getCalving().getDam().getHerdStatus() == HerdStatus.ACTIVE,
            null,
            null,
            null,
            null,
            null,
            null,
            calf.getSex(),
            clock.toFarmDate(calf.getCalving().getBirthTime()),
            calf.getBirthWeight(),
            calf.getTagCode(),
            null,
            null,
            null,
            calf.getRegistrationState(),
            null
        );
    }

    @Transactional
    public EntryDtos.PendingCalf assignParentage(Long farmId, Long calfId, vn.edu.fpt.beefcare.service.dto.EntryActionRequests.AssignCalfParentageRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        if (req == null || req.damId() == null) throw DomainException.required("damId");
        String source = req.sireSource() == null ? "NONE" : req.sireSource().trim().toUpperCase(java.util.Locale.ROOT);
        if (!java.util.Set.of("NONE", "INTERNAL", "AI").contains(source)) throw DomainException.invalid("sireSource");
        CalfOutcome calf = catalog.lockCalf(farmId, calfId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calf_id", calfId));
        if (!"LIVE".equalsIgnoreCase(calf.getOutcome()) || !"PENDING_CONFIRMATION".equalsIgnoreCase(calf.getRegistrationState())) throw DomainException.conflict(MessageCodes.COM_05);
        var dam = em.createQuery("select c from Cattle c where c.id=:id and c.farm.id=:farm", vn.edu.fpt.beefcare.domain.Cattle.class)
            .setParameter("id", req.damId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "damId", req.damId()));
        if (dam.getSex() != Sex.FEMALE || dam.getHerdStatus() != HerdStatus.ACTIVE) throw DomainException.unprocessable(MessageCodes.COM_10, "field", "damId");
        vn.edu.fpt.beefcare.domain.Cattle sire = null;
        if ("INTERNAL".equals(source)) {
            if (req.sireId() == null) throw DomainException.required("sireId");
            sire = em.createQuery("select c from Cattle c where c.id=:id and c.farm.id=:farm", vn.edu.fpt.beefcare.domain.Cattle.class)
                .setParameter("id", req.sireId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "sireId", req.sireId()));
            if (sire.getSex() != Sex.MALE || sire.getHerdStatus() != HerdStatus.ACTIVE) throw DomainException.unprocessable(MessageCodes.COM_10, "field", "sireId");
        } else if (req.sireId() != null) throw DomainException.invalid("sireId");
        if ("AI".equals(source) && (req.externalSireCode() == null || req.externalSireCode().isBlank())) throw DomainException.required("externalSireCode");
        calf.setAssignedDam(dam); calf.setAssignedSire(sire); calf.setAssignedSireSource(source); calf.setAssignedExternalSireCode(source.equals("AI") ? req.externalSireCode().trim() : null);
        em.merge(calf); em.flush();
        audit.log(ctx, "CALF_PARENTAGE_ASSIGN", "CalfOutcome", calf.getId(), Map.of("damId", dam.getId(), "sireSource", source));
        return pending(farmId).stream().filter(x -> x.calfOutcomeId().equals(calf.getId())).findFirst().orElseThrow();
    }

    /**
     * "Register now" at calving (UC-FE12-04, GBR-58, MSG-FE06-11): creates and posts a FARM_BORN voucher for the calf in
     * the caller's transaction. Returns the voucher and cattle codes. penId / purposeId may be null: the pen chosen at
     * calving and the default UNDECIDED purpose are used.
     */
    @Transactional
    public EntryDtos.RegisteredCalf registerCalfNow(Long farmId, Long calfId, Long penId, Long purposeId) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        CalfOutcome calf = catalog.lockCalf(farmId, calfId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calf_id", calfId));
        if (!"VALID".equalsIgnoreCase(calf.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        EntryLineRequest line = new EntryLineRequest(null, null, null, null, null, null, null, null, null, null, purposeId, null, null, penId, null, null, null, null, null, null, calf.getId());
        EntryVoucherRequest req = new EntryVoucherRequest(
            EntryType.FARM_BORN,
            clock.toFarmDate(calf.getCalving().getBirthTime()),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            List.of(line),
            null
        );
        HerdEntryVoucher draft = vouchers.createDraft(ctx, req);
        EntryDtos.PostResult posted = posting.postLocked(ctx, draft, false);
        EntryDtos.Line created = posted.voucher().lines().get(0);
        String damCode = calf.getCalving().getDam().getDisplayCode();
        return new EntryDtos.RegisteredCalf(
            draft.getId(),
            draft.getCode(),
            created.cattleId(),
            created.cattleCode(),
            damCode,
            mapper.notice(MessageCodes.FE06_11, "cattle_code", created.cattleCode(), "dam_code", damCode, "voucher_code", draft.getCode())
        );
    }
}
