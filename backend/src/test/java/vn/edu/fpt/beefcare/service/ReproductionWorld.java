package vn.edu.fpt.beefcare.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.test.util.ReflectionTestUtils;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.CalvingEvent;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.PregnancyUpdate;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

/**
 * In-memory farm of the FE-11 / FE-12 unit tests: cattle, reproduction events, pregnancies, pregnancy updates,
 * calvings, calf outcomes, pens, breeds, purposes, weights and farm parameters, answered through {@link FakeJpql} for
 * {@link ReproductionCommandService}, {@link ReproductionReadService} and the real {@link CattleStateService}. Each route
 * mirrors the farm / status / time conditions written in the query it answers.
 */
final class ReproductionWorld {

    static final long FARM_ID = 970L;
    static final java.time.ZoneOffset FARM_ZONE = ZoneOffset.ofHours(7);

    final Farm farm = new Farm();
    final Map<FarmRole, AppUser> users = new HashMap<>();
    final List<FarmMembership> memberships = new ArrayList<>();
    final Map<Long, Cattle> cattle = new HashMap<>();
    final List<ReproductionEvent> events = new ArrayList<>();
    final List<PregnancyEpisode> episodes = new ArrayList<>();
    final List<PregnancyUpdate> updates = new ArrayList<>();
    final List<CalvingEvent> calvings = new ArrayList<>();
    final List<CalfOutcome> calves = new ArrayList<>();
    final List<HealthCase> healthCases = new ArrayList<>();
    final Map<Long, Pen> pens = new HashMap<>();
    final Map<Long, Breed> breeds = new HashMap<>();
    final Map<Long, ProductionPurpose> purposes = new HashMap<>();
    final List<PenAssignment> placements = new ArrayList<>();
    final Map<Long, Growth> weights = new HashMap<>();
    final Set<String> qrTags = new HashSet<>();
    /** Gestation length of the farm parameter version; null = not configured (MSG-FE11-08). */
    Integer gestation = 283;
    /** JSON values of the farm parameter version; null = the farm has no parameter version. */
    String parameters = "{\"BREEDING_WINDOW_START_HOURS\":8,\"BREEDING_WINDOW_END_HOURS\":12,\"MIN_BREEDING_AGE_MONTHS\":13,"
        + "\"MIN_BREEDING_WEIGHT_KG\":230,\"POST_CALVING_DAYS\":45,\"ESTRUS_CYCLE_DAYS\":21,\"PREGNANCY_CHECK_DAYS\":28,\"CALVING_LEAD_DAYS\":30}";
    LocalDate entryDate = LocalDate.of(2025, 1, 1);
    private long nextId = 5000L;
    final FakeJpql jpql;

    ReproductionWorld(EntityManager em) {
        farm.setId(FARM_ID);
        user(FarmRole.OWNER, 30L, "Owner Hoa");
        user(FarmRole.MANAGER, 31L, "Manager Lan");
        user(FarmRole.TECHNICIAN, 32L, "Technician Minh");
        pen(11L, "A-01", ActiveStatus.ACTIVE);
        pen(12L, "B-01", ActiveStatus.INACTIVE);
        Breed brahman = new Breed();
        brahman.setId(21L);
        brahman.setName("Brahman");
        brahman.setAvailable(true);
        breeds.put(21L, brahman);
        purpose(61L, PurposeType.UNDECIDED);
        purpose(62L, PurposeType.BREEDING);

        doAnswer(inv -> {
            Object entity = inv.getArgument(0);
            if (ReflectionTestUtils.getField(entity, "id") == null) {
                ReflectionTestUtils.setField(entity, "id", nextId++);
            }
            if (entity instanceof ReproductionEvent e) {
                events.add(e);
            } else if (entity instanceof PregnancyEpisode p) {
                episodes.add(p);
            } else if (entity instanceof PregnancyUpdate u) {
                updates.add(u);
            } else if (entity instanceof CalvingEvent c) {
                calvings.add(c);
            } else if (entity instanceof CalfOutcome o) {
                calves.add(o);
            }
            return null;
        }).when(em).persist(any());

        jpql = new FakeJpql(em)
            // ---- CattleStateService
            .on("from HealthCase h join Treatment", p -> List.of(0L))
            .on("isSuspectedContagious", p -> List.of(0L))
            .on("from HealthCase h where h.id=:id", p -> healthCases.stream()
                .filter(h -> h.getId().equals(p.get("id")) && h.getCattle().getId().equals(p.get("cattle"))).toList())
            .on("from HealthCase h where h.cattle.id=:id", p -> List.of(healthCases.stream()
                .filter(h -> h.getCattle().getId().equals(p.get("id")) && "OPEN".equals(h.getStatus())).count()))
            .on("max(t.withdrawalEndDate) from Treatment", p -> Collections.singletonList(null))
            .on("max(v.withdrawalEndDate) from Vaccination", p -> Collections.singletonList(null))
            .on("from ScheduledDose d", p -> List.of(0L))
            .on("select g.weightKg from Growth g", p -> Optional.ofNullable(weights.get((Long) p.get("id"))).map(Growth::getWeightKg).stream().toList())
            .on("select g from Growth g", p -> Optional.ofNullable(weights.get((Long) p.get("id"))).stream().toList())
            .on("select p from FarmParameterVersion p", p -> parameters == null ? List.of() : List.of(parameterVersion()))
            .on("select p.gestationLengthDays from FarmParameterVersion p", p -> gestation == null ? List.of() : List.of(gestation))
            // ---- cattle, entry, members, catalogue
            .on("from HerdEntry e", p -> List.of(entryDate))
            .on("select c from Cattle c where c.id=:id and c.farm.id=:farm", p -> Optional.ofNullable(cattle.get((Long) p.get("id")))
                .filter(c -> c.getFarm().getId().equals(p.get("farm"))).stream().toList())
            .on("count(c) from Cattle c where c.farm.id=:farm", p -> List.of(cattle.values().stream()
                .filter(c -> ((String) p.get("tag")).equalsIgnoreCase(c.getDisplayCode()) || ((String) p.get("tag")).equalsIgnoreCase(c.getEarTagNumber())).count()))
            .on("count(t) from CattleQrTag t", p -> List.of(qrTags.stream().filter(t -> t.equalsIgnoreCase((String) p.get("tag"))).count()))
            .on("count(o) from CalfOutcome o", p -> List.of(calves.stream()
                .filter(o -> o.getTagCode() != null && o.getTagCode().equalsIgnoreCase((String) p.get("tag")) && "VALID".equals(o.getStatus()) && !o.getId().equals(p.get("id"))).count()))
            .on("from FarmMembership m", p -> memberships.stream().filter(m -> m.getUser().getId().equals(p.get("user"))).toList())
            .on("from Pen p where p.id=:id", p -> Optional.ofNullable(pens.get((Long) p.get("id"))).stream().toList())
            .on("from Breed b where b.id=:id", p -> Optional.ofNullable(breeds.get((Long) p.get("id"))).stream().toList())
            .on("from ProductionPurpose p where p.id=:id", p -> Optional.ofNullable(purposes.get((Long) p.get("id"))).stream().toList())
            .on("from ProductionPurpose p where p.farm.id=:farm and p.available=true", p -> purposes.values().stream()
                .filter(x -> Boolean.TRUE.equals(x.getAvailable()) && x.getPurposeType() == p.get("type")).sorted(Comparator.comparing(ProductionPurpose::getId)).toList())
            .on("from PenAssignment p join fetch p.pen", p -> placements)
            // ---- reproduction events
            .on("e.type=:type and upper(e.status)='VALID' and e.eventTime>:from", p -> validEvents((Long) p.get("c"))
                .filter(e -> e.getType().equals(p.get("type")) && e.getEventTime().isAfter((Instant) p.get("from")) && e.getEventTime().isBefore((Instant) p.get("to")))
                .sorted(Comparator.comparing(ReproductionEvent::getEventTime).reversed()).toList())
            .on("e.type=:type and upper(e.status)='VALID' order by", p -> validEvents((Long) p.get("id")).filter(e -> e.getType().equals(p.get("type")))
                .sorted(Comparator.comparing(ReproductionEvent::getEventTime).thenComparing(ReproductionEvent::getId).reversed()).toList())
            .on("from ReproductionEvent e where e.id=:id", p -> events.stream()
                .filter(e -> e.getId().equals(p.get("id")) && e.getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            .on("upper(e.status)='VALID' and e.eventTime>:birth", p -> validEvents((Long) p.get("c"))
                .filter(e -> e.getEventTime().isAfter((Instant) p.get("birth"))).sorted(Comparator.comparing(ReproductionEvent::getEventTime)).toList())
            .on("from ReproductionEvent e where e.cattle.id=:id and upper(e.status)='VALID' order by e.eventTime desc", p -> validEvents((Long) p.get("id"))
                .sorted(Comparator.comparing(ReproductionEvent::getEventTime).thenComparing(ReproductionEvent::getId).reversed()).toList())
            .on("from ReproductionEvent e where e.cattle.id=:id order by", p -> events.stream().filter(e -> e.getCattle().getId().equals(p.get("id")))
                .sorted(Comparator.comparing(ReproductionEvent::getEventTime).thenComparing(ReproductionEvent::getId)).toList())
            .on("from ReproductionEvent x where x.linkedEvent.id=:id", p -> events.stream()
                .filter(x -> x.getLinkedEvent() != null && x.getLinkedEvent().getId().equals(p.get("id")) && "VALID".equals(x.getStatus()))
                .sorted(Comparator.comparing(ReproductionEvent::getEventTime)).toList())
            // ---- pregnancies
            .on("select p.confirmingCheck.eventTime from PregnancyEpisode p", p -> episodesOf((Long) p.get("id")).filter(x -> "OPEN".equals(x.getStatus()))
                .sorted(Comparator.comparing(PregnancyEpisode::getId).reversed()).map(x -> x.getConfirmingCheck().getEventTime()).toList())
            .on("from PregnancyEpisode p where p.cattle.id=:id and upper(p.status)='OPEN'", p -> episodesOf((Long) p.get("id"))
                .filter(x -> "OPEN".equals(x.getStatus())).sorted(Comparator.comparing(PregnancyEpisode::getId).reversed()).toList())
            .on("from PregnancyEpisode p where p.cattle.id=:id order by", p -> episodesOf((Long) p.get("id")).sorted(Comparator.comparing(PregnancyEpisode::getId)).toList())
            .on("from PregnancyEpisode p where p.cattle.id=:c and p.id", p -> episodesOf((Long) p.get("c"))
                .filter(x -> x.getId() > (Long) p.get("id") && !"VOIDED".equals(x.getStatus())).toList())
            .on("from PregnancyEpisode p where p.linkedBreeding.id=:id", p -> episodes.stream()
                .filter(x -> x.getLinkedBreeding() != null && x.getLinkedBreeding().getId().equals(p.get("id")) && !"VOIDED".equals(x.getStatus())).toList())
            .on("from PregnancyEpisode p where p.confirmingCheck.id=:id", p -> episodes.stream()
                .filter(x -> x.getConfirmingCheck() != null && x.getConfirmingCheck().getId().equals(p.get("id")) && !"VOIDED".equals(x.getStatus())).toList())
            .on("from PregnancyEpisode p where p.id=:id", p -> episodes.stream()
                .filter(x -> x.getId().equals(p.get("id")) && x.getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            // ---- pregnancy updates
            .on("max(u.occurredTime) from PregnancyUpdate u", p -> Collections.singletonList(validUpdatesOfCow((Long) p.get("id"))
                .filter(u -> "LOSS".equals(u.getType())).map(PregnancyUpdate::getOccurredTime).max(Comparator.naturalOrder()).orElse(null)))
            .on("count(u) from PregnancyUpdate u where u.episode.cattle.id=:c", p -> List.of(validUpdatesOfCow((Long) p.get("c"))
                .filter(u -> "LOSS".equals(u.getType()) && u.getOccurredTime().isAfter((Instant) p.get("at"))).count()))
            .on("count(u) from PregnancyUpdate u where u.episode.id=:id and u.id<>:loss", p -> List.of(updates.stream()
                .filter(u -> u.getEpisode().getId().equals(p.get("id")) && !u.getId().equals(p.get("loss")) && "VALID".equals(u.getStatus()) && "LOSS".equals(u.getType())).count()))
            .on("from PregnancyUpdate u where u.episode.cattle.id=:id and upper(u.status)='VALID' order by u.occurredTime desc", p -> validUpdatesOfCow((Long) p.get("id"))
                .sorted(Comparator.comparing(PregnancyUpdate::getOccurredTime).thenComparing(PregnancyUpdate::getId).reversed()).toList())
            .on("from PregnancyUpdate u where u.episode.cattle.id=:id order by", p -> updates.stream()
                .filter(u -> u.getEpisode().getCattle().getId().equals(p.get("id"))).sorted(Comparator.comparing(PregnancyUpdate::getOccurredTime)).toList())
            .on("from PregnancyUpdate u where u.episode.id=:e and u.id<>:id", p -> updates.stream()
                .filter(u -> u.getEpisode().getId().equals(p.get("e")) && !u.getId().equals(p.get("id")) && "VALID".equals(u.getStatus())
                    && !u.getOccurredTime().isBefore((Instant) p.get("t"))).toList())
            .on("from PregnancyUpdate u where u.episode.id=:id", p -> updates.stream()
                .filter(u -> u.getEpisode().getId().equals(p.get("id")) && "VALID".equals(u.getStatus())).sorted(Comparator.comparing(PregnancyUpdate::getOccurredTime)).toList())
            .on("from PregnancyUpdate u where u.id=:id", p -> updates.stream()
                .filter(u -> u.getId().equals(p.get("id")) && u.getEpisode().getCattle().getFarm().getId().equals(p.get("farm"))).toList())
            // ---- calvings and calves
            .on("max(c.birthTime) from CalvingEvent c", p -> Collections.singletonList(maxBirth(p.containsKey("id") ? (Long) p.get("id") : (Long) p.get("c"))))
            .on("max(x.birthTime) from CalvingEvent x", p -> Collections.singletonList(maxBirth((Long) p.get("id"))))
            .on("count(c) from CalvingEvent c where c.dam.id=:c", p -> List.of(validCalvings((Long) p.get("c"))
                .filter(c -> c.getBirthTime().isAfter((Instant) p.get("at"))).count()))
            .on("count(c) from CalvingEvent c where c.dam.id=:dam and upper(c.status)='VALID' and c.birthTime>:from", p -> List.of(validCalvings((Long) p.get("dam"))
                .filter(c -> c.getBirthTime().isAfter((Instant) p.get("from")) && c.getBirthTime().isBefore((Instant) p.get("to")) && !c.getId().equals(p.get("id"))).count()))
            .on("count(c) from CalvingEvent c where c.dam.id=:dam", p -> List.of(validCalvings((Long) p.get("dam")).count()))
            .on("from CalvingEvent c where c.dam.id=:id and upper(c.status)='VALID' order by", p -> validCalvings((Long) p.get("id"))
                .sorted(Comparator.comparing(CalvingEvent::getBirthTime).thenComparing(CalvingEvent::getId).reversed()).toList())
            .on("from CalvingEvent c where c.dam.id=:id order by", p -> calvings.stream().filter(c -> c.getDam().getId().equals(p.get("id")))
                .sorted(Comparator.comparing(CalvingEvent::getBirthTime)).toList())
            .on("from CalvingEvent c where c.episode.id=", p -> calvings.stream().filter(c -> c.getEpisode() != null && "VALID".equals(c.getStatus())
                && c.getEpisode().getId().equals(p.containsKey("id") ? p.get("id") : p.get("e"))).toList())
            .on("from CalvingEvent c where c.id=:id", p -> calvings.stream()
                .filter(c -> c.getId().equals(p.get("id")) && c.getDam().getFarm().getId().equals(p.get("farm"))).toList())
            .on("from CalfOutcome o where o.calving.id=:id", p -> calves.stream().filter(o -> o.getCalving().getId().equals(p.get("id")))
                .sorted(Comparator.comparing(CalfOutcome::getCalfNo)).toList())
            .on("from CalfOutcome o where o.id=:id", p -> calves.stream()
                .filter(o -> o.getId().equals(p.get("id")) && o.getCalving().getDam().getFarm().getId().equals(p.get("farm"))).toList());
    }

    private FarmParameterVersion parameterVersion() {
        FarmParameterVersion v = new FarmParameterVersion();
        v.setFarm(farm);
        v.setEffectiveFrom(LocalDate.of(2024, 1, 1));
        v.setParameterValues(parameters);
        v.setGestationLengthDays(gestation);
        return v;
    }

    private Stream<ReproductionEvent> validEvents(Long cattleId) {
        return events.stream().filter(e -> e.getCattle().getId().equals(cattleId) && "VALID".equals(e.getStatus()));
    }

    private Stream<PregnancyEpisode> episodesOf(Long cattleId) {
        return episodes.stream().filter(x -> x.getCattle().getId().equals(cattleId));
    }

    private Stream<PregnancyUpdate> validUpdatesOfCow(Long cattleId) {
        return updates.stream().filter(u -> u.getEpisode().getCattle().getId().equals(cattleId) && "VALID".equals(u.getStatus()));
    }

    private Stream<CalvingEvent> validCalvings(Long damId) {
        return calvings.stream().filter(c -> c.getDam().getId().equals(damId) && "VALID".equals(c.getStatus()));
    }

    private Instant maxBirth(Long damId) {
        return validCalvings(damId).map(CalvingEvent::getBirthTime).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
    }

    // ------------------------------------------------------------------ builders

    private void user(FarmRole role, long id, String name) {
        AppUser u = new AppUser();
        u.setId(id);
        u.setFullName(name);
        users.put(role, u);
        FarmMembership m = new FarmMembership();
        m.setFarm(farm);
        m.setUser(u);
        m.setRole(role.name());
        m.setStatus("ACTIVE");
        memberships.add(m);
    }

    private void pen(long id, String code, ActiveStatus status) {
        Pen p = new Pen();
        p.setId(id);
        p.setCode(code);
        p.setName("Chuồng " + code);
        p.setStatus(status);
        pens.put(id, p);
    }

    private void purpose(long id, PurposeType type) {
        ProductionPurpose p = new ProductionPurpose();
        p.setId(id);
        p.setPurposeType(type);
        p.setAvailable(true);
        p.setName(type.name());
        purposes.put(id, p);
    }

    /** An ACTIVE cow of the farm, born on {@code birth}, with a VALID weight of 300 kg. */
    Cattle cow(long id, String code, PurposeType purpose, LocalDate birth) {
        Cattle c = animal(id, code, Sex.FEMALE, purpose);
        c.setBirthDate(birth);
        weigh(c, "300");
        return c;
    }

    Cattle animal(long id, String code, Sex sex, PurposeType purposeType) {
        ProductionPurpose p = new ProductionPurpose();
        p.setPurposeType(purposeType);
        Cattle c = new Cattle();
        c.setId(id);
        c.setDisplayCode(code);
        c.setFarm(farm);
        c.setSex(sex);
        c.setLifeStage(LifeStage.ADULT);
        c.setPurpose(p);
        c.setBreed(breeds.get(21L));
        c.setHerdStatus(HerdStatus.ACTIVE);
        c.setVersion(1);
        c.setBirthDate(LocalDate.of(2023, 1, 1));
        cattle.put(id, c);
        return c;
    }

    void weigh(Cattle c, String kg) {
        Growth g = new Growth();
        g.setCattle(c);
        g.setWeightKg(new BigDecimal(kg));
        g.setCheckDate(LocalDate.of(2026, 11, 1));
        g.setStatus("VALID");
        weights.put(c.getId(), g);
    }

    static Instant at(int year, int month, int day, int hour, int minute) {
        return LocalDate.of(year, month, day).atTime(hour, minute).toInstant(FARM_ZONE);
    }

    ReproductionEvent event(Cattle c, String type, Instant at) {
        ReproductionEvent e = new ReproductionEvent();
        e.setId(nextId++);
        e.setCattle(c);
        e.setType(type);
        e.setEventTime(at);
        e.setRecordedAt(at);
        e.setRecordedBy(users.get(FarmRole.MANAGER));
        e.setSource("DIRECT_OBSERVATION");
        e.setStatus("VALID");
        e.setVersion(1);
        events.add(e);
        return e;
    }

    ReproductionEvent breeding(Cattle c, Instant at, ReproductionEvent estrus) {
        ReproductionEvent e = event(c, "BREEDING", at);
        e.setResult("BRED");
        e.setMethod("AI");
        e.setSireSource("EXTERNAL");
        e.setExternalSireName("Red Angus");
        e.setLinkedEvent(estrus);
        e.setTentativeExpectedCalvingDate(LocalDate.ofInstant(at, FARM_ZONE).plusDays(283));
        return e;
    }

    ReproductionEvent check(Cattle c, Instant at, String result, ReproductionEvent breeding) {
        ReproductionEvent e = event(c, "PREGNANCY_CHECK", at);
        e.setResult(result);
        e.setLinkedEvent(breeding);
        return e;
    }

    PregnancyEpisode pregnancy(Cattle c, ReproductionEvent check, ReproductionEvent breeding, String status) {
        PregnancyEpisode p = new PregnancyEpisode();
        p.setId(nextId++);
        p.setCattle(c);
        p.setConfirmingCheck(check);
        p.setLinkedBreeding(breeding);
        p.setParity(1);
        p.setStatus(status);
        p.setVersion(1);
        if (breeding != null) {
            p.setExpectedCalvingDate(LocalDate.ofInstant(breeding.getEventTime(), FARM_ZONE).plusDays(283));
            p.setExpectedBasis("CONFIRMED");
        }
        episodes.add(p);
        return p;
    }

    PregnancyUpdate update(PregnancyEpisode episode, String type, Instant at) {
        PregnancyUpdate u = new PregnancyUpdate();
        u.setId(nextId++);
        u.setEpisode(episode);
        u.setType(type);
        u.setOccurredTime(at);
        u.setRecordedAt(at);
        u.setSource("DIRECT_OBSERVATION");
        u.setDetails("Theo dõi");
        u.setStatus("VALID");
        u.setVersion(1);
        updates.add(u);
        return u;
    }

    CalvingEvent calving(Cattle dam, PregnancyEpisode episode, Instant at) {
        CalvingEvent c = new CalvingEvent();
        c.setId(nextId++);
        c.setDam(dam);
        c.setEpisode(episode);
        c.setBirthTime(at);
        c.setSource("DIRECT_OBSERVATION");
        c.setStatus("VALID");
        c.setVersion(1);
        calvings.add(c);
        if (episode != null) {
            episode.setStatus("CALVED");
        }
        return c;
    }

    CalfOutcome calf(CalvingEvent calving, int no, String outcome, String registration) {
        CalfOutcome o = new CalfOutcome();
        o.setId(nextId++);
        o.setCalving(calving);
        o.setCalfNo(no);
        o.setOutcome(outcome);
        o.setSex("FEMALE");
        o.setRegistrationState(registration);
        o.setProposedPen(pens.get(11L));
        o.setStatus("VALID");
        o.setVersion(1);
        calves.add(o);
        return o;
    }

    HealthCase openCase(Cattle c) {
        HealthCase h = new HealthCase();
        h.setId(nextId++);
        h.setCattle(c);
        h.setStatus("OPEN");
        h.setCaseCode("HC-0009");
        healthCases.add(h);
        return h;
    }
}
