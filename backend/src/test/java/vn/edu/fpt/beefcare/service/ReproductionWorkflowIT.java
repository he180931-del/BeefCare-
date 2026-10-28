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
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** FE-11 / FE-12: estrus, breeding, pregnancy check and calving with a draft calf; roles and contradictions. */
@ServiceIntegrationTest
@Transactional
class ReproductionWorkflowIT extends DomainTestSupport {

    @Autowired
    ReproductionCommandService reproduction;

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
        cow.setCreatedAt(clock.instant().minus(Duration.ofDays(400))); // entered the herd before every event below
        em.flush();
    }

    private static String key() {
        return UUID.randomUUID().toString();
    }

    private Instant daysAgo(int days) {
        return clock.instant().minus(Duration.ofDays(days));
    }

    private ReproductionDtos.EventCommand event(Integer cattleVersion, Instant at, String method, String result, Long linked, boolean externalSire) {
        return new ReproductionDtos.EventCommand(cow.getId(), cattleVersion, at, null, method, result, null, "note", "Manager", null, linked,
            null, externalSire ? "EXTERNAL" : null, externalSire ? "Brahman bull" : null, externalSire ? breed.getId() : null,
            null, null, null, null);
    }

    @Test
    void breedingIsNotPregnancyUntilACheckConfirmsItAndCalvingCreatesADraftCalf() {
        actAs(manager);
        var estrus = reproduction.recordEstrus(farm.getId(), key(), event(cow.getVersion(), daysAgo(80), null, null, null, false));
        var breeding = reproduction.recordBreeding(farm.getId(), key(), event(estrus.cattleVersion(), daysAgo(79), "AI", null, estrus.id(), true));
        assertThat(breeding.tentativeExpectedCalvingDate()).isNotNull();
        assertThat(breeding.pregnancyEpisodeId()).isNull(); // a breeding alone does not mean pregnant
        assertThat(openEpisodes()).isZero();

        var check = reproduction.recordPregnancyCheck(farm.getId(), key(), event(breeding.cattleVersion(), daysAgo(40), "ULTRASOUND", "PREGNANT", breeding.id(), false));
        assertThat(check.pregnancyEpisodeId()).isNotNull();
        PregnancyEpisode episode = em.find(PregnancyEpisode.class, check.pregnancyEpisodeId());
        assertThat(episode.getStatus()).isEqualTo("OPEN");
        assertThat(episode.getExpectedBasis()).isEqualTo("CONFIRMED");
        assertThat(episode.getExpectedCalvingDate()).isEqualTo(TODAY.minusDays(79).plusDays(283)); // breeding date + gestation

        // a second PREGNANT result contradicts the open pregnancy (MSG-FE12-02)
        Integer cattleVersion = versionOf(Cattle.class, cow.getId());
        assertThatThrownBy(() -> reproduction.recordPregnancyCheck(farm.getId(), key(), event(cattleVersion, daysAgo(20), "ULTRASOUND", "PREGNANT", null, false)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo("MSG-FE12-02"));

        ReproductionDtos.CalvingResult calving = reproduction.recordCalving(farm.getId(), key(), new ReproductionDtos.CalvingCommand(
            cow.getId(), versionOf(Cattle.class, cow.getId()), episode.getId(), versionOf(PregnancyEpisode.class, episode.getId()),
            clock.instant().minus(Duration.ofHours(2)), null, "NORMAL", "GOOD", false, "Manager",
            List.of(new ReproductionDtos.CalfCommand(1, "LIVE", "FEMALE", new BigDecimal("28.5"), "KG", "MEASURED", null, null, breed.getId(), null, false))));
        assertThat(calving.calfOutcomeIds()).hasSize(1);
        assertThat(calving.registeredCattleIds()).isEmpty();
        em.flush();
        em.clear();
        CalfOutcome calf = em.find(CalfOutcome.class, calving.calfOutcomeIds().get(0));
        assertThat(calf.getRegistrationState()).isEqualTo("PENDING_CONFIRMATION"); // GBR-93: a draft calf until entered
        assertThat(em.find(PregnancyEpisode.class, episode.getId()).getStatus()).isNotEqualTo("OPEN");

        var history = reproduction.history(farm.getId(), cow.getId());
        assertThat(history.events()).hasSizeGreaterThanOrEqualTo(3);
        assertThat(history.pregnancies()).hasSize(1);
    }

    @Test
    void onlyTheManagerRecordsReproductionAndOtherFarmsAreRejected() {
        actAs(owner);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), key(), event(cow.getVersion(), daysAgo(1), null, null, null, false)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        actAs(technician);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), key(), event(cow.getVersion(), daysAgo(1), null, null, null, false)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_01));
        assertThat(reproduction.history(farm.getId(), cow.getId()).events()).isEmpty(); // Technician reads

        Farm other = farm();
        AppUser otherManager = memberWithRole(other, FarmRole.MANAGER);
        actAs(otherManager);
        assertThatThrownBy(() -> reproduction.history(farm.getId(), cow.getId())).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> reproduction.recordEstrus(other.getId(), key(), event(cow.getVersion(), daysAgo(1), null, null, null, false)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getStatus().value()).isEqualTo(404));
    }

    @Test
    void futureEventsStaleVersionsAndMalesAreRefused() {
        actAs(manager);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), key(), event(cow.getVersion(), clock.instant().plus(Duration.ofHours(2)), null, null, null, false)))
            .isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), key(), event(cow.getVersion() + 3, daysAgo(1), null, null, null, false)))
            .isInstanceOfSatisfying(DomainException.class, e -> assertThat(e.getCode()).isEqualTo(MessageCodes.COM_05));
        Cattle bull = cattle(farm, breed, purpose(farm, PurposeType.SIRE), Sex.MALE, LifeStage.ADULT);
        assertThatThrownBy(() -> reproduction.recordEstrus(farm.getId(), key(), new ReproductionDtos.EventCommand(bull.getId(), bull.getVersion(), daysAgo(1),
            null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null))).isInstanceOf(DomainException.class);
    }

    private long openEpisodes() {
        return em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id = :c and p.status = 'OPEN'", Long.class)
            .setParameter("c", cow.getId()).getSingleResult();
    }
}
