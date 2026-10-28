package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.HerdEntryVoucher;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.TradingPartner;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.dto.PaymentResultDTO;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class VoucherPaymentServiceTest extends DomainTestSupport {

    @Autowired
    VoucherPaymentService payments;

    @Autowired
    AuditLogRepository auditLogs;

    @Autowired
    RecordRevisionRepository revisions;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    TradingPartner seller;
    TradingPartner buyer;
    HerdEntryVoucher entry; // total payable 62,000,000
    HerdExitVoucher exit; // total receivable 59,000,000

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        seller = partner(farm, owner, true, false);
        buyer = partner(farm, owner, false, true);
        entry = entryVoucher(farm, owner, seller, 60_000_000L, 2_000_000L, EntryVoucherStatus.POSTED);
        exit = exitVoucher(farm, owner, buyer, 60_000_000L, 1_000_000L, ExitVoucherStatus.CONFIRMED);
    }

    private RecordPaymentRequest pay(long amount) {
        return new RecordPaymentRequest(TODAY, amount, PaymentMethod.BANK_TRANSFER, "ref-" + amount, null, null);
    }

    private void expect(Runnable call, String code) {
        assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).as(e.getMessage()).isEqualTo(code));
    }

    @Test
    void scenario9PaymentAboveOutstandingIsBlockedAndVoidRaisesOutstandingAgain() {
        actAs(owner);
        PaymentResultDTO first = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(20_000_000L));
        assertThat(first.payment().direction()).isEqualTo(PaymentDirection.PAY);
        assertThat(first.summary().total()).isEqualTo(62_000_000L);
        assertThat(first.summary().paid()).isEqualTo(20_000_000L);
        assertThat(first.summary().outstanding()).isEqualTo(42_000_000L);
        assertThat(first.summary().state()).isEqualTo(PaymentState.PARTLY_PAID);
        assertThat(entry.getAmountPaid()).isEqualTo(20_000_000L);

        // exceeds the outstanding amount (BR-D39)
        assertThatThrownBy(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(42_000_001L)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_13);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                assertThat(e.getParams()).containsEntry("amount", 42_000_000L);
            });
        assertThat(entry.getAmountPaid()).isEqualTo(20_000_000L);

        // paying the exact rest settles the voucher
        PaymentResultDTO rest = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(42_000_000L));
        assertThat(rest.summary().state()).isEqualTo(PaymentState.PAID);
        assertThat(rest.summary().outstanding()).isZero();
        expect(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1)), MessageCodes.FE06_13);

        // voiding a payment raises the outstanding amount again
        PaymentResultDTO voided = payments.voidPayment(farm.getId(), first.payment().id(), new VoidPaymentRequest("wrong amount", null));
        assertThat(voided.payment().status()).isEqualTo(PaymentRecordStatus.VOIDED);
        assertThat(voided.payment().voidReason()).isEqualTo("wrong amount");
        assertThat(voided.summary().paid()).isEqualTo(42_000_000L);
        assertThat(voided.summary().outstanding()).isEqualTo(20_000_000L);
        assertThat(voided.summary().state()).isEqualTo(PaymentState.PARTLY_PAID);
        assertThat(entry.getAmountPaid()).isEqualTo(42_000_000L);

        // and the freed amount can be recorded again
        PaymentResultDTO again = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(20_000_000L));
        assertThat(again.summary().state()).isEqualTo(PaymentState.PAID);
    }

    @Test
    void managerMayPaySellerButNotCollectFromBuyer() {
        actAs(manager);
        assertThat(payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000_000L)).payment().recordedById()).isEqualTo(manager.getId());
        expect(() -> payments.record(farm.getId(), VoucherKind.EXIT, exit.getId(), pay(1_000_000L)), MessageCodes.COM_01);
    }

    @Test
    void ownerCollectsFromBuyer() {
        actAs(owner);
        PaymentResultDTO r = payments.record(farm.getId(), VoucherKind.EXIT, exit.getId(), pay(10_000_000L));
        assertThat(r.payment().direction()).isEqualTo(PaymentDirection.COLLECT);
        assertThat(r.summary().total()).isEqualTo(59_000_000L);
        assertThat(r.summary().outstanding()).isEqualTo(49_000_000L);
        assertThat(exit.getAmountCollected()).isEqualTo(10_000_000L);
        expect(() -> payments.record(farm.getId(), VoucherKind.EXIT, exit.getId(), pay(49_000_001L)), MessageCodes.FE06_13);
    }

    @Test
    void technicianCannotRecordOrVoid() {
        actAs(owner);
        PaymentResultDTO r = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000_000L));
        actAs(technician);
        expect(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000L)), MessageCodes.COM_01);
        expect(() -> payments.voidPayment(farm.getId(), r.payment().id(), new VoidPaymentRequest("x", null)), MessageCodes.COM_01);
        expect(() -> payments.list(farm.getId(), VoucherKind.ENTRY, entry.getId()), MessageCodes.COM_01);
    }

    @Test
    void managerCannotVoidACollection() {
        actAs(owner);
        PaymentResultDTO r = payments.record(farm.getId(), VoucherKind.EXIT, exit.getId(), pay(1_000_000L));
        actAs(manager);
        expect(() -> payments.voidPayment(farm.getId(), r.payment().id(), new VoidPaymentRequest("x", null)), MessageCodes.COM_01);
        // a manager can view the exit voucher payments (read-only)
        assertThat(payments.list(farm.getId(), VoucherKind.EXIT, exit.getId()).payments()).hasSize(1);
    }

    @Test
    void dateMustBeWithinVoucherDateAndToday() {
        actAs(owner);
        LocalDate voucherDate = entry.getEntryDate();
        expect(
            () -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(TODAY.plusDays(1), 1000L, PaymentMethod.CASH, null, null, null)),
            MessageCodes.COM_07
        );
        expect(
            () -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(voucherDate.minusDays(1), 1000L, PaymentMethod.CASH, null, null, null)),
            MessageCodes.COM_15
        );
        // the voucher date itself and today are both fine
        payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(voucherDate, 1000L, PaymentMethod.CASH, null, null, null));
        payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(TODAY, 1000L, PaymentMethod.CASH, null, null, null));
    }

    @Test
    void amountMustBeAPositiveWholeNumberWithMethodAndShortTexts() {
        actAs(owner);
        expect(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(0)), MessageCodes.COM_10);
        expect(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(-5)), MessageCodes.COM_10);
        expect(
            () -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(TODAY, null, PaymentMethod.CASH, null, null, null)),
            MessageCodes.COM_06
        );
        expect(
            () -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(TODAY, 100L, null, null, null, null)),
            MessageCodes.COM_06
        );
        expect(
            () -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), new RecordPaymentRequest(TODAY, 100L, PaymentMethod.CASH, "r".repeat(101), null, null)),
            MessageCodes.COM_10
        );
    }

    @Test
    void onlyPostedEntryAndConfirmedExitVouchersTakePayments() {
        actAs(owner);
        HerdEntryVoucher draft = entryVoucher(farm, owner, seller, 1_000L, 0, EntryVoucherStatus.DRAFT);
        HerdEntryVoucher voided = entryVoucher(farm, owner, seller, 1_000L, 0, EntryVoucherStatus.VOIDED);
        HerdExitVoucher pending = exitVoucher(farm, owner, null, 0, 0, ExitVoucherStatus.PENDING);
        for (HerdEntryVoucher v : new HerdEntryVoucher[] { draft, voided }) {
            assertThatThrownBy(() -> payments.record(farm.getId(), VoucherKind.ENTRY, v.getId(), pay(100)))
                .isInstanceOfSatisfying(DomainException.class, e -> {
                    assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05);
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                });
        }
        expect(() -> payments.record(farm.getId(), VoucherKind.EXIT, pending.getId(), pay(100)), MessageCodes.COM_05);
    }

    @Test
    void staleVoucherVersionIsAConflict() {
        actAs(owner);
        int version = entry.getVersion();
        payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000L));
        assertThat(entry.getVersion()).isGreaterThan(version);
        assertThatThrownBy(
            () ->
                payments.record(
                    farm.getId(),
                    VoucherKind.ENTRY,
                    entry.getId(),
                    new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, null, version)
                )
        )
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
            });
        payments.record(
            farm.getId(),
            VoucherKind.ENTRY,
            entry.getId(),
            new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, null, entry.getVersion())
        );
    }

    @Test
    void voidNeedsReasonAndWorksOnlyOnce() {
        actAs(owner);
        Long id = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(5_000_000L)).payment().id();
        expect(() -> payments.voidPayment(farm.getId(), id, new VoidPaymentRequest("  ", null)), MessageCodes.COM_06);
        expect(() -> payments.voidPayment(farm.getId(), id, new VoidPaymentRequest(null, null)), MessageCodes.COM_06);
        payments.voidPayment(farm.getId(), id, new VoidPaymentRequest("typo", null));
        expect(() -> payments.voidPayment(farm.getId(), id, new VoidPaymentRequest("again", null)), MessageCodes.COM_05);
        // history kept: the voided payment is still listed
        PaymentResultDTO list = payments.list(farm.getId(), VoucherKind.ENTRY, entry.getId());
        assertThat(list.payments()).hasSize(1).first().satisfies(p -> assertThat(p.status()).isEqualTo(PaymentRecordStatus.VOIDED));
        assertThat(list.summary().outstanding()).isEqualTo(62_000_000L);
    }

    @Test
    void voidWithStalePaymentVersionIsAConflict() {
        actAs(owner);
        Long id = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(5_000_000L)).payment().id();
        expect(() -> payments.voidPayment(farm.getId(), id, new VoidPaymentRequest("typo", 99)), MessageCodes.COM_05);
    }

    @Test
    void recordAndVoidWriteAuditLogAndRevision() {
        actAs(owner);
        long audits = auditLogs.count();
        long revs = revisions.count();
        Long id = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(5_000_000L)).payment().id();
        assertThat(auditLogs.count()).isEqualTo(audits + 1);
        payments.voidPayment(farm.getId(), id, new VoidPaymentRequest("typo", null));
        assertThat(auditLogs.count()).isEqualTo(audits + 2);
        assertThat(revisions.count()).isEqualTo(revs + 1);
        var rev = revisions.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc("VoucherPayment", id).get(0);
        assertThat(rev.getAction()).isEqualTo("VOID");
        assertThat(rev.getReason()).isEqualTo("typo");
        assertThat(rev.getBeforeSnapshot()).contains("RECORDED");
        assertThat(rev.getAfterSnapshot()).contains("VOIDED");
    }

    @Test
    void writesAreBlockedWhenTheFarmServiceIsNotActive() {
        actAs(owner);
        Long id = payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000L)).payment().id();
        farm.setServiceStatus("EXPIRED");
        em.flush();
        expect(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000L)), MessageCodes.COM_12);
        expect(() -> payments.voidPayment(farm.getId(), id, new VoidPaymentRequest("x", null)), MessageCodes.COM_12);
        assertThat(payments.summary(farm.getId(), VoucherKind.ENTRY, entry.getId()).paid()).isEqualTo(1_000L);
    }

    @Test
    void voucherOfAnotherFarmIsNotFound() {
        Farm other = farm();
        AppUser otherOwner = memberWithRole(other, FarmRole.OWNER);
        actAs(otherOwner);
        assertThatThrownBy(() -> payments.record(other.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000L)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        actAs(owner);
        assertThatThrownBy(() -> payments.record(other.getId(), VoucherKind.ENTRY, entry.getId(), pay(1_000L)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
    }

    @Test
    void overpaymentAfterACorrectionShowsZeroOutstandingAndBlocksNewPayments() {
        actAs(owner);
        payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(60_000_000L));
        // a line is corrected / voided: cattle amount falls, paid now exceeds the total (MSG-FE06-23)
        entry.setCattleAmount(50_000_000L);
        em.flush();
        var summary = payments.summary(farm.getId(), VoucherKind.ENTRY, entry.getId());
        assertThat(summary.total()).isEqualTo(52_000_000L);
        assertThat(summary.outstanding()).isZero();
        assertThat(summary.overpaid()).isEqualTo(8_000_000L);
        assertThat(summary.state()).isEqualTo(PaymentState.PAID);
        expect(() -> payments.record(farm.getId(), VoucherKind.ENTRY, entry.getId(), pay(1)), MessageCodes.FE06_13);
    }

    @Test
    void initialPaymentInsideThePostTransaction() {
        actAs(owner);
        HerdEntryVoucher draft = entryVoucher(farm, owner, seller, 10_000_000L, 500_000L, EntryVoucherStatus.DRAFT);
        FarmContext ctx = new FarmContext(farm, owner, FarmRole.OWNER);
        assertThat(payments.recordInitialPayment(ctx, draft, 0L, null, null)).isNull();
        draft.setStatus(EntryVoucherStatus.POSTED);
        var p = payments.recordInitialPayment(ctx, draft, 4_000_000L, PaymentMethod.CASH, "deposit");
        assertThat(p.getDirection()).isEqualTo(PaymentDirection.PAY);
        assertThat(p.getPaymentDate()).isEqualTo(draft.getEntryDate());
        assertThat(draft.getAmountPaid()).isEqualTo(4_000_000L);
        assertThatThrownBy(() -> payments.recordInitialPayment(ctx, draft, 6_500_001L, PaymentMethod.CASH, null))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_13));
        assertThat(payments.recordInitialPayment(ctx, draft, 6_500_000L, PaymentMethod.CASH, null)).isNotNull();
        assertThat(draft.getOutstandingAmount()).isZero();
    }

    @Test
    void initialCollectionOnAnExitVoucher() {
        FarmContext ctx = new FarmContext(farm, owner, FarmRole.OWNER);
        actAs(owner);
        var c = payments.recordInitialCollection(ctx, exit, 9_000_000L, PaymentMethod.BANK_TRANSFER, null);
        assertThat(c.getDirection()).isEqualTo(PaymentDirection.COLLECT);
        assertThat(exit.getAmountCollected()).isEqualTo(9_000_000L);
        assertThat(exit.getOutstandingAmount()).isEqualTo(50_000_000L);
    }

    @Test
    void pathTypeParsing() {
        assertThat(VoucherKind.parse("entry")).isEqualTo(VoucherKind.ENTRY);
        assertThat(VoucherKind.parse("Exit-Vouchers")).isEqualTo(VoucherKind.EXIT);
        assertThatThrownBy(() -> VoucherKind.parse("feed")).isInstanceOf(DomainException.class);
    }
}
