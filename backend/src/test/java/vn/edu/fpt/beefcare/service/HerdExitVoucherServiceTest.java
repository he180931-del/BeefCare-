package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.HerdExit;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitType;
import vn.edu.fpt.beefcare.domain.enumeration.ExitVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.LossKind;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentDirection;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentMethod;
import vn.edu.fpt.beefcare.domain.enumeration.PaymentRecordStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus;
import vn.edu.fpt.beefcare.domain.enumeration.WeightBasis;
import vn.edu.fpt.beefcare.repository.AuditLogRepository;
import vn.edu.fpt.beefcare.repository.HerdExitRepository;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.RecordRevisionRepository;
import vn.edu.fpt.beefcare.repository.VoucherPaymentRepository;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherDTO;
import vn.edu.fpt.beefcare.service.dto.ExitVoucherRequests;
import vn.edu.fpt.beefcare.support.ExitTestSupport;

/** FE-13 herd exit vouchers: acceptance scenarios 12-17 of section 9 and the rules around them. */
@ServiceIntegrationTest
@Transactional
class HerdExitVoucherServiceTest extends ExitTestSupport {

    @Autowired
    HerdExitVoucherService service;

    @Autowired
    CattleGuardService guard;

    @Autowired
    HerdExitRepository exitLines;

    @Autowired
    PenAssignmentRepository assignments;

    @Autowired
    VoucherPaymentRepository paymentRepository;

    @Autowired
    AuditLogRepository auditLogs;

    @Autowired
    RecordRevisionRepository revisionRepository;

    @BeforeEach
    void setUp() {
        setUpExitFarm();
    }

    private void expect(Runnable call, String code, HttpStatus status) {
        assertThatThrownBy(call::run)
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).as(e.getMessage()).isEqualTo(code);
                assertThat(e.getStatus()).isEqualTo(status);
            });
    }

    private static ExitVoucherRequests.Confirm ack() {
        return new ExitVoucherRequests.Confirm(true, null);
    }

    private Long farmId() {
        return farm.getId();
    }

    private ExitVoucherDTO.ConfirmResult confirm(Long id) {
        return service.confirm(farmId(), id, ack(), null);
    }

    private PenAssignment openAssignment(Cattle c) {
        return assignments.findFirstByCattleIdAndToDateIsNull(c.getId()).orElse(null);
    }

    // ------------------------------------------------------------------ scenario 12

    @Test
    void scenario12ConfirmSaleWithWithdrawalWarnsHighlightsAndAppliesEveryEffect() {
        Cattle c1 = placed(penA, "400");
        Cattle c2 = placed(penA, "350");
        withdrawal(c1, TODAY.plusDays(5));
        ScheduledDose dose = dose(c1, TODAY.plusDays(10));
        Reminder reminder = reminder(c1, "REM-03", TODAY.plusDays(10));
        Reminder past = reminder(c1, "REM-08", TODAY.minusDays(1));
        HealthCase openCase = healthCase(c1, "OPEN", null, TODAY.minusDays(8), null);
        PregnancyEpisode pregnancy = pregnancy(c1);
        CalfOutcome calf = draftCalf(c1);

        actAs(owner);
        ExitVoucherRequests.Save req = saveReq(
            ExitType.SALE,
            TODAY,
            buyer.getId(),
            null,
            1_000_000L,
            10_000_000L,
            PaymentMethod.CASH,
            List.of(line(c1, "400", 60_000L), line(c2, "350", 60_000L))
        );
        ExitVoucherDTO.Detail draft = service.create(farmId(), req);
        assertThat(draft.status()).isEqualTo(ExitVoucherStatus.DRAFT);
        assertThat(draft.code()).matches("PX-2026-\\d{4}");
        assertThat(draft.cattleAmount()).isEqualTo(45_000_000L);
        assertThat(draft.totalReceivable()).isEqualTo(44_000_000L);
        assertThat(draft.cattleCount()).isEqualTo(2);
        // DRAFT has no effect (POST-3)
        assertThat(c1.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        assertThat(openAssignment(c1)).isNotNull();

        ExitVoucherDTO.ChecksResult checks = service.checks(farmId(), draft.id());
        ExitVoucherDTO.CattleCheck check1 = checks.cattle().stream().filter(c -> c.cattleId().equals(c1.getId())).findFirst().orElseThrow();
        assertThat(check1.withdrawal().endDate()).isEqualTo(TODAY.plusDays(5));
        assertThat(check1.withdrawal().breach()).isTrue();
        assertThat(check1.openCases()).hasSize(1);
        assertThat(check1.futureDoses().count()).isEqualTo(1);
        assertThat(check1.futureReminders().count()).isEqualTo(1);
        assertThat(check1.openPregnancy()).isNotNull();
        assertThat(check1.draftCalfIds()).containsExactly(calf.getId());
        assertThat(check1.messages()).extracting(ExitVoucherDTO.Message::code).contains("MSG-FE13-07", "MSG-FE13-01");
        ExitVoucherDTO.CattleCheck check2 = checks.cattle().stream().filter(c -> c.cattleId().equals(c2.getId())).findFirst().orElseThrow();
        assertThat(check2.hasWarnings()).isFalse();
        assertThat(checks.occupancy()).singleElement().satisfies(o -> {
            assertThat(o.before()).isEqualTo(2);
            assertThat(o.after()).isZero();
        });

        ExitVoucherDTO.ConfirmResult result = confirm(draft.id());

        assertThat(result.repeated()).isFalse();
        assertThat(result.message().code()).isEqualTo("MSG-FE13-02");
        assertThat(result.voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(result.voucher().confirmedBy().id()).isEqualTo(owner.getId());
        assertThat(c1.getHerdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThat(c1.getExitType()).isEqualTo(ExitType.SALE);
        assertThat(c1.getExitDate()).isEqualTo(TODAY);
        assertThat(c2.getHerdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThat(openAssignment(c1)).isNull();
        assertThat(assignments.findAllByCattleIdOrderByFromDateAscIdAsc(c1.getId())).singleElement().satisfies(a -> assertThat(a.getToDate()).isEqualTo(TODAY));
        assertThat(dose.getStatus()).isEqualTo("CANCELLED");
        assertThat(reminder.getStatus()).isEqualTo("CANCELLED");
        assertThat(past.getStatus()).isEqualTo("ACTIVE");
        assertThat(openCase.getStatus()).isEqualTo("CLOSED");
        assertThat(openCase.getOutcome()).isEqualTo("CLOSED_BY_EXIT");
        assertThat(pregnancy.getCloseReason()).isEqualTo("DAM_EXITED");
        assertThat(pregnancy.getClosedDate()).isEqualTo(TODAY);
        assertThat(calf.getRegistrationState()).isEqualTo("PENDING_CONFIRMATION");

        // deposit stored as a COLLECT payment (BR-D39 bookkeeping)
        assertThat(result.voucher().payments()).singleElement().satisfies(p -> {
            assertThat(p.direction()).isEqualTo(PaymentDirection.COLLECT);
            assertThat(p.amount()).isEqualTo(10_000_000L);
            assertThat(p.status()).isEqualTo(PaymentRecordStatus.RECORDED);
        });
        assertThat(result.voucher().outstanding()).isEqualTo(34_000_000L);
        assertThat(result.voucher().payment().paid()).isEqualTo(10_000_000L);
        // effects listed and the check results saved on the line
        assertThat(result.effects()).hasSize(2);
        ExitVoucherDTO.CattleEffects e1 = result.effects().stream().filter(e -> e.cattleId().equals(c1.getId())).findFirst().orElseThrow();
        assertThat(e1.cancelledDoseIds()).containsExactly(dose.getId());
        assertThat(e1.closedCaseIds()).containsExactly(openCase.getId());
        assertThat(e1.closedPregnancyId()).isEqualTo(pregnancy.getId());
        assertThat(e1.pendingCalfIds()).containsExactly(calf.getId());
        HerdExit line1 = exitLines.findAllByVoucherIdOrderByLineNoAsc(draft.id()).get(0);
        assertThat(line1.getStatus()).isEqualTo(ExitLineStatus.CONFIRMED);
        assertThat(line1.getCheckResults()).contains("withdrawal").contains("MSG-FE13-07");
        assertThat(line1.getLastPen()).isEqualTo(penA);
        assertThat(auditLogs.findAll()).anySatisfy(a -> assertThat(a.getAction()).isEqualTo("EXIT_CONFIRM"));
        // the confirmed history shows the system cancellations
        assertThat(result.voucher().history()).extracting(ExitVoucherDTO.HistoryEvent::type).contains("CREATED", "CONFIRMED", "ITEMS_CANCELLED", "COLLECTION_RECORDED");
        // exited cattle are read-only (GBR-26)
        expect(() -> guard.assertWritable(c1), MessageCodes.COM_13, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void withdrawalIsOnlyHighlightedForSaleOrCullAndNeverBlocks() {
        Cattle c = placed(penA, "300");
        withdrawal(c, TODAY.plusDays(3));
        actAs(owner);
        ExitVoucherDTO.Detail other = service.create(
            farmId(),
            saveReq(ExitType.OTHER, TODAY, null, "Neighbour farm", 0, 0, null, List.of(line(c, "300", 0L)))
        );
        ExitVoucherDTO.CattleCheck check = service.checks(farmId(), other.id()).cattle().get(0);
        assertThat(check.withdrawal()).isNotNull();
        assertThat(check.withdrawal().breach()).isFalse();
        assertThat(check.messages()).extracting(ExitVoucherDTO.Message::code).doesNotContain("MSG-FE13-07");
        // the warning does not block the confirmation
        assertThat(confirm(other.id()).voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
    }

    @Test
    void withdrawalEndedBeforeTheExitDateIsNotAWarning() {
        Cattle c = placed(penA, "300");
        withdrawal(c, TODAY.minusDays(1));
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));
        assertThat(service.checks(farmId(), draft.id()).cattle().get(0).withdrawal()).isNull();
    }

    // ------------------------------------------------------------------ scenario 13 and BR-D35

    @Test
    void scenario13CattleOnAnotherDraftVoucherCannotJoinASecondOne() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail first = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));
        assertThatThrownBy(() -> service.create(farmId(), sale(TODAY, line(c, "300", 50_000L))))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo("MSG-FE13-08");
                assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                assertThat(e.getParams()).containsEntry("voucher_code", first.code()).containsEntry("cattle_code", c.getDisplayCode());
            });
    }

    @Test
    void aRemovedLineFreesTheCattleForAnotherVoucher() {
        Cattle c = placed(penA, "300");
        Cattle d = placed(penA, "310");
        actAs(owner);
        ExitVoucherDTO.Detail first = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L), line(d, "310", 50_000L)));
        ExitVoucherDTO.Detail trimmed = service.update(farmId(), first.id(), sale(TODAY, line(d, "310", 50_000L)));
        assertThat(trimmed.cattleCount()).isEqualTo(1);
        assertThat(trimmed.cattleAmount()).isEqualTo(15_500_000L);
        ExitVoucherDTO.Detail second = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));
        assertThat(second.cattleCount()).isEqualTo(1);
        // the code sequence moves on and is never reused
        assertThat(second.code()).isNotEqualTo(first.code());
    }

    @Test
    void selectableCattleListsOnlyActiveCattleOnNoOpenLineAndFilters() {
        Cattle free = placed(penA, "500");
        Cattle inB = placed(penB, "200");
        Cattle onDraft = placed(penA, "300");
        Cattle exited = placed(penA, "300");
        exited.setHerdStatus(HerdStatus.EXITED);
        actAs(owner);
        service.create(farmId(), sale(TODAY, line(onDraft, "300", 1L)));
        withdrawal(free, TODAY.plusDays(2));
        healthCase(free, "OPEN", null, TODAY.minusDays(5), null);

        List<ExitVoucherDTO.SelectableCattle> all = service.selectableCattle(farmId(), null, null, null, null);
        assertThat(all).extracting(ExitVoucherDTO.SelectableCattle::cattleId).containsExactlyInAnyOrder(free.getId(), inB.getId());
        ExitVoucherDTO.SelectableCattle f = all.stream().filter(s -> s.cattleId().equals(free.getId())).findFirst().orElseThrow();
        assertThat(f.withdrawalEndDate()).isEqualTo(TODAY.plusDays(2));
        assertThat(f.openCaseId()).isNotNull();
        assertThat(f.latestWeight().weightKg()).isEqualByComparingTo("500");
        assertThat(f.penCode()).isEqualTo("A");
        assertThat(f.herdGroup()).isEqualTo("FATTENING");

        assertThat(service.selectableCattle(farmId(), free.getDisplayCode().toLowerCase(), null, null, null)).hasSize(1);
        assertThat(service.selectableCattle(farmId(), null, penB.getId(), null, null)).extracting(ExitVoucherDTO.SelectableCattle::cattleId).containsExactly(inB.getId());
        assertThat(service.selectableCattle(farmId(), null, null, null, new BigDecimal("400"))).extracting(ExitVoucherDTO.SelectableCattle::cattleId).containsExactly(free.getId());
        assertThat(service.selectableCattle(farmId(), null, null, "CALVES", null)).isEmpty();
    }

    @Test
    void addingCattleByQrTagAndByIdIsIdempotentAndScopedToTheFarm() {
        Cattle c = placed(penA, "300");
        Cattle d = placed(penA, "310");
        CattleQrTag tag = new CattleQrTag();
        tag.setFarm(farm);
        tag.setCattle(c);
        tag.setTagCode("QR-TEST-" + next());
        tag.setStatus(QrTagStatus.ACTIVE);
        tag.setIssuedBy(owner);
        tag.setIssuedAt(Instant.now());
        save(tag);
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY));
        assertThat(draft.cattleCount()).isZero();

        ExitVoucherDTO.Detail scanned = service.addCattle(farmId(), draft.id(), new ExitVoucherRequests.AddCattle(null, tag.getTagCode(), null));
        assertThat(scanned.lines()).singleElement().satisfies(l -> {
            assertThat(l.cattleId()).isEqualTo(c.getId());
            assertThat(l.exitWeightKg()).isEqualByComparingTo("300");
            assertThat(l.weightBasis()).isEqualTo(WeightBasis.ESTIMATED);
            assertThat(l.estimated()).isTrue();
        });
        ExitVoucherDTO.Detail again = service.addCattle(farmId(), draft.id(), new ExitVoucherRequests.AddCattle(List.of(c.getId(), d.getId()), null, null));
        assertThat(again.cattleCount()).isEqualTo(2);
        expect(() -> service.addCattle(farmId(), draft.id(), new ExitVoucherRequests.AddCattle(null, "NO-SUCH-TAG", null)), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
    }

    // ------------------------------------------------------------------ scenario 14: death / missing

    @Test
    void scenario14ClosedCaseDiedCreatesOnePendingVoucherThatBlocksEventsAndCanBeDismissed() {
        Cattle c = placed(penA, "300");
        HealthCase hc = healthCase(c, "CLOSED", "DIED", TODAY.minusDays(8), TODAY.minusDays(1));

        HerdExitVoucher pending = service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.DIED);
        assertThat(pending.getStatus()).isEqualTo(ExitVoucherStatus.PENDING);
        assertThat(pending.getExitType()).isEqualTo(ExitType.DEATH);
        assertThat(pending.getLossKind()).isEqualTo(LossKind.DIED);
        assertThat(pending.getSourceHealthCase()).isEqualTo(hc);
        assertThat(pending.getReportedBy()).isEqualTo(manager);
        assertThat(pending.getExitDate()).isEqualTo(TODAY.minusDays(1));
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        // exactly one voucher per case
        assertThat(service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.DIED)).isEqualTo(pending);
        // REM-12 for the Owner
        assertThat(em.createQuery("select r from Reminder r where r.cattle.id = :c and r.ruleType = 'REM-12'", Reminder.class).setParameter("c", c.getId()).getResultList())
            .singleElement()
            .satisfies(r -> assertThat(r.getStatus()).isEqualTo("ACTIVE"));
        // exit pending: no new events, pen moves, profile changes or exit lines (GBR-26)
        assertThat(guard.isExitPending(c.getId())).isTrue();
        expect(() -> guard.assertWritable(c), MessageCodes.COM_17, HttpStatus.UNPROCESSABLE_ENTITY);

        actAs(owner);
        expect(
            () -> service.create(farmId(), sale(TODAY, line(c, "300", 1L))),
            MessageCodes.COM_17,
            HttpStatus.UNPROCESSABLE_ENTITY
        );
        // the Manager sees it but cannot dismiss
        actAs(manager);
        assertThat(service.get(farmId(), pending.getId()).status()).isEqualTo(ExitVoucherStatus.PENDING);
        expect(() -> service.dismiss(farmId(), pending.getId(), new ExitVoucherRequests.Dismiss("x", null)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);

        actAs(owner);
        // the reason is mandatory
        expect(() -> service.dismiss(farmId(), pending.getId(), new ExitVoucherRequests.Dismiss(" ", null)), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        expect(() -> service.dismiss(farmId(), pending.getId(), new ExitVoucherRequests.Dismiss("mistake", 99)), MessageCodes.COM_05, HttpStatus.CONFLICT);
        ExitVoucherDTO.DismissResult dismissed = service.dismiss(farmId(), pending.getId(), new ExitVoucherRequests.Dismiss("Found alive", null));
        assertThat(dismissed.message().code()).isEqualTo("MSG-FE13-04");
        assertThat(dismissed.voucher().status()).isEqualTo(ExitVoucherStatus.DISMISSED);
        assertThat(dismissed.voucher().closeReason()).isEqualTo("Found alive");
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        assertThat(hc.getOutcome()).isEqualTo("DIED");
        assertThat(guard.isExitPending(c.getId())).isFalse();
        guard.assertWritable(c);
        assertThat(em.createQuery("select r from Reminder r where r.cattle.id = :c and r.ruleType = 'REM-12'", Reminder.class).setParameter("c", c.getId()).getSingleResult().getStatus())
            .isEqualTo("RESOLVED");
        // a dismissed voucher cannot be dismissed or confirmed again
        expect(() -> service.dismiss(farmId(), pending.getId(), new ExitVoucherRequests.Dismiss("again", null)), MessageCodes.COM_05, HttpStatus.CONFLICT);
        expect(() -> confirm(pending.getId()), MessageCodes.COM_05, HttpStatus.CONFLICT);
    }

    @Test
    void scenario14ConfirmingThePendingVoucherNeedsCauseAndDisposalAndExitsTheCattle() {
        Cattle c = placed(penA, "300");
        withdrawal(c, TODAY.plusDays(4));
        dose(c, TODAY.plusDays(7));
        HealthCase hc = healthCase(c, "CLOSED", "DIED", TODAY.minusDays(8), TODAY.minusDays(1));
        HerdExitVoucher pending = service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.DIED);
        actAs(owner);

        expect(() -> confirm(pending.getId()), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        // cause given, disposal missing for a death
        service.update(farmId(), pending.getId(), death(TODAY.minusDays(1), LossKind.DIED, "Bloat", null));
        expect(() -> confirm(pending.getId()), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        // acknowledgement is required first
        expect(() -> service.confirm(farmId(), pending.getId(), new ExitVoucherRequests.Confirm(false, null), null), MessageCodes.COM_16, HttpStatus.BAD_REQUEST);

        ExitVoucherDTO.Detail completed = service.update(farmId(), pending.getId(), death(TODAY.minusDays(1), LossKind.DIED, "Bloat", "Buried on the farm"));
        assertThat(completed.status()).isEqualTo(ExitVoucherStatus.PENDING);
        assertThat(completed.deathCause()).isEqualTo("Bloat");
        // a loss voucher never carries money, even when the request sends some
        assertThat(completed.totalReceivable()).isNull();
        assertThat(completed.pricingBasis()).isNull();

        ExitVoucherDTO.ConfirmResult result = confirm(pending.getId());
        assertThat(result.voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThat(c.getExitType()).isEqualTo(ExitType.DEATH);
        assertThat(c.getExitDate()).isEqualTo(TODAY.minusDays(1));
        assertThat(openAssignment(c)).isNull();
        assertThat(em.createQuery("select r from Reminder r where r.cattle.id = :c and r.ruleType = 'REM-12'", Reminder.class).setParameter("c", c.getId()).getSingleResult().getStatus())
            .isEqualTo("RESOLVED");
        assertThat(paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(pending.getId())).isEmpty();
        assertThat(result.voucher().payment()).isNull();
        assertThat(result.voucher().payments()).isEmpty();
        // a death has no meat withdrawal highlight
        assertThat(result.voucher().lines().get(0).check().withdrawal().breach()).isFalse();
    }

    @Test
    void missingCreatesAnOtherVoucherWithoutDisposal() {
        Cattle c = placed(penA, "300");
        HealthCase hc = healthCase(c, "CLOSED", "MISSING", TODAY.minusDays(8), TODAY.minusDays(1));
        HerdExitVoucher pending = service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.MISSING);
        assertThat(pending.getExitType()).isEqualTo(ExitType.OTHER);
        assertThat(pending.getLossKind()).isEqualTo(LossKind.MISSING);
        assertThat(pending.getNotes()).isEqualTo("Missing");
        actAs(owner);
        service.update(farmId(), pending.getId(), death(TODAY.minusDays(1), LossKind.MISSING, "Not found after a search", null));
        assertThat(confirm(pending.getId()).voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(c.getExitType()).isEqualTo(ExitType.OTHER);
    }

    @Test
    void aLossReportTakesTheCattleOffItsDraftExitLine() {
        Cattle c = placed(penA, "300");
        Cattle d = placed(penA, "310");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L), line(d, "310", 50_000L)));
        HealthCase hc = healthCase(c, "CLOSED", "DIED", TODAY.minusDays(8), TODAY.minusDays(1));
        service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.DIED);
        ExitVoucherDTO.Detail after = service.get(farmId(), draft.id());
        assertThat(after.lines()).extracting(ExitVoucherDTO.Line::cattleId).containsExactly(d.getId());
        assertThat(after.cattleAmount()).isEqualTo(15_500_000L);
    }

    @Test
    void ownerRecordsADeathDirectlyAndItHasNoMoney() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), death(TODAY, LossKind.DIED, "Snake bite", "Handed to the veterinary service", line(c, "300", 99_000L)));
        assertThat(draft.status()).isEqualTo(ExitVoucherStatus.DRAFT);
        assertThat(draft.loss()).isTrue();
        assertThat(draft.exitType()).isEqualTo(ExitType.DEATH);
        assertThat(draft.cattleAmount()).isNull();
        assertThat(draft.lines().get(0).lineAmount()).isZero();
        assertThat(draft.lines().get(0).unitPrice()).isNull();
        assertThat(draft.lines().get(0).exitWeightKg()).isNull();
        ExitVoucherDTO.ConfirmResult result = confirm(draft.id());
        assertThat(result.voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(draft.id())).isEmpty();
        assertThat(c.getExitType()).isEqualTo(ExitType.DEATH);
        // collections cannot be recorded on a death voucher (no amounts)
    }

    // ------------------------------------------------------------------ scenario 15: void

    private record Confirmed(Cattle c1, Cattle c2, ScheduledDose dose, ExitVoucherDTO.Detail voucher) {}

    private Confirmed confirmedSale() {
        Cattle c1 = placed(penA, "400");
        Cattle c2 = placed(penA, "350");
        ScheduledDose dose = dose(c1, TODAY.plusDays(10));
        actAs(owner);
        ExitVoucherDTO.Detail d = service.create(
            farmId(),
            saveReq(ExitType.SALE, TODAY.minusDays(1), buyer.getId(), null, 0, 5_000_000L, PaymentMethod.CASH, List.of(line(c1, "400", 50_000L), line(c2, "350", 50_000L)))
        );
        return new Confirmed(c1, c2, dose, confirm(d.id()).voucher());
    }

    @Test
    void scenario15VoidWithInactiveLastPenNeedsAnotherPenAndRestoresNothingAutomatically() {
        Confirmed s = confirmedSale();
        assertThat(s.dose().getStatus()).isEqualTo("CANCELLED");
        penA.setStatus(ActiveStatus.INACTIVE);
        em.flush();

        ExitVoucherDTO.VoidCheck pre = service.voidCheck(farmId(), s.voucher().id());
        assertThat(pre.voidable()).isTrue();
        assertThat(pre.cattle()).allSatisfy(v -> {
            assertThat(v.needsPenOverride()).isTrue();
            assertThat(v.lastPen().active()).isFalse();
        });
        assertThat(pre.message().code()).isEqualTo("MSG-FE13-09");
        assertThat(pre.reviewList()).hasSize(2);

        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("buyer cancelled", null, null, null)), MessageCodes.FE13_09, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(s.c1().getHerdStatus()).isEqualTo(HerdStatus.EXITED);
        // override of only one cattle is not enough
        expect(
            () -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("buyer cancelled", Map.of(s.c1().getId(), penB.getId()), null, null)),
            MessageCodes.FE13_09,
            HttpStatus.UNPROCESSABLE_ENTITY
        );

        ExitVoucherDTO.VoidResult result = service.voidVoucher(
            farmId(),
            s.voucher().id(),
            new ExitVoucherRequests.Void("buyer cancelled", Map.of(s.c1().getId(), penB.getId(), s.c2().getId(), penB.getId()), null, null)
        );
        assertThat(result.message().code()).isEqualTo("MSG-FE13-05");
        assertThat(result.voucher().status()).isEqualTo(ExitVoucherStatus.VOIDED);
        assertThat(result.voucher().closeReason()).isEqualTo("buyer cancelled");
        assertThat(result.voucher().closedBy().id()).isEqualTo(owner.getId());
        for (Cattle c : List.of(s.c1(), s.c2())) {
            assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
            assertThat(c.getExitType()).isNull();
            assertThat(c.getExitDate()).isNull();
            PenAssignment open = openAssignment(c);
            assertThat(open.getPen()).isEqualTo(penB);
            assertThat(open.getFromDate()).isEqualTo(TODAY);
            assertThat(open.getSource().name()).isEqualTo("CORRECTION");
        }
        // cancelled items are listed for review and NOT restored; the collection stays in the history
        assertThat(s.dose().getStatus()).isEqualTo("CANCELLED");
        assertThat(result.reviewList()).anySatisfy(e -> assertThat(e.cancelledDoseIds()).contains(s.dose().getId()));
        assertThat(paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(s.voucher().id()))
            .singleElement()
            .satisfies(p -> assertThat(p.getStatus()).isEqualTo(PaymentRecordStatus.RECORDED));
        assertThat(result.voucher().history()).extracting(ExitVoucherDTO.HistoryEvent::type).contains("VOIDED", "COLLECTION_RECORDED");
        assertThat(revisionRepository.findAll()).anySatisfy(r -> assertThat(r.getAction()).isEqualTo("VOID"));
        assertThat(auditLogs.findAll()).anySatisfy(a -> assertThat(a.getAction()).isEqualTo("EXIT_VOID"));
        guard.assertWritable(s.c1());
    }

    @Test
    void voidReturnsEachCattleToItsLastPenWhenItIsAvailableAndNeverTwice() {
        Confirmed s = confirmedSale();
        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void(" ", null, null, null)), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("x", null, null, 77)), MessageCodes.COM_05, HttpStatus.CONFLICT);
        assertThat(service.voidCheck(farmId(), s.voucher().id()).cattle()).allSatisfy(v -> assertThat(v.needsPenOverride()).isFalse());

        ExitVoucherDTO.VoidResult result = service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("wrong buyer", null, null, null));
        assertThat(openAssignment(s.c1()).getPen()).isEqualTo(penA);
        assertThat(openAssignment(s.c2()).getPen()).isEqualTo(penA);
        assertThat(result.voucher().status()).isEqualTo(ExitVoucherStatus.VOIDED);
        // never voided twice
        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("again", null, null, null)), MessageCodes.COM_05, HttpStatus.CONFLICT);
        assertThat(service.voidCheck(farmId(), s.voucher().id()).voidable()).isFalse();
        // and the cattle can be put on a new voucher
        assertThat(service.create(farmId(), sale(TODAY, line(s.c1(), "400", 1L))).cattleCount()).isEqualTo(1);
    }

    @Test
    void voidChecksCapacityPerPenInAggregate() {
        Confirmed s = confirmedSale();
        // fill penA so that only one place is free for the two returning cattle
        for (int i = 0; i < 9; i++) {
            placed(penA, null);
        }
        ExitVoucherDTO.VoidCheck pre = service.voidCheck(farmId(), s.voucher().id());
        assertThat(pre.cattle().stream().filter(ExitVoucherDTO.VoidCattle::needsPenOverride)).hasSize(1);
        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("x", null, null, null)), MessageCodes.FE13_09, HttpStatus.UNPROCESSABLE_ENTITY);
        // the second cattle goes to pen B, the first fits its last pen
        service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("x", Map.of(s.c2().getId(), penB.getId()), null, null));
        assertThat(openAssignment(s.c1()).getPen()).isEqualTo(penA);
        assertThat(openAssignment(s.c2()).getPen()).isEqualTo(penB);
    }

    @Test
    void voidOverridePenWithUnmetCriteriaNeedsAWarningReason() {
        Confirmed s = confirmedSale();
        criteria(penB, 1, Set.of(PurposeType.BREEDING), EnumSet.allOf(LifeStage.class), null, null, null, owner);
        Map<Long, Long> overrides = Map.of(s.c1().getId(), penB.getId(), s.c2().getId(), penB.getId());
        penA.setStatus(ActiveStatus.INACTIVE);
        em.flush();
        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("x", overrides, null, null)), MessageCodes.FE04_06, HttpStatus.UNPROCESSABLE_ENTITY);
        service.voidVoucher(
            farmId(),
            s.voucher().id(),
            new ExitVoucherRequests.Void("x", overrides, Map.of(s.c1().getId(), "no other pen", s.c2().getId(), "no other pen"), null)
        );
        assertThat(openAssignment(s.c1()).getWarningReason()).isEqualTo("no other pen");
    }

    @Test
    void voidIsBlockedWhenACattleSitsOnAnotherOpenExitLine() {
        Confirmed s = confirmedSale();
        HerdExitVoucher other = exitVoucher(farm, owner, buyer, 0, 0, ExitVoucherStatus.DRAFT);
        exitLine(other, s.c1(), 1, ExitLineStatus.DRAFT);
        expect(() -> service.voidVoucher(farmId(), s.voucher().id(), new ExitVoucherRequests.Void("x", null, null, null)), MessageCodes.FE13_08, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(s.c1().getHerdStatus()).isEqualTo(HerdStatus.EXITED);
    }

    @Test
    void onlyAConfirmedVoucherCanBeVoided() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 1L)));
        expect(() -> service.voidVoucher(farmId(), draft.id(), new ExitVoucherRequests.Void("x", null, null, null)), MessageCodes.COM_05, HttpStatus.CONFLICT);
    }

    // ------------------------------------------------------------------ scenarios 16, 17: permissions

    @Test
    void scenario16ManagerAndTechnicianCannotWriteButManagerCanRead() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));

        actAs(manager);
        assertThat(service.get(farmId(), draft.id()).code()).isEqualTo(draft.code());
        assertThat(service.list(farmId(), null, null, null, null).vouchers()).hasSize(1);
        assertThat(service.checks(farmId(), draft.id()).cattle()).hasSize(1);
        assertThat(service.voidCheck(farmId(), draft.id()).voidable()).isFalse();
        expect(() -> confirm(draft.id()), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> service.create(farmId(), sale(TODAY)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> service.update(farmId(), draft.id(), sale(TODAY)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> service.delete(farmId(), draft.id(), null), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> service.voidVoucher(farmId(), draft.id(), new ExitVoucherRequests.Void("x", null, null, null)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> service.selectableCattle(farmId(), null, null, null, null), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);

        actAs(technician);
        expect(() -> service.get(farmId(), draft.id()), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> service.list(farmId(), null, null, null, null), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        expect(() -> confirm(draft.id()), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
    }

    @Test
    void otherFarmsVoucherIsNotFound() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));
        var otherFarm = farm();
        var otherOwner = memberWithRole(otherFarm, vn.edu.fpt.beefcare.domain.enumeration.FarmRole.OWNER);
        actAs(otherOwner);
        expect(() -> service.get(otherFarm.getId(), draft.id()), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
        expect(() -> service.get(farmId(), draft.id()), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
    }

    @Test
    void scenario17ExpiredServiceBlocksEveryWriteButNotReads() {
        Cattle c = placed(penA, "300");
        Cattle d = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));
        HealthCase hc = healthCase(d, "CLOSED", "DIED", TODAY.minusDays(8), TODAY.minusDays(1));
        HerdExitVoucher pending = service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.DIED);
        farm.setServiceStatus("EXPIRED");
        em.flush();

        expect(() -> service.create(farmId(), sale(TODAY)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> service.update(farmId(), draft.id(), sale(TODAY)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> service.addCattle(farmId(), draft.id(), new ExitVoucherRequests.AddCattle(List.of(d.getId()), null, null)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> confirm(draft.id()), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> service.delete(farmId(), draft.id(), null), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> service.dismiss(farmId(), pending.getId(), new ExitVoucherRequests.Dismiss("x", null)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> service.voidVoucher(farmId(), draft.id(), new ExitVoucherRequests.Void("x", null, null, null)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        expect(() -> service.selectableCattle(farmId(), null, null, null, null), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        // reads stay available
        assertThat(service.get(farmId(), draft.id()).status()).isEqualTo(ExitVoucherStatus.DRAFT);
        assertThat(service.list(farmId(), null, null, null, null).vouchers()).hasSize(2);
    }

    // ------------------------------------------------------------------ confirm rules

    @Test
    void confirmingTwiceIsIdempotentAndCreatesNothingNew() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(
            farmId(),
            saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 0, 3_000_000L, PaymentMethod.BANK_TRANSFER, List.of(line(c, "300", 50_000L)))
        );
        ExitVoucherDTO.ConfirmResult first = service.confirm(farmId(), draft.id(), ack(), "key-1");
        long audits = auditLogs.count();
        long payments = paymentRepository.count();
        ExitVoucherDTO.ConfirmResult second = service.confirm(farmId(), draft.id(), ack(), "key-1");

        assertThat(second.repeated()).isTrue();
        assertThat(second.voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
        assertThat(second.voucher().version()).isEqualTo(first.voucher().version());
        assertThat(second.effects()).hasSameSizeAs(first.effects());
        assertThat(second.effects().get(0).closedAssignment()).isEqualTo(first.effects().get(0).closedAssignment());
        assertThat(auditLogs.count()).isEqualTo(audits);
        assertThat(paymentRepository.count()).isEqualTo(payments);
        assertThat(second.voucher().payments()).hasSize(1);
    }

    @Test
    void confirmNeedsTheAcknowledgementAtLeastOneLineAndTheHeader() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail empty = service.create(farmId(), sale(TODAY));
        expect(() -> confirm(empty.id()), MessageCodes.FE06_16, HttpStatus.UNPROCESSABLE_ENTITY);

        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 50_000L)));
        expect(() -> service.confirm(farmId(), draft.id(), new ExitVoucherRequests.Confirm(false, null), null), MessageCodes.COM_16, HttpStatus.BAD_REQUEST);
        expect(() -> service.confirm(farmId(), draft.id(), new ExitVoucherRequests.Confirm(null, null), null), MessageCodes.COM_16, HttpStatus.BAD_REQUEST);
        expect(() -> service.confirm(farmId(), draft.id(), new ExitVoucherRequests.Confirm(true, 55), null), MessageCodes.COM_05, HttpStatus.CONFLICT);
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);

        // neither a buyer nor a destination
        ExitVoucherDTO.Detail noBuyer = service.create(farmId(), saveReq(ExitType.OTHER, TODAY, null, null, 0, 0, null, List.of()));
        service.addCattle(farmId(), noBuyer.id(), new ExitVoucherRequests.AddCattle(List.of(placed(penA, "300").getId()), null, null));
        expect(() -> confirm(noBuyer.id()), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
    }

    @Test
    void confirmIsBlockedWhenACattleIsNoLongerActiveAndNothingIsPartiallyConfirmed() {
        Cattle c1 = placed(penA, "300");
        Cattle c2 = placed(penA, "310");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c1, "300", 50_000L), line(c2, "310", 50_000L)));
        // c2 left the herd by another route in the meantime
        c2.setHerdStatus(HerdStatus.EXITED);
        em.flush();

        expect(() -> confirm(draft.id()), MessageCodes.COM_05, HttpStatus.CONFLICT);
        assertThat(c1.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        assertThat(openAssignment(c1)).isNotNull();
        assertThat(service.get(farmId(), draft.id()).status()).isEqualTo(ExitVoucherStatus.DRAFT);
        assertThat(paymentRepository.findAllByExitVoucherIdOrderByPaymentDateAscIdAsc(draft.id())).isEmpty();
    }

    @Test
    void perKgPricingNeedsAWeightOnEveryLine() {
        Cattle noWeight = placed(penA, null);
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(noWeight, null, 50_000L)));
        assertThat(draft.lines().get(0).exitWeightKg()).isNull();
        expect(() -> confirm(draft.id()), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        // per head needs no weight
        ExitVoucherDTO.Detail perHead = service.update(
            farmId(),
            draft.id(),
            new ExitVoucherRequests.Save(
                ExitType.SALE,
                TODAY,
                buyer.getId(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                vn.edu.fpt.beefcare.domain.enumeration.PricingBasis.PER_HEAD,
                0L,
                0L,
                null,
                null,
                List.of(line(noWeight, null, 12_000_000L)),
                null
            )
        );
        assertThat(perHead.cattleAmount()).isEqualTo(12_000_000L);
        assertThat(confirm(draft.id()).voucher().status()).isEqualTo(ExitVoucherStatus.CONFIRMED);
    }

    @Test
    void defaultExitWeightIsTheLatestEstimatedAndAnEnteredWeightIsMeasured() {
        Cattle c = placed(penA, "420.5");
        Cattle d = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, null, 10_000L), line(d, "310.25", 10_000L)));
        ExitVoucherDTO.Line l1 = draft.lines().get(0);
        assertThat(l1.exitWeightKg()).isEqualByComparingTo("420.5");
        assertThat(l1.weightBasis()).isEqualTo(WeightBasis.ESTIMATED);
        assertThat(l1.estimated()).isTrue();
        assertThat(l1.lineAmount()).isEqualTo(4_205_000L);
        ExitVoucherDTO.Line l2 = draft.lines().get(1);
        assertThat(l2.weightBasis()).isEqualTo(WeightBasis.MEASURED);
        assertThat(l2.lineAmount()).isEqualTo(3_102_500L);
        assertThat(draft.estimatedWeightCount()).isEqualTo(1);
        assertThat(draft.totalWeightKg()).isEqualByComparingTo("730.75");
        // entry / exit weights are not growth records (GBR-92)
        assertThat(em.createQuery("select count(g) from Growth g where g.cattle.id = :c", Long.class).setParameter("c", c.getId()).getSingleResult()).isEqualTo(1L);
    }

    // ------------------------------------------------------------------ header validation

    private Cattle withRecentWeight() {
        Cattle c = placed(penA, "300");
        weight(c, TODAY.minusDays(2), "305");
        return c;
    }

    @Test
    void exitDateCannotBeInTheFutureOrBeforeTheLatestRecordedEvent() {
        actAs(owner);
        Cattle c = withRecentWeight();
        assertThatThrownBy(() -> service.create(farmId(), sale(TODAY.minusDays(5), line(c, "300", 1L))))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo("MSG-FE13-03");
                assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                assertThat(e.getParams()).containsEntry("earliest_date", TODAY.minusDays(2));
            });
        Cattle c2 = withRecentWeight();
        expect(() -> service.create(farmId(), sale(TODAY.plusDays(1), line(c2, "300", 1L))), MessageCodes.FE13_03, HttpStatus.UNPROCESSABLE_ENTITY);
        expect(() -> service.create(farmId(), sale(TODAY.plusDays(1))), MessageCodes.COM_07, HttpStatus.UNPROCESSABLE_ENTITY);
        // exactly the date of the latest event is allowed
        Cattle c3 = withRecentWeight();
        assertThat(service.create(farmId(), sale(TODAY.minusDays(2), line(c3, "300", 1L))).exitDate()).isEqualTo(TODAY.minusDays(2));
    }

    @Test
    void exitDateBeforeAnyCattleEventIsRejectedAtConfirmToo() {
        Cattle c = placed(penA, "300");
        Cattle d = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY.minusDays(3), line(c, "300", 1L), line(d, "300", 1L)));
        // a later event is recorded on one cattle while the voucher is still a draft
        weight(d, TODAY.minusDays(1), "320");
        expect(() -> confirm(draft.id()), MessageCodes.FE13_03, HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
    }

    @Test
    void buyerMustBeAnActiveBuyerAndTypeIsFixedAfterTheFirstSave() {
        Cattle c = placed(penA, "300");
        var seller = partner(farm, owner, true, false);
        var inactiveBuyer = partner(farm, owner, false, true);
        inactiveBuyer.setStatus(ActiveStatus.INACTIVE);
        em.flush();
        actAs(owner);
        expect(() -> service.create(farmId(), saveReq(ExitType.SALE, TODAY, seller.getId(), null, 0, 0, null, List.of(line(c, "300", 1L)))), MessageCodes.COM_08, HttpStatus.UNPROCESSABLE_ENTITY);
        expect(() -> service.create(farmId(), saveReq(ExitType.SALE, TODAY, inactiveBuyer.getId(), null, 0, 0, null, List.of(line(c, "300", 1L)))), MessageCodes.COM_08, HttpStatus.UNPROCESSABLE_ENTITY);
        expect(() -> service.create(farmId(), new ExitVoucherRequests.Save(null, TODAY, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null)), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);

        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 1L)));
        expect(() -> service.update(farmId(), draft.id(), saveReq(ExitType.CULL, TODAY, buyer.getId(), null, 0, 0, null, List.of(line(c, "300", 1L)))), MessageCodes.COM_10, HttpStatus.BAD_REQUEST);
        // an OTHER voucher may name a destination instead of a buyer
        ExitVoucherDTO.Detail other = service.create(farmId(), saveReq(ExitType.OTHER, TODAY, null, "Relative's farm", 0, 0, null, List.of()));
        assertThat(other.destination()).isEqualTo("Relative's farm");
    }

    @Test
    void depositDeductionsAndMethodRules() {
        actAs(owner);
        // total receivable = 100 kg x 10,000 - 100,000 = 900,000
        Cattle a = placed(penA, "100");
        assertThatThrownBy(() -> service.create(farmId(), saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 100_000, 900_001, PaymentMethod.CASH, List.of(line(a, "100", 10_000L)))))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_13);
                assertThat(e.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                assertThat(e.getParams()).containsEntry("amount", 900_000L);
            });
        Cattle b = placed(penA, "100");
        expect(() -> service.create(farmId(), saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 1_000_001, 0, null, List.of(line(b, "100", 10_000L)))), MessageCodes.COM_10, HttpStatus.BAD_REQUEST);
        Cattle c = placed(penA, "100");
        expect(() -> service.create(farmId(), saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 0, 1000, null, List.of(line(c, "100", 10_000L)))), MessageCodes.COM_06, HttpStatus.BAD_REQUEST);
        Cattle d = placed(penA, "100");
        ExitVoucherDTO.Detail full = service.create(farmId(), saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 100_000, 900_000, PaymentMethod.CASH, List.of(line(d, "100", 10_000L))));
        ExitVoucherDTO.ConfirmResult result = confirm(full.id());
        assertThat(result.voucher().outstanding()).isZero();
        assertThat(result.voucher().payment().state().name()).isEqualTo("PAID");
    }

    @Test
    void draftCanBeDiscardedButNotAConfirmedVoucher() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 1L)));
        expect(() -> service.delete(farmId(), draft.id(), 99), MessageCodes.COM_05, HttpStatus.CONFLICT);
        service.delete(farmId(), draft.id(), null);
        expect(() -> service.get(farmId(), draft.id()), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
        assertThat(exitLines.findAllByVoucherIdOrderByLineNoAsc(draft.id())).isEmpty();

        ExitVoucherDTO.Detail again = service.create(farmId(), sale(TODAY, line(c, "300", 1L)));
        confirm(again.id());
        expect(() -> service.delete(farmId(), again.id(), null), MessageCodes.COM_05, HttpStatus.CONFLICT);
        expect(() -> service.update(farmId(), again.id(), sale(TODAY)), MessageCodes.COM_05, HttpStatus.CONFLICT);
    }

    @Test
    void staleVersionOnUpdateIsAConflict() {
        Cattle c = placed(penA, "300");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), sale(TODAY, line(c, "300", 1L)));
        ExitVoucherRequests.Save stale = new ExitVoucherRequests.Save(ExitType.SALE, TODAY, buyer.getId(), null, null, null, null, null, null, null, null, 0L, 0L, null, null, null, draft.version() + 5);
        expect(() -> service.update(farmId(), draft.id(), stale), MessageCodes.COM_05, HttpStatus.CONFLICT);
        ExitVoucherDTO.Detail updated = service.update(farmId(), draft.id(), saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 0, 0, null, null));
        assertThat(updated.cattleCount()).isEqualTo(1);
        assertThat(updated.version()).isGreaterThan(draft.version());
    }

    // ------------------------------------------------------------------ list (SCR-41)

    @Test
    void listShowsTilesStatusCountsAndFilters() {
        Cattle c1 = placed(penA, "400");
        Cattle c2 = placed(penA, "300");
        Cattle c3 = placed(penB, "200");
        Cattle c4 = placed(penB, "200");
        actAs(owner);
        ExitVoucherDTO.Detail sale = service.create(
            farmId(),
            saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 1_000_000, 10_000_000, PaymentMethod.CASH, List.of(line(c1, "400", 60_000L), line(c2, "300", 60_000L)))
        );
        confirm(sale.id());
        ExitVoucherDTO.Detail cull = service.create(farmId(), saveReq(ExitType.CULL, TODAY, buyer.getId(), null, 0, 0, null, List.of(line(c3, "200", 30_000L))));
        confirm(cull.id());
        ExitVoucherDTO.Detail draft = service.create(farmId(), saveReq(ExitType.OTHER, TODAY, null, "Farm X", 0, 0, null, List.of(line(c4, "200", 0L))));
        HealthCase hc = healthCase(placed(penA, "300"), "CLOSED", "DIED", TODAY.minusDays(3), TODAY.minusDays(1));
        service.createPendingLossVoucher(hc, manager, TODAY.minusDays(1), LossKind.DIED);

        ExitVoucherDTO.ListResult all = service.list(farmId(), null, null, null, null);
        assertThat(all.from()).isEqualTo(java.time.LocalDate.of(2026, 7, 1));
        assertThat(all.to()).isEqualTo(TODAY);
        assertThat(all.vouchers()).hasSize(4);
        assertThat(all.statusCounts()).containsEntry("ALL", 4).containsEntry("DRAFT", 1).containsEntry("PENDING", 1).containsEntry("CONFIRMED", 2).containsEntry("VOIDED", 0);
        ExitVoucherDTO.Tiles t = all.tiles();
        assertThat(t.cattleExited()).isEqualTo(3);
        assertThat(t.cattleExitedByType()).containsEntry(ExitType.SALE, 2).containsEntry(ExitType.CULL, 1).containsEntry(ExitType.DEATH, 0);
        // 700 kg x 60,000 - 1,000,000 + 200 kg x 30,000
        assertThat(t.salesRevenue()).isEqualTo(41_000_000L + 6_000_000L);
        assertThat(t.toCollect()).isEqualTo(31_000_000L + 6_000_000L);
        assertThat(t.vouchersToCollect()).isEqualTo(2);
        assertThat(t.awaitingOwner()).isEqualTo(1);

        ExitVoucherDTO.Row saleRow = all.vouchers().stream().filter(r -> r.id().equals(sale.id())).findFirst().orElseThrow();
        assertThat(saleRow.cattleCount()).isEqualTo(2);
        assertThat(saleRow.totalWeightKg()).isEqualByComparingTo("700");
        assertThat(saleRow.totalReceivable()).isEqualTo(41_000_000L);
        assertThat(saleRow.outstanding()).isEqualTo(31_000_000L);
        assertThat(saleRow.pens()).containsExactly("A");
        assertThat(saleRow.buyer().id()).isEqualTo(buyer.getId());
        ExitVoucherDTO.Row lossRow = all.vouchers().stream().filter(r -> r.loss()).findFirst().orElseThrow();
        assertThat(lossRow.totalReceivable()).isNull();
        assertThat(lossRow.outstanding()).isNull();
        assertThat(lossRow.sourceHealthCase().id()).isEqualTo(hc.getId());

        assertThat(service.list(farmId(), List.of(ExitVoucherStatus.DRAFT), null, null, null).vouchers()).extracting(ExitVoucherDTO.Row::id).containsExactly(draft.id());
        assertThat(service.list(farmId(), null, ExitType.CULL, null, null).vouchers()).extracting(ExitVoucherDTO.Row::id).containsExactly(cull.id());
        assertThat(service.list(farmId(), null, null, TODAY.plusDays(1), TODAY.plusDays(2)).vouchers()).isEmpty();
        expect(() -> service.list(farmId(), null, null, TODAY, TODAY.minusDays(1)), MessageCodes.COM_11, HttpStatus.BAD_REQUEST);
    }

    @Test
    void collectionsAreRecordedThroughThePaymentServiceAfterConfirmation() {
        Cattle c = placed(penA, "100");
        actAs(owner);
        ExitVoucherDTO.Detail draft = service.create(farmId(), saveReq(ExitType.SALE, TODAY, buyer.getId(), null, 0, 200_000, PaymentMethod.CASH, List.of(line(c, "100", 10_000L))));
        confirm(draft.id());
        assertThat(service.get(farmId(), draft.id()).outstanding()).isEqualTo(800_000L);
        assertThat(service.get(farmId(), draft.id()).payment().state().name()).isEqualTo("PARTLY_PAID");
    }
}
