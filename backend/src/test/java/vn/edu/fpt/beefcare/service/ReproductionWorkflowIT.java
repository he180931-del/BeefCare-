package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Duration;
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
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-11 / FE-12 service workflow: estrus, breeding, pregnancy check and calving with a draft calf; roles and contradictions. */
@ServiceIntegrationTest
@Transactional
class ReproductionWorkflowIT extends DomainTestSupport {

    @Autowired
    ReproductionCommandService reproduction;
    @Autowired
    ReproductionReadService reads;

    Farm farm;
    AppUser owner;
    AppUser manager;
    AppUser technician;
    Breed breed;
    Cattle cow;

    @BeforeEach
    void farmWithABreedingCow() {
        farm = farm();
        owner = memberWithRole(farm, FarmRole.OWNER);
        manager = memberWithRole(farm, FarmRole.MANAGER);
        technician = memberWithRole(farm, FarmRole.TECHNICIAN);
        breed = breed(farm);
        cow = cattle(farm, breed, purpose(farm, PurposeType.BREEDING), Sex.FEMALE, LifeStage.ADULT);
        clock.set(TODAY.atTime(10, 0).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant());
        FarmParameterVersion p = new FarmParameterVersion();
        p.setFarm(farm); p.setVersionNo(1); p.setGestationLengthDays(283); p.setParameterValues("{}"); p.setEffectiveFrom(TODAY.minusYears(2)); p.setCreatedAt(clock.instant());
        save(p);
        em.flush();
    }

    private static String key() {
        return UUID.randomUUID().toString();
    }

    private Instant daysAgo(int days) {
        return clock.instant().minus(Duration.ofDays(days));
    }

    private ReproductionDtos.EstrusCommand estrus(Integer version, Instant at) {
        return new ReproductionDtos.EstrusCommand(version, at, null, null, List.of("STANDING"), "note", null, null);
    }

    @Test
    void breedingIsNotPregnancyUntilACheckConfirmsItAndCalvingCreatesADraftCalf() {
        actAs(manager);
        var estrus = reproduction.recordEstrus(farm.getId(), cow.getId(), key(), estrus(cow.getVersion(), daysAgo(80)));
        var breeding = reproduction.recordBreeding(farm.getId(), cow.getId(), key(), new ReproductionDtos.BreedingCommand(estrus.cattleVersion(), daysAgo(79).plus(Duration.ofHours(10)),
            null, "AI", "EXTERNAL", null, breed.getId(), null, "ST-1", "Semen Co", null, "Dẫn tinh viên", estrus.eventId(), null, null));
        assertThat(breeding.tentativeCalvingDate()).isNotNull();
        assertThat(breeding.episode()).isNull(); // a breeding alone does not mean pregnant
        assertThat(openEpisodes()).isZero();

        var check = reproduction.recordPregnancyCheck(farm.getId(), cow.getId(), key(), new ReproductionDtos.PregnancyCheckCommand(breeding.cattleVersion(), breeding.eventId(),
            daysAgo(40), null, "PREGNANT", "ULTRASOUND", null, null, "BS. Thú y", null));
        assertThat(check.episode()).isNotNull();
        PregnancyEpisode episode = em.find(PregnancyEpisode.class, check.episode().episodeId());
        assertThat(episode.getStatus()).isEqualTo("OPEN");
        assertThat(episode.getExpectedBasis()).isEqualTo("CONFIRMED");
        assertThat(episode.getExpectedCalvingDate()).isEqualTo(TODAY.minusDays(79).plusDays(283)); // breeding date + gestation

        // AF2: a second PREGNANT check confirms the open pregnancy instead of opening a second one
        var again = reproduction.recordPregnancyCheck(farm.getId(), cow.getId(), key(), new ReproductionDtos.PregnancyCheckCommand(versionOf(Cattle.class, cow.getId()), null,
            daysAgo(20), null, "PREGNANT", "ULTRASOUND", null, null, null, null));
        assertThat(again.episode().episodeId()).isEqualTo(episode.getId());
        assertThat(openEpisodes()).isEqualTo(1);

        ReproductionDtos.CalvingResult calving = reproduction.recordCalving(farm.getId(), key(), new ReproductionDtos.CalvingCommand(
            cow.getId(), versionOf(Cattle.class, cow.getId()), episode.getId(), versionOf(PregnancyEpisode.class, episode.getId()), null,
            clock.instant().minus(Duration.ofHours(2)), null, null, "Manager", "NORMAL", "GOOD", false,
            List.of(new ReproductionDtos.CalfCommand("LIVE", "FEMALE", new BigDecimal("28.5"), "MEASURED", null, pen(farm, "P" + next(), 10).getId(), breed.getId(), "DRAFT", null))));
        assertThat(calving.calves()).hasSize(1);
        assertThat(calving.calves().get(0).cattleId()).isNull();
        assertThat(calving.damStatus()).isEqualTo("POST_CALVING");
        em.flush();
        em.clear();
        CalfOutcome calf = em.find(CalfOutcome.class, calving.calves().get(0).calfId());
        assertThat(calf.getRegistrationState()).isEqualTo("PENDING_CONFIRMATION"); // GBR-93: a draft calf until entered
        assertThat(em.find(PregnancyEpisode.class, episode.getId()).getStatus()).isEqualTo("CALVED");

        var profile = reads.profile(farm.getId(), cow.getId(), null, null, null);
        assertThat(profile.timeline()).hasSizeGreaterThanOrEqualTo(5);
        assertThat(profile.calvings()).hasSize(1);
    }

    @Test
    void onlyTheManagerRecordsReproductionAndOtherFarmsAreRejected() {
        actAs(owner);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), cow.getId(), key(), estrus(cow.getVersion(), daysAgo(1))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        actAs(technician);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), cow.getId(), key(), estrus(cow.getVersion(), daysAgo(1))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        assertThat(reads.profile(farm.getId(), cow.getId(), null, null, null).timeline()).isEmpty(); // Technician reads

        Farm other = farm();
        AppUser otherManager = memberWithRole(other, FarmRole.MANAGER);
        actAs(otherManager);
        assertThatThrownBy(() -> reads.profile(farm.getId(), cow.getId(), null, null, null)).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> reproduction.recordEstrus(other.getId(), cow.getId(), key(), estrus(cow.getVersion(), daysAgo(1))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getStatus().value()).isEqualTo(404));
    }

    @Test
    void futureEventsStaleVersionsAndMalesAreRefused() {
        actAs(manager);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), cow.getId(), key(), estrus(cow.getVersion(), clock.instant().plus(Duration.ofHours(2)))))
            .isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), cow.getId(), key(), estrus(cow.getVersion() + 3, daysAgo(1))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        Cattle bull = cattle(farm, breed, purpose(farm, PurposeType.SIRE), Sex.MALE, LifeStage.ADULT);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), bull.getId(), key(), estrus(bull.getVersion(), daysAgo(1))))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.FE11_11));
    }

    private long openEpisodes() {
        return em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id = :c and p.status = 'OPEN'", Long.class)
            .setParameter("c", cow.getId()).getSingleResult();
    }
}
