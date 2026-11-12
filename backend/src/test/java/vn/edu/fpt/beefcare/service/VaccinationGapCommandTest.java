package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.VaccinationSchedule;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/**
 * FE-09 backend gaps (spec FE-09 §7): stop reason (GAP-FE09-02), withdrawal correction (GAP-FE09-04), history route and
 * revisions (GAP-FE09-03), schedule target / dose-count edits (GAP-FE09-01) and skipping cattle in a batch (TC-09-17).
 */
@ServiceIntegrationTest
@Transactional
class VaccinationGapCommandTest extends DomainTestSupport {

    @Autowired
    VaccinationCommandService vaccination;

    @Autowired
    CareCatalogueCommandService catalogue;

    @Autowired
    CareReadService reads;

    Farm farm;
    AppUser manager;
    CareDtos.CatalogueItem vaccine;
    List<Cattle> herd;

    @BeforeEach
    void farmWithFourCattle() {
        farm = farm();
        memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        var breed = breed(farm);
        var fattening = purpose(farm, PurposeType.FATTENING);
        herd = List.of(
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK),
            cattle(farm, breed, fattening, Sex.MALE, LifeStage.YOUNG_STOCK)
        );
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        actAs(manager);
        vaccine = catalogue.saveVaccine(farm.getId(), null, key(),
            new CareDtos.VaccineCommand(null, "FMD" + next(), "LMLM", "Lở mồm long móng", "Navetco", "2 ml", "SC", 21, 6, true));
    }

    static String key() {
        return UUID.randomUUID().toString();
    }

    Instant hoursAgo(int hours) {
        return clock.instant().minusSeconds(hours * 3600L);
    }

    CareDtos.VaccinationScheduleResult schedule(String name, int doses, List<Cattle> cattle) {
        return vaccination.createSchedule(farm.getId(), key(), new CareDtos.CreateVaccinationSchedule(name, vaccine.id(), TODAY, doses, 21, null,
            cattle.stream().map(Cattle::getId).toList()));
    }

    List<ScheduledDose> doses(Long scheduleId) {
        return em.createQuery("select d from ScheduledDose d where d.schedule.id=:id order by d.cattle.id, d.doseNo", ScheduledDose.class)
            .setParameter("id", scheduleId).getResultList();
    }

    void reload() {
        em.flush();
        em.clear();
    }

    // ------------------------------------------------------------ GAP-FE09-02 (R-09-06, SCR-32 #11)

    @Test
    void stoppingAScheduleStoresTheReasonAndShowsItInTheScheduleView() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 2, herd);
        Integer version = versionOf(VaccinationSchedule.class, created.id());

        CareDtos.VaccinationScheduleResult stopped = vaccination.stopSchedule(farm.getId(), created.id(), key(), version, "  Đổi vắc-xin theo thú y  ");
        assertThat(stopped.status()).isEqualTo("STOPPED");
        reload();

        assertThat(em.find(VaccinationSchedule.class, created.id()).getStopReason()).isEqualTo("Đổi vắc-xin theo thú y");
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("CANCELLED");
        assertThat(vaccination.schedules(farm.getId())).singleElement()
            .satisfies(view -> assertThat(view.stopReason()).isEqualTo("Đổi vắc-xin theo thú y"));
    }

    @Test
    void stoppingWithoutAReasonOrWithMoreThan500CharactersChangesNothing() {
        CareDtos.VaccinationScheduleResult created = schedule("LMLM 2026", 1, herd);
        Integer version = versionOf(VaccinationSchedule.class, created.id());

        assertThatThrownBy(() -> vaccination.stopSchedule(farm.getId(), created.id(), key(), version, "   "))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.COM_06);
                assertThat(e.getParams()).containsEntry("field", "reason");
            });
        assertThatThrownBy(() -> vaccination.stopSchedule(farm.getId(), created.id(), key(), version, "x".repeat(501)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_10));
        reload();
        assertThat(em.find(VaccinationSchedule.class, created.id()).getStatus()).isEqualTo("ACTIVE");
        assertThat(doses(created.id())).extracting(ScheduledDose::getStatus).containsOnly("PLANNED");
    }

    // ------------------------------------------------------------ GAP-FE09-04 (R-09-14, TC-09-27)

    Long recordOnFarm(Cattle cow, int withdrawalDays) {
        return vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "ON_FARM", null, hoursAgo(1), "LOT-1", "2 ml", "SC",
            withdrawalDays, "Manager", List.of(new CareDtos.VaccinationAnimal(cow.getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
    }

    CareDtos.CorrectVaccination withdrawal(Long id, Integer days) {
        return new CareDtos.CorrectVaccination(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), null, null, null, null, null, null, null,
            "Sửa ngưng thịt", days);
    }

    @Test
    void correctingTheWithdrawalPeriodRecalculatesTheEndDatesAndKeepsTheOldPeriodInTheRevision() {
        Cattle cow = herd.get(0);
        Long id = recordOnFarm(cow, 21);
        reload();

        CareDtos.VaccinationResult corrected = vaccination.correct(farm.getId(), id, key(), withdrawal(id, 30));
        assertThat(corrected.withdrawalDays()).isEqualTo(30);
        assertThat(corrected.withdrawalEndDate()).isEqualTo(TODAY.plusDays(30));
        assertThat(corrected.cattleWithdrawalEndDate()).isEqualTo(TODAY.plusDays(30));
        assertThat(corrected.corrected()).isTrue();
        reload();

        var record = em.find(vn.edu.fpt.beefcare.domain.Vaccination.class, id);
        assertThat(record.getWithdrawalDays()).isEqualTo(30);
        assertThat(record.getWithdrawalEndDate()).isEqualTo(TODAY.plusDays(30));
        String before = em.createQuery("select r.beforeSnapshot from RecordRevision r where r.sourceType='Vaccination' and r.sourceId=:id", String.class)
            .setParameter("id", id).getSingleResult();
        assertThat(before).contains("\"withdrawalDays\":21").contains("\"withdrawalEndDate\":\"" + TODAY.plusDays(21) + "\"");

        CareDtos.VaccinationResult none = vaccination.correct(farm.getId(), id, key(), withdrawal(id, 0));
        assertThat(none.withdrawalEndDate()).isNull();
        assertThat(none.cattleWithdrawalEndDate()).isNull();
    }

    @Test
    void anOutOfRangeWithdrawalOrAWithdrawalOnAHistoricalRecordIsRejected() {
        Cattle cow = herd.get(0);
        Long onFarm = recordOnFarm(cow, 21);
        reload();
        assertThatThrownBy(() -> vaccination.correct(farm.getId(), onFarm, key(), withdrawal(onFarm, 366)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "withdrawalDays"));

        Long historical = vaccination.record(farm.getId(), key(), new CareDtos.RecordVaccinations(vaccine.id(), "HISTORICAL", TODAY.minusMonths(3), null, null,
            "2 ml", "SC", null, "Trại cũ", List.of(new CareDtos.VaccinationAnimal(herd.get(1).getId(), null, null, "VACCINATE", null, null)))).vaccinationIds().get(0);
        reload();
        assertThatThrownBy(() -> vaccination.correct(farm.getId(), historical, key(), withdrawal(historical, 5)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getParams()).containsEntry("field", "withdrawalDays"));
    }

    @Test
    void voidingTheOnlyOnFarmRecordClearsTheWithdrawalOfTheCattle() {
        Cattle cow = herd.get(0);
        Long id = recordOnFarm(cow, 21);
        reload();
        CareDtos.VaccinationResult voided = vaccination.voidRecord(farm.getId(), id, key(),
            new CareDtos.VoidRecord(versionOf(vn.edu.fpt.beefcare.domain.Vaccination.class, id), "Ghi nhầm bò"));
        assertThat(voided.status()).isEqualTo("VOIDED");
        assertThat(voided.cattleWithdrawalEndDate()).isNull();
    }
}
