package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.CattleQrTag;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.enumeration.EntryType;
import vn.edu.fpt.beefcare.domain.enumeration.EntryVoucherStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.EntryActionRequests;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.EntryLineRequest;
import vn.edu.fpt.beefcare.service.dto.EntryVoucherRequest;
import vn.edu.fpt.beefcare.support.HerdEntryTestBase;

/** Farm-born calves (GBR-31, GBR-58, GBR-93, UC-FE06-01 AF1 / AF2 / AF7). */
@ServiceIntegrationTest
@Transactional
class FarmBornEntryTest extends HerdEntryTestBase {

    @Autowired
    PendingCalfService calves;

    @Autowired
    EntryReminderService reminders;

    Cattle dam;

    @BeforeEach
    void setUpDam() {
        dam = cattle(farm, breed, breeding, Sex.FEMALE, LifeStage.ADULT);
    }

    private CalfOutcome calf(String outcome, String sex, String tagCode) {
        CalvingEvent calving = new CalvingEvent();
        calving.setDam(dam);
        calving.setBirthTime(TODAY.minusDays(2).atTime(12, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        calving.setCourse("NORMAL");
        calving.setDamCondition("GOOD");
        save(calving);
        CalfOutcome o = new CalfOutcome();
        o.setCalving(calving);
        o.setOutcome(outcome);
        o.setSex(sex);
        o.setBirthWeight(new BigDecimal("32.50"));
        o.setRegistrationState("PENDING_CONFIRMATION");
        o.setTagCode(tagCode);
        o.setProposedPen(penA);
        save(o);
        reminders.raiseCalfReminder(o, dam);
        return o;
    }

    private EntryVoucherRequest farmBorn(EntryLineRequest... lines) {
        return new EntryVoucherRequest(EntryType.FARM_BORN, TODAY, null, null, null, null, "born on farm", null, null, null, null, null, List.of(lines), null);
    }

    private EntryLineRequest calfLine(CalfOutcome calf, Long penId, Long purposeId) {
        return new EntryLineRequest(null, null, null, null, null, null, null, null, null, null, purposeId, null, null, penId, null, null, null, null, null, null, calf.getId());
    }

    private static DomainException thrown(Runnable r) {
        try {
            r.run();
        } catch (DomainException e) {
            return e;
        }
        throw new AssertionError("expected a DomainException");
    }

    @Test
    void pendingListHasOnlyLiveCalvesWaitingForRegistration() {
        CalfOutcome live = calf("LIVE", "FEMALE", null);
        calf("STILLBORN", "MALE", null);
        CalfOutcome registered = calf("LIVE", "MALE", null);
        registered.setRegistrationState("REGISTERED");
        save(registered);
        List<EntryDtos.PendingCalf> pending = calves.pending(farm.getId());
        assertThat(pending).singleElement().satisfies(p -> {
            assertThat(p.calfOutcomeId()).isEqualTo(live.getId());
            assertThat(p.damCode()).isEqualTo(dam.getDisplayCode());
            assertThat(p.damActive()).isTrue();
            assertThat(p.birthDate()).isEqualTo(TODAY.minusDays(2));
            assertThat(p.defaultPurposeId()).isEqualTo(undecided.getId());
            assertThat(p.proposedPenId()).isEqualTo(penA.getId());
            assertThat(p.sex()).isEqualTo("FEMALE");
        });
    }

    @Test
    void postingAFarmBornVoucherRegistersTheCalf() {
        CalfOutcome calf = calf("LIVE", "FEMALE", "QR-CALF-1");
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), farmBorn(calfLine(calf, penA.getId(), null)));
        assertThat(draft.entryType()).isEqualTo(EntryType.FARM_BORN);
        assertThat(draft.totalPayable()).isZero();
        assertThat(draft.sellerId()).isNull();
        assertThat(count("Cattle")).isEqualTo(1); // only the dam
        assertThat(calves.pending(farm.getId())).hasSize(1);

        EntryDtos.PostResult result = postDraft(farm.getId(), draft.id());
        Cattle c = em.find(Cattle.class, result.voucher().lines().get(0).cattleId());
        assertThat(c.getDam().getId()).isEqualTo(dam.getId());
        assertThat(c.getSex()).isEqualTo(Sex.FEMALE);
        assertThat(c.getBirthDate()).isEqualTo(TODAY.minusDays(2));
        assertThat(c.getLifeStage()).isEqualTo(LifeStage.UNWEANED_CALF);
        assertThat(c.getPurpose().getId()).isEqualTo(undecided.getId());
        assertThat(c.getBreed().getId()).isEqualTo(breed.getId());
        assertThat(c.getHerdStatus()).isEqualTo(HerdStatus.ACTIVE);
        assertThat(result.voucher().lines().get(0).entryDate()).isEqualTo(TODAY.minusDays(2));
        assertThat(result.voucher().lines().get(0).entryWeightKg()).isEqualByComparingTo("32.50");
        assertThat(result.voucher().lines().get(0).damCode()).isEqualTo(dam.getDisplayCode());
        assertThat(result.voucher().totalPayable()).isZero();
        assertThat(result.voucher().paymentState()).isNull();
        assertThat(em.createQuery("select t from CattleQrTag t where t.cattle.id = :c", CattleQrTag.class).setParameter("c", c.getId()).getSingleResult().getTagCode()).isEqualTo("QR-CALF-1");
        assertThat(countOpenAssignments(penA)).isEqualTo(1);

        CalfOutcome reloaded = em.find(CalfOutcome.class, calf.getId());
        assertThat(reloaded.getRegistrationState()).isEqualTo("REGISTERED");
        assertThat(reloaded.getRegisteredCattle().getId()).isEqualTo(c.getId());
        assertThat(em.createQuery("select r from Reminder r where r.ruleType = 'REM-09'", Reminder.class).getSingleResult().getStatus()).isEqualTo("RESOLVED");
        assertThat(calves.pending(farm.getId())).isEmpty();

        // the same calf cannot be registered again (MSG-FE06-02)
        DomainException e = thrown(() -> vouchers.create(farm.getId(), farmBorn(calfLine(calf, penA.getId(), null))));
        assertThat(e.getCode()).isEqualTo(MessageCodes.FE06_02);
        assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(e.getParams()).containsEntry("cattle_code", c.getDisplayCode());
        // and posting twice is idempotent
        assertThat(postDraft(farm.getId(), draft.id()).alreadyPosted()).isTrue();
        assertThat(count("Cattle")).isEqualTo(2);
    }

    @Test
    void onlyLiveCalvesWithAnActiveDamAreAccepted() {
        CalfOutcome stillborn = calf("STILLBORN", "MALE", null);
        assertThat(thrown(() -> vouchers.create(farm.getId(), farmBorn(calfLine(stillborn, penA.getId(), null)))).getCode()).isEqualTo(MessageCodes.FE06_04);

        CalfOutcome live = calf("LIVE", "MALE", null);
        EntryDtos.Voucher draft = vouchers.create(farm.getId(), farmBorn(calfLine(live, penA.getId(), null)));
        dam.setHerdStatus(HerdStatus.EXITED);
        dam.setExitType(vn.edu.fpt.beefcare.domain.enumeration.ExitType.SALE);
        dam.setExitDate(TODAY);
        save(dam);
        assertThat(thrown(() -> postDraft(farm.getId(), draft.id())).getCode()).isEqualTo(MessageCodes.COM_13);
        assertThat(em.find(CalfOutcome.class, live.getId()).getRegistrationState()).isEqualTo("PENDING_CONFIRMATION");
    }

    @Test
    void purposeMustFitTheCalfsSex() {
        CalfOutcome heifer = calf("LIVE", "FEMALE", null);
        assertThat(thrown(() -> postDraft(farm.getId(), vouchers.create(farm.getId(), farmBorn(calfLine(heifer, penA.getId(), sire.getId()))).id())).getCode()).isEqualTo(HerdEntryCodes.FE05_12);
        CalfOutcome bull = calf("LIVE", "MALE", null);
        assertThat(thrown(() -> postDraft(farm.getId(), vouchers.create(farm.getId(), farmBorn(calfLine(bull, penA.getId(), breeding.getId()))).id())).getCode()).isEqualTo(HerdEntryCodes.FE05_12);
    }

    @Test
    void farmBornVoucherHasNoSellerOrAmounts() {
        CalfOutcome c = calf("LIVE", "MALE", null);
        var withSeller = new EntryVoucherRequest(EntryType.FARM_BORN, TODAY, seller.getId(), null, null, null, null, null, null, null, null, null, List.of(calfLine(c, penA.getId(), null)), null);
        assertThat(thrown(() -> vouchers.create(farm.getId(), withSeller)).getCode()).isEqualTo(MessageCodes.COM_10);
        var withFee = new EntryVoucherRequest(EntryType.FARM_BORN, TODAY, null, null, null, null, null, null, 5L, null, null, null, List.of(calfLine(c, penA.getId(), null)), null);
        assertThat(thrown(() -> vouchers.create(farm.getId(), withFee)).getCode()).isEqualTo(MessageCodes.COM_10);
    }

    @Test
    void voidingTheVoucherReturnsTheCalfToPendingAndRaisesTheReminderAgain() {
        CalfOutcome calf = calf("LIVE", "MALE", null);
        EntryDtos.PostResult posted = postDraft(farm.getId(), vouchers.create(farm.getId(), farmBorn(calfLine(calf, penA.getId(), null))).id());
        voidVoucher(posted.voucher().id(), new EntryActionRequests.VoidRequest("calf entered by mistake", null));
        CalfOutcome reloaded = em.find(CalfOutcome.class, calf.getId());
        assertThat(reloaded.getRegistrationState()).isEqualTo("PENDING_CONFIRMATION");
        assertThat(reloaded.getRegisteredCattle()).isNull();
        assertThat(em.find(Cattle.class, posted.voucher().lines().get(0).cattleId()).getHerdStatus()).isEqualTo(HerdStatus.VOIDED);
        assertThat(em.createQuery("select r from Reminder r where r.ruleType = 'REM-09' and r.status = 'OPEN'", Reminder.class).getResultList()).hasSize(1);
        assertThat(calves.pending(farm.getId())).hasSize(1);
        assertThat(corrections.voidCheck(farm.getId(), posted.voucher().id()).entryType()).isEqualTo("FARM_BORN");
    }

    @Test
    void diedBeforeRegistrationNeedsAReasonAndResolvesTheReminder() {
        CalfOutcome calf = calf("LIVE", "MALE", null);
        assertThat(thrown(() -> calves.diedBeforeRegistration(farm.getId(), calf.getId(), " ")).getCode()).isEqualTo(MessageCodes.COM_06);
        EntryDtos.PendingCalf result = calves.diedBeforeRegistration(farm.getId(), calf.getId(), "Died the next morning");
        assertThat(result.registrationState()).isEqualTo("DIED_BEFORE_REGISTRATION");
        assertThat(em.find(CalfOutcome.class, calf.getId()).getDiedReason()).isEqualTo("Died the next morning");
        assertThat(em.createQuery("select r from Reminder r where r.ruleType = 'REM-09'", Reminder.class).getSingleResult().getStatus()).isEqualTo("RESOLVED");
        assertThat(calves.pending(farm.getId())).isEmpty();
        assertThat(thrown(() -> calves.diedBeforeRegistration(farm.getId(), calf.getId(), "again")).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(thrown(() -> vouchers.create(farm.getId(), farmBorn(calfLine(calf, penA.getId(), null)))).getStatus()).isEqualTo(HttpStatus.CONFLICT);
        actAs(technician);
        CalfOutcome other = calf("LIVE", "MALE", null);
        assertThat(thrown(() -> calves.diedBeforeRegistration(farm.getId(), other.getId(), "x")).getCode()).isEqualTo(MessageCodes.COM_01);
    }

    @Test
    void registerNowCreatesAndPostsTheVoucherInTheCallersTransaction() {
        CalfOutcome calf = calf("LIVE", "FEMALE", null);
        EntryDtos.RegisteredCalf result = calves.registerCalfNow(farm.getId(), calf.getId(), null, null);
        assertThat(result.notice().code()).isEqualTo("MSG-FE06-11");
        assertThat(result.notice().params()).containsEntry("cattle_code", result.cattleCode()).containsEntry("dam_code", dam.getDisplayCode()).containsEntry("voucher_code", result.voucherCode());
        Cattle c = em.find(Cattle.class, result.cattleId());
        assertThat(c.getDam().getId()).isEqualTo(dam.getId());
        assertThat(vouchers.get(farm.getId(), result.voucherId()).status()).isEqualTo(EntryVoucherStatus.POSTED);
        assertThat(countOpenAssignments(penA)).isEqualTo(1); // the pen chosen at calving
        assertThat(thrown(() -> calves.registerCalfNow(farm.getId(), calf.getId(), null, null)).getCode()).isEqualTo(MessageCodes.FE06_02);
    }
}
