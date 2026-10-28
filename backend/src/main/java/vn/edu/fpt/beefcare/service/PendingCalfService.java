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
                "select o from CalfOutcome o where o.calving.dam.farm.id = :farm and upper(o.outcome) = 'LIVE' and o.registrationState = 'PENDING_CONFIRMATION' order by o.calving.birthTime, o.id",
                CalfOutcome.class
            )
            .setParameter("farm", farmId)
            .getResultList();
        return calves
            .stream()
            .map(c -> {
                var dam = c.getCalving().getDam();
                HerdEntry draft = entryRepository.findFirstByCalfOutcomeIdAndStatus(c.getId(), EntryLineStatus.DRAFT).orElse(null);
                return new EntryDtos.PendingCalf(
                    c.getId(),
                    c.getCalving().getId(),
                    dam.getId(),
                    dam.getDisplayCode(),
                    dam.getHerdStatus() == HerdStatus.ACTIVE,
                    null,
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

    /**
     * "Register now" at calving (UC-FE12-04, GBR-58, MSG-FE06-11): creates and posts a FARM_BORN voucher for the calf in
     * the caller's transaction. Returns the voucher and cattle codes. penId / purposeId may be null: the pen chosen at
     * calving and the default UNDECIDED purpose are used.
     */
    @Transactional
    public EntryDtos.RegisteredCalf registerCalfNow(Long farmId, Long calfId, Long penId, Long purposeId) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_ENTRY_VOUCHERS);
        CalfOutcome calf = catalog.lockCalf(farmId, calfId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calf_id", calfId));
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
