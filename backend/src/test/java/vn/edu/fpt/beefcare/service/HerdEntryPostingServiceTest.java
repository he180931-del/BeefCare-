package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.DeclarationStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentState;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.domain.enumeration.YesNoUnknown;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** Draft handling and posting (UC-FE06-01, spec section 9 scenarios 1-6). */
@ServiceIntegrationTest
@Transactional
class HerdEntryPostingServiceTest extends HerdEntryTestBase {

    @Autowired
    VoucherPaymentRepository paymentRepository;

    @Autowired
    AuditLogRepository auditLogs;

    private static DomainException thrown(Runnable r) {
        try {
            r.run();
        } catch (DomainException e) {
            return e;
        }
        throw new AssertionError("expected a DomainException");
    }

    // ---------------------------------------------------------------- scenario 1

    @Test
    void scenario1_postThreeCattleIntoTwoPens() {
        List<EntryLineRequest> lines = List.of(line("T1", penA, "300", 50_000), line("T2", penA, "250", 50_000), line("T3", penB, "200", 40_000));
        EntryDtos.PostResult result = createAndPost(lines, 1_500_000L, 20_000_000L);

        assertThat(result.cattleCodes()).hasSize(3);
        assertThat(result.firstCode()).isEqualTo(result.cattleCodes().get(0));
        assertThat(result.lastCode()).isEqualTo(result.cattleCodes().get(2));
        assertThat(result.posted().code()).isEqualTo("MSG-FE06-01");
        assertThat(result.posted().params()).containsEntry("count", 3).containsEntry("voucher_code", result.voucher().code());

        assertThat(count("Cattle")).isEqualTo(3);
        assertThat(count("HerdEntry")).isEqualTo(3);
        assertThat(count("PenAssignment")).isEqualTo(3);
        assertThat(countOpenAssignments(penA)).isEqualTo(2);
        assertThat(countOpenAssignments(penB)).isEqualTo(1);
        assertThat(count("CattleQrTag")).isEqualTo(3);
        List<Cattle> cattle = em.createQuery("select c from Cattle c where c.farm.id = :f order by c.id", Cattle.class).setParameter("f", farm.getId()).getResultList();
        assertThat(cattle).allSatisfy(c -> {
            assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
            assertThat(c.getDisplayCode()).matches("BC-\\d{6}");
        });
        assertThat(em.createQuery("select h from HerdEntry h where h.farm.id = :f", HerdEntry.class).setParameter("f", farm.getId()).getResultList())
            .allSatisfy(h -> assertThat(h.getStatus()).isEqualTo(EntryLineStatus.VALID));

        EntryDtos.Voucher v = result.voucher();
        assertThat(v.status()).isEqualTo(EntryVoucherStatus.POSTED);
        assertThat(v.cattleAmount()).isEqualTo(15_000_000L + 12_500_000L + 8_000_000L);
        assertThat(v.totalPayable()).isEqualTo(37_000_000L);
        assertThat(v.amountPaid()).isEqualTo(20_000_000L);
        assertThat(v.outstanding()).isEqualTo(17_000_000L);
        assertThat(v.paymentState()).isEqualTo(PaymentState.PARTLY_PAID);
        assertThat(v.payments()).hasSize(1);
        assertThat(v.payments().get(0).amount()).isEqualTo(20_000_000L);
        assertThat(v.cattleCount()).isEqualTo(3);
        assertThat(v.totalWeightKg()).isEqualByComparingTo("750");
        assertThat(v.history()).extracting(EntryDtos.HistoryItem::kind).contains("ENTRY_DRAFT_CREATE", "ENTRY_POST", "PAYMENT_RECORDED");
        assertThat(auditLogs.findAll()).anyMatch(a -> "ENTRY_POST".equals(a.getAction()));
    }

    // ---------------------------------------------------------------- draft is side-effect free

    @Test
    void draftCreatesNothing_andCanBeReplacedThenDiscarded() {
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("D1", penA, "300", 50_000), line("D2", penB, "280", 50_000)), 100_000L, 500_000L));
        assertThat(draft.status()).isEqualTo(EntryVoucherStatus.DRAFT);
        assertThat(draft.code()).matches("PN-2026-\\d{4}");
        assertThat(draft.lines()).hasSize(2);
        assertThat(draft.totalPayable()).isEqualTo(29_100_000L);

        assertThat(count("Cattle")).isZero();
        assertThat(count("PenAssignment")).isZero();
        assertThat(count("CattleQrTag")).isZero();
        assertThat(count("Reminder")).isZero();
        assertThat(count("VoucherPayment")).isZero();
        assertThat(draft.payments()).isEmpty();

        EntryDtos.Voucher updated = updateVoucher(draft.id(), purchase(List.of(line("D1", penA, "310", 50_000)), 0L, 0L));
        assertThat(updated.lines()).hasSize(1);
        assertThat(updated.cattleAmount()).isEqualTo(15_500_000L);
        assertThat(count("Cattle")).isZero();

        discard(draft.id(), null);
        assertThat(count("HerdEntry")).isZero();
        assertThatThrownBy(() -> vouchers.get(farm.getId(), draft.id())).isInstanceOf(DomainException.class);
    }

    @Test
    void discardedDraftCodeIsNeverReused() {
        EntryDtos.Voucher first = vouchers.create(farm.getId(), purchase(List.of(line("R1", penA, "300", 1)), 0L, 0L));
        discard(first.id(), null);
        EntryDtos.Voucher second = vouchers.create(farm.getId(), purchase(List.of(line("R1", penA, "300", 1)), 0L, 0L));
        assertThat(first.code()).isEqualTo("PN-2026-0001");
        assertThat(second.code()).isEqualTo("PN-2026-0002");
    }

    @Test
    void draftSaveIsMinimal_butPostRechecksEverything() {
        // a draft line without breed / sex / life stage can be saved
        EntryLineRequest sparse = new EntryLineRequest(null, null, null, null, null, null, null, null, null, null, null, null, null, penA.getId(), null, null, null, null, null, null, null);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(sparse), 0L, 0L));
        assertThat(draft.lines()).hasSize(1);
        DomainException e = thrown(() -> postDraft(farm.getId(), draft.id()));
        assertThat(e.getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(count("Cattle")).isZero();
        assertThat(vouchers.get(farm.getId(), draft.id()).status()).isEqualTo(EntryVoucherStatus.DRAFT);
    }

    // ---------------------------------------------------------------- scenario 2 and per-pen aggregation

    @Test
    void scenario2_twoLinesIntoPenWithOneFreePlaceIsBlocked() {
        var small = pen(farm, "S" + next(), 2);
        var cow = cattle(farm, breed, fattening, Sex.MALE, vn.edu.fpt.beefcare.domain.enumeration.LifeStage.ADULT);
        openPlacement(cow, small);

        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("S1", small, "300", 1), line("S2", small, "300", 1)), 0L, 0L));
        long cattleBefore = count("Cattle");
        DomainException e = thrown(() -> postDraft(farm.getId(), draft.id()));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
        assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(e.getParams()).containsEntry("free", 1).containsEntry("count", 2);
        assertThat(count("Cattle")).isEqualTo(cattleBefore);
        assertThat(count("CattleQrTag")).isZero();
        assertThat(vouchers.get(farm.getId(), draft.id()).status()).isEqualTo(EntryVoucherStatus.DRAFT);
    }

    @Test
    void aggregateCapacityIsCheckedPerPen_notPerLine() {
        var two = pen(farm, "T" + next(), 2);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("P1", two, "300", 1), line("P2", two, "300", 1), line("P3", two, "300", 1)), 0L, 0L));
        DomainException e = thrown(() -> postDraft(farm.getId(), draft.id()));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_05);
        assertThat(e.getParams()).containsEntry("count", 3).containsEntry("free", 2);
        EntryDtos.Checks checks = vouchers.checks(farm.getId(), draft.id());
        assertThat(checks.canPost()).isFalse();
        assertThat(checks.errors()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE04_05);
    }

    @Test
    void checksShowOccupancyBeforeAfter_andPenWillBeFull() {
        var two = pen(farm, "F" + next(), 2);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("F1", two, "300", 1), line("F2", two, "300", 1)), 0L, 0L));
        EntryDtos.Checks checks = vouchers.checks(farm.getId(), draft.id());
        assertThat(checks.canPost()).isTrue();
        assertThat(checks.occupancy()).singleElement().satisfies(o -> {
            assertThat(o.before()).isZero();
            assertThat(o.after()).isEqualTo(2);
            assertThat(o.willBeFull()).isTrue();
        });
        assertThat(checks.warnings()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE06_17);
        EntryDtos.PostResult result = postDraft(farm.getId(), draft.id());
        assertThat(result.warnings()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE06_17);
    }

    // ---------------------------------------------------------------- scenario 3

    @Test
    void scenario3_unmetCriteriaNeedAReason_andTheReasonIsStored() {
        var fatteningOnly = pen(farm, "K" + next(), 5);
        criteria(fatteningOnly, 1, java.util.Set.of(PurposeType.FATTENING), null, null, null, null, owner);

        EntryLineRequest bull = line("B1", Sex.MALE, sire, fatteningOnly, "400", 1);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(bull), 0L, 0L));
        DomainException e = thrown(() -> postDraft(farm.getId(), draft.id()));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_06);
        assertThat(count("Cattle")).isZero();

        EntryDtos.Voucher withReason = updateVoucher(draft.id(), purchase(List.of(withReason(bull, "Bull kept apart")), 0L, 0L));
        vouchers.checks(farm.getId(), withReason.id());
        postDraft(farm.getId(), withReason.id());
        PenAssignment a = em.createQuery("select a from PenAssignment a where a.farm.id = :f", PenAssignment.class).setParameter("f", farm.getId()).getSingleResult();
        assertThat(a.getWarningReason()).isEqualTo("Bull kept apart");
        assertThat(a.getCriteriaVersion()).isNotNull();
        assertThat(a.getReceptionCheck()).contains("NOT_MET");
        assertThat(a.getSource()).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource.HERD_ENTRY);
    }

    // ---------------------------------------------------------------- scenario 4

    @Test
    void scenario4_postingTwiceCreatesOneSetOfData() {
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("X1", penA, "300", 50_000)), 0L, 5_000_000L));
        EntryDtos.PostResult first = postDraft(farm.getId(), draft.id());
        EntryDtos.PostResult second = postDraft(farm.getId(), draft.id());
        assertThat(first.alreadyPosted()).isFalse();
        assertThat(second.alreadyPosted()).isTrue();
        assertThat(second.cattleCodes()).isEqualTo(first.cattleCodes());
        assertThat(count("Cattle")).isEqualTo(1);
        assertThat(count("CattleQrTag")).isEqualTo(1);
        assertThat(count("HerdEntry")).isEqualTo(1);
        assertThat(count("VoucherPayment")).isEqualTo(1);
        assertThat(second.voucher().amountPaid()).isEqualTo(5_000_000L);
    }

    // ---------------------------------------------------------------- scenario 5

    @Test
    void scenario5_missingQuarantineCertificateOnlyWarns() {
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchaseWithoutCert(List.of(line("Q1", penA, "300", 1))));
        EntryDtos.Checks checks = vouchers.checks(farm.getId(), draft.id());
        assertThat(checks.canPost()).isTrue();
        assertThat(checks.warnings()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE06_24);
        EntryDtos.PostResult result = postDraft(farm.getId(), draft.id());
        assertThat(result.voucher().status()).isEqualTo(EntryVoucherStatus.POSTED);
        assertThat(result.warnings()).extracting(EntryDtos.Issue::code).contains(MessageCodes.FE06_24);
    }

    // ---------------------------------------------------------------- scenario 6 and histories

    @Test
    void scenario6_declaredPregnancyRaisesRem03_withoutPregnancyEpisode() {
        EntryLineRequest.ReproductionDeclaration repro = new EntryLineRequest.ReproductionDeclaration(DeclarationStatus.KNOWN, 2, YesNoUnknown.YES, 4, "bought pregnant");
        EntryLineRequest cow = withReproduction(line("C1", Sex.FEMALE, breeding, penA, "380", 1), repro);
        EntryDtos.PostResult result = createAndPost(List.of(cow), 0L, 0L);

        Cattle c = em.find(Cattle.class, result.voucher().lines().get(0).cattleId());
        assertThat(c.getDeclaredParity()).isEqualTo(2);
        List<Reminder> reminders = em.createQuery("select r from Reminder r where r.farm.id = :f", Reminder.class).setParameter("f", farm.getId()).getResultList();
        assertThat(reminders).singleElement().satisfies(r -> {
            assertThat(r.getRuleType()).isEqualTo("REM-03");
            assertThat(r.getDueTime()).isEqualTo(TODAY.plusDays(7).atStartOfDay(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
            assertThat(r.getStatus()).isEqualTo("OPEN");
            assertThat(r.getCattle().getId()).isEqualTo(c.getId());
        });
        assertThat(em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id = :c", Long.class).setParameter("c", c.getId()).getSingleResult()).isZero();
        assertThat(em.createQuery("select d from PreEntryHistoryDeclaration d where d.farm.id = :f", vn.edu.fpt.beefcare.domain.PreEntryHistoryDeclaration.class).setParameter("f", farm.getId()).getResultList())
            .hasSize(3)
            .anySatisfy(d -> {
                assertThat(d.getCategory()).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.DeclarationCategory.REPRODUCTION);
                assertThat(d.getEarlierCalvings()).isEqualTo(2);
                assertThat(d.getPregnantAtEntry()).isEqualTo(YesNoUnknown.YES);
                assertThat(d.getEstMonthsPregnant()).isEqualTo(4);
            });
    }

    @Test
    void knownVaccinationsBecomeHistoricalRecordsWithoutDoses() {
        Vaccine fmd = new Vaccine();
        fmd.setFarm(farm);
        fmd.setCode("FMD");
        fmd.setName("FMD vaccine");
        fmd.setDiseasePrevented("FMD");
        fmd.setManufacturer("Acme");
        fmd.setDose("2 ml");
        fmd.setRoute("IM");
        fmd.setBoosterInterval(180);
        fmd.setWithdrawalInfo("21 days");
        fmd.setAvailable(true);
        save(fmd);
        var vacc = new EntryLineRequest.VaccinationDeclaration(
            DeclarationStatus.KNOWN,
            "seller book",
            List.of(new EntryLineRequest.VaccinationItem(fmd.getId(), null, TODAY.minusDays(40), null), new EntryLineRequest.VaccinationItem(null, "Local free-text vaccine", null, null))
        );
        EntryDtos.PostResult result = createAndPost(List.of(withVaccination(line("V1", penA, "300", 1), vacc)), 0L, 0L);
        List<vn.edu.fpt.beefcare.domain.Vaccination> records = em.createQuery("select v from Vaccination v where v.cattle.id = :c", vn.edu.fpt.beefcare.domain.Vaccination.class).setParameter("c", result.voucher().lines().get(0).cattleId()).getResultList();
        assertThat(records).singleElement().satisfies(v -> {
            assertThat(v.getSource()).isEqualTo("HISTORICAL");
            assertThat(v.getScheduledDose()).isNull();
            assertThat(v.getVaccinationDate()).isEqualTo(TODAY.minusDays(40));
            assertThat(v.getWithdrawalEndDate()).isNull();
        });
        assertThat(em.createQuery("select count(d) from ScheduledDose d where d.cattle.id = :c", Long.class).setParameter("c", result.voucher().lines().get(0).cattleId()).getSingleResult()).isZero();
    }

    @Test
    void matchingVaccinationSchedulesAreListedButNeverApplied() {
        Vaccine fmd = new Vaccine();
        fmd.setFarm(farm);
        fmd.setCode("FMD2");
        fmd.setName("FMD");
        fmd.setDiseasePrevented("FMD");
        fmd.setManufacturer("Acme");
        fmd.setDose("2 ml");
        fmd.setRoute("IM");
        fmd.setBoosterInterval(180);
        fmd.setWithdrawalInfo("21 days");
        fmd.setAvailable(true);
        save(fmd);
        var schedule = new vn.edu.fpt.beefcare.domain.VaccinationSchedule();
        schedule.setFarm(farm);
        schedule.setVaccine(fmd);
        schedule.setTargetGroup("fattening");
        schedule.setFirstDueDate(TODAY.plusDays(10));
        schedule.setDoseCount(2);
        schedule.setIntervalDays(21);
        schedule.setStatus("ACTIVE");
        save(schedule);
        EntryDtos.PostResult result = createAndPost(List.of(line("M1", penA, "300", 1)), 0L, 0L);
        assertThat(result.matchingSchedules()).singleElement().satisfies(s -> assertThat(s.scheduleId()).isEqualTo(schedule.getId()));
        assertThat(result.schedulesNotice().code()).isEqualTo("MSG-FE06-05");
        assertThat(em.createQuery("select count(d) from ScheduledDose d", Long.class).getSingleResult()).isZero();
    }

    // ---------------------------------------------------------------- header and line rules

    @Test
    void headerRules() {
        // no line
        EntryDtos.Voucher empty = vouchers.create(farm.getId(), purchase(List.of(), 0L, 0L));
        assertThat(thrown(() -> postDraft(farm.getId(), empty.id())).getCode()).isEqualTo(MessageCodes.FE06_16);

        // amount paid above total
        EntryDtos.Voucher over = vouchers.create(farm.getId(), purchase(List.of(line("H1", penA, "100", 1_000)), 0L, 200_000L));
        DomainException e = thrown(() -> postDraft(farm.getId(), over.id()));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_13);
        assertThat(e.getParams()).containsEntry("amount", 100_000L);

        // missing seller
        var noSeller = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY, null, null, null, null, null, null, 0L, 0L, null, null, List.of(line("H2", penA, "100", 1)), null);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), noSeller);
        assertThat(thrown(() -> postDraft(farm.getId(), draft.id())).getCode()).isEqualTo(MessageCodes.COM_06);

        // payment method required when something is paid
        var noMethod = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY, seller.getId(), null, null, null, null, null, 0L, 10L, null, null, List.of(line("H3", penA, "100", 1_000)), null);
        EntryDtos.Voucher d2 = vouchers.create(farm.getId(), noMethod);
        assertThat(thrown(() -> postDraft(farm.getId(), d2.id())).getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(count("Cattle")).isZero();
    }

    @Test
    void entryDateCannotBeInTheFutureOrBeforeABirthDate() {
        var future = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY.plusDays(1), seller.getId(), null, null, null, null, null, 0L, 0L, null, null, List.of(line("E1", penA, "100", 1)), null);
        EntryDtos.Voucher d = vouchers.create(farm.getId(), future);
        assertThat(thrown(() -> postDraft(farm.getId(), d.id())).getCode()).isEqualTo(MessageCodes.FE06_03);

        EntryLineRequest born = new EntryLineRequest("E2", null, null, null, breed.getId(), Sex.MALE, TODAY.plusDays(0), null, null, vn.edu.fpt.beefcare.domain.enumeration.LifeStage.ADULT, fattening.getId(), new BigDecimal("100"), vn.edu.fpt.beefcare.domain.enumeration.WeightBasis.MEASURED, penA.getId(), 1L, null, null, null, null, null, null);
        var early = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY.minusDays(5), seller.getId(), null, null, null, null, null, 0L, 0L, null, null, List.of(born), null);
        EntryDtos.Voucher d2 = vouchers.create(farm.getId(), early);
        assertThat(thrown(() -> postDraft(farm.getId(), d2.id())).getCode()).isEqualTo(MessageCodes.FE06_03);
    }

    @Test
    void lineRules() {
        // duplicate ear tag inside the voucher
        EntryDtos.Voucher dup = vouchers.create(farm.getId(), purchase(List.of(line("DUP", penA, "100", 1), line("dup", penA, "100", 1)), 0L, 0L));
        assertThat(thrown(() -> postDraft(farm.getId(), dup.id())).getCode()).isEqualTo(HerdEntryCodes.FE05_02);

        // SIRE purpose for a female
        EntryDtos.Voucher sirePurpose = vouchers.create(farm.getId(), purchase(List.of(line("L1", Sex.FEMALE, sire, penA, "100", 1)), 0L, 0L));
        assertThat(thrown(() -> postDraft(farm.getId(), sirePurpose.id())).getCode()).isEqualTo(HerdEntryCodes.FE05_12);

        // inactive breed
        breed.setAvailable(false);
        save(breed);
        EntryDtos.Voucher inactive = vouchers.create(farm.getId(), purchase(List.of(line("L2", penA, "100", 1)), 0L, 0L));
        assertThat(thrown(() -> postDraft(farm.getId(), inactive.id())).getCode()).isEqualTo(HerdEntryCodes.FE18_08);
        breed.setAvailable(true);
        save(breed);

        // per-kg pricing needs a weight
        EntryDtos.Voucher noWeight = vouchers.create(farm.getId(), purchase(List.of(line("L3", penA, null, 1)), 0L, 0L));
        assertThat(thrown(() -> postDraft(farm.getId(), noWeight.id())).getCode()).isEqualTo(MessageCodes.COM_06);
        assertThat(count("Cattle")).isZero();
    }

    @Test
    void earTagMustBeUniqueAmongActiveCattle_andIsFreedByAVoid() {
        createAndPost(List.of(line("TAG-1", penA, "100", 1), line("TAG-2", penA, "100", 1)), 0L, 0L);
        EntryDtos.Voucher again = vouchers.create(farm.getId(), purchase(List.of(line("tag-1", penA, "100", 1)), 0L, 0L));
        assertThat(thrown(() -> postDraft(farm.getId(), again.id())).getCode()).isEqualTo(HerdEntryCodes.FE05_02);
        EntryDtos.Checks checks = vouchers.checks(farm.getId(), again.id());
        assertThat(checks.errors()).extracting(EntryDtos.Issue::code).contains(HerdEntryCodes.FE05_02);
    }

    @Test
    void lifeStageIsProposedFromTheAgeAtEntry() {
        assertThat(EntryLineValidator.proposeLifeStage(TODAY.minusMonths(3), TODAY)).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.LifeStage.UNWEANED_CALF);
        assertThat(EntryLineValidator.proposeLifeStage(TODAY.minusMonths(8), TODAY)).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.LifeStage.WEANED_CALF);
        assertThat(EntryLineValidator.proposeLifeStage(TODAY.minusMonths(18), TODAY)).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.LifeStage.YOUNG_STOCK);
        assertThat(EntryLineValidator.proposeLifeStage(TODAY.minusMonths(40), TODAY)).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.LifeStage.ADULT);
        assertThat(EntryLineValidator.proposeLifeStage(null, TODAY)).isNull();
        assertThat(vouchers.proposeLifeStage(null, 30, TODAY)).containsEntry("lifeStage", vn.edu.fpt.beefcare.domain.enumeration.LifeStage.ADULT);
    }

    @Test
    void ageInMonthsSetsAnEstimatedBirthMonth() {
        EntryDtos.PostResult result = createAndPost(List.of(line("AG1", penA, "100", 1)), 0L, 0L);
        Cattle c = em.find(Cattle.class, result.voucher().lines().get(0).cattleId());
        assertThat(c.getBirthDate()).isEqualTo(TODAY.minusMonths(18).withDayOfMonth(1));
        assertThat(c.getBirthDateAccuracy()).isEqualTo(vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy.ESTIMATED);
        assertThat(result.voucher().lines().get(0).ageMonthsAtEntry()).isEqualTo(18);
    }

    // ---------------------------------------------------------------- permissions and farm status

    @Test
    void technicianIsDenied_managerIsAllowed() {
        actAs(technician);
        assertThat(thrown(() -> vouchers.create(farm.getId(), purchase(List.of(line("N1", penA, "100", 1)), 0L, 0L))).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> vouchers.list(farm.getId(), null, null, null, null, null)).getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        actAs(manager);
        EntryDtos.PostResult result = createAndPost(List.of(line("N2", penA, "100", 1)), 0L, 0L);
        assertThat(result.voucher().status()).isEqualTo(EntryVoucherStatus.POSTED);
        actAs(technician);
        assertThat(thrown(() -> postDraft(farm.getId(), result.voucher().id())).getCode()).isEqualTo(MessageCodes.COM_01);
        assertThat(thrown(() -> voidVoucher(result.voucher().id(), new vn.edu.fpt.beefcare.service.dto.EntryActionRequests.VoidRequest("x", null))).getCode()).isEqualTo(MessageCodes.COM_01);
    }

    @Test
    void expiredFarmServiceBlocksWritesAndReads() {
        var expired = farm("EXPIRED");
        var o = memberWithRole(expired, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        actAs(o);
        var req = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY, null, null, null, null, null, null, 0L, 0L, null, null, List.of(), null);
        DomainException e = thrown(() -> vouchers.create(expired.getId(), req));
        assertThat(e.getCode()).isEqualTo(MessageCodes.COM_12);
        assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        // GBR-14 / MSG-COM-12: reads of farm operations are unavailable too while the service is not ACTIVE.
        assertThat(thrown(() -> vouchers.list(expired.getId(), null, null, null, null, null)).getCode()).isEqualTo(MessageCodes.COM_12);
    }

    @Test
    void otherFarmVoucherIsNotFound() {
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("O1", penA, "100", 1)), 0L, 0L));
        var other = farm();
        var otherOwner = memberWithRole(other, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        actAs(otherOwner);
        assertThat(thrown(() -> vouchers.get(other.getId(), draft.id())).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(thrown(() -> postDraft(other.getId(), draft.id())).getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(thrown(() -> vouchers.get(farm.getId(), draft.id())).getCode()).isEqualTo(MessageCodes.COM_01);
    }

    @Test
    void staleDraftVersionIsRejected() {
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), purchase(List.of(line("VV", penA, "100", 1)), 0L, 0L));
        updateVoucher(draft.id(), purchase(List.of(line("VV", penA, "110", 1)), 0L, 0L));
        var stale = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(
            draft.entryType(), TODAY, seller.getId(), null, null, null, null, null, 0L, 0L, null, null, List.of(line("VV", penA, "120", 1)), draft.version()
        );
        DomainException e = thrown(() -> updateVoucher(draft.id(), stale));
        assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(thrown(() -> posting.post(farm.getId(), draft.id(), new vn.edu.fpt.beefcare.service.dto.EntryActionRequests.PostRequest(draft.version(), false))).getCode()).isEqualTo(MessageCodes.COM_05);
    }

    @Test
    void inlineSellerIsCreatedWithTheDraft_andInactiveSellerBlocksPosting() {
        var req = new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest(
            vn.edu.fpt.beefcare.domain.enumeration.EntryType.PURCHASE, TODAY, null, new vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest.NewPartner("Ong Ba", "0909", "Long An"), "C1", null, null, null, 0L, 0L, null, null, List.of(line("I1", penA, "100", 1)), null
        );
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), req);
        assertThat(draft.sellerName()).isEqualTo("Ong Ba");
        var partner = em.find(vn.edu.fpt.beefcare.domain.TradingPartner.class, draft.sellerId());
        assertThat(partner.isSeller()).isTrue();
        partner.setStatus(vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus.INACTIVE);
        save(partner);
        assertThat(thrown(() -> postDraft(farm.getId(), draft.id())).getCode()).isEqualTo(MessageCodes.COM_08);
    }

    @Test
    void listShowsTilesRowsAndFilters() {
        createAndPost(List.of(line("LS1", penA, "300", 50_000), line("LS2", penA, "250", 50_000)), 500_000L, 10_000_000L);
        vouchers.create(farm.getId(), purchase(List.of(line("LS3", penB, "200", 40_000)), 0L, 0L));
        EntryDtos.VoucherList list = vouchers.list(farm.getId(), null, null, null, null, null);
        assertThat(list.items()).hasSize(2);
        assertThat(list.tiles().postedVouchers()).isEqualTo(1);
        assertThat(list.tiles().draftVouchers()).isEqualTo(1);
        assertThat(list.tiles().cattlePurchased()).isEqualTo(2);
        assertThat(list.tiles().cattleFarmBorn()).isZero();
        assertThat(list.tiles().purchaseAmount()).isEqualTo(28_000_000L);
        assertThat(list.tiles().owedToSellers()).isEqualTo(18_000_000L);
        assertThat(list.tiles().owedVouchers()).hasSize(1);
        assertThat(list.statusCounts()).containsEntry("ALL", 2).containsEntry("DRAFT", 1).containsEntry("POSTED", 1).containsEntry("VOIDED", 0);
        EntryDtos.Row posted = vouchers.list(farm.getId(), EntryVoucherStatus.POSTED, null, null, null, null).items().get(0);
        assertThat(posted.cattleCount()).isEqualTo(2);
        assertThat(posted.totalWeightKg()).isEqualByComparingTo("550");
        assertThat(posted.totalAmount()).isEqualTo(28_000_000L);
        assertThat(posted.outstanding()).isEqualTo(18_000_000L);
        assertThat(posted.paymentState()).isEqualTo(PaymentState.PARTLY_PAID);
        assertThat(vouchers.list(farm.getId(), null, null, TODAY.plusDays(1), null, null).items()).isEmpty();
        assertThat(vouchers.list(farm.getId(), null, null, null, null, seller.getId() + 999).items()).isEmpty();
        assertThat(thrown(() -> vouchers.list(farm.getId(), null, null, TODAY, TODAY.minusDays(1), null)).getCode()).isEqualTo(MessageCodes.COM_11);
    }

    // ---------------------------------------------------------------- helpers

    private void openPlacement(Cattle cow, vn.edu.fpt.beefcare.domain.Pen pen) {
        PenAssignment a = new PenAssignment();
        a.setFarm(farm);
        a.setCattle(cow);
        a.setPen(pen);
        a.setFromDate(TODAY.minusDays(30));
        a.setSource(vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource.HERD_ENTRY);
        a.setMovedBy(owner);
        a.setRecordedAt(Instant.now());
        save(a);
    }
}
