package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.PenAvailabilityRequest;
import vn.edu.fpt.beefcare.service.dto.PenCriteriaDTO;
import vn.edu.fpt.beefcare.service.dto.PenDTO;
import vn.edu.fpt.beefcare.service.dto.PenListDTO;
import vn.edu.fpt.beefcare.service.dto.PenRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class PenServiceTest extends DomainTestSupport {

    @Autowired
    PenService pens;

    @Autowired
    PenAssignmentService assignments;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;

    @BeforeEach
    void setUpFarm() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        actAs(owner);
    }

    private static PenCriteriaDTO criteria(Set<PurposeType> p, Set<LifeStage> l, Sex sex, Integer age, String kg) {
        return new PenCriteriaDTO(p, l, sex, age, kg == null ? null : new BigDecimal(kg));
    }

    private PenRequest request(String code, int capacity, PenCriteriaDTO criteria) {
        return new PenRequest(code, "Pen " + code, capacity, "desc", criteria, null, null);
    }

    private void assertCode(Runnable r, String code, HttpStatus status) {
        assertThatThrownBy(r::run)
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(code);
                assertThat(e.getStatus()).isEqualTo(status);
            });
    }

    private void placeCows(Pen pen, int n) {
        Breed breed = breed(farm);
        ProductionPurpose purpose = purpose(farm, PurposeType.BREEDING);
        for (int i = 0; i < n; i++) {
            Cattle c = cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
            assignments.openAssignment(c, pen, TODAY.minusDays(10), AssignmentSource.HERD_ENTRY, "entry", null, null, owner);
        }
    }

    @Test
    void createsPenWithCriteriaVersionOne() {
        PenDTO pen = pens.create(
            farm.getId(),
            request("A-1", 20, criteria(Set.of(PurposeType.BREEDING, PurposeType.FATTENING), Set.of(LifeStage.ADULT), Sex.FEMALE, 12, "250"))
        );
        assertThat(pen.status()).isEqualTo(ActiveStatus.ACTIVE);
        assertThat(pen.message().code()).isEqualTo(MessageCodes.FE04_01);
        assertThat(pen.currentCriteria().versionNo()).isEqualTo(1);
        assertThat(pen.currentCriteria().criteria().minAgeMonths()).isEqualTo(12);
        assertThat(pen.freePlaces()).isEqualTo(20);
        assertThat(pen.acceptsSummary()).contains("BREEDING/FATTENING").contains("FEMALE").contains("250");
    }

    @Test
    void penWithoutCriteriaAcceptsAll() {
        PenDTO pen = pens.create(farm.getId(), request("P0", 5, null));
        assertThat(pen.acceptsSummary()).isEqualTo("All");
        assertThat(pen.currentCriteria().versionNo()).isEqualTo(1);
    }

    @Test
    void initialStatusInactiveIsHonoured() {
        PenDTO pen = pens.create(farm.getId(), new PenRequest("X1", "x", 5, null, null, ActiveStatus.INACTIVE, null));
        assertThat(pen.status()).isEqualTo(ActiveStatus.INACTIVE);
    }

    @Test
    void penCodeMustBeUniqueInTheFarmIgnoringCase() {
        pens.create(farm.getId(), request("A-1", 5, null));
        assertCode(() -> pens.create(farm.getId(), request("a-1", 5, null)), MessageCodes.FE04_02, HttpStatus.UNPROCESSABLE_ENTITY);
        Farm other = farm();
        AppUser otherOwner = memberWithRole(other, FarmRole.OWNER);
        actAs(otherOwner);
        assertThat(pens.create(other.getId(), request("A-1", 5, null)).code()).isEqualTo("A-1");
    }

    @Test
    void technicianCannotWriteButCanRead() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 5, null));
        actAs(technician);
        assertCode(() -> pens.create(farm.getId(), request("A2", 5, null)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        assertCode(() -> pens.update(farm.getId(), pen.id(), request("A1", 6, null)), MessageCodes.COM_01, HttpStatus.FORBIDDEN);
        assertCode(
            () -> pens.changeAvailability(farm.getId(), pen.id(), new PenAvailabilityRequest(ActiveStatus.INACTIVE, TODAY, "r", null)),
            MessageCodes.COM_01,
            HttpStatus.FORBIDDEN
        );
        assertThat(pens.list(farm.getId(), null, null).pens()).hasSize(1);
        assertThat(pens.get(farm.getId(), pen.id()).code()).isEqualTo("A1");
    }

    @Test
    void managerCanCreate() {
        actAs(manager);
        assertThat(pens.create(farm.getId(), request("M1", 5, null)).id()).isNotNull();
    }

    @Test
    void expiredServiceBlocksPenWritesButNotReads() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 5, null));
        farm.setServiceStatus("EXPIRED");
        em.flush();
        assertCode(() -> pens.create(farm.getId(), request("A2", 5, null)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        assertCode(() -> pens.update(farm.getId(), pen.id(), request("A1", 6, null)), MessageCodes.COM_12, HttpStatus.FORBIDDEN);
        assertThat(pens.list(farm.getId(), null, null).pens()).hasSize(1);
    }

    @Test
    void capacityCannotDropBelowHeadcount() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, null));
        placeCows(em.find(Pen.class, pen.id()), 4);
        assertThatThrownBy(() -> pens.update(farm.getId(), pen.id(), request("A1", 3, null)))
            .isInstanceOfSatisfying(DomainException.class, e -> {
                assertThat(e.getCode()).isEqualTo(MessageCodes.FE04_03);
                assertThat(e.getParams()).containsEntry("min_capacity", 4);
            });
        PenDTO ok = pens.update(farm.getId(), pen.id(), request("A1", 4, null));
        assertThat(ok.capacity()).isEqualTo(4);
        assertThat(ok.full()).isTrue();
        assertThat(ok.headcount()).isEqualTo(4);
    }

    @Test
    void changedCriteriaCreatesNewVersionAndKeepsTheOld() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, criteria(Set.of(PurposeType.BREEDING), null, null, null, null)));
        clock.setFarmToday(TODAY.plusDays(5));
        PenDTO v2 = pens.update(farm.getId(), pen.id(), request("A1", 10, criteria(Set.of(PurposeType.FATTENING), null, Sex.MALE, 6, "200")));
        assertThat(v2.currentCriteria().versionNo()).isEqualTo(2);
        assertThat(v2.currentCriteria().effectiveFrom()).isEqualTo(TODAY.plusDays(5));
        assertThat(v2.criteriaVersions()).extracting(v -> v.versionNo()).containsExactly(2, 1);
        assertThat(v2.criteriaVersions().get(1).criteria().purposeTypes()).containsExactly(PurposeType.BREEDING);
    }

    @Test
    void unchangedCriteriaDoesNotCreateAVersion() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, criteria(Set.of(PurposeType.BREEDING), null, null, 12, "250.0")));
        PenDTO same = pens.update(farm.getId(), pen.id(), request("A1", 12, criteria(Set.of(PurposeType.BREEDING), null, null, 12, "250")));
        assertThat(same.criteriaVersions()).hasSize(1);
        PenDTO untouched = pens.update(farm.getId(), pen.id(), request("A1", 13, null));
        assertThat(untouched.criteriaVersions()).hasSize(1);
        assertThat(untouched.capacity()).isEqualTo(13);
    }

    @Test
    void newCriteriaVersionDoesNotRewriteExistingAssignments() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, criteria(Set.of(PurposeType.BREEDING), null, null, null, null)));
        Pen entity = em.find(Pen.class, pen.id());
        Breed breed = breed(farm);
        Cattle c = cattle(farm, breed, purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        PenAssignment a = assignments.openAssignment(c, entity, TODAY.minusDays(3), AssignmentSource.HERD_ENTRY, "r", null, null, owner);
        pens.update(farm.getId(), pen.id(), request("A1", 10, criteria(Set.of(PurposeType.SIRE), null, null, null, null)));
        em.flush();
        em.clear();
        assertThat(em.find(PenAssignment.class, a.getId()).getToDate()).isNull();
        assertThat(pens.get(farm.getId(), pen.id()).headcount()).isEqualTo(1);
    }

    @Test
    void staleExpectedVersionGivesMsgCom05() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, null));
        PenRequest stale = new PenRequest("A1", "n", 11, null, null, null, pen.version() + 5);
        assertCode(() -> pens.update(farm.getId(), pen.id(), stale), MessageCodes.COM_05, HttpStatus.CONFLICT);
        PenRequest fresh = new PenRequest("A1", "n", 11, null, null, null, pen.version());
        assertThat(pens.update(farm.getId(), pen.id(), fresh).version()).isGreaterThan(pen.version());
    }

    @Test
    void availabilityToggleKeepsCattleAndRecordsReason() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, null));
        placeCows(em.find(Pen.class, pen.id()), 2);
        PenDTO stopped = pens.changeAvailability(farm.getId(), pen.id(), new PenAvailabilityRequest(ActiveStatus.INACTIVE, TODAY, "cleaning", null));
        assertThat(stopped.status()).isEqualTo(ActiveStatus.INACTIVE);
        assertThat(stopped.statusReason()).isEqualTo("cleaning");
        assertThat(stopped.headcount()).isEqualTo(2);
        assertThat(stopped.cattle()).hasSize(2);
        assertThat(stopped.message().code()).isEqualTo(MessageCodes.FE04_04);
        PenDTO resumed = pens.changeAvailability(farm.getId(), pen.id(), new PenAvailabilityRequest(ActiveStatus.ACTIVE, TODAY, "done", null));
        assertThat(resumed.status()).isEqualTo(ActiveStatus.ACTIVE);
    }

    @Test
    void availabilityRejectsFutureDateMissingReasonAndSameStatus() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, null));
        assertCode(
            () -> pens.changeAvailability(farm.getId(), pen.id(), new PenAvailabilityRequest(ActiveStatus.INACTIVE, TODAY.plusDays(1), "x", null)),
            MessageCodes.COM_07,
            HttpStatus.UNPROCESSABLE_ENTITY
        );
        assertCode(
            () -> pens.changeAvailability(farm.getId(), pen.id(), new PenAvailabilityRequest(ActiveStatus.INACTIVE, TODAY, "  ", null)),
            MessageCodes.COM_06,
            HttpStatus.BAD_REQUEST
        );
        assertCode(
            () -> pens.changeAvailability(farm.getId(), pen.id(), new PenAvailabilityRequest(ActiveStatus.ACTIVE, TODAY, "x", null)),
            MessageCodes.COM_05,
            HttpStatus.CONFLICT
        );
    }

    @Test
    void listHeaderCountsActivePensOnlyAndFilters() {
        PenDTO a = pens.create(farm.getId(), request("A1", 10, null));
        pens.create(farm.getId(), new PenRequest("B1", "Barn", 20, null, null, ActiveStatus.INACTIVE, null));
        pens.create(farm.getId(), request("C1", 5, null));
        placeCows(em.find(Pen.class, a.id()), 3);
        PenListDTO all = pens.list(farm.getId(), null, null);
        assertThat(all.pens()).hasSize(3);
        assertThat(all.usedPlaces()).isEqualTo(3);
        assertThat(all.totalPlaces()).isEqualTo(15);
        assertThat(pens.list(farm.getId(), ActiveStatus.INACTIVE, null).pens()).extracting(PenDTO::code).containsExactly("B1");
        assertThat(pens.list(farm.getId(), null, "barn").pens()).extracting(PenDTO::code).containsExactly("B1");
        assertThat(pens.list(farm.getId(), null, "c1").pens()).extracting(PenDTO::code).containsExactly("C1");
        assertThat(all.pens().get(0).headcount()).isEqualTo(3);
    }

    @Test
    void penOfAnotherFarmIsNotFound() {
        Farm other = farm();
        Pen foreign = pen(other, "Z1", 5);
        assertCode(() -> pens.get(farm.getId(), foreign.getId()), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
        assertCode(() -> pens.update(farm.getId(), foreign.getId(), request("Z1", 5, null)), MessageCodes.COM_08, HttpStatus.NOT_FOUND);
    }

    @Test
    void detailShowsCattleWithWeightAndHints() {
        PenDTO pen = pens.create(farm.getId(), request("A1", 10, null));
        Pen entity = em.find(Pen.class, pen.id());
        Cattle c = cattle(farm, breed(farm), purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        assignments.openAssignment(c, entity, TODAY.minusDays(2), AssignmentSource.HERD_ENTRY, "r", null, null, owner);
        weight(c, TODAY.minusDays(1), "310.5");
        PenDTO detail = pens.get(farm.getId(), pen.id());
        assertThat(detail.cattle()).hasSize(1);
        assertThat(detail.cattle().get(0).latestWeightKg()).isEqualByComparingTo("310.5");
        assertThat(detail.cattle().get(0).sinceDate()).isEqualTo(TODAY.minusDays(2));
        assertThat(detail.cattle().get(0).hints()).isEmpty();
        assertThat(List.of(detail.criteriaVersions())).hasSize(1);
    }
}
