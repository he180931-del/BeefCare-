package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * Not wrapped in a test transaction: every service call is a real transaction. A failure while creating the second
 * line (here a QR tag code that is already taken) must leave nothing of the first line behind (GBR-32, "an error on any
 * line posts nothing").
 */
@ServiceIntegrationTest
class HerdEntryPostRollbackTest extends DomainTestSupport {

    @Autowired
    TransactionTemplate tx;

    @Autowired
    HerdEntryVoucherService vouchers;

    @Autowired
    HerdEntryPostingService posting;

    @Autowired
    VoucherPaymentRepository paymentRepository;

    @Test
    void aFailureOnTheSecondLineRollsBackTheWholePost() {
        Object[] refs = new Object[6];
        tx.executeWithoutResult(status -> {
            Farm farm = farm();
            AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            TradingPartner seller = partner(farm, owner, true, false);
            Breed breed = breed(farm);
            ProductionPurpose purpose = purpose(farm, PurposeType.FATTENING);
            Pen pen = pen(farm, "RB" + next(), 10);
            // another cattle already holds the QR code the second line would get
            Cattle other = cattle(farm, breed, purpose, Sex.MALE, LifeStage.ADULT);
            other.setDisplayCode("BC-900001");
            save(other);
            CattleQrTag taken = new CattleQrTag();
            taken.setFarm(farm);
            taken.setCattle(other);
            taken.setTagCode(String.format("QR-%d-%06d", farm.getId(), 2));
            taken.setStatus(QrTagStatus.ACTIVE);
            taken.setIssuedBy(owner);
            taken.setIssuedAt(Instant.now());
            save(taken);
            refs[0] = farm;
            refs[1] = owner;
            refs[2] = seller;
            refs[3] = breed;
            refs[4] = purpose;
            refs[5] = pen;
            refs[5] = new Object[] { pen, taken };
        });
        Farm farm = (Farm) refs[0];
        AppUser owner = (AppUser) refs[1];
        TradingPartner seller = (TradingPartner) refs[2];
        Breed breed = (Breed) refs[3];
        ProductionPurpose purpose = (ProductionPurpose) refs[4];
        Pen pen = (Pen) ((Object[]) refs[5])[0];
        CattleQrTag taken = (CattleQrTag) ((Object[]) refs[5])[1];
        actAs(owner);

        EntryLineRequest l1 = line(breed, purpose, pen, "RB-1");
        EntryLineRequest l2 = line(breed, purpose, pen, "RB-2");
        EntryVoucherRequest req = new EntryVoucherRequest(EntryType.PURCHASE, TODAY, seller.getId(), null, "Q", null, null, PricingBasis.PER_KG, 0L, 1_000_000L, PaymentMethod.CASH, null, List.of(l1, l2), null);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), req);

        assertThatThrownBy(() -> posting.post(farm.getId(), draft.id(), new EntryActionRequests.PostRequest(draft.version(), false))).isInstanceOf(RuntimeException.class);

        tx.executeWithoutResult(status -> {
            assertThat(count("Cattle", farm)).isEqualTo(1); // only the pre-existing one
            assertThat(count("PenAssignment", farm)).isZero();
            assertThat(count("PreEntryHistoryDeclaration", farm)).isZero();
            assertThat(em.createQuery("select count(t) from CattleQrTag t where t.farm.id = :f", Long.class).setParameter("f", farm.getId()).getSingleResult()).isEqualTo(1);
            assertThat(paymentRepository.findAllByEntryVoucherIdOrderByPaymentDateAscIdAsc(draft.id())).isEmpty();
            var v = em.find(vn.edu.fpt.beefcare.domain.HerdEntryVoucher.class, draft.id());
            assertThat(v.getStatus()).isEqualTo(EntryVoucherStatus.DRAFT);
            assertThat(v.getPostedAt()).isNull();
            assertThat(v.getAmountPaid()).isEqualTo(1_000_000L);
            assertThat(em.createQuery("select h from vn.edu.fpt.beefcare.domain.HerdEntry h where h.voucher.id = :v", vn.edu.fpt.beefcare.domain.HerdEntry.class).setParameter("v", draft.id()).getResultList())
                .allSatisfy(h -> {
                    assertThat(h.getStatus()).isEqualTo(EntryLineStatus.DRAFT);
                    assertThat(h.getCattle()).isNull();
                });
            // the cattle code counter was rolled back too
            assertThat(em.createQuery("select s.lastValue from CodeSequence s where s.farmId = :f and s.codeType = vn.edu.fpt.beefcare.domain.enumeration.CodeType.CATTLE", Long.class).setParameter("f", farm.getId()).getResultList()).allMatch(n -> n == 0L);
        });

        // once the collision is gone the same draft posts, with the first free codes
        tx.executeWithoutResult(status -> em.remove(em.find(CattleQrTag.class, taken.getId())));
        EntryDtos.PostResult ok = posting.post(farm.getId(), draft.id(), new EntryActionRequests.PostRequest(draft.version(), false));
        assertThat(ok.cattleCodes()).containsExactly("BC-000001", "BC-000002");
        assertThat(ok.voucher().payments()).hasSize(1);
    }

    private long count(String entity, Farm farm) {
        return em.createQuery("select count(x) from " + entity + " x where x.farm.id = :f", Long.class).setParameter("f", farm.getId()).getSingleResult();
    }

    private static EntryLineRequest line(Breed breed, ProductionPurpose purpose, Pen pen, String tag) {
        return new EntryLineRequest(tag, null, null, null, breed.getId(), Sex.MALE, null, null, 18, LifeStage.YOUNG_STOCK, purpose.getId(), new BigDecimal("300"), WeightBasis.MEASURED, pen.getId(), 10_000L, null, null, null, null, null, null);
    }
}
