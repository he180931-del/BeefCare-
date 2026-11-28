package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.EstrusSign;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.EntryDtos;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/**
 * FE-11 (A3–A6) and FE-12 (A2–A8) commands. Events keep the occurrence and the recording metadata apart (GBR-49);
 * corrections never orphan or contradict later records (MSG-FE11-07, GBR-59). Decisions P1–P7: D36 in docs/REQUIREMENT_DECISIONS.md.
 */
@Service
public class ReproductionCommandService {
    static final Set<String> SOURCES = Set.of("DIRECT_OBSERVATION", "FARM_NOTEBOOK", "EXTERNAL_REPORT");
    static final Set<String> BREEDING_METHODS = Set.of("NATURAL", "AI");
    static final Set<String> CHECK_RESULTS = Set.of("PREGNANT", "NOT_PREGNANT", "INCONCLUSIVE");
    /** D67: OBSERVATION = xác nhận có thai bằng quan sát (không lên giống lại sau phối), cho trại không siêu âm. */
    static final Set<String> CHECK_METHODS = Set.of("ULTRASOUND", "RECTAL", "OBSERVATION", "OTHER");
    static final Set<String> UPDATE_TYPES = Set.of("OBSERVATION", "COMPLICATION", "LOSS");
    static final Set<String> COURSES = Set.of("NORMAL", "ASSISTED", "CAESAREAN");
    static final Set<String> DAM_CONDITIONS = Set.of("GOOD", "NEEDS_MONITORING", "CRITICAL");
    static final Duration DUPLICATE_WINDOW = Duration.ofHours(12);
    static final Duration LINKED_ESTRUS_WINDOW = Duration.ofHours(72);
    static final int MAX_CALVES = 4;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final CattleGuardService cattleGuard;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;
    private final RecordRevisionService revisions;
    private final FarmClock clock;
    private final PendingCalfService pendingCalves;
    private final EntryReminderService entryReminders;
    private final CattleStateService cattleState;
    private final ReproductionReminderService reminders;

    public ReproductionCommandService(FarmAccessService access, CattleGuardService cattleGuard, IdempotencyCommandService idempotency,
                                      AuditService audit, RecordRevisionService revisions, FarmClock clock,
                                      PendingCalfService pendingCalves, EntryReminderService entryReminders, CattleStateService cattleState,
                                      ReproductionReminderService reminders) {
        this.access = access; this.cattleGuard = cattleGuard; this.idempotency = idempotency; this.audit = audit;
        this.revisions = revisions; this.clock = clock; this.pendingCalves = pendingCalves; this.entryReminders = entryReminders;
        this.cattleState = cattleState; this.reminders = reminders;
    }

    // ------------------------------------------------------------------ FE-11 A3 estrus

    public ReproductionDtos.EventResult recordEstrus(Long farmId, Long cattleId, String key, ReproductionDtos.EstrusCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_ESTRUS", key, fingerprint("cattleId", cattleId, "request", req),
            ReproductionDtos.EventResult.class, () -> recordEstrusInCommand(farmId, cattleId, req));
    }

    @Transactional
    ReproductionDtos.EventResult recordEstrusInCommand(Long farmId, Long cattleId, ReproductionDtos.EstrusCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null) throw DomainException.required("observedAt");
        Cattle cattle = cattleGuard.lockWritable(farmId, cattleId);
        VersionGuard.requireExpected(cattle.getVersion(), req.expectedCattleVersion());
        assertTracked(cattle);
        assertNotPregnant(cattle);
        Instant at = eventTime(farmId, cattle, req.observedAt(), "observedAt");
        if (!Boolean.TRUE.equals(req.confirmDuplicate())) assertNoDuplicate(cattle, "ESTRUS", at, null, null);

        ReproductionEvent event = newEvent(ctx, cattle, "ESTRUS", at, req.dataSource());
        event.setResult("OBSERVED");
        event.setSigns(parseSigns(req.signs()));
        event.setDescription(optional(req.description(), "description", 1000));
        setObserver(farmId, ctx, event, req.observerId(), req.observerName());
        em.persist(event); em.flush();
        reminders.estrusRecorded(cattle, event);
        audit.log(ctx, "REPRODUCTION_ESTRUS_RECORD", "ReproductionEvent", event.getId(), Map.of("cattleId", cattle.getId(), "occurredAt", at.toString()));

        Integer startHours = parameter(farmId, "BREEDING_WINDOW_START_HOURS"), endHours = parameter(farmId, "BREEDING_WINDOW_END_HOURS");
        ReproductionDtos.Window window = startHours == null || endHours == null ? null
            : new ReproductionDtos.Window(at.plus(Duration.ofHours(startHours)), at.plus(Duration.ofHours(endHours)));
        String missing = startHours == null ? "BREEDING_WINDOW_START_HOURS" : endHours == null ? "BREEDING_WINDOW_END_HOURS" : null;
        return result(event, cattle, window, missing, null, null);
    }

    // ------------------------------------------------------------------ FE-11 A4 breeding

    public ReproductionDtos.EventResult recordBreeding(Long farmId, Long cattleId, String key, ReproductionDtos.BreedingCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_BREEDING", key, fingerprint("cattleId", cattleId, "request", req),
            ReproductionDtos.EventResult.class, () -> recordBreedingInCommand(farmId, cattleId, req));
    }

    @Transactional
    ReproductionDtos.EventResult recordBreedingInCommand(Long farmId, Long cattleId, ReproductionDtos.BreedingCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null) throw DomainException.required("bredAt");
        Cattle cattle = cattleGuard.lockWritable(farmId, cattleId);
        VersionGuard.requireExpected(cattle.getVersion(), req.expectedCattleVersion());
        assertTracked(cattle);
        assertNotPregnant(cattle);
        Instant at = eventTime(farmId, cattle, req.bredAt(), "bredAt");
        ReproductionEvent linked = linkedEstrus(farmId, cattle, req.linkedEstrusId(), at);
        if (!Boolean.TRUE.equals(req.confirmDuplicate())) assertNoDuplicate(cattle, "BREEDING", at, null, req.linkedEstrusId());

        ReproductionEvent event = newEvent(ctx, cattle, "BREEDING", at, req.dataSource());
        event.setResult("BRED");
        event.setMethod(breedingMethod(req.method()));
        setSire(farmId, cattle, event, req.sireSource(), req.sireCattleId(), req.sireBreedId(), req.sireBreed(), req.semenCode(), req.semenSupplier());
        setPerformer(farmId, event, req.performerId(), req.performerName());
        event.setDescription(optional(req.note(), "note", 500));
        event.setLinkedEvent(linked);
        Integer gestation = gestationDays(farmId, clock.toFarmDate(at));
        event.setTentativeExpectedCalvingDate(gestation == null ? null : clock.toFarmDate(at).plusDays(gestation));
        em.persist(event); em.flush();

        List<String> failed = cattleState.breedingCriteria(cattle, clock.today()).stream().filter(c -> !c.met()).map(CattleStateService.BreedingCriterion::name).toList();
        reminders.breedingRecorded(cattle, event);
        audit.log(ctx, "REPRODUCTION_BREEDING_RECORD", "ReproductionEvent", event.getId(), Map.of("cattleId", cattle.getId(), "occurredAt", at.toString()));
        return result(event, cattle, null, gestation == null ? "GESTATION_LENGTH_DAYS" : null,
            failed.isEmpty() ? null : new ReproductionDtos.EligibilityWarning(MessageCodes.FE11_09, failed), null);
    }

    // ------------------------------------------------------------------ FE-12 A2 pregnancy check

    public ReproductionDtos.EventResult recordPregnancyCheck(Long farmId, Long cattleId, String key, ReproductionDtos.PregnancyCheckCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_PREGNANCY_CHECK", key, fingerprint("cattleId", cattleId, "request", req),
            ReproductionDtos.EventResult.class, () -> recordPregnancyCheckInCommand(farmId, cattleId, req));
    }

    @Transactional
    ReproductionDtos.EventResult recordPregnancyCheckInCommand(Long farmId, Long cattleId, ReproductionDtos.PregnancyCheckCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null) throw DomainException.required("checkedAt");
        Cattle cattle = cattleGuard.lockWritable(farmId, cattleId);
        VersionGuard.requireExpected(cattle.getVersion(), req.expectedCattleVersion());
        assertFemaleForOtherActions(cattle);
        Instant at = eventTime(farmId, cattle, req.checkedAt(), "checkedAt");
        String result = checkResult(req.result());
        Integer months = estimatedMonths(result, req.estimatedMonths());
        ReproductionEvent linked = linkedBreeding(farmId, cattle, req.linkedBreedingId(), at);
        PregnancyEpisode open = openPregnancy(cattle.getId());
        assertCheckConsistent(cattle, open, result, at, linked);

        ReproductionEvent event = newEvent(ctx, cattle, "PREGNANCY_CHECK", at, req.dataSource());
        event.setResult(result);
        event.setMethod(checkMethod(req.method()));
        event.setEstMonthsPregnant(months);
        setExaminer(farmId, event, req.examinerId(), req.examinerName());
        event.setDescription(optional(req.note(), "note", 500));
        event.setLinkedEvent(linked);
        em.persist(event); em.flush();

        PregnancyEpisode episode = null;
        String missing = null;
        if ("PREGNANT".equals(result)) {
            Integer gestation = gestationDays(farmId, clock.toFarmDate(at));
            if (gestation == null) missing = "GESTATION_LENGTH_DAYS";
            if (open != null) {
                // AF2: an OPEN pregnancy is confirmed by this check; a linked breeding replaces an ESTIMATED date (R-12-03).
                episode = open;
                if (linked != null && open.getLinkedBreeding() == null) {
                    open.setLinkedBreeding(linked);
                    setExpected(open, cattle, linked, null, at, gestation);
                } else if (open.getExpectedCalvingDate() == null) {
                    setExpected(open, cattle, open.getLinkedBreeding(), months, at, gestation);
                }
            } else {
                episode = new PregnancyEpisode();
                episode.setCattle(cattle); episode.setConfirmingCheck(event); episode.setLinkedBreeding(linked);
                episode.setParity(nextParity(cattle)); episode.setStatus("OPEN");
                setExpected(episode, cattle, linked, months, at, gestation);
                em.persist(episode);
            }
            em.flush();
        }
        reminders.pregnancyCheckRecorded(cattle, event, episode);
        audit.log(ctx, "REPRODUCTION_PREGNANCY_CHECK_RECORD", "ReproductionEvent", event.getId(), Map.of("cattleId", cattle.getId(), "result", result));
        return result(event, cattle, null, missing, null, episode);
    }

    // ------------------------------------------------------------------ FE-12 A3 pregnancy update

    public ReproductionDtos.PregnancyUpdateResult updatePregnancy(Long farmId, Long episodeId, String key, ReproductionDtos.PregnancyUpdateCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "PREGNANCY_UPDATE", key, fingerprint("episodeId", episodeId, "request", req),
            ReproductionDtos.PregnancyUpdateResult.class, () -> updatePregnancyInCommand(farmId, episodeId, req));
    }

    @Transactional
    ReproductionDtos.PregnancyUpdateResult updatePregnancyInCommand(Long farmId, Long episodeId, ReproductionDtos.PregnancyUpdateCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null) throw DomainException.required("type");
        PregnancyEpisode episode = episode(farmId, episodeId);
        Cattle cattle = cattleGuard.lockWritable(farmId, episode.getCattle().getId());
        VersionGuard.requireExpected(episode.getVersion(), req.expectedEpisodeVersion());
        if (!"OPEN".equalsIgnoreCase(episode.getStatus())) throw DomainException.conflict(MessageCodes.FE12_12, "dam_code", cattle.getDisplayCode());
        String type = updateType(req.type());
        Instant at = eventTime(farmId, cattle, req.occurredAt(), "occurredAt");
        assertNotBeforeConfirmingCheck(cattle, episode, at, "occurredAt");
        PregnancyUpdate update = new PregnancyUpdate();
        update.setEpisode(episode); update.setOccurredTime(at); update.setRecordedAt(clock.now()); update.setRecordedBy(ctx.user());
        update.setSource(dataSource(req.dataSource())); update.setType(type);
        update.setDetails(required(req.details(), "details", 1000));
        update.setHealthCase(healthCase(farmId, cattle, type, req.healthCaseId()));
        em.persist(update);
        if ("LOSS".equals(type)) closeAsLost(episode, at);
        em.flush();
        audit.log(ctx, "PREGNANCY_UPDATE_RECORD", "PregnancyUpdate", update.getId(), Map.of("episodeId", episodeId, "type", type));
        return updateResult(update, cattle);
    }

    // ------------------------------------------------------------------ FE-12 A4 calving

    public ReproductionDtos.CalvingResult recordCalving(Long farmId, String key, ReproductionDtos.CalvingCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALVING_RECORD", key, req,
            ReproductionDtos.CalvingResult.class, () -> recordCalvingInCommand(farmId, req));
    }

    @Transactional
    ReproductionDtos.CalvingResult recordCalvingInCommand(Long farmId, ReproductionDtos.CalvingCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null || req.damId() == null) throw DomainException.required("damId");
        Cattle dam = cattleGuard.lockWritable(farmId, req.damId());
        VersionGuard.requireExpected(dam.getVersion(), req.expectedCattleVersion());
        assertFemaleForOtherActions(dam);
        Instant birth = eventTime(farmId, dam, req.birthAt(), "birthAt");
        List<ReproductionDtos.CalfCommand> calves = req.calves() == null ? List.of() : req.calves();
        if (calves.isEmpty()) throw DomainException.unprocessable(MessageCodes.FE12_06, "field", "calves");
        if (calves.size() > MAX_CALVES) throw DomainException.invalid("calves");

        PregnancyEpisode episode = null;
        if (Boolean.TRUE.equals(req.noTrackedPregnancy())) {
            if (req.episodeId() != null) throw DomainException.invalid("episodeId");
        } else if (req.episodeId() != null) {
            episode = episode(farmId, req.episodeId());
            if (!episode.getCattle().getId().equals(dam.getId())) throw DomainException.notFound(MessageCodes.COM_08, "episodeId", req.episodeId());
            VersionGuard.requireExpected(episode.getVersion(), req.expectedEpisodeVersion());
        } else {
            episode = openPregnancy(dam.getId());
            if (episode != null && req.expectedEpisodeVersion() != null) VersionGuard.check(episode.getVersion(), req.expectedEpisodeVersion());
        }
        if (episode != null) {
            if (!"OPEN".equalsIgnoreCase(episode.getStatus())) throw DomainException.conflict(MessageCodes.FE12_12, "dam_code", dam.getDisplayCode());
            assertNotBeforeConfirmingCheck(dam, episode, birth, "birthAt");
        }
        assertNoCalvingWithin30Days(dam, birth, null);

        CalvingEvent calving = new CalvingEvent();
        calving.setDam(dam); calving.setEpisode(episode); calving.setBirthTime(birth); calving.setSource(dataSource(req.dataSource()));
        calving.setCourse(optionalEnum(req.course(), COURSES, "course"));
        calving.setDamCondition(optionalEnum(req.damCondition(), DAM_CONDITIONS, "damCondition"));
        calving.setRetainedPlacenta(Boolean.TRUE.equals(req.retainedPlacenta()));
        setAttendant(farmId, calving, req.attendantId(), req.attendantName());
        calving.setRecordedAt(clock.now()); calving.setRecordedBy(ctx.user());

        // R-12-07: every calf is validated before anything is written.
        Set<String> tagsInRequest = new HashSet<>();
        List<CalfOutcome> made = new ArrayList<>();
        List<Boolean> registerNow = new ArrayList<>();
        for (int i = 0; i < calves.size(); i++) {
            ReproductionDtos.CalfCommand command = calves.get(i);
            CalfOutcome calf = newCalf(farmId, calving, dam, command, i, tagsInRequest);
            made.add(calf);
            registerNow.add("LIVE".equals(calf.getOutcome()) && "REGISTER_NOW".equals(registration(command.registration(), i)));
        }
        em.persist(calving);
        made.forEach(em::persist);
        em.flush();
        if (episode != null) { episode.setStatus("CALVED"); episode.setClosedDate(clock.toFarmDate(birth)); episode.setCloseReason("CALVED"); }
        reminders.calvingRecorded(dam, calving.getId(), birth);
        em.flush();

        List<ReproductionDtos.CalfResult> results = new ArrayList<>();
        for (int i = 0; i < made.size(); i++) {
            CalfOutcome calf = made.get(i);
            if (registerNow.get(i)) {
                // GBR-58 / Q3 / Q5: registration posts a FARM_BORN voucher (FE-06); a calf without a tag gets a code at posting.
                EntryDtos.RegisteredCalf registered = pendingCalves.registerCalfNow(farmId, calf.getId(), calf.getProposedPen().getId(), calf.getProposedPurpose().getId());
                em.flush();
                results.add(new ReproductionDtos.CalfResult(calf.getId(), calf.getCalfNo(), calf.getOutcome(), calf.getRegistrationState(),
                    registered.cattleId(), registered.cattleCode(), registered.voucherCode(), calf.getTagCode(), calf.getStatus(), calf.getVersion()));
            } else {
                if ("LIVE".equals(calf.getOutcome())) entryReminders.raiseCalfReminder(calf, dam);
                results.add(calfResult(calf, null));
            }
        }
        audit.log(ctx, "CALVING_RECORD", "CalvingEvent", calving.getId(), Map.of("damId", dam.getId(), "calfCount", calves.size()));
        return new ReproductionDtos.CalvingResult(calving.getId(), calving.getStatus(), calving.getVersion(), episode == null ? null : episode.getId(),
            results, reproStatus(dam));
    }

    private CalfOutcome newCalf(Long farmId, CalvingEvent calving, Cattle dam, ReproductionDtos.CalfCommand req, int i, Set<String> tagsInRequest) {
        String at = "calves[" + i + "].";
        if (req == null) throw requiredAt(at + "outcome", i);
        String outcome = normalize(req.outcome());
        if (outcome.isEmpty()) throw requiredAt(at + "outcome", i);
        if (!Set.of("LIVE", "STILLBORN").contains(outcome)) throw invalidAt(at + "outcome", i);
        boolean live = "LIVE".equals(outcome);
        String sex = req.sex() == null || req.sex().isBlank() ? null : normalize(req.sex());
        if (sex != null && !(live ? Set.of("MALE", "FEMALE") : Set.of("MALE", "FEMALE", "UNKNOWN")).contains(sex)) throw invalidAt(at + "sex", i);
        CalfOutcome calf = new CalfOutcome();
        calf.setCalving(calving); calf.setCalfNo(i + 1); calf.setOutcome(outcome); calf.setSex(sex);
        setWeight(calf, req.birthWeightKg(), req.weightBasis(), at, i);
        if (!live) { calf.setRegistrationState("NOT_REQUIRED"); return calf; }

        String registration = registration(req.registration(), i);
        if ("REGISTER_NOW".equals(registration) && sex == null) throw requiredAt(at + "sex", i);
        String tag = optional(req.tagCode(), at + "tagCode", 50);
        if (tag != null) {
            if (!tagsInRequest.add(tag.toLowerCase(Locale.ROOT))) throw tagUsed(tag, at + "tagCode", i);
            assertTagFree(farmId, tag, null, at + "tagCode", i);
        }
        calf.setTagCode(tag);
        if (req.penId() == null) throw requiredAt(at + "penId", i);
        Pen pen = em.createQuery("select p from Pen p where p.id=:id and p.farm.id=:farm", Pen.class).setParameter("id", req.penId()).setParameter("farm", farmId)
            .getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", at + "penId"));
        if (pen.getStatus() == null || !"ACTIVE".equals(pen.getStatus().name()))
            throw DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", pen.getCode(), "count", 1, "free", 0, "field", at + "penId", "calf", i);
        calf.setProposedPen(pen);
        Breed breed = req.breedId() == null ? dam.getBreed() : em.createQuery("select b from Breed b where b.id=:id and b.farm.id=:farm", Breed.class)
            .setParameter("id", req.breedId()).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", at + "breedId"));
        if (req.breedId() != null && !Boolean.TRUE.equals(breed.getAvailable())) throw invalidAt(at + "breedId", i);
        calf.setBreed(breed);
        if ("REGISTER_NOW".equals(registration)) {
            ProductionPurpose purpose = req.purposeId() != null
                ? em.createQuery("select p from ProductionPurpose p where p.id=:id and p.farm.id=:farm", ProductionPurpose.class)
                    .setParameter("id", req.purposeId()).setParameter("farm", farmId).getResultStream().findFirst()
                    .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", at + "purposeId"))
                : em.createQuery("select p from ProductionPurpose p where p.farm.id=:farm and p.available=true and p.purposeType=:type order by p.id", ProductionPurpose.class)
                    .setParameter("farm", farmId).setParameter("type", PurposeType.UNDECIDED).setMaxResults(1).getResultStream().findFirst()
                    .orElseThrow(() -> requiredAt(at + "purposeId", i));
            if (!Boolean.TRUE.equals(purpose.getAvailable())) throw invalidAt(at + "purposeId", i);
            if ((purpose.getPurposeType() == PurposeType.SIRE && "FEMALE".equals(sex)) || (purpose.getPurposeType() == PurposeType.BREEDING && "MALE".equals(sex)))
                throw DomainException.unprocessable(HerdEntryCodes.FE05_12, "field", at + "purposeId", "calf", i);
            calf.setProposedPurpose(purpose);
        } else if (req.purposeId() != null) {
            calf.setProposedPurpose(em.createQuery("select p from ProductionPurpose p where p.id=:id and p.farm.id=:farm", ProductionPurpose.class)
                .setParameter("id", req.purposeId()).setParameter("farm", farmId).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", at + "purposeId")));
        }
        calf.setRegistrationState("PENDING_CONFIRMATION");
        return calf;
    }

    // ------------------------------------------------------------------ FE-11 A5 / FE-12 A5 correct event

    public ReproductionDtos.EventResult correctEvent(Long farmId, Long eventId, String key, ReproductionDtos.CorrectEvent req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_EVENT_CORRECT", key, fingerprint("eventId", eventId, "request", req),
            ReproductionDtos.EventResult.class, () -> correctEventInCommand(farmId, eventId, req));
    }

    @Transactional
    ReproductionDtos.EventResult correctEventInCommand(Long farmId, Long eventId, ReproductionDtos.CorrectEvent req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        ReproductionEvent event = event(farmId, eventId);
        Cattle cattle = cattleGuard.lockCattle(farmId, event.getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(event.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(event.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = eventSnapshot(event);
        String type = event.getType();
        Instant at = req.occurredAt() == null ? event.getEventTime() : eventTime(farmId, cattle, req.occurredAt(), "occurredAt");
        PregnancyEpisode confirmed = confirmedEpisode(event);

        if (req.dataSource() != null) event.setSource(dataSource(req.dataSource()));
        switch (type) {
            case "ESTRUS" -> {
                // An estrus cannot move after a breeding that links it (R-11-11).
                List<ReproductionDtos.Dependent> later = linkedEvents(event).stream().filter(e -> e.getEventTime().isBefore(at)).map(this::dependent).toList();
                if (!later.isEmpty()) throw dependents(later);
                if (req.signs() != null) event.setSigns(parseSigns(req.signs()));
                if (req.description() != null) event.setDescription(optional(req.description(), "description", 1000));
                if (req.observerId() != null || req.observerName() != null) setObserver(farmId, ctx, event, req.observerId(), req.observerName());
            }
            case "BREEDING" -> {
                ReproductionEvent linked = Boolean.TRUE.equals(req.unlinkEvent()) ? null
                    : req.linkedEventId() != null ? linkedEstrus(farmId, cattle, req.linkedEventId(), at) : event.getLinkedEvent();
                if (linked != null && at.isBefore(linked.getEventTime())) throw beforeLinked("động dục", linked.getEventTime(), cattle, "occurredAt");
                List<ReproductionDtos.Dependent> later = linkedEvents(event).stream().filter(e -> e.getEventTime().isBefore(at)).map(this::dependent).toList();
                if (!later.isEmpty()) throw dependents(later);
                boolean sireChange = req.sireSource() != null || req.sireCattleId() != null || req.sireBreedId() != null || req.sireBreed() != null;
                if (sireChange) {
                    List<ReproductionDtos.Dependent> calves = registeredCalvesOfBreeding(event);
                    if (!calves.isEmpty()) throw dependents(calves);
                    event.setSire(null); event.setSireBreed(null); event.setExternalSireName(null);
                    setSire(farmId, cattle, event, req.sireSource() == null ? event.getSireSource() : req.sireSource(), req.sireCattleId(), req.sireBreedId(), req.sireBreed(),
                        req.semenCode() == null ? event.getSemenBatch() : req.semenCode(), req.semenSupplier() == null ? event.getSupplier() : req.semenSupplier());
                } else {
                    if (req.semenCode() != null) event.setSemenBatch(optional(req.semenCode(), "semenCode", 50));
                    if (req.semenSupplier() != null) event.setSupplier(optional(req.semenSupplier(), "semenSupplier", 100));
                }
                if (req.method() != null) event.setMethod(breedingMethod(req.method()));
                if (req.performerId() != null || req.performerName() != null) setPerformer(farmId, event, req.performerId(), req.performerName());
                if (req.note() != null) event.setDescription(optional(req.note(), "note", 500));
                event.setLinkedEvent(linked);
                Integer gestation = gestationDays(farmId, clock.toFarmDate(at));
                event.setTentativeExpectedCalvingDate(gestation == null ? null : clock.toFarmDate(at).plusDays(gestation));
                for (PregnancyEpisode p : episodesLinkedTo(event)) if ("OPEN".equalsIgnoreCase(p.getStatus())) setExpected(p, cattle, event, null, at, gestation);
            }
            case "PREGNANCY_CHECK" -> {
                ReproductionEvent linked = Boolean.TRUE.equals(req.unlinkEvent()) ? null
                    : req.linkedEventId() != null ? linkedBreeding(farmId, cattle, req.linkedEventId(), at) : event.getLinkedEvent();
                if (linked != null && at.isBefore(linked.getEventTime())) throw beforeLinked("lần phối", linked.getEventTime(), cattle, "occurredAt");
                String result = req.result() == null ? event.getResult() : checkResult(req.result());
                Integer months = req.estimatedMonths() == null ? ("PREGNANT".equals(result) ? event.getEstMonthsPregnant() : null) : estimatedMonths(result, req.estimatedMonths());
                if (confirmed != null) {
                    List<ReproductionDtos.Dependent> later = episodeDependents(confirmed);
                    boolean relinked = !Objects.equals(event.getLinkedEvent() == null ? null : event.getLinkedEvent().getId(), linked == null ? null : linked.getId());
                    boolean contradicts = relinked || !"PREGNANT".equals(result) || later.stream().anyMatch(d -> d.at() != null && d.at().isBefore(at));
                    if (contradicts && !later.isEmpty()) throw dependents(later);
                    if (!"PREGNANT".equals(result)) voidEpisode(confirmed, "CONFIRMING_CHECK_CORRECTED"); // R-12-16
                } else if ("PREGNANT".equals(result) && !"PREGNANT".equals(event.getResult())) {
                    PregnancyEpisode open = openPregnancy(cattle.getId());
                    assertCheckConsistent(cattle, open, result, at, linked);
                    if (open == null) {
                        PregnancyEpisode episode = new PregnancyEpisode();
                        episode.setCattle(cattle); episode.setConfirmingCheck(event); episode.setLinkedBreeding(linked);
                        episode.setParity(nextParity(cattle)); episode.setStatus("OPEN");
                        em.persist(episode); confirmed = episode;
                    } else confirmed = open;
                }
                event.setResult(result); event.setEstMonthsPregnant(months); event.setLinkedEvent(linked);
                if (req.method() != null) event.setMethod(checkMethod(req.method()));
                if (req.examinerId() != null || req.examinerName() != null) setExaminer(farmId, event, req.examinerId(), req.examinerName());
                if (req.note() != null) event.setDescription(optional(req.note(), "note", 500));
                if (confirmed != null && "OPEN".equalsIgnoreCase(confirmed.getStatus()) && "PREGNANT".equals(result)) {
                    if (confirmed.getConfirmingCheck() != null && confirmed.getConfirmingCheck().getId().equals(event.getId())) confirmed.setLinkedBreeding(linked);
                    setExpected(confirmed, cattle, confirmed.getLinkedBreeding(), months, at, gestationDays(farmId, clock.toFarmDate(at)));
                }
            }
            default -> throw DomainException.invalid("type");
        }
        event.setEventTime(at);
        event.setCorrected(true); event.setUpdatedAt(clock.now()); em.flush();
        reminders.eventCorrected(cattle, event, confirmed);
        revisions.recordWithOptionalNote(ctx, "ReproductionEvent", eventId, RecordRevisionService.CORRECT, reason, before, eventSnapshot(event));
        audit.log(ctx, "REPRODUCTION_EVENT_CORRECT", "ReproductionEvent", eventId, Map.of("cattleId", cattle.getId()));
        return result(event, cattle, null, null, null, confirmed);
    }

    // ------------------------------------------------------------------ FE-11 A6 / FE-12 A5 void event

    public ReproductionDtos.EventResult voidEvent(Long farmId, Long eventId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_EVENT_VOID", key, fingerprint("eventId", eventId, "request", req),
            ReproductionDtos.EventResult.class, () -> voidEventInCommand(farmId, eventId, req));
    }

    @Transactional
    ReproductionDtos.EventResult voidEventInCommand(Long farmId, Long eventId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        ReproductionEvent event = event(farmId, eventId);
        Cattle cattle = cattleGuard.lockCattle(farmId, event.getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(event.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(event.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        List<ReproductionDtos.Dependent> blocking = new ArrayList<>(linkedEvents(event).stream().map(this::dependent).toList());
        for (PregnancyEpisode p : episodesLinkedTo(event)) if (!"VOIDED".equalsIgnoreCase(p.getStatus())) blocking.add(new ReproductionDtos.Dependent("PREGNANCY", p.getId(), null));
        PregnancyEpisode confirmed = confirmedEpisode(event);
        if (confirmed != null) blocking.addAll(episodeDependents(confirmed));
        if (!blocking.isEmpty()) throw dependents(blocking);
        Map<String, Object> before = eventSnapshot(event);
        event.setStatus("VOIDED"); event.setStatusReason(reason); event.setUpdatedAt(clock.now());
        if (confirmed != null) voidEpisode(confirmed, "CONFIRMING_CHECK_VOIDED"); // R-12-16, TC-12-21
        reminders.eventVoided(cattle, event);
        em.flush();
        revisions.recordWithOptionalNote(ctx, "ReproductionEvent", eventId, RecordRevisionService.VOID, reason, before, eventSnapshot(event));
        audit.log(ctx, "REPRODUCTION_EVENT_VOID", "ReproductionEvent", eventId, Map.of("cattleId", cattle.getId()));
        return result(event, cattle, null, null, null, confirmed);
    }

    // ------------------------------------------------------------------ FE-12 A6 pregnancy update correction / void

    public ReproductionDtos.PregnancyUpdateResult correctPregnancyUpdate(Long farmId, Long updateId, String key, ReproductionDtos.CorrectPregnancyUpdate req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "PREGNANCY_UPDATE_CORRECT", key, fingerprint("updateId", updateId, "request", req),
            ReproductionDtos.PregnancyUpdateResult.class, () -> correctPregnancyUpdateInCommand(farmId, updateId, req));
    }

    @Transactional
    ReproductionDtos.PregnancyUpdateResult correctPregnancyUpdateInCommand(Long farmId, Long updateId, ReproductionDtos.CorrectPregnancyUpdate req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        PregnancyUpdate update = pregnancyUpdate(farmId, updateId);
        PregnancyEpisode episode = update.getEpisode();
        Cattle cattle = cattleGuard.lockCattle(farmId, episode.getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(update.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(update.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = pregnancyUpdateSnapshot(update);
        String type = req.type() == null ? update.getType() : updateType(req.type());
        Instant at = req.occurredAt() == null ? update.getOccurredTime() : eventTime(farmId, cattle, req.occurredAt(), "occurredAt");
        assertNotBeforeConfirmingCheck(cattle, episode, at, "occurredAt");
        boolean wasLoss = "LOSS".equalsIgnoreCase(update.getType()), isLoss = "LOSS".equals(type);
        if (wasLoss != isLoss || !at.equals(update.getOccurredTime())) {
            // Moving or re-typing an update must not contradict a later update or the calving of the pregnancy.
            List<ReproductionDtos.Dependent> later = laterUpdatesAndCalvings(episode, update, isLoss ? at : null);
            if (!later.isEmpty()) throw dependents(later);
        }
        if (wasLoss && !isLoss) reopenAfterLossVoided(episode, update.getId(), true);
        else if (!wasLoss && isLoss) closeAsLost(episode, at);
        else if (isLoss) episode.setClosedDate(clock.toFarmDate(at));
        update.setType(type); update.setOccurredTime(at);
        if (req.dataSource() != null) update.setSource(dataSource(req.dataSource()));
        if (req.details() != null) update.setDetails(required(req.details(), "details", 1000));
        if (Boolean.TRUE.equals(req.unlinkHealthCase())) update.setHealthCase(null);
        else if (req.healthCaseId() != null) update.setHealthCase(healthCase(farmId, cattle, type, req.healthCaseId()));
        if (!"COMPLICATION".equals(type)) update.setHealthCase(null);
        update.setCorrected(Boolean.TRUE);
        em.flush();
        revisions.recordWithOptionalNote(ctx, "PregnancyUpdate", updateId, RecordRevisionService.CORRECT, reason, before, pregnancyUpdateSnapshot(update));
        audit.log(ctx, "PREGNANCY_UPDATE_CORRECT", "PregnancyUpdate", updateId, Map.of("episodeId", episode.getId()));
        return updateResult(update, cattle);
    }

    public ReproductionDtos.PregnancyUpdateResult voidPregnancyUpdate(Long farmId, Long updateId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "PREGNANCY_UPDATE_VOID", key, fingerprint("updateId", updateId, "request", req),
            ReproductionDtos.PregnancyUpdateResult.class, () -> voidPregnancyUpdateInCommand(farmId, updateId, req));
    }

    @Transactional
    ReproductionDtos.PregnancyUpdateResult voidPregnancyUpdateInCommand(Long farmId, Long updateId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        PregnancyUpdate update = pregnancyUpdate(farmId, updateId);
        Cattle cattle = cattleGuard.lockCattle(farmId, update.getEpisode().getCattle().getId());
        cattleGuard.assertActive(cattle);
        VersionGuard.requireExpected(update.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(update.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = pregnancyUpdateSnapshot(update);
        update.setStatus("VOIDED"); update.setStatusReason(reason);
        // R-12-15 / TC-12-25: voiding a loss reopens the pregnancy only when no newer pregnancy exists.
        if ("LOSS".equalsIgnoreCase(update.getType())) reopenAfterLossVoided(update.getEpisode(), update.getId(), false);
        em.flush();
        revisions.recordWithOptionalNote(ctx, "PregnancyUpdate", updateId, RecordRevisionService.VOID, reason, before, pregnancyUpdateSnapshot(update));
        audit.log(ctx, "PREGNANCY_UPDATE_VOID", "PregnancyUpdate", updateId, Map.of("episodeId", update.getEpisode().getId()));
        return updateResult(update, cattle);
    }

    // ------------------------------------------------------------------ FE-12 A7 calving correction / void

    public ReproductionDtos.CalvingResult correctCalving(Long farmId, Long calvingId, String key, ReproductionDtos.CorrectCalving req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALVING_CORRECT", key, fingerprint("calvingId", calvingId, "request", req),
            ReproductionDtos.CalvingResult.class, () -> correctCalvingInCommand(farmId, calvingId, req));
    }

    @Transactional
    ReproductionDtos.CalvingResult correctCalvingInCommand(Long farmId, Long calvingId, ReproductionDtos.CorrectCalving req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalvingEvent calving = calving(farmId, calvingId);
        Cattle dam = cattleGuard.lockCattle(farmId, calving.getDam().getId());
        cattleGuard.assertActive(dam);
        VersionGuard.requireExpected(calving.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(calving.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String, Object> before = calvingSnapshot(calving);
        if (req.birthAt() != null && !req.birthAt().equals(calving.getBirthTime())) {
            Instant birth = eventTime(farmId, dam, req.birthAt(), "birthAt");
            // A registered calf's entry and birth dates come from this time (GBR-31).
            List<ReproductionDtos.Dependent> registered = registeredCalves(calving);
            if (!registered.isEmpty()) throw dependents(registered);
            if (calving.getEpisode() != null) assertNotBeforeConfirmingCheck(dam, calving.getEpisode(), birth, "birthAt");
            assertNoCalvingWithin30Days(dam, birth, calving.getId());
            calving.setBirthTime(birth);
            if (calving.getEpisode() != null) calving.getEpisode().setClosedDate(clock.toFarmDate(birth));
        }
        if (req.dataSource() != null) calving.setSource(dataSource(req.dataSource()));
        if (req.course() != null) calving.setCourse(optionalEnum(req.course(), COURSES, "course"));
        if (req.damCondition() != null) calving.setDamCondition(optionalEnum(req.damCondition(), DAM_CONDITIONS, "damCondition"));
        if (req.retainedPlacenta() != null) calving.setRetainedPlacenta(req.retainedPlacenta());
        if (req.attendantId() != null || req.attendantName() != null) setAttendant(farmId, calving, req.attendantId(), req.attendantName());
        calving.setCorrected(Boolean.TRUE); em.flush();
        reminders.calvingCorrected(dam, calving.getId(), calving.getBirthTime());
        em.flush();
        revisions.recordWithOptionalNote(ctx, "CalvingEvent", calvingId, RecordRevisionService.CORRECT, reason, before, calvingSnapshot(calving));
        audit.log(ctx, "CALVING_CORRECT", "CalvingEvent", calvingId, Map.of("damId", dam.getId()));
        return calvingResult(calving, dam);
    }

    public ReproductionDtos.CalvingResult voidCalving(Long farmId, Long calvingId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALVING_VOID", key, fingerprint("calvingId", calvingId, "request", req),
            ReproductionDtos.CalvingResult.class, () -> voidCalvingInCommand(farmId, calvingId, req));
    }

    @Transactional
    ReproductionDtos.CalvingResult voidCalvingInCommand(Long farmId, Long calvingId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalvingEvent calving = calving(farmId, calvingId);
        Cattle dam = cattleGuard.lockCattle(farmId, calving.getDam().getId());
        cattleGuard.assertActive(dam);
        VersionGuard.requireExpected(calving.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(calving.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        List<ReproductionDtos.Dependent> blocking = new ArrayList<>(registeredCalves(calving)); // TC-12-22
        if (calving.getEpisode() != null) {
            // Reopening the pregnancy must not contradict reproduction recorded after the birth.
            em.createQuery("select e from ReproductionEvent e where e.cattle.id=:c and upper(e.status)='VALID' and e.eventTime>:birth order by e.eventTime", ReproductionEvent.class)
                .setParameter("c", dam.getId()).setParameter("birth", calving.getBirthTime()).getResultList().forEach(e -> blocking.add(dependent(e)));
            em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:c and p.id<>:id and p.id>:id and upper(p.status)<>'VOIDED'", PregnancyEpisode.class)
                .setParameter("c", dam.getId()).setParameter("id", calving.getEpisode().getId()).getResultList()
                .forEach(p -> blocking.add(new ReproductionDtos.Dependent("PREGNANCY", p.getId(), null)));
        }
        if (!blocking.isEmpty()) throw dependents(blocking);
        Map<String, Object> before = calvingSnapshot(calving);
        List<CalfOutcome> outcomes = calves(calving.getId());
        for (CalfOutcome calf : outcomes) {
            if (!"VALID".equalsIgnoreCase(calf.getStatus())) continue;
            Map<String, Object> calfBefore = calfSnapshot(calf);
            calf.setStatus("VOIDED"); calf.setStatusReason(reason); entryReminders.cancelCalfReminder(calf); // R-12-16, TC-12-23
            em.flush();
            revisions.recordWithOptionalNote(ctx, "CalfOutcome", calf.getId(), RecordRevisionService.VOID, reason, calfBefore, calfSnapshot(calf));
        }
        calving.setStatus("VOIDED"); calving.setStatusReason(reason);
        PregnancyEpisode episode = calving.getEpisode();
        if (episode != null) {
            episode.setStatus("OPEN"); episode.setClosedDate(null); episode.setCloseReason(null);
        }
        reminders.calvingVoided(dam, calvingId, episode);
        em.flush();
        revisions.recordWithOptionalNote(ctx, "CalvingEvent", calvingId, RecordRevisionService.VOID, reason, before, calvingSnapshot(calving));
        audit.log(ctx, "CALVING_VOID", "CalvingEvent", calvingId, Map.of("damId", dam.getId(), "calfCount", outcomes.size()));
        return calvingResult(calving, dam);
    }

    // ------------------------------------------------------------------ FE-12 A8 calf outcome correction / void

    public ReproductionDtos.CalfResult correctCalf(Long farmId, Long calfId, String key, ReproductionDtos.CorrectCalf req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALF_OUTCOME_CORRECT", key, fingerprint("calfId", calfId, "request", req),
            ReproductionDtos.CalfResult.class, () -> correctCalfInCommand(farmId, calfId, req));
    }

    @Transactional
    ReproductionDtos.CalfResult correctCalfInCommand(Long farmId, Long calfId, ReproductionDtos.CorrectCalf req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalfOutcome calf = calf(farmId, calfId);
        Cattle dam = cattleGuard.lockCattle(farmId, calf.getCalving().getDam().getId());
        cattleGuard.assertActive(dam);
        VersionGuard.requireExpected(calf.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(calf.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        // R-12-15 / TC-12-24: the data of a registered calf belongs to its cattle record now.
        if ("REGISTERED".equalsIgnoreCase(calf.getRegistrationState())) throw dependents(List.of(registeredDependent(calf)));
        Map<String, Object> before = calfSnapshot(calf);
        String outcome = req.outcome() == null ? calf.getOutcome() : normalize(req.outcome());
        if (!Set.of("LIVE", "STILLBORN").contains(outcome)) throw DomainException.invalid("outcome");
        if ("DIED_BEFORE_REGISTRATION".equalsIgnoreCase(calf.getRegistrationState()) && "STILLBORN".equals(outcome))
            throw DomainException.invalid("outcome"); // R-12-13: a live calf that died later stays LIVE
        String sex = req.sex() == null ? calf.getSex() : (req.sex().isBlank() ? null : normalize(req.sex()));
        boolean live = "LIVE".equals(outcome);
        if (sex != null && !(live ? Set.of("MALE", "FEMALE") : Set.of("MALE", "FEMALE", "UNKNOWN")).contains(sex)) throw DomainException.invalid("sex");
        calf.setOutcome(outcome); calf.setSex(sex);
        if (Boolean.TRUE.equals(req.clearWeight())) { calf.setBirthWeight(null); calf.setWeightBasis(null); calf.setWeightUnit(null); }
        else if (req.birthWeightKg() != null || req.weightBasis() != null)
            setWeight(calf, req.birthWeightKg() == null ? calf.getBirthWeight() : req.birthWeightKg(), req.weightBasis() == null ? calf.getWeightBasis() : req.weightBasis(), "", -1);
        if (live) {
            if (req.tagCode() != null) {
                String tag = optional(req.tagCode(), "tagCode", 50);
                if (tag != null) assertTagFree(farmId, tag, calf.getId(), "tagCode", -1);
                calf.setTagCode(tag);
            }
            if (req.penId() != null) {
                Pen pen = em.createQuery("select p from Pen p where p.id=:id and p.farm.id=:farm", Pen.class).setParameter("id", req.penId()).setParameter("farm", farmId)
                    .getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "penId"));
                if (pen.getStatus() == null || !"ACTIVE".equals(pen.getStatus().name()))
                    throw DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", pen.getCode(), "count", 1, "free", 0, "field", "penId");
                calf.setProposedPen(pen);
            }
            if (req.breedId() != null) calf.setBreed(em.createQuery("select b from Breed b where b.id=:id and b.farm.id=:farm", Breed.class)
                .setParameter("id", req.breedId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "breedId")));
            if (req.purposeId() != null) calf.setProposedPurpose(em.createQuery("select p from ProductionPurpose p where p.id=:id and p.farm.id=:farm", ProductionPurpose.class)
                .setParameter("id", req.purposeId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "field", "purposeId")));
            if ("NOT_REQUIRED".equalsIgnoreCase(calf.getRegistrationState())) {
                if (calf.getProposedPen() == null) throw DomainException.required("penId");
                calf.setRegistrationState("PENDING_CONFIRMATION"); entryReminders.raiseCalfReminder(calf, dam);
            }
        } else {
            calf.setTagCode(null);
            if (!"NOT_REQUIRED".equalsIgnoreCase(calf.getRegistrationState())) { calf.setRegistrationState("NOT_REQUIRED"); entryReminders.cancelCalfReminder(calf); }
        }
        calf.setCorrected(true); em.flush();
        revisions.recordWithOptionalNote(ctx, "CalfOutcome", calfId, RecordRevisionService.CORRECT, reason, before, calfSnapshot(calf));
        audit.log(ctx, "CALF_OUTCOME_CORRECT", "CalfOutcome", calfId, Map.of("calvingId", calf.getCalving().getId()));
        return calfResult(calf, null);
    }

    public ReproductionDtos.CalfResult voidCalf(Long farmId, Long calfId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALF_OUTCOME_VOID", key, fingerprint("calfId", calfId, "request", req),
            ReproductionDtos.CalfResult.class, () -> voidCalfInCommand(farmId, calfId, req));
    }

    @Transactional
    ReproductionDtos.CalfResult voidCalfInCommand(Long farmId, Long calfId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalfOutcome calf = calf(farmId, calfId);
        Cattle dam = cattleGuard.lockCattle(farmId, calf.getCalving().getDam().getId());
        cattleGuard.assertActive(dam);
        VersionGuard.requireExpected(calf.getVersion(), req == null ? null : req.expectedVersion());
        String reason = reason(req.reason());
        if (!"VALID".equalsIgnoreCase(calf.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        if ("REGISTERED".equalsIgnoreCase(calf.getRegistrationState())) throw dependents(List.of(registeredDependent(calf)));
        long others = calves(calf.getCalving().getId()).stream().filter(c -> !c.getId().equals(calfId) && "VALID".equalsIgnoreCase(c.getStatus())).count();
        if (others == 0) throw DomainException.unprocessable(MessageCodes.FE12_06, "field", "calves"); // R-12-08: void the calving instead
        Map<String, Object> before = calfSnapshot(calf);
        calf.setStatus("VOIDED"); calf.setStatusReason(reason);
        entryReminders.cancelCalfReminder(calf); em.flush();
        revisions.recordWithOptionalNote(ctx, "CalfOutcome", calfId, RecordRevisionService.VOID, reason, before, calfSnapshot(calf));
        audit.log(ctx, "CALF_OUTCOME_VOID", "CalfOutcome", calfId, Map.of("calvingId", calf.getCalving().getId()));
        return calfResult(calf, null);
    }

    // ------------------------------------------------------------------ rules

    /** R-11-10 / GBR-54: estrus and breeding are recorded only for a tracked female (FE11-11 otherwise). */
    private void assertTracked(Cattle cattle) {
        assertFemale(cattle);
        String status = String.valueOf(cattleState.state(cattle).get("reproductiveStatus"));
        if ("NOT_APPLICABLE".equals(status)) throw DomainException.unprocessable(MessageCodes.FE11_11, "cattle_code", cattle.getDisplayCode(), "reason", notTrackedReason(cattle));
    }
    /** "Thao tác khác": pregnancy check and calving for any ACTIVE YOUNG_STOCK / ADULT female, or one with an OPEN pregnancy. */
    private void assertFemaleForOtherActions(Cattle cattle) {
        assertFemale(cattle);
        boolean stage = cattle.getLifeStage() != null && Set.of("YOUNG_STOCK", "ADULT").contains(cattle.getLifeStage().name());
        if (!stage && openPregnancy(cattle.getId()) == null)
            throw DomainException.unprocessable(MessageCodes.FE11_11, "cattle_code", cattle.getDisplayCode(), "reason", notTrackedReason(cattle));
    }
    private void assertFemale(Cattle cattle) {
        if (cattle.getSex() != Sex.FEMALE) throw DomainException.unprocessable(MessageCodes.FE11_11, "cattle_code", cattle.getDisplayCode(), "reason", "NOT_FEMALE");
        if (cattle.getHerdStatus() != HerdStatus.ACTIVE) throw DomainException.unprocessable(MessageCodes.COM_13, "cattle_code", cattle.getDisplayCode());
    }
    static String notTrackedReason(Cattle cattle) {
        if (cattle.getSex() != Sex.FEMALE) return "NOT_FEMALE";
        if (cattle.getLifeStage() == null || !Set.of("YOUNG_STOCK", "ADULT").contains(cattle.getLifeStage().name())) return "LIFE_STAGE";
        return "PURPOSE";
    }
    /** R-11-04. */
    private void assertNotPregnant(Cattle cattle) {
        if (openPregnancy(cattle.getId()) != null) throw DomainException.unprocessable(MessageCodes.FE11_05, "cattle_code", cattle.getDisplayCode());
    }
    /** R-11-03 / Q2 / P2: a VALID event of the same type within 12 hours asks for confirmation; a breeding on the same linked estrus is a deliberate second service. */
    private void assertNoDuplicate(Cattle cattle, String type, Instant at, Long excluded, Long linkedEstrusId) {
        List<ReproductionEvent> near = em.createQuery("select e from ReproductionEvent e where e.cattle.id=:c and e.type=:type and upper(e.status)='VALID' and e.eventTime>:from and e.eventTime<:to order by e.eventTime desc", ReproductionEvent.class)
            .setParameter("c", cattle.getId()).setParameter("type", type).setParameter("from", at.minus(DUPLICATE_WINDOW)).setParameter("to", at.plus(DUPLICATE_WINDOW)).getResultList();
        for (ReproductionEvent e : near) {
            if (e.getId().equals(excluded)) continue;
            if (linkedEstrusId != null && e.getLinkedEvent() != null && linkedEstrusId.equals(e.getLinkedEvent().getId())) continue;
            throw DomainException.conflict(MessageCodes.FE11_03, "event_type", "ESTRUS".equals(type) ? "động dục" : "phối giống", "type", type,
                "cattle_code", cattle.getDisplayCode(), "time", formatTime(e.getEventTime()), "at", e.getEventTime(), "eventId", e.getId());
        }
    }
    /** R-12-04: a check never overrides independent newer evidence; NOT_PREGNANT contradicts an OPEN pregnancy. */
    private void assertCheckConsistent(Cattle cattle, PregnancyEpisode open, String result, Instant at, ReproductionEvent linked) {
        if (open != null) {
            if ("NOT_PREGNANT".equals(result)) throw DomainException.conflict(MessageCodes.FE12_02, "cattle_code", cattle.getDisplayCode());
            if ("PREGNANT".equals(result) && linked != null && open.getLinkedBreeding() != null && !open.getLinkedBreeding().getId().equals(linked.getId()))
                throw DomainException.conflict(MessageCodes.FE12_02, "cattle_code", cattle.getDisplayCode());
            return;
        }
        if ("PREGNANT".equals(result)) {
            Long closedLater = em.createQuery("select count(c) from CalvingEvent c where c.dam.id=:c and upper(c.status)='VALID' and c.birthTime>:at", Long.class)
                .setParameter("c", cattle.getId()).setParameter("at", at).getSingleResult()
                + em.createQuery("select count(u) from PregnancyUpdate u where u.episode.cattle.id=:c and upper(u.status)='VALID' and upper(u.type)='LOSS' and u.occurredTime>:at", Long.class)
                .setParameter("c", cattle.getId()).setParameter("at", at).getSingleResult();
            if (closedLater > 0) throw DomainException.conflict(MessageCodes.FE12_02, "cattle_code", cattle.getDisplayCode());
        }
    }
    /** §3.4 / P4 / TC-12-19: a second VALID calving of the dam within 30 days. */
    private void assertNoCalvingWithin30Days(Cattle dam, Instant birth, Long excluded) {
        Long near = em.createQuery("select count(c) from CalvingEvent c where c.dam.id=:dam and upper(c.status)='VALID' and c.birthTime>:from and c.birthTime<:to and c.id<>:id", Long.class)
            .setParameter("dam", dam.getId()).setParameter("from", birth.minus(Duration.ofDays(30))).setParameter("to", birth.plus(Duration.ofDays(30)))
            .setParameter("id", excluded == null ? -1L : excluded).getSingleResult();
        if (near > 0) throw DomainException.conflict(MessageCodes.FE12_12, "dam_code", dam.getDisplayCode());
    }
    private void assertNotBeforeConfirmingCheck(Cattle cattle, PregnancyEpisode episode, Instant at, String field) {
        ReproductionEvent check = episode.getConfirmingCheck();
        if (check != null && at.isBefore(check.getEventTime())) throw beforeLinked("lần khám xác nhận", check.getEventTime(), cattle, field);
    }
    /** Not in the future, not before the herd entry date (BR-D14 → MSG-COM-15, as FE-09/FE-10). */
    private Instant eventTime(Long farmId, Cattle cattle, Instant at, String field) {
        if (at == null) throw DomainException.required(field);
        clock.assertNotFuture(at);
        LocalDate entryDate = em.createQuery("select e.entryDate from HerdEntry e where e.cattle.id=:cattle and e.voucher.farm.id=:farm and e.status=:valid order by e.id", LocalDate.class)
            .setParameter("cattle", cattle.getId()).setParameter("farm", farmId).setParameter("valid", EntryLineStatus.VALID)
            .setMaxResults(1).getResultStream().findFirst().orElse(null);
        if (entryDate != null && clock.toFarmDate(at).isBefore(entryDate)) throw DomainException.unprocessable(MessageCodes.COM_15, "date", entryDate, "field", field);
        return at;
    }

    private ReproductionEvent linkedEstrus(Long farmId, Cattle cattle, Long id, Instant bredAt) {
        if (id == null) return null;
        ReproductionEvent estrus = linkedOf(farmId, cattle, id, "ESTRUS");
        if (bredAt.isBefore(estrus.getEventTime())) throw beforeLinked("động dục", estrus.getEventTime(), cattle, "bredAt");
        if (estrus.getEventTime().isBefore(bredAt.minus(LINKED_ESTRUS_WINDOW))) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "linked_estrus_older_than_72_hours");
        return estrus;
    }
    private ReproductionEvent linkedBreeding(Long farmId, Cattle cattle, Long id, Instant checkedAt) {
        if (id == null) return null;
        ReproductionEvent breeding = linkedOf(farmId, cattle, id, "BREEDING");
        if (checkedAt.isBefore(breeding.getEventTime())) throw beforeLinked("lần phối", breeding.getEventTime(), cattle, "checkedAt");
        Instant lastCalving = em.createQuery("select max(c.birthTime) from CalvingEvent c where c.dam.id=:c and upper(c.status)='VALID'", Instant.class)
            .setParameter("c", cattle.getId()).getSingleResult();
        if (lastCalving != null && breeding.getEventTime().isBefore(lastCalving)) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "linked_breeding_before_last_calving");
        return breeding;
    }
    /** P5: another cow, another type or a VOIDED event stays MSG-COM-05. */
    private ReproductionEvent linkedOf(Long farmId, Cattle cattle, Long id, String type) {
        ReproductionEvent linked = em.createQuery("select e from ReproductionEvent e where e.id=:id and e.cattle.farm.id=:farm", ReproductionEvent.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.unprocessable(MessageCodes.COM_05, "reason", "invalid_linked_event"));
        if (!linked.getCattle().getId().equals(cattle.getId()) || !type.equals(linked.getType()) || !"VALID".equalsIgnoreCase(linked.getStatus()))
            throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "invalid_linked_event");
        return linked;
    }
    private DomainException beforeLinked(String event, Instant time, Cattle cattle, String field) {
        return DomainException.unprocessable(MessageCodes.FE11_10, "event", event, "time", formatTime(time), "at", time, "field", field);
    }

    /** R-11-01 → MSG-FE11-04 for a farm sire that is not another ACTIVE male of this farm. */
    private void setSire(Long farmId, Cattle cow, ReproductionEvent event, String sireSource, Long sireCattleId, Long sireBreedId, String sireBreed,
                         String semenCode, String semenSupplier) {
        String source = normalize(sireSource);
        if (source.isEmpty()) throw DomainException.required("sireSource");
        if ("ON_FARM".equals(source) || "FARM".equals(source)) source = "INTERNAL";
        if (!Set.of("INTERNAL", "EXTERNAL").contains(source)) throw DomainException.invalid("sireSource");
        event.setSireSource(source);
        if ("INTERNAL".equals(source)) {
            if (sireCattleId == null) throw DomainException.required("sireCattleId");
            Cattle sire = em.createQuery("select c from Cattle c where c.id=:id and c.farm.id=:farm", Cattle.class)
                .setParameter("id", sireCattleId).setParameter("farm", farmId).getResultStream().findFirst().orElse(null);
            if (sire == null || sire.getId().equals(cow.getId()) || sire.getSex() != Sex.MALE || sire.getHerdStatus() != HerdStatus.ACTIVE)
                throw DomainException.unprocessable(MessageCodes.FE11_04, "field", "sireCattleId");
            event.setSire(sire);
            event.setSemenBatch(null); event.setSupplier(null);
        } else {
            if (sireBreedId != null) {
                event.setSireBreed(em.createQuery("select b from Breed b where b.id=:id and b.farm.id=:farm", Breed.class)
                    .setParameter("id", sireBreedId).setParameter("farm", farmId).getResultStream().findFirst()
                    .orElseThrow(() -> DomainException.invalid("sireBreedId")));
            }
            event.setExternalSireName(optional(sireBreed, "sireBreed", 255));
            if (event.getSireBreed() == null && event.getExternalSireName() == null) throw DomainException.required("sireBreed");
            event.setSemenBatch(optional(semenCode, "semenCode", 50));
            event.setSupplier(optional(semenSupplier, "semenSupplier", 100));
        }
    }
    private void setObserver(Long farmId, FarmContext ctx, ReproductionEvent event, Long id, String name) {
        if (id != null) { event.setObserverUser(member(farmId, id, "observerId")); event.setObserver(null); }
        else if (name != null && !name.isBlank()) { event.setObserverUser(null); event.setObserver(optional(name, "observerName", 100)); }
        else { event.setObserverUser(ctx.user()); event.setObserver(null); } // P1: the recorder by default
    }
    private void setPerformer(Long farmId, ReproductionEvent event, Long id, String name) {
        event.setPerformerUser(id == null ? null : member(farmId, id, "performerId"));
        event.setPerformedBy(id == null ? optional(name, "performerName", 100) : null);
    }
    private void setExaminer(Long farmId, ReproductionEvent event, Long id, String name) {
        event.setExaminerUser(id == null ? null : member(farmId, id, "examinerId"));
        event.setExaminer(id == null ? optional(name, "examinerName", 100) : null);
    }
    private void setAttendant(Long farmId, CalvingEvent calving, Long id, String name) {
        calving.setAttendantUser(id == null ? null : member(farmId, id, "attendantId"));
        calving.setAttendant(id == null ? optional(name, "attendantName", 100) : null);
    }
    private AppUser member(Long farmId, Long userId, String field) {
        return em.createQuery("select m from FarmMembership m where m.farm.id=:farm and m.user.id=:user and upper(m.status)='ACTIVE'", FarmMembership.class)
            .setParameter("farm", farmId).setParameter("user", userId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.invalid(field)).getUser();
    }
    private HealthCase healthCase(Long farmId, Cattle cattle, String type, Long id) {
        if (id == null) return null;
        if (!"COMPLICATION".equals(type)) throw DomainException.invalid("healthCaseId"); // R-12-06: only a complication links a case
        return em.createQuery("select h from HealthCase h where h.id=:id and h.cattle.id=:cattle", HealthCase.class)
            .setParameter("id", id).setParameter("cattle", cattle.getId()).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.invalid("healthCaseId"));
    }
    private void setWeight(CalfOutcome calf, BigDecimal weight, String basis, String prefix, int i) {
        String field = prefix + "birthWeightKg";
        if (weight == null) {
            if (basis != null && !basis.isBlank()) throw DomainException.unprocessable(MessageCodes.FE12_07, "field", field, "calf", i < 0 ? null : i);
            calf.setBirthWeight(null); calf.setWeightBasis(null); calf.setWeightUnit(null); return;
        }
        String b = normalize(basis);
        if (weight.compareTo(BigDecimal.ONE) < 0 || weight.compareTo(BigDecimal.valueOf(80)) > 0 || weight.stripTrailingZeros().scale() > 1 || !Set.of("MEASURED", "ESTIMATED").contains(b))
            throw DomainException.unprocessable(MessageCodes.FE12_07, "field", field, "calf", i < 0 ? null : i);
        calf.setBirthWeight(weight); calf.setWeightBasis(b); calf.setWeightUnit("KG");
    }
    /** R-12-10 / BR-D08: unique among the farm's cattle codes and ear tags, issued QR tags and the farm's VALID calf outcomes. */
    private void assertTagFree(Long farmId, String tag, Long excludedCalf, String field, int i) {
        long used = em.createQuery("select count(c) from Cattle c where c.farm.id=:farm and (lower(c.displayCode)=lower(:tag) or lower(c.earTagNumber)=lower(:tag))", Long.class)
            .setParameter("farm", farmId).setParameter("tag", tag).getSingleResult()
            + em.createQuery("select count(t) from CattleQrTag t where lower(t.tagCode)=lower(:tag)", Long.class).setParameter("tag", tag).getSingleResult()
            + em.createQuery("select count(o) from CalfOutcome o where o.calving.dam.farm.id=:farm and lower(o.tagCode)=lower(:tag) and upper(o.status)='VALID' and o.id<>:id", Long.class)
            .setParameter("farm", farmId).setParameter("tag", tag).setParameter("id", excludedCalf == null ? -1L : excludedCalf).getSingleResult();
        if (used > 0) throw tagUsed(tag, field, i);
    }
    private DomainException tagUsed(String tag, String field, int i) {
        return DomainException.unprocessable(MessageCodes.FE12_08, "tag_code", tag, "code", tag, "field", field, "calf", i < 0 ? null : i);
    }
    private String registration(String value, int i) {
        String r = value == null || value.isBlank() ? "DRAFT" : normalize(value);
        if (!Set.of("DRAFT", "REGISTER_NOW").contains(r)) throw invalidAt("calves[" + i + "].registration", i);
        return r;
    }

    // ------------------------------------------------------------------ dependents (MSG-FE11-07, P3)

    private DomainException dependents(List<ReproductionDtos.Dependent> items) {
        List<ReproductionDtos.Dependent> unique = new ArrayList<>(new LinkedHashSet<>(items));
        String records = String.join(", ", unique.stream().map(this::label).toList());
        return DomainException.conflict(MessageCodes.FE11_07, "records", records, "dependents", unique);
    }
    private String label(ReproductionDtos.Dependent d) {
        String name = switch (d.type()) {
            case "ESTRUS" -> "động dục"; case "BREEDING" -> "phối giống"; case "PREGNANCY_CHECK" -> "khám thai";
            case "PREGNANCY" -> "thai"; case "PREGNANCY_UPDATE" -> "diễn biến thai"; case "CALVING" -> "lần đẻ";
            case "REGISTERED_CALF" -> "bê đã đăng ký"; default -> d.type().toLowerCase(Locale.ROOT);
        };
        return d.at() == null ? name : name + " " + DATE.format(d.at().atZone(clock.zone()));
    }
    private ReproductionDtos.Dependent dependent(ReproductionEvent e) { return new ReproductionDtos.Dependent(e.getType(), e.getId(), e.getEventTime()); }
    private List<ReproductionEvent> linkedEvents(ReproductionEvent event) {
        return em.createQuery("select x from ReproductionEvent x where x.linkedEvent.id=:id and upper(x.status)='VALID' order by x.eventTime", ReproductionEvent.class)
            .setParameter("id", event.getId()).getResultList();
    }
    private List<PregnancyEpisode> episodesLinkedTo(ReproductionEvent breeding) {
        return em.createQuery("select p from PregnancyEpisode p where p.linkedBreeding.id=:id and upper(p.status)<>'VOIDED'", PregnancyEpisode.class)
            .setParameter("id", breeding.getId()).getResultList();
    }
    private PregnancyEpisode confirmedEpisode(ReproductionEvent event) {
        if (!"PREGNANCY_CHECK".equals(event.getType())) return null;
        return em.createQuery("select p from PregnancyEpisode p where p.confirmingCheck.id=:id and upper(p.status)<>'VOIDED'", PregnancyEpisode.class)
            .setParameter("id", event.getId()).getResultStream().findFirst().orElse(null);
    }
    /** Updates, the calving and registered calves of a pregnancy (what a confirming check supports). */
    private List<ReproductionDtos.Dependent> episodeDependents(PregnancyEpisode episode) {
        List<ReproductionDtos.Dependent> out = new ArrayList<>();
        em.createQuery("select u from PregnancyUpdate u where u.episode.id=:id and upper(u.status)='VALID' order by u.occurredTime", PregnancyUpdate.class)
            .setParameter("id", episode.getId()).getResultList().forEach(u -> out.add(new ReproductionDtos.Dependent("PREGNANCY_UPDATE", u.getId(), u.getOccurredTime())));
        for (CalvingEvent c : em.createQuery("select c from CalvingEvent c where c.episode.id=:id and upper(c.status)='VALID'", CalvingEvent.class).setParameter("id", episode.getId()).getResultList()) {
            out.add(new ReproductionDtos.Dependent("CALVING", c.getId(), c.getBirthTime()));
            out.addAll(registeredCalves(c));
        }
        return out;
    }
    private List<ReproductionDtos.Dependent> laterUpdatesAndCalvings(PregnancyEpisode episode, PregnancyUpdate update, Instant newLossAt) {
        Instant from = newLossAt == null ? update.getOccurredTime() : (newLossAt.isBefore(update.getOccurredTime()) ? newLossAt : update.getOccurredTime());
        List<ReproductionDtos.Dependent> out = new ArrayList<>();
        em.createQuery("select u from PregnancyUpdate u where u.episode.id=:e and u.id<>:id and upper(u.status)='VALID' and u.occurredTime>=:t order by u.occurredTime", PregnancyUpdate.class)
            .setParameter("e", episode.getId()).setParameter("id", update.getId()).setParameter("t", from).getResultList()
            .forEach(u -> out.add(new ReproductionDtos.Dependent("PREGNANCY_UPDATE", u.getId(), u.getOccurredTime())));
        em.createQuery("select c from CalvingEvent c where c.episode.id=:e and upper(c.status)='VALID'", CalvingEvent.class).setParameter("e", episode.getId()).getResultList()
            .forEach(c -> out.add(new ReproductionDtos.Dependent("CALVING", c.getId(), c.getBirthTime())));
        return out;
    }
    private List<ReproductionDtos.Dependent> registeredCalves(CalvingEvent calving) {
        return calves(calving.getId()).stream().filter(c -> "REGISTERED".equalsIgnoreCase(c.getRegistrationState()) && "VALID".equalsIgnoreCase(c.getStatus()))
            .map(this::registeredDependent).toList();
    }
    private ReproductionDtos.Dependent registeredDependent(CalfOutcome calf) {
        return new ReproductionDtos.Dependent("REGISTERED_CALF", calf.getRegisteredCattle() == null ? calf.getId() : calf.getRegisteredCattle().getId(), null);
    }
    private List<ReproductionDtos.Dependent> registeredCalvesOfBreeding(ReproductionEvent breeding) {
        List<ReproductionDtos.Dependent> out = new ArrayList<>();
        for (PregnancyEpisode p : episodesLinkedTo(breeding))
            for (CalvingEvent c : em.createQuery("select c from CalvingEvent c where c.episode.id=:id and upper(c.status)='VALID'", CalvingEvent.class).setParameter("id", p.getId()).getResultList())
                out.addAll(registeredCalves(c));
        return out;
    }

    // ------------------------------------------------------------------ pregnancy state

    /** R-12-03: CONFIRMED from the linked breeding, ESTIMATED from the months, none otherwise (or without the gestation parameter). */
    private void setExpected(PregnancyEpisode episode, Cattle cattle, ReproductionEvent linked, Integer months, Instant checkedAt, Integer gestation) {
        if (gestation != null && linked != null) {
            episode.setExpectedCalvingDate(clock.toFarmDate(linked.getEventTime()).plusDays(gestation)); episode.setExpectedBasis("CONFIRMED");
        } else if (gestation != null && months != null) {
            episode.setExpectedCalvingDate(clock.toFarmDate(checkedAt).plusDays(gestation - months * 30L)); episode.setExpectedBasis("ESTIMATED");
        } else {
            episode.setExpectedCalvingDate(null); episode.setExpectedBasis(null);
        }
    }
    private void closeAsLost(PregnancyEpisode episode, Instant at) {
        episode.setStatus("LOST"); episode.setCloseReason("PREGNANCY_LOSS"); episode.setClosedDate(clock.toFarmDate(at));
        reminders.pregnancyLost(episode);
    }
    private void voidEpisode(PregnancyEpisode episode, String reason) {
        episode.setStatus("VOIDED"); episode.setCloseReason(reason); episode.setClosedDate(clock.today());
        reminders.eventVoided(episode.getCattle(), episode.getConfirmingCheck());
    }
    /** R-12-15: a lost pregnancy reopens only when no newer pregnancy of the cow exists; {@code strict} turns that case into MSG-FE11-07. */
    private void reopenAfterLossVoided(PregnancyEpisode episode, Long lossUpdateId, boolean strict) {
        if (!"LOST".equalsIgnoreCase(episode.getStatus())) return;
        List<PregnancyEpisode> newer = em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:c and p.id>:id and upper(p.status)<>'VOIDED'", PregnancyEpisode.class)
            .setParameter("c", episode.getCattle().getId()).setParameter("id", episode.getId()).getResultList();
        Long otherLoss = em.createQuery("select count(u) from PregnancyUpdate u where u.episode.id=:id and u.id<>:loss and upper(u.status)='VALID' and upper(u.type)='LOSS'", Long.class)
            .setParameter("id", episode.getId()).setParameter("loss", lossUpdateId).getSingleResult();
        if (!newer.isEmpty()) {
            if (strict) throw dependents(newer.stream().map(p -> new ReproductionDtos.Dependent("PREGNANCY", p.getId(), null)).toList());
            return;
        }
        if (otherLoss > 0) return;
        episode.setStatus("OPEN"); episode.setCloseReason(null); episode.setClosedDate(null);
        reminders.pregnancyLossVoided(episode);
    }

    // ------------------------------------------------------------------ values

    private ReproductionEvent newEvent(FarmContext ctx, Cattle cattle, String type, Instant at, String source) {
        ReproductionEvent event = new ReproductionEvent();
        event.setCattle(cattle); event.setType(type); event.setEventTime(at); event.setRecordedAt(clock.now()); event.setRecordedBy(ctx.user());
        event.setSource(dataSource(source)); event.setUpdatedAt(clock.now());
        return event;
    }
    private String breedingMethod(String value) {
        String m = normalize(value);
        if ("NATURAL_SERVICE".equals(m)) m = "NATURAL";
        if ("ARTIFICIAL_INSEMINATION".equals(m)) m = "AI";
        if (m.isEmpty()) throw DomainException.required("method");
        if (!BREEDING_METHODS.contains(m)) throw DomainException.invalid("method");
        return m;
    }
    private String checkResult(String value) {
        String r = normalize(value);
        if (r.isEmpty()) throw DomainException.required("result");
        if (!CHECK_RESULTS.contains(r)) throw DomainException.invalid("result");
        return r;
    }
    private String checkMethod(String value) { return optionalEnum(value, CHECK_METHODS, "method"); }
    private Integer estimatedMonths(String result, Integer months) {
        if (months == null) return null;
        if (!"PREGNANT".equals(result) || months < 1 || months > 9) throw DomainException.invalid("estimatedMonths");
        return months;
    }
    private String updateType(String value) {
        String t = normalize(value);
        if (t.isEmpty()) throw DomainException.required("type");
        if (!UPDATE_TYPES.contains(t)) throw DomainException.invalid("type");
        return t;
    }
    private String optionalEnum(String value, Set<String> allowed, String field) {
        if (value == null || value.isBlank()) return null;
        String v = normalize(value);
        if ("MONITORING".equals(v) && allowed == DAM_CONDITIONS) v = "NEEDS_MONITORING";
        if (!allowed.contains(v)) throw DomainException.invalid(field);
        return v;
    }
    private String dataSource(String value) {
        String source = value == null || value.isBlank() ? "DIRECT_OBSERVATION" : normalize(value);
        if (!SOURCES.contains(source)) throw DomainException.invalid("dataSource");
        return source;
    }
    private Set<EstrusSign> parseSigns(List<String> values) {
        if (values == null || values.isEmpty()) return null;
        Set<EstrusSign> signs = new LinkedHashSet<>();
        for (String value : values) try { signs.add(EstrusSign.valueOf(normalize(value))); } catch (IllegalArgumentException e) { throw DomainException.invalid("signs"); }
        return signs;
    }
    /**
     * Ghi chú khi sửa / xóa bản ghi sinh sản (D69, như D43 / D53): không bắt buộc; trống lưu {@code null}, quá 500 ký tự
     * → MSG-COM-10. Record Revision vẫn giữ giá trị trước / sau, người và thời điểm (BR-D15).
     */
    private String reason(String reason) {
        if (reason == null || reason.isBlank()) return null;
        if (reason.trim().length() > 500) throw DomainException.invalid("reason");
        return reason.trim();
    }
    private String optional(String value, String field, int max) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().length() > max) throw DomainException.invalid(field);
        return value.trim();
    }
    private String required(String value, String field, int max) {
        if (value == null || value.isBlank()) throw DomainException.required(field);
        return optional(value, field, max);
    }
    private static String normalize(String value) { return value == null ? "" : value.trim().toUpperCase(Locale.ROOT); }
    private static DomainException requiredAt(String field, int calf) { return DomainException.badRequest(MessageCodes.COM_06, "field", field, "calf", calf); }
    private static DomainException invalidAt(String field, int calf) { return DomainException.badRequest(MessageCodes.COM_10, "field", field, "calf", calf); }
    private static Map<String, Object> fingerprint(Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) map.put(String.valueOf(kv[i]), kv[i + 1]);
        return map;
    }

    /** Gestation length of the effective farm parameter version; null when the farm has none (R-11-07, MSG-FE11-08). */
    private Integer gestationDays(Long farmId, LocalDate date) {
        return em.createQuery("select p.gestationLengthDays from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc, p.versionNo desc", Integer.class)
            .setParameter("farm", farmId).setParameter("date", date).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }
    private Integer parameter(Long farmId, String key) {
        Object value = cattleState.parameters(farmId, clock.today()).get(key);
        return value instanceof Number n ? n.intValue() : null;
    }
    /** GBR-30: declared parity at entry plus the VALID calvings recorded since. */
    private int nextParity(Cattle cattle) {
        Long count = em.createQuery("select count(c) from CalvingEvent c where c.dam.id=:dam and upper(c.status)='VALID'", Long.class).setParameter("dam", cattle.getId()).getSingleResult();
        return (cattle.getDeclaredParity() == null ? 0 : cattle.getDeclaredParity()) + count.intValue() + 1;
    }
    private PregnancyEpisode openPregnancy(Long cattleId) {
        return em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:id and upper(p.status)='OPEN' order by p.id desc", PregnancyEpisode.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }
    private String formatTime(Instant at) { return TIME.format(at.atZone(clock.zone())); }
    private String reproStatus(Cattle cattle) { return String.valueOf(cattleState.state(cattle).get("reproductiveStatus")); }

    private PregnancyEpisode episode(Long farmId, Long id) {
        return em.createQuery("select p from PregnancyEpisode p where p.id=:id and p.cattle.farm.id=:farm", PregnancyEpisode.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "episodeId", id));
    }
    private ReproductionEvent event(Long farmId, Long id) {
        return em.createQuery("select e from ReproductionEvent e where e.id=:id and e.cattle.farm.id=:farm", ReproductionEvent.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "eventId", id));
    }
    private PregnancyUpdate pregnancyUpdate(Long farmId, Long id) {
        return em.createQuery("select u from PregnancyUpdate u where u.id=:id and u.episode.cattle.farm.id=:farm", PregnancyUpdate.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "updateId", id));
    }
    private CalvingEvent calving(Long farmId, Long id) {
        return em.createQuery("select c from CalvingEvent c where c.id=:id and c.dam.farm.id=:farm", CalvingEvent.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calvingId", id));
    }
    private CalfOutcome calf(Long farmId, Long id) {
        return em.createQuery("select o from CalfOutcome o where o.id=:id and o.calving.dam.farm.id=:farm", CalfOutcome.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calfId", id));
    }
    private List<CalfOutcome> calves(Long calvingId) {
        return em.createQuery("select o from CalfOutcome o where o.calving.id=:id order by o.calfNo, o.id", CalfOutcome.class).setParameter("id", calvingId).getResultList();
    }

    // ------------------------------------------------------------------ results and snapshots

    private ReproductionDtos.EventResult result(ReproductionEvent event, Cattle cattle, ReproductionDtos.Window window, String missing,
                                                ReproductionDtos.EligibilityWarning warning, PregnancyEpisode episode) {
        ReproductionDtos.EpisodeInfo info = episode == null ? null : new ReproductionDtos.EpisodeInfo(episode.getId(), episode.getVersion(), episode.getParity(),
            episode.getExpectedCalvingDate(), episode.getExpectedBasis(),
            "OPEN".equalsIgnoreCase(episode.getStatus()) && episode.getExpectedCalvingDate() == null ? MessageCodes.FE12_11 : null);
        return new ReproductionDtos.EventResult(event.getId(), event.getType(), event.getStatus(), event.getVersion(), cattle.getVersion(), event.getResult(),
            window, event.getTentativeExpectedCalvingDate(), missing, warning, info, reproStatus(cattle));
    }
    private ReproductionDtos.PregnancyUpdateResult updateResult(PregnancyUpdate update, Cattle cattle) {
        PregnancyEpisode episode = update.getEpisode();
        return new ReproductionDtos.PregnancyUpdateResult(update.getId(), episode.getId(), update.getType(), update.getStatus(), update.getVersion(),
            episode.getStatus(), episode.getVersion(), reproStatus(cattle));
    }
    private ReproductionDtos.CalvingResult calvingResult(CalvingEvent calving, Cattle dam) {
        return new ReproductionDtos.CalvingResult(calving.getId(), calving.getStatus(), calving.getVersion(), calving.getEpisode() == null ? null : calving.getEpisode().getId(),
            calves(calving.getId()).stream().map(c -> calfResult(c, null)).toList(), reproStatus(dam));
    }
    private ReproductionDtos.CalfResult calfResult(CalfOutcome calf, String voucherCode) {
        Cattle registered = calf.getRegisteredCattle();
        return new ReproductionDtos.CalfResult(calf.getId(), calf.getCalfNo(), calf.getOutcome(), calf.getRegistrationState(),
            registered == null ? null : registered.getId(), registered == null ? null : registered.getDisplayCode(), voucherCode, calf.getTagCode(),
            calf.getStatus(), calf.getVersion());
    }
    private Map<String, Object> eventSnapshot(ReproductionEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", e.getType()); m.put("eventTime", e.getEventTime()); m.put("source", e.getSource()); m.put("result", e.getResult());
        m.put("method", e.getMethod()); m.put("signs", e.getSigns() == null ? null : e.getSigns().stream().map(Enum::name).toList());
        m.put("description", e.getDescription()); m.put("observer", e.getObserver()); m.put("observerId", e.getObserverUser() == null ? null : e.getObserverUser().getId());
        m.put("sireSource", e.getSireSource()); m.put("sireId", e.getSire() == null ? null : e.getSire().getId());
        m.put("sireBreedId", e.getSireBreed() == null ? null : e.getSireBreed().getId()); m.put("sireBreed", e.getExternalSireName());
        m.put("semenCode", e.getSemenBatch()); m.put("semenSupplier", e.getSupplier());
        m.put("performer", e.getPerformedBy()); m.put("performerId", e.getPerformerUser() == null ? null : e.getPerformerUser().getId());
        m.put("examiner", e.getExaminer()); m.put("examinerId", e.getExaminerUser() == null ? null : e.getExaminerUser().getId());
        m.put("estimatedMonths", e.getEstMonthsPregnant()); m.put("linkedEventId", e.getLinkedEvent() == null ? null : e.getLinkedEvent().getId());
        m.put("tentativeCalvingDate", e.getTentativeExpectedCalvingDate()); m.put("status", e.getStatus());
        return m;
    }
    private Map<String, Object> pregnancyUpdateSnapshot(PregnancyUpdate u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("episodeId", u.getEpisode().getId()); m.put("occurredTime", u.getOccurredTime()); m.put("source", u.getSource()); m.put("type", u.getType());
        m.put("details", u.getDetails()); m.put("status", u.getStatus()); m.put("healthCaseId", u.getHealthCase() == null ? null : u.getHealthCase().getId());
        return m;
    }
    private Map<String, Object> calvingSnapshot(CalvingEvent c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("damId", c.getDam().getId()); m.put("episodeId", c.getEpisode() == null ? null : c.getEpisode().getId()); m.put("birthTime", c.getBirthTime());
        m.put("source", c.getSource()); m.put("course", c.getCourse()); m.put("damCondition", c.getDamCondition()); m.put("retainedPlacenta", c.getRetainedPlacenta());
        m.put("attendant", c.getAttendant()); m.put("attendantId", c.getAttendantUser() == null ? null : c.getAttendantUser().getId()); m.put("status", c.getStatus());
        return m;
    }
    private Map<String, Object> calfSnapshot(CalfOutcome c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("calvingId", c.getCalving().getId()); m.put("calfNo", c.getCalfNo()); m.put("outcome", c.getOutcome()); m.put("sex", c.getSex());
        m.put("birthWeight", c.getBirthWeight()); m.put("weightBasis", c.getWeightBasis()); m.put("tagCode", c.getTagCode());
        m.put("penId", c.getProposedPen() == null ? null : c.getProposedPen().getId()); m.put("breedId", c.getBreed() == null ? null : c.getBreed().getId());
        m.put("purposeId", c.getProposedPurpose() == null ? null : c.getProposedPurpose().getId());
        m.put("registrationState", c.getRegistrationState()); m.put("status", c.getStatus());
        return m;
    }
}
