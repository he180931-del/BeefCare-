package vn.edu.fpt.beefcare.support;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.service.HerdEntryCorrectionService;
import vn.edu.fpt.beefcare.service.HerdEntryPostingService;
import vn.edu.fpt.beefcare.service.HerdEntryVoucherService;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;

/** A farm with an Owner, a Manager, a Technician, a seller, a breed, one purpose of each type and two pens. */
public abstract class HerdEntryTestBase extends DomainTestSupport {

    @Autowired
    protected HerdEntryVoucherService vouchers;

    @Autowired
    protected HerdEntryPostingService posting;

    @Autowired
    protected HerdEntryCorrectionService corrections;

    protected Farm farm;
    protected AppUser owner;
    protected AppUser manager;
    protected AppUser technician;
    protected TradingPartner seller;
    protected Breed breed;
    protected ProductionPurpose fattening;
    protected ProductionPurpose breeding;
    protected ProductionPurpose sire;
    protected ProductionPurpose undecided;
    protected Pen penA;
    protected Pen penB;

    @BeforeEach
    void setUpHerdFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        seller = partner(farm, owner, true, false);
        breed = breed(farm);
        fattening = purpose(farm, PurposeType.FATTENING);
        breeding = purpose(farm, PurposeType.BREEDING);
        sire = purpose(farm, PurposeType.SIRE);
        undecided = purpose(farm, PurposeType.UNDECIDED);
        penA = pen(farm, "A" + next(), 10);
        penB = pen(farm, "B" + next(), 10);
        actAs(owner);
    }

    /** A male fattening line aged 18 months, young stock. */
    protected EntryLineRequest line(String tag, Pen pen, String kg, long price) {
        return line(tag, Sex.MALE, fattening, pen, kg, price);
    }

    protected EntryLineRequest line(String tag, Sex sex, ProductionPurpose purpose, Pen pen, String kg, long price) {
        return new EntryLineRequest(
            tag,
            null,
            null,
            null,
            breed.getId(),
            sex,
            null,
            null,
            18,
            LifeStage.YOUNG_STOCK,
            purpose.getId(),
            kg == null ? null : new BigDecimal(kg),
            kg == null ? null : WeightBasis.MEASURED,
            pen.getId(),
            price,
            null,
            null,
            null,
            null,
            null,
            null
        );
    }

    protected EntryLineRequest withReason(EntryLineRequest l, String reason) {
        return new EntryLineRequest(l.earTagNumber(), l.name(), l.photoUrl(), l.colourMarkings(), l.breedId(), l.sex(), l.birthDate(), l.birthDateAccuracy(), l.ageMonths(), l.lifeStage(), l.purposeId(), l.entryWeightKg(), l.weightBasis(), l.penId(), l.unitPrice(), l.quarantineUntil(), reason, l.vaccination(), l.disease(), l.reproduction(), l.calfOutcomeId());
    }

    protected EntryLineRequest withReproduction(EntryLineRequest l, EntryLineRequest.ReproductionDeclaration repro) {
        return new EntryLineRequest(l.earTagNumber(), l.name(), l.photoUrl(), l.colourMarkings(), l.breedId(), l.sex(), l.birthDate(), l.birthDateAccuracy(), l.ageMonths(), l.lifeStage(), l.purposeId(), l.entryWeightKg(), l.weightBasis(), l.penId(), l.unitPrice(), l.quarantineUntil(), l.warningReason(), l.vaccination(), l.disease(), repro, l.calfOutcomeId());
    }

    protected EntryLineRequest withVaccination(EntryLineRequest l, EntryLineRequest.VaccinationDeclaration vacc) {
        return new EntryLineRequest(l.earTagNumber(), l.name(), l.photoUrl(), l.colourMarkings(), l.breedId(), l.sex(), l.birthDate(), l.birthDateAccuracy(), l.ageMonths(), l.lifeStage(), l.purposeId(), l.entryWeightKg(), l.weightBasis(), l.penId(), l.unitPrice(), l.quarantineUntil(), l.warningReason(), vacc, l.disease(), l.reproduction(), l.calfOutcomeId());
    }

    protected EntryVoucherRequest purchase(List<EntryLineRequest> lines, Long transportFee, Long paid) {
        return new EntryVoucherRequest(
            EntryType.PURCHASE,
            TODAY,
            seller.getId(),
            null,
            "QC-2026-001",
            "51A-123.45",
            null,
            PricingBasis.PER_KG,
            transportFee,
            paid,
            paid != null && paid > 0 ? PaymentMethod.BANK_TRANSFER : null,
            null,
            lines,
            null
        );
    }

    protected EntryVoucherRequest purchaseWithoutCert(List<EntryLineRequest> lines) {
        EntryVoucherRequest p = purchase(lines, 0L, 0L);
        return new EntryVoucherRequest(p.entryType(), p.entryDate(), p.sellerId(), null, null, null, null, p.pricingBasis(), 0L, 0L, null, null, lines, null);
    }

    protected EntryDtos.PostResult createAndPost(List<EntryLineRequest> lines, Long fee, Long paid) {
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(lines, fee, paid));
        return postDraft(farm.getId(), draft.id());
    }

    /** Posts a voucher with the version it has now, as the client form sends it (BR-D31). */
    protected EntryDtos.PostResult postDraft(Long farmId, Long voucherId) {
        return posting.post(farmId, voucherId, new EntryActionRequests.PostRequest(entryVoucherVersion(voucherId), false));
    }

    // The helpers below send the versions the form read unless the request names its own (BR-D31).

    protected EntryDtos.Voucher updateVoucher(Long voucherId, EntryVoucherRequest r) {
        Integer version = r.expectedVersion() != null ? r.expectedVersion() : entryVoucherVersion(voucherId);
        return vouchers.update(farm.getId(), voucherId, new EntryVoucherRequest(r.entryType(), r.entryDate(), r.sellerId(), r.newSeller(),
            r.quarantineCertNo(), r.vehiclePlate(), r.note(), r.pricingBasis(), r.transportFee(), r.amountPaid(), r.paymentMethod(),
            r.paymentDueDate(), r.lines(), version));
    }

    protected void discard(Long voucherId, Integer expectedVersion) {
        vouchers.discard(farm.getId(), voucherId, expectedVersion != null ? expectedVersion : entryVoucherVersion(voucherId));
    }

    protected EntryDtos.VoidResult voidVoucher(Long voucherId, EntryActionRequests.VoidRequest r) {
        Integer version = r.expectedVersion() != null ? r.expectedVersion() : entryVoucherVersion(voucherId);
        return corrections.voidVoucher(farm.getId(), voucherId, new EntryActionRequests.VoidRequest(r.reason(), version));
    }

    protected EntryDtos.EntryVoidResult voidEntry(Long entryId, EntryActionRequests.VoidRequest r) {
        Integer version = r.expectedVersion() != null ? r.expectedVersion() : versionOf(HerdEntry.class, entryId);
        return corrections.voidEntry(farm.getId(), entryId, new EntryActionRequests.VoidRequest(r.reason(), version));
    }

    protected EntryDtos.CorrectionResult correct(Long entryId, EntryActionRequests.CorrectEntryRequest r) {
        HerdEntry entry = em.find(HerdEntry.class, entryId);
        Integer version = r.expectedVersion() != null ? r.expectedVersion() : entry == null ? null : entry.getVersion();
        Integer voucherVersion = r.voucherVersion() != null ? r.voucherVersion() : entry == null ? null : entry.getVoucher().getVersion();
        return corrections.correct(farm.getId(), entryId, new EntryActionRequests.CorrectEntryRequest(r.reason(), version, voucherVersion, r.changes()));
    }

    protected long count(String entity) {
        return em.createQuery("select count(x) from " + entity + " x where x.farm.id = :f", Long.class).setParameter("f", farm.getId()).getSingleResult();
    }

    protected long countOpenAssignments(Pen pen) {
        return em.createQuery("select count(a) from PenAssignment a where a.pen.id = :p and a.toDate is null", Long.class).setParameter("p", pen.getId()).getSingleResult();
    }

    protected LocalDate today() {
        return TODAY;
    }
}
