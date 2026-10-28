package vn.edu.fpt.beefcare.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.repository.TradingPartnerRepository;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;
import vn.edu.fpt.beefcare.service.dto.TradingPartnerRequest;

/**
 * Trading partners (GBR-97): sellers, buyers and feed suppliers of the farm. Names are unique per farm (case-insensitive),
 * partners are never deleted (made INACTIVE), buyers are maintained by the Owner, sellers and suppliers by Owner and Manager.
 */
@Service
public class TradingPartnerService {

    private final TradingPartnerRepository repository;
    private final FarmAccessService access;
    private final AuditService audit;
    private final FarmClock clock;

    public TradingPartnerService(TradingPartnerRepository repository, FarmAccessService access, AuditService audit, FarmClock clock) {
        this.repository = repository;
        this.access = access;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<EntryDtos.Partner> list(Long farmId, String role, ActiveStatus status, String q) {
        access.require(farmId, FarmAction.VIEW_PARTNERS);
        String needle = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        String wanted = role == null ? null : role.trim().toUpperCase(Locale.ROOT);
        if (wanted != null && !List.of("SELLER", "BUYER", "SUPPLIER").contains(wanted)) {
            throw DomainException.invalid("role");
        }
        return repository
            .findAllByFarmIdOrderByNameAsc(farmId)
            .stream()
            .filter(p -> status == null || p.getStatus() == status)
            .filter(p -> wanted == null || ("SELLER".equals(wanted) && p.isSeller()) || ("BUYER".equals(wanted) && p.isBuyer()) || ("SUPPLIER".equals(wanted) && p.isSupplier()))
            .filter(p -> needle == null || needle.isEmpty() || p.getName().toLowerCase(Locale.ROOT).contains(needle) || (p.getContactPhone() != null && p.getContactPhone().contains(needle)))
            .map(TradingPartnerService::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public EntryDtos.Partner get(Long farmId, Long id) {
        access.require(farmId, FarmAction.VIEW_PARTNERS);
        return toDto(load(farmId, id));
    }

    @Transactional
    public EntryDtos.Partner create(Long farmId, TradingPartnerRequest req) {
        boolean buyer = Boolean.TRUE.equals(req.buyer());
        FarmContext ctx = access.require(farmId, buyer ? FarmAction.MANAGE_BUYERS : FarmAction.MANAGE_SELLERS);
        TradingPartner p = new TradingPartner();
        p.setFarm(ctx.farm());
        p.setCreatedBy(ctx.user());
        p.setStatus(ActiveStatus.ACTIVE);
        apply(p, req);
        TradingPartner saved = save(farmId, p);
        audit.log(ctx, "PARTNER_CREATE", "TradingPartner", saved.getId(), Map.of("name", saved.getName()));
        return toDto(saved);
    }

    /** Inline "+ Add new source" on a voucher (seller flag only): same rules as creating a seller. */
    @Transactional(propagation = Propagation.MANDATORY)
    public TradingPartner createInlineSeller(FarmContext ctx, EntryVoucherRequest.NewPartner np) {
        TradingPartner p = new TradingPartner();
        p.setFarm(ctx.farm());
        p.setCreatedBy(ctx.user());
        p.setStatus(ActiveStatus.ACTIVE);
        p.setName(np.name().trim());
        p.setSeller(true);
        p.setContactPhone(blankToNull(np.phone()));
        p.setAddress(blankToNull(np.area()));
        TradingPartner saved = save(ctx.farmId(), p);
        audit.log(ctx, "PARTNER_CREATE", "TradingPartner", saved.getId(), Map.of("name", saved.getName(), "inline", true));
        return saved;
    }

    @Transactional
    public EntryDtos.Partner update(Long farmId, Long id, TradingPartnerRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_SELLERS);
        TradingPartner p = load(farmId, id);
        requireRightsOn(farmId, p, req.buyer());
        VersionGuard.check(p.getVersion(), req.expectedVersion());
        apply(p, req);
        TradingPartner saved = save(farmId, p);
        audit.log(ctx, "PARTNER_UPDATE", "TradingPartner", saved.getId(), Map.of("name", saved.getName()));
        return toDto(saved);
    }

    @Transactional
    public EntryDtos.Partner changeStatus(Long farmId, Long id, TradingPartnerRequest.StatusRequest req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_SELLERS);
        if (req == null || req.status() == null) {
            throw DomainException.required("status");
        }
        TradingPartner p = load(farmId, id);
        requireRightsOn(farmId, p, null);
        VersionGuard.check(p.getVersion(), req.expectedVersion());
        p.setStatus(req.status());
        p.setUpdatedAt(clock.now());
        TradingPartner saved = repository.saveAndFlush(p);
        audit.log(ctx, "PARTNER_STATUS", "TradingPartner", saved.getId(), Map.of("status", saved.getStatus()));
        return toDto(saved);
    }

    /** A buyer (existing or requested) can only be maintained by the Owner. */
    private void requireRightsOn(Long farmId, TradingPartner p, Boolean requestedBuyer) {
        if (p.isBuyer() || Boolean.TRUE.equals(requestedBuyer)) {
            access.require(farmId, FarmAction.MANAGE_BUYERS);
        }
    }

    private void apply(TradingPartner p, TradingPartnerRequest req) {
        p.setName(req.name().trim());
        p.setSeller(Boolean.TRUE.equals(req.seller()));
        p.setBuyer(Boolean.TRUE.equals(req.buyer()));
        p.setSupplier(Boolean.TRUE.equals(req.supplier()));
        p.setContactPhone(blankToNull(req.phone()));
        p.setAddress(blankToNull(req.area()));
        p.setNote(blankToNull(req.note()));
    }

    private TradingPartner save(Long farmId, TradingPartner p) {
        if (p.getName().isEmpty() || p.getName().length() > 150) {
            throw DomainException.invalid("name");
        }
        if (!p.isSeller() && !p.isBuyer() && !p.isSupplier()) {
            throw DomainException.required("roles");
        }
        boolean duplicate = p.getId() == null
            ? repository.existsByFarmIdAndNameIgnoreCase(farmId, p.getName())
            : repository.existsByFarmIdAndNameIgnoreCaseAndIdNot(farmId, p.getName(), p.getId());
        if (duplicate) {
            throw DomainException.unprocessable(HerdEntryCodes.PARTNER_DUPLICATE, "name", p.getName());
        }
        p.setUpdatedAt(clock.now());
        if (p.getCreatedAt() == null) {
            p.setCreatedAt(clock.now());
        }
        return repository.saveAndFlush(p);
    }

    private TradingPartner load(Long farmId, Long id) {
        return repository.findByIdAndFarmId(id, farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "partner_id", id));
    }

    static EntryDtos.Partner toDto(TradingPartner p) {
        return new EntryDtos.Partner(
            p.getId(),
            p.getName(),
            p.isSeller(),
            p.isBuyer(),
            p.isSupplier(),
            p.getContactPhone(),
            p.getAddress(),
            p.getNote(),
            p.getStatus().name(),
            p.getVersion()
        );
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
