package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class CattleGuardServiceTest extends DomainTestSupport {

    @Autowired
    CattleGuardService guard;

    Farm farm;
    AppUser owner;
    Breed breed;
    ProductionPurpose purpose;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = user();
        breed = breed(farm);
        purpose = purpose(farm, PurposeType.FATTENING);
    }

    private Cattle cow() {
        return cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
    }

    private HerdExitVoucher voucher(ExitType type, ExitVoucherStatus status) {
        HerdExitVoucher v = exitVoucher(farm, owner, null, 0, 0, status);
        v.setExitType(type);
        if (type == ExitType.DEATH) {
            v.setLossKind(LossKind.DIED);
        }
        em.flush();
        return v;
    }

    @Test
    void activeCattleIsWritable() {
        Cattle c = cow();
        assertThatCode(() -> guard.assertWritable(c)).doesNotThrowAnyException();
        assertThat(guard.isExitPending(c.getId())).isFalse();
    }

    @Test
    void exitedCattleIsReadOnlyMsgCom13() {
        Cattle c = cow();
        c.setHerdStatus(HerdStatus.EXITED);
        c.setExitType(ExitType.SALE);
        c.setExitDate(TODAY.minusDays(2));
        em.flush();
        assertThatThrownBy(() -> guard.assertWritable(c))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_13);
                assertThat(e.getParams()).containsEntry("cattle_code", c.getDisplayCode()).containsEntry("exit_type", ExitType.SALE);
            });
    }

    @Test
    void voidedCattleIsReadOnlyMsgCom18() {
        Cattle c = cow();
        c.setHerdStatus(HerdStatus.VOIDED);
        c.setVoidReason("entered by mistake");
        em.flush();
        assertThatThrownBy(() -> guard.assertWritable(c))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_18);
                assertThat(e.getParams()).containsEntry("reason", "entered by mistake");
            });
    }

    @Test
    void cattleOnAPendingDeathVoucherAcceptsNothingNewMsgCom17() {
        Cattle c = cow();
        exitLine(voucher(ExitType.DEATH, ExitVoucherStatus.PENDING), c, 1, ExitLineStatus.PENDING);
        assertThat(guard.isExitPending(c.getId())).isTrue();
        assertThatThrownBy(() -> guard.assertWritable(c))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_17);
                assertThat(e.getParams()).containsEntry("cattle_code", c.getDisplayCode()).containsEntry("loss_kind", LossKind.DIED);
            });
        // existing records can still be corrected: only the ACTIVE check applies
        assertThatCode(() -> guard.assertActive(c)).doesNotThrowAnyException();
    }

    @Test
    void draftExitLineDoesNotMakeTheCattleExitPendingButBlocksAnotherVoucher() {
        Cattle c = cow();
        HerdExitVoucher draft = voucher(ExitType.SALE, ExitVoucherStatus.DRAFT);
        exitLine(draft, c, 1, ExitLineStatus.DRAFT);
        assertThat(guard.isExitPending(c.getId())).isFalse();
        assertThatCode(() -> guard.assertWritable(c)).doesNotThrowAnyException();

        HerdExitVoucher other = voucher(ExitType.SALE, ExitVoucherStatus.DRAFT);
        assertThatThrownBy(() -> guard.assertCanJoinExitVoucher(c, other.getId()))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE13_08);
                assertThat(e.getParams()).containsEntry("voucher_code", draft.getCode());
            });
        // the voucher that already holds the line may be edited
        assertThatCode(() -> guard.assertCanJoinExitVoucher(c, draft.getId())).doesNotThrowAnyException();
    }

    @Test
    void removedAndVoidedExitLinesDoNotBlock() {
        Cattle c = cow();
        HerdExitVoucher v = voucher(ExitType.SALE, ExitVoucherStatus.VOIDED);
        exitLine(v, c, 1, ExitLineStatus.VOIDED);
        exitLine(voucher(ExitType.SALE, ExitVoucherStatus.DRAFT), c, 1, ExitLineStatus.REMOVED);
        HerdExitVoucher next = voucher(ExitType.SALE, ExitVoucherStatus.DRAFT);
        assertThat(guard.openExitLine(c.getId())).isEmpty();
        assertThatCode(() -> guard.assertCanJoinExitVoucher(c, next.getId())).doesNotThrowAnyException();
    }

    @Test
    void confirmedExitLineBlocksJoiningAndExitedCattleCannotJoin() {
        Cattle c = cow();
        exitLine(voucher(ExitType.SALE, ExitVoucherStatus.CONFIRMED), c, 1, ExitLineStatus.CONFIRMED);
        c.setHerdStatus(HerdStatus.EXITED);
        c.setExitType(ExitType.SALE);
        c.setExitDate(TODAY);
        em.flush();
        HerdExitVoucher next = voucher(ExitType.SALE, ExitVoucherStatus.DRAFT);
        assertThatThrownBy(() -> guard.assertCanJoinExitVoucher(c, next.getId()))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_13));
    }

    @Test
    void lockWritableChecksFarmAndState() {
        Cattle c = cow();
        assertThat(guard.lockWritable(farm.getId(), c.getId()).getId()).isEqualTo(c.getId());
        Farm other = farm();
        assertThatThrownBy(() -> guard.lockWritable(other.getId(), c.getId()))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_08));
    }
}
