package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.RecordRevision;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PricingBasis;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;
import vn.edu.fpt.beefcare.service.dto.RecordPaymentRequest;
import vn.edu.fpt.beefcare.service.dto.VoidPaymentRequest;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** Correct / void one herd entry and void a whole voucher (GBR-33, UC-FE06-03, UC-FE06-05; scenarios 7-9). */
@ServiceIntegrationTest
@Transactional
class HerdEntryCorrectionServiceTest extends HerdEntryTestBase {

    @Autowired
    RecordRevisionRepository revisions;

    @Autowired
    VoucherPaymentService payments;

    private static DomainException thrown(Runnable r) {
        try {
            r.run();
        } catch (DomainException e) {
            return e;
        }
        throw new AssertionError("expected a DomainException");
    }

    private EntryDtos.PostResult postThree() {
        return createAndPost(List.of(line("T1", penA, "300", 50_000), line("T2", penA, "250", 50_000), line("T3", penB, "200", 40_000)), 1_000_000L, 20_000_000L);
    }

    private EntryDtos.PostResult postOn(LocalDate date, List<EntryLineRequest> lines, long fee, long paid) {
        EntryVoucherRequest req = new EntryVoucherRequest(EntryType.PURCHASE, date, seller.getId(), null, "QC", null, null, PricingBasis.PER_KG, fee, paid, paid > 0 ? PaymentMethod.CASH : null, null, lines, null);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), req);
        return postDraft(farm.getId(), draft.id());
    }

    private Long cattleId(EntryDtos.PostResult r, int index) {
        return r.voucher().lines().get(index).cattleId();
    }

    private Long entryId(EntryDtos.PostResult r, int index) {
        return r.voucher().lines().get(index).id();
    }

    private void weigh(Long cattleId, LocalDate date) {
        weight(em.find(Cattle.class, cattleId), date, "310");
    }

    // ---------------------------------------------------------------- scenario 7

    @Test
    void scenario7_voidingOneFreshCattleRemovesItFromTheVoucher() {
        EntryDtos.PostResult posted = postThree();
        Long voucherId = posted.voucher().id();
        EntryDtos.VoidCheckRow check = corrections.entryVoidCheck(farm.getId(), entryId(posted, 2));
        assertThat(check.canVoid()).isTrue();
        assertThat(check.eventsAfterEntry()).isEmpty();

        EntryDtos.EntryVoidResult result = voidEntry(entryId(posted, 2), new EntryActionRequests.VoidRequest("Registered by mistake", null));
        assertThat(result.notice().code()).isEqualTo("MSG-FE06-12");

        Cattle voided = em.find(Cattle.class, cattleId(posted, 2));
        assertThat(voided.getHerdStatus()).isEqualTo(HerdStatus.VOIDED);
        assertThat(voided.getVoidReason()).isEqualTo("Registered by mistake");
        assertThat(em.createQuery("select t from CattleQrTag t where t.cattle.id = :c", CattleQrTag.class).setParameter("c", voided.getId()).getSingleResult().getStatus()).isEqualTo(QrTagStatus.RETIRED);
        assertThat(em.createQuery("select count(a) from PenAssignment a where a.cattle.id = :c and a.toDate is null", Long.class).setParameter("c", voided.getId()).getSingleResult()).isZero();
        assertThat(countOpenAssignments(penB)).isZero();
        assertThat(em.find(HerdEntry.class, entryId(posted, 2)).getStatus()).isEqualTo(EntryLineStatus.VOID);
        assertThat(result.voucher().cattleAmount()).isEqualTo(15_000_000L + 12_500_000L);
        assertThat(result.voucher().totalPayable()).isEqualTo(28_500_000L);
        assertThat(result.voucher().cattleCount()).isEqualTo(2);
        assertThat(result.voucher().status()).isEqualTo(EntryVoucherStatus.POSTED);
        List<RecordRevision> rev = revisions.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc("HerdEntry", entryId(posted, 2));
        assertThat(rev).singleElement().satisfies(r -> {
            assertThat(r.getAction()).isEqualTo("VOID");
            assertThat(r.getReason()).isEqualTo("Registered by mistake");
            assertThat(r.getBeforeSnapshot()).contains("VALID");
            assertThat(r.getAfterSnapshot()).contains("VOID");
        });

        // the ear tag is free again and the identifiers are not reused
        EntryDtos.PostResult next = createAndPost(List.of(line("T3", penB, "200", 40_000)), 0L, 0L);
        assertThat(next.cattleCodes().get(0)).isNotIn(posted.cattleCodes());
        assertThat(voucherId).isNotNull();
    }

    @Test
    void scenario7_cattleWithAWeighingCannotBeVoided() {
        EntryDtos.PostResult posted = postThree();
        weigh(cattleId(posted, 0), TODAY);
        DomainException e = thrown(() -> voidEntry(entryId(posted, 0), new EntryActionRequests.VoidRequest("oops", null)));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_09);
        assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(e.getParams()).containsEntry("cattle_code", posted.cattleCodes().get(0));
        EntryDtos.VoidCheckRow row = corrections.entryVoidCheck(farm.getId(), entryId(posted, 0));
        assertThat(row.canVoid()).isFalse();
        assertThat(row.eventsAfterEntry()).containsExactly("WEIGHT");
        assertThat(em.find(Cattle.class, cattleId(posted, 0)).getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
    }

    @Test
    void penMoveAndQrReplacementAlsoCountAsEvents() {
        EntryDtos.PostResult posted = postThree();
        Cattle moved = em.find(Cattle.class, cattleId(posted, 0));
        PenAssignment first = em.createQuery("select a from PenAssignment a where a.cattle.id = :c", PenAssignment.class).setParameter("c", moved.getId()).getSingleResult();
        first.setToDate(TODAY);
        save(first);
        PenAssignment second = new PenAssignment();
        second.setFarm(farm);
        second.setCattle(moved);
        second.setPen(penB);
        second.setFromDate(TODAY);
        second.setSource(AssignmentSource.MOVE);
        second.setMovedBy(owner);
        second.setRecordedAt(Instant.now());
        save(second);
        assertThat(corrections.entryVoidCheck(farm.getId(), entryId(posted, 0)).eventsAfterEntry()).contains("PEN_MOVE");

        CattleQrTag tag = em.createQuery("select t from CattleQrTag t where t.cattle.id = :c", CattleQrTag.class).setParameter("c", cattleId(posted, 1)).getSingleResult();
        tag.setStatus(QrTagStatus.REPLACED);
        save(tag);
        assertThat(corrections.entryVoidCheck(farm.getId(), entryId(posted, 1)).eventsAfterEntry()).contains("QR_REPLACEMENT");
    }

    @Test
    void lastValidLineMustBeVoidedWithTheWholeVoucher() {
        EntryDtos.PostResult posted = createAndPost(List.of(line("ONE", penA, "300", 50_000)), 0L, 0L);
        DomainException e = thrown(() -> voidEntry(entryId(posted, 0), new EntryActionRequests.VoidRequest("x", null)));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_20);
        assertThat(e.getParams()).containsEntry("action", "VOID_VOUCHER");
        assertThat(em.find(Cattle.class, cattleId(posted, 0)).getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
    }

    // ---------------------------------------------------------------- scenario 8

    @Test
    void scenario8_voucherCannotBeVoidedWhenOneCattleHasAnEvent() {
        EntryDtos.PostResult posted = postThree();
        weigh(cattleId(posted, 1), TODAY);
        EntryDtos.VoidCheck check = corrections.voidCheck(farm.getId(), posted.voucher().id());
        assertThat(check.canVoid()).isFalse();
        assertThat(check.rows()).extracting(EntryDtos.VoidCheckRow::canVoid).containsExactly(true, false, true);
        assertThat(check.blocked().code()).isEqualTo("MSG-FE06-21");
        assertThat(check.confirm().code()).isEqualTo("MSG-FE06-20");

        DomainException e = thrown(() -> voidVoucher(posted.voucher().id(), new EntryActionRequests.VoidRequest("wrong supplier", null)));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_21);
        assertThat(e.getParams().get("cattle_codes")).isEqualTo(posted.cattleCodes().get(1));
        assertThat(e.getParams()).containsEntry("voucher_code", posted.voucher().code());
        assertThat(vouchers.get(farm.getId(), posted.voucher().id()).status()).isEqualTo(EntryVoucherStatus.POSTED);
        assertThat(count("Cattle")).isEqualTo(3);
        assertThat(em.createQuery("select count(c) from Cattle c where c.farm.id = :f and c.herdStatus = :s", Long.class).setParameter("f", farm.getId()).setParameter("s", HerdStatus.VOIDED).getSingleResult()).isZero();
    }

    @Test
    void voidingAWholeVoucher_effectsAndKeptPayments() {
        EntryDtos.PostResult posted = postThree();
        Long id = posted.voucher().id();
        EntryDtos.VoidResult result = voidVoucher(id, new EntryActionRequests.VoidRequest("Entered twice", null));
        assertThat(result.notice().code()).isEqualTo("MSG-FE06-22");
        EntryDtos.Voucher v = result.voucher();
        assertThat(v.status()).isEqualTo(EntryVoucherStatus.VOIDED);
        assertThat(v.voidReason()).isEqualTo("Entered twice");
        assertThat(v.voidedAt()).isNotNull();
        assertThat(v.lines()).allSatisfy(l -> assertThat(l.status()).isEqualTo(EntryLineStatus.VOID));
        assertThat(v.payments()).hasSize(1);
        assertThat(v.amountPaid()).isEqualTo(20_000_000L);
        assertThat(countOpenAssignments(penA)).isZero();
        assertThat(countOpenAssignments(penB)).isZero();
        assertThat(em.createQuery("select count(t) from CattleQrTag t where t.farm.id = :f and t.status = :s", Long.class).setParameter("f", farm.getId()).setParameter("s", QrTagStatus.RETIRED).getSingleResult()).isEqualTo(3);
        assertThat(em.createQuery("select count(c) from Cattle c where c.farm.id = :f and c.herdStatus = :s", Long.class).setParameter("f", farm.getId()).setParameter("s", HerdStatus.VOIDED).getSingleResult()).isEqualTo(3);
        assertThat(revisions.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc("HerdEntryVoucher", id)).singleElement().satisfies(r -> assertThat(r.getAction()).isEqualTo("VOID"));

        // voiding twice, correcting or voiding a line afterwards is a state conflict
        assertThat(thrown(() -> voidVoucher(id, new EntryActionRequests.VoidRequest("again", null))).getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(thrown(() -> voidEntry(entryId(posted, 0), new EntryActionRequests.VoidRequest("again", null))).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        // payments of a voided voucher are frozen
        assertThat(thrown(() -> payments.record(farm.getId(), VoucherKind.ENTRY, id, new RecordPaymentRequest(TODAY, 1_000L, PaymentMethod.CASH, null, null, entryVoucherVersion(id)))).getStatus()).isEqualTo(HttpStatus.CONFLICT);

        // codes of voided cattle are never reused
        EntryDtos.PostResult next = createAndPost(List.of(line("NEW", penA, "100", 1)), 0L, 0L);
        assertThat(next.cattleCodes().get(0)).isNotIn(posted.cattleCodes());
    }

    @Test
    void voidNeedsReasonAndCurrentVersion() {
        EntryDtos.PostResult posted = postThree();
        assertThat(thrown(() -> voidVoucher(posted.voucher().id(), new EntryActionRequests.VoidRequest("  ", null))).getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(thrown(() -> voidVoucher(posted.voucher().id(), new EntryActionRequests.VoidRequest("x", posted.voucher().version() + 5))).getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(thrown(() -> voidEntry(entryId(posted, 0), new EntryActionRequests.VoidRequest("", null))).getCode()).isEqualTo(MessageCodes.COM_06);
    }

    // ---------------------------------------------------------------- scenario 9

    @Test
    void scenario9_paymentAboveOutstandingIsBlocked_andVoidingAPaymentRaisesTheOutstanding() {
        EntryDtos.PostResult posted = postThree();
        Long id = posted.voucher().id();
        long total = posted.voucher().totalPayable();
        DomainException e = thrown(() -> payments.record(farm.getId(), VoucherKind.ENTRY, id, new RecordPaymentRequest(TODAY, total, PaymentMethod.CASH, null, null, entryVoucherVersion(id))));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_13);
        long outstanding = total - 20_000_000L;
        assertThat(e.getParams()).containsEntry("amount", outstanding);

        Long paymentId = vouchers.get(farm.getId(), id).payments().get(0).id();
        var voided = payments.voidPayment(farm.getId(), paymentId, new VoidPaymentRequest("Entered wrongly", versionOf(vn.edu.fpt.beefcare.domain.VoucherPayment.class, paymentId)));
        assertThat(voided.summary().outstanding()).isEqualTo(total);
        assertThat(vouchers.get(farm.getId(), id).outstanding()).isEqualTo(total);
    }

    // ---------------------------------------------------------------- corrections

    @Test
    void correctingThePriceRecalculatesAndReportsAnOverpayment() {
        EntryDtos.PostResult posted = createAndPost(List.of(line("P1", penA, "300", 50_000), line("P2", penA, "200", 50_000)), 0L, 25_000_000L);
        assertThat(posted.voucher().totalPayable()).isEqualTo(25_000_000L);
        Long cattleId = cattleId(posted, 0);
        var changes = new EntryActionRequests.Changes(null, null, null, null, null, null, 40_000L, null, null, null, null, null, null, null, null);
        EntryDtos.CorrectionResult result = correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("Price was 40k", posted.voucher().lines().get(0).version(), posted.voucher().version(), changes));

        assertThat(result.notice().code()).isEqualTo("MSG-FE06-06");
        assertThat(result.line().unitPrice()).isEqualTo(40_000L);
        assertThat(result.line().lineAmount()).isEqualTo(12_000_000L);
        assertThat(result.line().corrected()).isTrue();
        assertThat(result.line().cattleId()).isEqualTo(cattleId);
        assertThat(result.voucher().cattleAmount()).isEqualTo(22_000_000L);
        assertThat(result.voucher().totalPayable()).isEqualTo(22_000_000L);
        assertThat(result.overpaid()).isEqualTo(3_000_000L);
        assertThat(result.overpaidNotice().code()).isEqualTo("MSG-FE06-23");
        assertThat(result.overpaidNotice().params()).containsEntry("amount", 3_000_000L);
        assertThat(result.voucher().amountPaid()).isEqualTo(25_000_000L);
        assertThat(result.voucher().outstanding()).isZero();

        RecordRevision rev = revisions.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc("HerdEntry", entryId(posted, 0)).get(0);
        assertThat(rev.getAction()).isEqualTo("CORRECT");
        assertThat(rev.getReason()).isEqualTo("Price was 40k");
        assertThat(rev.getBeforeSnapshot()).contains("50000");
        assertThat(rev.getAfterSnapshot()).contains("40000").contains("voucherTotalPayable");
    }

    @Test
    void correctionNeedsAReasonAChangeAndTheCurrentVersion() {
        EntryDtos.PostResult posted = postThree();
        var price = new EntryActionRequests.Changes(null, null, null, null, null, null, 1L, null, null, null, null, null, null, null, null);
        var none = new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest(" ", null, null, price))).getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("r", null, null, none))).getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("r", 99, null, price))).getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("r", null, 99, price))).getCode()).isEqualTo(MessageCodes.COM_05);
    }

    @Test
    void weightCorrectionKeepsTheBasisRule() {
        EntryDtos.PostResult posted = createAndPost(List.of(line("W1", penA, "300", 50_000), line("W2", penA, "200", 50_000)), 0L, 0L);
        var changes = new EntryActionRequests.Changes(null, null, null, null, new BigDecimal("320"), WeightBasis.ESTIMATED, null, null, null, null, null, null, null, null, null);
        EntryDtos.CorrectionResult result = correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("Weighed again", null, null, changes));
        assertThat(result.line().entryWeightKg()).isEqualByComparingTo("320");
        assertThat(result.line().estimatedWeight()).isTrue();
        assertThat(result.line().lineAmount()).isEqualTo(16_000_000L);
        assertThat(result.voucher().estimatedWeightCount()).isEqualTo(1);
    }

    @Test
    void entryDateCorrectionAppliesToAllCattleOfAPurchaseVoucher() {
        LocalDate entry = TODAY.minusDays(10);
        EntryDtos.PostResult posted = postOn(entry, List.of(line("D1", penA, "300", 1), line("D2", penA, "300", 1)), 0, 0);
        // a weighing 8 days after entry: the entry date may not move past it
        weigh(cattleId(posted, 0), TODAY.minusDays(8));
        var later = new EntryActionRequests.Changes(TODAY.minusDays(5), null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        DomainException blocked = thrown(() -> correct(entryId(posted, 1), new EntryActionRequests.CorrectEntryRequest("later", null, null, later)));
        assertThat(blocked.getCode()).isEqualTo(MessageCodes.FE06_07);
        assertThat(blocked.getParams()).containsEntry("reason", "EVENT_BEFORE_ENTRY_DATE");
        var future = new EntryActionRequests.Changes(TODAY.plusDays(1), null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        assertThat(thrown(() -> correct(entryId(posted, 1), new EntryActionRequests.CorrectEntryRequest("future", null, null, future))).getCode()).isEqualTo(MessageCodes.FE06_03);

        var earlier = new EntryActionRequests.Changes(TODAY.minusDays(12), null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        EntryDtos.CorrectionResult result = correct(entryId(posted, 1), new EntryActionRequests.CorrectEntryRequest("typo", null, null, earlier));
        assertThat(result.voucher().entryDate()).isEqualTo(TODAY.minusDays(12));
        assertThat(result.voucher().lines()).allSatisfy(l -> assertThat(l.entryDate()).isEqualTo(TODAY.minusDays(12)));
        assertThat(em.createQuery("select a from PenAssignment a where a.farm.id = :f", PenAssignment.class).setParameter("f", farm.getId()).getResultList()).allSatisfy(a -> assertThat(a.getFromDate()).isEqualTo(TODAY.minusDays(12)));
    }

    @Test
    void entryDateCannotMoveBeforeAPaymentDate() {
        LocalDate entry = TODAY.minusDays(10);
        EntryDtos.PostResult posted = postOn(entry, List.of(line("PD1", penA, "300", 1), line("PD2", penA, "300", 1)), 0, 0);
        payments.record(farm.getId(), VoucherKind.ENTRY, posted.voucher().id(), new RecordPaymentRequest(TODAY.minusDays(9), 100L, PaymentMethod.CASH, null, null, entryVoucherVersion(posted.voucher().id())));
        var later = new EntryActionRequests.Changes(TODAY.minusDays(5), null, null, null, null, null, null, null, null, null, null, null, null, null, null);
        DomainException e = thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("later", null, null, later)));
        assertThat(e.getParams()).containsEntry("reason", "PAYMENT_BEFORE_ENTRY_DATE");
    }

    @Test
    void birthDateMustNotBeAfterTheEntryDate() {
        EntryDtos.PostResult posted = postThree();
        var changes = new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, null, TODAY.plusDays(0).minusDays(0), null, null, null, null, null);
        // birth date = entry date is fine, a later date than the entry date is not
        correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("born today", null, null, changes));
        var after = new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, null, TODAY.plusDays(2), null, null, null, null, null);
        DomainException e = thrown(() -> correct(entryId(posted, 1), new EntryActionRequests.CorrectEntryRequest("later", null, null, after)));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_07);
    }

    @Test
    void sexChangeIsBlockedWithReproductiveEventsOrDeclaredReproduction() {
        var repro = new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 1, YesNoUnknown.NO, null, null);
        EntryDtos.PostResult posted = createAndPost(
            List.of(withReproduction(line("S1", Sex.FEMALE, fattening, penA, "300", 1), repro), line("S2", Sex.FEMALE, fattening, penA, "300", 1), line("S3", Sex.FEMALE, fattening, penA, "300", 1)),
            0L,
            0L
        );
        var toMale = new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, Sex.MALE, null, null, null, null, null, null);
        // declared reproduction history on a female cannot stay on a male
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("x", null, null, toMale))).getCode()).isEqualTo(MessageCodes.COM_10);
        // a reproductive event blocks the change
        ReproductionEvent ev = new ReproductionEvent();
        ev.setCattle(em.find(Cattle.class, cattleId(posted, 1)));
        ev.setType("ESTRUS");
        ev.setEventTime(Instant.now());
        ev.setResult("OK");
        save(ev);
        DomainException e = thrown(() -> correct(entryId(posted, 1), new EntryActionRequests.CorrectEntryRequest("x", null, null, toMale)));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_07);
        assertThat(e.getParams()).containsEntry("reason", "SEX_CHANGE_WITH_REPRODUCTIVE_EVENTS");
        // without events it is allowed
        EntryDtos.CorrectionResult ok = correct(entryId(posted, 2), new EntryActionRequests.CorrectEntryRequest("x", null, null, toMale));
        assertThat(em.find(Cattle.class, cattleId(posted, 2)).getSex()).isEqualTo(Sex.MALE);
        assertThat(ok.line().cattleId()).isEqualTo(cattleId(posted, 2));
    }

    @Test
    void historyCorrectionAdjustsParityAndTheDeclaredPregnancyReminder() {
        var repro = new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 2, YesNoUnknown.YES, 4, null);
        EntryDtos.PostResult posted = createAndPost(List.of(withReproduction(line("H1", Sex.FEMALE, breeding, penA, "300", 1), repro), line("H2", penA, "300", 1)), 0L, 0L);
        Cattle cow = em.find(Cattle.class, cattleId(posted, 0));
        assertThat(cow.getDeclaredParity()).isEqualTo(2);
        var changed = new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 3, YesNoUnknown.NO, null, null);
        var changes = new EntryActionRequests.Changes(null, null, null, null, null, null, null, null, null, null, null, null, null, null, changed);
        EntryDtos.CorrectionResult result = correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("calvings recounted", null, null, changes));
        assertThat(result.line().data().reproduction().earlierCalvings()).isEqualTo(3);
        assertThat(em.find(Cattle.class, cow.getId()).getDeclaredParity()).isEqualTo(3);
        List<Reminder> reminders = em.createQuery("select r from Reminder r where r.cattle.id = :c", Reminder.class).setParameter("c", cow.getId()).getResultList();
        assertThat(reminders).singleElement().satisfies(r -> assertThat(r.getStatus()).isEqualTo("CANCELLED"));
        assertThat(em.createQuery("select d from PreEntryHistoryDeclaration d where d.herdEntry.id = :e", vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration.class).setParameter("e", entryId(posted, 0)).getResultList()).hasSize(3);
        RecordRevision rev = revisions.findAllBySourceTypeAndSourceIdOrderByChangedAtAscIdAsc("HerdEntry", entryId(posted, 0)).get(0);
        assertThat(rev.getBeforeSnapshot()).contains("history");
    }

    @Test
    void exitedOrVoidedCattleCannotBeCorrected() {
        EntryDtos.PostResult posted = postThree();
        Cattle sold = em.find(Cattle.class, cattleId(posted, 0));
        sold.setHerdStatus(HerdStatus.EXITED);
        sold.setExitType(vn.edu.fpt.beefcare.domain.enumeration.ExitType.SALE);
        sold.setExitDate(TODAY);
        save(sold);
        var price = new EntryActionRequests.Changes(null, null, null, null, null, null, 1L, null, null, null, null, null, null, null, null);
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("x", null, null, price))).getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(thrown(() -> voidEntry(entryId(posted, 0), new EntryActionRequests.VoidRequest("x", null))).getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(corrections.voidCheck(farm.getId(), posted.voucher().id()).canVoid()).isFalse();
    }

    @Test
    void correctionsAndVoidsRequireOwnerOrManager() {
        EntryDtos.PostResult posted = postThree();
        var price = new EntryActionRequests.Changes(null, null, null, null, null, null, 1L, null, null, null, null, null, null, null, null);
        actAs(technician);
        assertThat(thrown(() -> correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("x", null, null, price))).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> voidEntry(entryId(posted, 0), new EntryActionRequests.VoidRequest("x", null))).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> corrections.voidCheck(farm.getId(), posted.voucher().id())).getCode()).isEqualTo(MessageCodes.COM_01);
        actAs(manager);
        correct(entryId(posted, 0), new EntryActionRequests.CorrectEntryRequest("manager fixes", null, null, price));
    }
}
