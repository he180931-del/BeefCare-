package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.EstrusSign;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos;

/** Transactional business commands for FE-11/12; events retain occurrence and recording metadata separately. */
@Service
public class ReproductionCommandService {
    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final CattleGuardService cattleGuard;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;
    private final RecordRevisionService revisions;
    private final FarmClock clock;
    private final PendingCalfService pendingCalves;
    private final EntryReminderService entryReminders;
    private final ObjectMapper json;
    private final CattleStateService cattleState;
    private final ReproductionReminderService reproductiveReminders;

    public ReproductionCommandService(FarmAccessService access, CattleGuardService cattleGuard, IdempotencyCommandService idempotency,
                                      AuditService audit, RecordRevisionService revisions, FarmClock clock,
                                      PendingCalfService pendingCalves, EntryReminderService entryReminders, ObjectMapper json, CattleStateService cattleState,
                                      ReproductionReminderService reproductiveReminders) {
        this.access = access; this.cattleGuard = cattleGuard; this.idempotency = idempotency; this.audit = audit;
        this.revisions = revisions; this.clock = clock; this.pendingCalves = pendingCalves; this.entryReminders = entryReminders; this.json = json; this.cattleState = cattleState;
        this.reproductiveReminders=reproductiveReminders;
    }

    @Transactional(readOnly = true)
    public List<ReproductionDtos.ReproductionAnimal> worklist(Long farmId) {
        access.require(farmId, FarmAction.VIEW_REPRODUCTION);
        List<Cattle> cattle = em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=:status and c.sex=:sex order by c.displayCode", Cattle.class)
            .setParameter("farm", farmId).setParameter("status", HerdStatus.ACTIVE).setParameter("sex", Sex.FEMALE).getResultList();
        return cattle.stream().map(c -> {
            Map<String,Object> state = cattleState.state(c);
            String status = String.valueOf(state.get("reproductiveStatus"));
            if ("NOT_APPLICABLE".equals(status)) return null;
            @SuppressWarnings("unchecked") List<String> failures = (List<String>) state.getOrDefault("failedBreedingConditions", List.of());
            return new ReproductionDtos.ReproductionAnimal(c.getId(), c.getDisplayCode(), status,
                (LocalDate) state.get("expectedCalvingDate"), (String) state.get("expectedBasis"),
                (Boolean) state.get("breedingEligible"), failures);
        }).filter(java.util.Objects::nonNull).toList();
    }

    @Transactional(readOnly = true)
    public ReproductionDtos.ReproductionHistory history(Long farmId, Long cattleId) {
        access.require(farmId, FarmAction.VIEW_REPRODUCTION);
        Cattle cattle = em.createQuery("select c from Cattle c where c.id=:id and c.farm.id=:farm", Cattle.class)
            .setParameter("id", cattleId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "cattleId", cattleId));
        List<ReproductionDtos.EventHistory> events = em.createQuery("select e from ReproductionEvent e where e.cattle.id=:id order by e.eventTime,e.id", ReproductionEvent.class)
            .setParameter("id", cattleId).getResultList().stream().map(e -> new ReproductionDtos.EventHistory(e.getId(),e.getType(),e.getEventTime(),e.getRecordedAt(),
                e.getRecordedBy()==null?null:e.getRecordedBy().getId(),e.getResult(),e.getMethod(),e.getObserver(),e.getPerformedBy(),e.getExaminer(),e.getStatus(),e.getCorrected(),e.getVersion())).toList();
        List<ReproductionDtos.PregnancyHistory> pregnancies = em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:id order by p.id", PregnancyEpisode.class)
            .setParameter("id", cattleId).getResultList().stream().map(p -> {
                List<ReproductionDtos.PregnancyUpdateHistory> updates = em.createQuery("select u from PregnancyUpdate u where u.episode.id=:episode order by u.occurredTime,u.id", PregnancyUpdate.class)
                    .setParameter("episode", p.getId()).getResultList().stream().map(u -> new ReproductionDtos.PregnancyUpdateHistory(u.getId(),u.getType(),u.getOccurredTime(),u.getRecordedAt(),u.getStatus(),u.getCorrected(),u.getVersion())).toList();
                return new ReproductionDtos.PregnancyHistory(p.getId(),p.getStatus(),p.getParity(),p.getExpectedCalvingDate(),p.getExpectedBasis(),updates);
            }).toList();
        List<ReproductionDtos.CalvingHistory> calvings = em.createQuery("select c from CalvingEvent c where c.dam.id=:id order by c.birthTime,c.id", CalvingEvent.class)
            .setParameter("id", cattleId).getResultList().stream().map(c -> {
                List<ReproductionDtos.CalfOutcomeResult> calves = em.createQuery("select o from CalfOutcome o where o.calving.id=:calving order by o.calfNo,o.id", CalfOutcome.class)
                    .setParameter("calving",c.getId()).getResultList().stream().map(this::calfResult).toList();
                return new ReproductionDtos.CalvingHistory(c.getId(),c.getBirthTime(),c.getStatus(),c.getCorrected(),c.getVersion(),calves);
            }).toList();
        return new ReproductionDtos.ReproductionHistory(cattle.getId(),events,pregnancies,calvings);
    }

    public ReproductionDtos.EventResult recordEstrus(Long farmId, String key, ReproductionDtos.EventCommand request) {
        return recordEvent(farmId, key, "ESTRUS", request);
    }
    public ReproductionDtos.EventResult recordBreeding(Long farmId, String key, ReproductionDtos.EventCommand request) {
        return recordEvent(farmId, key, "BREEDING", request);
    }
    public ReproductionDtos.EventResult recordPregnancyCheck(Long farmId, String key, ReproductionDtos.EventCommand request) {
        return recordEvent(farmId, key, "PREGNANCY_CHECK", request);
    }

    private ReproductionDtos.EventResult recordEvent(Long farmId, String key, String type, ReproductionDtos.EventCommand request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_" + type, key, request,
            ReproductionDtos.EventResult.class, () -> recordEventInCommand(farmId, type, request));
    }

    @Transactional
    ReproductionDtos.EventResult recordEventInCommand(Long farmId, String type, ReproductionDtos.EventCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null || req.cattleId() == null) throw DomainException.required("cattleId");
        Cattle cattle = cattleGuard.lockWritable(farmId, req.cattleId());
        VersionGuard.requireExpected(cattle.getVersion(), req.expectedCattleVersion());
        assertFemaleApplicable(cattle, true);
        Instant occurred = requiredTime(req.occurredAt(), "occurredAt");
        clock.assertNotFuture(occurred);
        if (cattle.getCreatedAt() != null && occurred.isBefore(cattle.getCreatedAt())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "event_before_herd_entry");

        String result = switch (type) { case "ESTRUS" -> "OBSERVED"; case "BREEDING" -> "BRED"; default -> normalize(req.result()); };
        if ("PREGNANCY_CHECK".equals(type) && !Set.of("PREGNANT", "NOT_PREGNANT", "INCONCLUSIVE").contains(result))
            throw DomainException.invalid("result");
        ReproductionEvent linked = linkedEvent(farmId, cattle, type, req.linkedEventId(), occurred);
        ReproductionEvent event = new ReproductionEvent();
        event.setCattle(cattle); event.setType(type); event.setEventTime(occurred); event.setRecordedAt(clock.now()); event.setRecordedBy(ctx.user());
        event.setSource(dataSource(req.source()));
        event.setResult(result); event.setMethod(optional(req.method(), "method", 30)); event.setDescription(optional(req.description(), "description", 500));
        event.setPerformedBy(optional(req.performedBy(), "performedBy", 100)); event.setExaminer(optional(req.examiner(), "examiner", 100));
        event.setObserver(optional(req.observer(), "observer", 100));
        event.setLinkedEvent(linked); event.setUpdatedAt(clock.now());
        if ("ESTRUS".equals(type)) event.setSigns(parseSigns(req.signs()));
        if ("PREGNANCY_CHECK".equals(type)) {
            event.setEstMonthsPregnant(req.estimatedMonthsPregnant());
            if (!"PREGNANT".equals(result) && req.estimatedMonthsPregnant() != null) throw DomainException.invalid("estimatedMonthsPregnant");
            if (req.estimatedMonthsPregnant() != null && (req.estimatedMonthsPregnant() < 1 || req.estimatedMonthsPregnant() > 9)) throw DomainException.invalid("estimatedMonthsPregnant");
        }
        if ("BREEDING".equals(type)) {
            String method = normalize(req.method());
            if (!Set.of("NATURAL", "AI").contains(method)) throw DomainException.invalid("method");
            event.setMethod(method);
            setSireFields(farmId, event, req);
            if ("UNKNOWN".equals(event.getSireSource())) throw DomainException.required("sireSource");
            event.setTentativeExpectedCalvingDate(clock.toFarmDate(occurred).plusDays(gestationDays(farmId, clock.toFarmDate(occurred))));
        }
        if ("PREGNANCY_CHECK".equals(type) && req.method() != null && !Set.of("ULTRASOUND", "RECTAL", "OTHER").contains(normalize(req.method())))
            throw DomainException.invalid("method");
        if ("PREGNANCY_CHECK".equals(type) && "PREGNANT".equals(result) &&
            em.createQuery("select count(e) from ReproductionEvent e where e.cattle.id=:cattle and e.status='VALID' and e.eventTime>:occurred", Long.class)
                .setParameter("cattle", cattle.getId()).setParameter("occurred", occurred).getSingleResult() > 0)
            throw DomainException.conflict("MSG-FE12-02", "cattle_code", cattle.getDisplayCode());
        em.persist(event); em.flush();
        PregnancyEpisode episode = null;
        if ("PREGNANCY_CHECK".equals(type) && "PREGNANT".equals(result)) {
            if (openPregnancy(cattle.getId()) != null) throw DomainException.conflict("MSG-FE12-02", "cattle_code", cattle.getDisplayCode());
            episode = new PregnancyEpisode(); episode.setCattle(cattle); episode.setConfirmingCheck(event); episode.setLinkedBreeding(linked);
            episode.setParity(nextParity(cattle)); episode.setStatus("OPEN");
            int gestation = gestationDays(farmId, clock.toFarmDate(occurred));
            if (linked != null) {
                episode.setExpectedCalvingDate(clock.toFarmDate(linked.getEventTime()).plusDays(gestation));
                episode.setExpectedBasis("CONFIRMED");
            } else if (req.estimatedMonthsPregnant() != null) {
                episode.setExpectedCalvingDate(clock.toFarmDate(occurred).plusDays(gestation - req.estimatedMonthsPregnant() * 30L));
                episode.setExpectedBasis("ESTIMATED");
            }
            em.persist(episode); event.setPregnancyEpisode(episode); em.flush();
        }
        if("ESTRUS".equals(type))reproductiveReminders.estrusRecorded(cattle,event);
        else if("BREEDING".equals(type))reproductiveReminders.breedingRecorded(cattle,event);
        else reproductiveReminders.pregnancyCheckRecorded(cattle,event,episode);
        audit.log(ctx, "REPRODUCTION_" + type + "_RECORD", "ReproductionEvent", event.getId(),
            Map.of("cattleId", cattle.getId(), "occurredAt", occurred.toString(), "result", result));
        return new ReproductionDtos.EventResult(event.getId(), type, event.getStatus(), event.getVersion(),
            event.getTentativeExpectedCalvingDate(), episode == null ? null : episode.getId(), cattle.getVersion());
    }

    public ReproductionDtos.PregnancyUpdateResult updatePregnancy(Long farmId, Long episodeId, String key, ReproductionDtos.PregnancyUpdateCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "PREGNANCY_UPDATE", key,
            Map.of("episodeId", episodeId, "request", req), ReproductionDtos.PregnancyUpdateResult.class,
            () -> updatePregnancyInCommand(farmId, episodeId, req));
    }

    public ReproductionDtos.PregnancyUpdateResult correctPregnancyUpdate(Long farmId, Long updateId, String key, ReproductionDtos.CorrectPregnancyUpdate req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "PREGNANCY_UPDATE_CORRECT", key,
            Map.of("updateId", updateId, "request", req), ReproductionDtos.PregnancyUpdateResult.class,
            () -> correctPregnancyUpdateInCommand(farmId, updateId, req));
    }

    @Transactional
    ReproductionDtos.PregnancyUpdateResult correctPregnancyUpdateInCommand(Long farmId, Long updateId, ReproductionDtos.CorrectPregnancyUpdate req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        PregnancyUpdate update = pregnancyUpdate(farmId, updateId);
        VersionGuard.requireExpected(update.getVersion(), req == null ? null : req.expectedVersion());
        requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(update.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        assertNoLaterPregnancyEvidence(update);
        Map<String,Object> before = pregnancyUpdateSnapshot(update);
        if (req.occurredAt() != null) { clock.assertNotFuture(req.occurredAt()); update.setOccurredTime(req.occurredAt()); }
        if (req.details() != null) update.setDetails(optional(req.details(), "details", 2000));
        update.setCorrected(Boolean.TRUE);
        if ("LOSS".equalsIgnoreCase(update.getType())) {
            update.getEpisode().setClosedDate(clock.toFarmDate(update.getOccurredTime()));
        }
        em.flush();
        revisions.record(ctx, "PregnancyUpdate", updateId, RecordRevisionService.CORRECT, req.reason(), before, pregnancyUpdateSnapshot(update));
        audit.log(ctx, "PREGNANCY_UPDATE_CORRECT", "PregnancyUpdate", updateId, Map.of("episodeId", update.getEpisode().getId()));
        return new ReproductionDtos.PregnancyUpdateResult(updateId, update.getEpisode().getId(), update.getType(), update.getEpisode().getStatus(), update.getEpisode().getVersion());
    }

    public ReproductionDtos.PregnancyUpdateResult voidPregnancyUpdate(Long farmId, Long updateId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "PREGNANCY_UPDATE_VOID", key,
            Map.of("updateId", updateId, "request", req), ReproductionDtos.PregnancyUpdateResult.class,
            () -> voidPregnancyUpdateInCommand(farmId, updateId, req));
    }

    @Transactional
    ReproductionDtos.PregnancyUpdateResult voidPregnancyUpdateInCommand(Long farmId, Long updateId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        PregnancyUpdate update = pregnancyUpdate(farmId, updateId);
        VersionGuard.requireExpected(update.getVersion(), req == null ? null : req.expectedVersion());
        requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(update.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        assertNoLaterPregnancyEvidence(update);
        Map<String,Object> before = pregnancyUpdateSnapshot(update);
        update.setStatus("VOIDED"); update.setStatusReason(req.reason().trim());
        if ("LOSS".equalsIgnoreCase(update.getType())) {
            update.getEpisode().setStatus("OPEN"); update.getEpisode().setCloseReason(null); update.getEpisode().setClosedDate(null);
        }
        em.flush();
        revisions.record(ctx, "PregnancyUpdate", updateId, RecordRevisionService.VOID, req.reason(), before, pregnancyUpdateSnapshot(update));
        audit.log(ctx, "PREGNANCY_UPDATE_VOID", "PregnancyUpdate", updateId, Map.of("episodeId", update.getEpisode().getId()));
        return new ReproductionDtos.PregnancyUpdateResult(updateId, update.getEpisode().getId(), update.getType(), update.getEpisode().getStatus(), update.getEpisode().getVersion());
    }

    @Transactional
    ReproductionDtos.PregnancyUpdateResult updatePregnancyInCommand(Long farmId, Long episodeId, ReproductionDtos.PregnancyUpdateCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null) throw DomainException.required("request");
        PregnancyEpisode episode = episode(farmId, episodeId);
        cattleGuard.lockWritable(farmId, episode.getCattle().getId());
        VersionGuard.requireExpected(episode.getVersion(), req.expectedEpisodeVersion());
        if (!"OPEN".equalsIgnoreCase(episode.getStatus())) throw DomainException.conflict("MSG-FE12-12", "cattle_code", episode.getCattle().getDisplayCode());
        Instant occurred = requiredTime(req.occurredAt(), "occurredAt"); clock.assertNotFuture(occurred);
        assertAfter(occurred, episode.getConfirmingCheck() == null ? null : episode.getConfirmingCheck().getEventTime());
        String type = normalize(req.type());
        if (!Set.of("OBSERVATION", "COMPLICATION", "LOSS").contains(type)) throw DomainException.invalid("type");
        HealthCase healthCase = null;
        if (req.healthCaseId() != null) {
            healthCase = em.createQuery("select h from HealthCase h where h.id=:id and h.cattle.id=:cattle", HealthCase.class)
                .setParameter("id", req.healthCaseId()).setParameter("cattle", episode.getCattle().getId()).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "healthCaseId", req.healthCaseId()));
        }
        if ("COMPLICATION".equals(type) && req.details() == null && healthCase == null) throw DomainException.required("details");
        PregnancyUpdate update = new PregnancyUpdate(); update.setEpisode(episode); update.setOccurredTime(occurred); update.setRecordedAt(clock.now());
        update.setRecordedBy(ctx.user()); update.setSource(dataSource(req.source()));
        update.setType(type); update.setDetails(optional(req.details(), "details", 2000)); update.setHealthCase(healthCase);
        em.persist(update);
        if ("LOSS".equals(type)) { episode.setStatus("LOST"); episode.setCloseReason("PREGNANCY_LOSS"); episode.setClosedDate(clock.toFarmDate(occurred)); reproductiveReminders.pregnancyLost(episode); }
        em.flush();
        audit.log(ctx, "PREGNANCY_UPDATE_RECORD", "PregnancyUpdate", update.getId(), Map.of("episodeId", episodeId, "type", type));
        return new ReproductionDtos.PregnancyUpdateResult(update.getId(), episodeId, type, episode.getStatus(), episode.getVersion());
    }

    public ReproductionDtos.CalvingResult recordCalving(Long farmId, String key, ReproductionDtos.CalvingCommand req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALVING_RECORD", key, req,
            ReproductionDtos.CalvingResult.class, () -> recordCalvingInCommand(farmId, req));
    }

    @Transactional
    ReproductionDtos.CalvingResult recordCalvingInCommand(Long farmId, ReproductionDtos.CalvingCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        if (req == null || req.cattleId() == null) throw DomainException.required("cattleId");
        Cattle dam = cattleGuard.lockWritable(farmId, req.cattleId());
        VersionGuard.requireExpected(dam.getVersion(), req.expectedCattleVersion());
        assertFemaleApplicable(dam, false);
        Instant birth = requiredTime(req.birthTime(), "birthTime"); clock.assertNotFuture(birth);
        if (dam.getCreatedAt() != null && birth.isBefore(dam.getCreatedAt())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "event_before_herd_entry");
        if (req.calves() == null || req.calves().isEmpty()) throw DomainException.required("calves");
        if (req.calves().size() > 10) throw DomainException.invalid("calves");
        PregnancyEpisode episode = req.episodeId() == null ? openPregnancy(dam.getId()) : episode(farmId, req.episodeId());
        if (req.episodeId() != null && !episode.getCattle().getId().equals(dam.getId())) throw DomainException.notFound(MessageCodes.COM_08, "episodeId", req.episodeId());
        if (episode != null) {
            VersionGuard.requireExpected(episode.getVersion(), req.expectedEpisodeVersion());
            if (!"OPEN".equalsIgnoreCase(episode.getStatus())) throw DomainException.conflict("MSG-FE12-12", "cattle_code", dam.getDisplayCode());
            assertAfter(birth, episode.getConfirmingCheck() == null ? null : episode.getConfirmingCheck().getEventTime());
        } else if (req.expectedEpisodeVersion() != null) throw DomainException.invalid("expectedEpisodeVersion");
        Long recentCalvings = em.createQuery("select count(c) from CalvingEvent c where c.dam.id=:dam and c.status='VALID' and c.birthTime between :from and :to", Long.class)
            .setParameter("dam", dam.getId()).setParameter("from", birth.minusSeconds(30L * 86400)).setParameter("to", birth.plusSeconds(30L * 86400)).getSingleResult();
        List<String> warnings = recentCalvings > 0 ? List.of("CALVING_WITHIN_30_DAYS") : List.of();

        CalvingEvent calving = new CalvingEvent(); calving.setDam(dam); calving.setEpisode(episode); calving.setBirthTime(birth);
        calving.setSource(dataSource(req.source()));
        String course = normalize(boundedRequired(req.course(), "course", 30));
        String damCondition = normalize(boundedRequired(req.damCondition(), "damCondition", 30));
        if (!Set.of("NORMAL", "ASSISTED", "CAESAREAN").contains(course)) throw DomainException.invalid("course");
        if (!Set.of("GOOD", "NEEDS_MONITORING", "CRITICAL").contains(damCondition)) throw DomainException.invalid("damCondition");
        calving.setCourse(course); calving.setDamCondition(damCondition);
        calving.setRetainedPlacenta(Boolean.TRUE.equals(req.retainedPlacenta())); calving.setAttendant(optional(req.attendant(), "attendant", 100));
        calving.setRecordedAt(clock.now()); calving.setRecordedBy(ctx.user());
        em.persist(calving); em.flush();
        Set<Integer> calfNos = new HashSet<>(); List<Long> outcomeIds = new ArrayList<>(); List<Long> registered = new ArrayList<>();
        for (int i = 0; i < req.calves().size(); i++) {
            ReproductionDtos.CalfCommand command = req.calves().get(i);
            int calfNo = command.calfNo() == null ? i + 1 : command.calfNo();
            if (calfNo < 1 || !calfNos.add(calfNo)) throw DomainException.invalid("calfNo");
            CalfOutcome calf = makeCalf(farmId, calving, command, calfNo);
            em.persist(calf); em.flush(); outcomeIds.add(calf.getId());
            if (Boolean.TRUE.equals(command.registerNow())) {
                if (!"LIVE".equalsIgnoreCase(calf.getOutcome())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "stillborn_cannot_register");
                var result = pendingCalves.registerCalfNow(farmId, calf.getId(), calf.getProposedPen() == null ? null : calf.getProposedPen().getId(),
                    calf.getProposedPurpose() == null ? null : calf.getProposedPurpose().getId());
                registered.add(result.cattleId());
            } else if ("LIVE".equalsIgnoreCase(calf.getOutcome())) {
                entryReminders.raiseCalfReminder(calf, dam);
            }
        }
        if (episode != null) {
            episode.setStatus("CALVED"); episode.setClosedDate(clock.toFarmDate(birth)); episode.setCloseReason("CALVED");
        }
        reproductiveReminders.calvingRecorded(dam,calving.getId(),birth);
        em.flush();
        audit.log(ctx, "CALVING_RECORD", "CalvingEvent", calving.getId(), Map.of("damId", dam.getId(), "calfCount", req.calves().size()));
        return new ReproductionDtos.CalvingResult(calving.getId(), calving.getStatus(), calving.getVersion(),
            episode == null ? null : episode.getId(), outcomeIds, registered, warnings);
    }

    private CalfOutcome makeCalf(Long farmId, CalvingEvent calving, ReproductionDtos.CalfCommand req, int calfNo) {
        if (req == null) throw DomainException.required("calves");
        String outcome = normalize(req.outcome()); String sex = req.sex() == null ? null : normalize(req.sex());
        if (!Set.of("LIVE", "STILLBORN").contains(outcome)) throw DomainException.invalid("outcome");
        if ("LIVE".equals(outcome) && !Set.of("MALE", "FEMALE").contains(sex)) throw DomainException.invalid("sex");
        if ("STILLBORN".equals(outcome) && sex != null && !Set.of("MALE", "FEMALE", "UNKNOWN").contains(sex)) throw DomainException.invalid("sex");
        BigDecimal weight = req.birthWeight();
        if (weight != null && (weight.signum() <= 0 || req.weightUnit() == null || req.weightBasis() == null)) throw DomainException.invalid("birthWeight");
        if (weight == null && (req.weightUnit() != null || req.weightBasis() != null)) throw DomainException.invalid("weightUnit");
        if (req.weightBasis() != null && !Set.of("MEASURED", "ESTIMATED").contains(normalize(req.weightBasis()))) throw DomainException.invalid("weightBasis");
        Cattle dam = calving.getDam();
        String tag = optional(req.tagCode(), "tagCode", 50);
        if (tag != null && (em.createQuery("select count(c) from Cattle c where c.farm.id=:farm and (lower(c.displayCode)=lower(:tag) or lower(c.earTagNumber)=lower(:tag))", Long.class)
            .setParameter("farm", farmId).setParameter("tag", tag).getSingleResult() > 0
            || em.createQuery("select count(o) from CalfOutcome o where o.calving.dam.farm.id=:farm and lower(o.tagCode)=lower(:tag)", Long.class)
                .setParameter("farm", farmId).setParameter("tag", tag).getSingleResult() > 0)) throw DomainException.conflict(MessageCodes.FE06_02, "cattle_code", tag);
        Pen pen = req.proposedPenId() == null ? null : em.createQuery("select p from Pen p where p.id=:id and p.farm.id=:farm", Pen.class)
            .setParameter("id", req.proposedPenId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "penId", req.proposedPenId()));
        if (pen != null && (pen.getStatus() == null || !"ACTIVE".equals(pen.getStatus().name()))) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "pen_inactive");
        Breed breed = req.breedId() == null ? null : em.createQuery("select b from Breed b where b.id=:id and b.farm.id=:farm", Breed.class)
            .setParameter("id", req.breedId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "breedId", req.breedId()));
        if (breed != null && !Boolean.TRUE.equals(breed.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "breed_inactive");
        ProductionPurpose purpose = req.purposeId() == null ? null : em.createQuery("select p from ProductionPurpose p where p.id=:id and p.farm.id=:farm", ProductionPurpose.class)
            .setParameter("id", req.purposeId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "purposeId", req.purposeId()));
        if (purpose != null && !Boolean.TRUE.equals(purpose.getAvailable())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "purpose_inactive");
        CalfOutcome calf = new CalfOutcome(); calf.setCalving(calving); calf.setCalfNo(calfNo); calf.setOutcome(outcome); calf.setSex(sex);
        calf.setBirthWeight(weight); calf.setWeightUnit(req.weightUnit() == null ? null : bounded(req.weightUnit(), "weightUnit", 30));
        calf.setWeightBasis(req.weightBasis() == null ? null : normalize(req.weightBasis())); calf.setTagCode(tag); calf.setProposedPen(pen);
        calf.setBreed(breed); calf.setProposedPurpose(purpose); calf.setRegistrationState("LIVE".equals(outcome) ? "PENDING_CONFIRMATION" : "NOT_REQUIRED");
        return calf;
    }

    public ReproductionDtos.EventResult correctEvent(Long farmId, Long eventId, String key, ReproductionDtos.CorrectEvent req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_EVENT_CORRECT", key,
            Map.of("eventId", eventId, "request", req), ReproductionDtos.EventResult.class, () -> correctEventInCommand(farmId, eventId, req));
    }

    @Transactional
    ReproductionDtos.EventResult correctEventInCommand(Long farmId, Long eventId, ReproductionDtos.CorrectEvent req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        ReproductionEvent event = event(farmId, eventId);
        Cattle cattle = cattleGuard.lockCattle(farmId, event.getCattle().getId());
        VersionGuard.requireExpected(event.getVersion(), req == null ? null : req.expectedVersion());
        requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(event.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        if (hasReproductionDependents(event) && (req.occurredAt() != null || req.method() != null || req.result() != null))
            throw DomainException.conflict("MSG-FE12-02", "cattle_code", cattle.getDisplayCode());
        Map<String,Object> before = eventSnapshot(event);
        if (req.occurredAt() != null) { clock.assertNotFuture(req.occurredAt()); event.setEventTime(req.occurredAt()); }
        if (req.method() != null) event.setMethod(optional(req.method(), "method", 30));
        if (req.result() != null) {
            if (event.getPregnancyEpisode() != null) throw DomainException.conflict("MSG-FE12-02", "cattle_code", cattle.getDisplayCode());
            String result = normalize(req.result());
            if ("PREGNANCY_CHECK".equals(event.getType()) && !Set.of("PREGNANT", "NOT_PREGNANT", "INCONCLUSIVE").contains(result)) throw DomainException.invalid("result");
            event.setResult(result);
            if("PREGNANCY_CHECK".equals(event.getType())&&"PREGNANT".equals(result)&&event.getPregnancyEpisode()==null){
                if(openPregnancy(cattle.getId())!=null)throw DomainException.conflict("MSG-FE12-02","cattle_code",cattle.getDisplayCode());
                PregnancyEpisode episode=new PregnancyEpisode();episode.setCattle(cattle);episode.setConfirmingCheck(event);episode.setLinkedBreeding(event.getLinkedEvent());
                episode.setParity(nextParity(cattle));episode.setStatus("OPEN");
                int gestation=gestationDays(farmId,clock.toFarmDate(event.getEventTime()));
                if(event.getLinkedEvent()!=null){episode.setExpectedCalvingDate(clock.toFarmDate(event.getLinkedEvent().getEventTime()).plusDays(gestation));episode.setExpectedBasis("CONFIRMED");}
                else if(event.getEstMonthsPregnant()!=null){episode.setExpectedCalvingDate(clock.toFarmDate(event.getEventTime()).plusDays(gestation-event.getEstMonthsPregnant()*30L));episode.setExpectedBasis("ESTIMATED");}
                em.persist(episode);event.setPregnancyEpisode(episode);
            }
        }
        if("BREEDING".equals(event.getType())&&req.occurredAt()!=null)
            event.setTentativeExpectedCalvingDate(clock.toFarmDate(event.getEventTime()).plusDays(gestationDays(farmId,clock.toFarmDate(event.getEventTime()))));
        if (req.description() != null) event.setDescription(optional(req.description(), "description", 1000));
        if (req.performedBy() != null) event.setPerformedBy(optional(req.performedBy(), "performedBy", 255));
        if (req.examiner() != null) event.setExaminer(optional(req.examiner(), "examiner", 255));
        if (req.observer() != null) event.setObserver(optional(req.observer(), "observer", 100));
        event.setCorrected(true); event.setUpdatedAt(clock.now()); em.flush();
        reproductiveReminders.eventCorrected(cattle,event,event.getPregnancyEpisode());
        revisions.record(ctx, "ReproductionEvent", eventId, RecordRevisionService.CORRECT, req.reason(), before, eventSnapshot(event));
        audit.log(ctx, "REPRODUCTION_EVENT_CORRECT", "ReproductionEvent", eventId, Map.of("cattleId", cattle.getId()));
        return new ReproductionDtos.EventResult(event.getId(), event.getType(), event.getStatus(), event.getVersion(), event.getTentativeExpectedCalvingDate(),
            event.getPregnancyEpisode() == null ? null : event.getPregnancyEpisode().getId(), cattle.getVersion());
    }

    public ReproductionDtos.EventResult voidEvent(Long farmId, Long eventId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "REPRODUCTION_EVENT_VOID", key,
            Map.of("eventId", eventId, "request", req), ReproductionDtos.EventResult.class, () -> voidEventInCommand(farmId, eventId, req));
    }

    public ReproductionDtos.CalvingResult correctCalving(Long farmId, Long calvingId, String key, ReproductionDtos.CorrectCalving req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALVING_CORRECT", key,
            Map.of("calvingId", calvingId, "request", req), ReproductionDtos.CalvingResult.class,
            () -> correctCalvingInCommand(farmId, calvingId, req));
    }

    @Transactional
    ReproductionDtos.CalvingResult correctCalvingInCommand(Long farmId, Long calvingId, ReproductionDtos.CorrectCalving req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalvingEvent calving = calving(farmId, calvingId);
        VersionGuard.requireExpected(calving.getVersion(), req == null ? null : req.expectedVersion()); requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(calving.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String,Object> before = calvingSnapshot(calving);
        boolean registered = em.createQuery("select count(o) from CalfOutcome o where o.calving.id=:id and o.registrationState='REGISTERED'", Long.class)
            .setParameter("id", calvingId).getSingleResult() > 0;
        if (req.birthTime() != null) {
            clock.assertNotFuture(req.birthTime());
            if (registered && !req.birthTime().equals(calving.getBirthTime())) throw DomainException.conflict("MSG-FE12-12", "reason", "registered_calf_entry_date_depends_on_birth");
            if (calving.getDam().getCreatedAt()!=null && req.birthTime().isBefore(calving.getDam().getCreatedAt())) throw DomainException.unprocessable(MessageCodes.COM_05,"reason","event_before_herd_entry");
            if (calving.getEpisode()!=null && calving.getEpisode().getConfirmingCheck()!=null && req.birthTime().isBefore(calving.getEpisode().getConfirmingCheck().getEventTime()))
                throw DomainException.conflict("MSG-FE12-12","reason","birth_before_confirmed_pregnancy");
            calving.setBirthTime(req.birthTime());
        }
        if (req.source() != null) calving.setSource(dataSource(req.source()));
        if (req.course() != null) {
            String course = normalize(req.course()); if (!Set.of("NORMAL","ASSISTED","CAESAREAN").contains(course)) throw DomainException.invalid("course"); calving.setCourse(course);
        }
        if (req.damCondition() != null) {
            String value = normalize(req.damCondition()); if (!Set.of("GOOD","NEEDS_MONITORING","CRITICAL").contains(value)) throw DomainException.invalid("damCondition"); calving.setDamCondition(value);
        }
        if (req.retainedPlacenta() != null) calving.setRetainedPlacenta(req.retainedPlacenta());
        if (req.attendant() != null) calving.setAttendant(optional(req.attendant(), "attendant", 100));
        calving.setCorrected(Boolean.TRUE); em.flush();
        if (calving.getEpisode() != null) calving.getEpisode().setClosedDate(clock.toFarmDate(calving.getBirthTime()));
        reproductiveReminders.calvingCorrected(calving.getDam(),calving.getId(),calving.getBirthTime());
        em.flush();
        revisions.record(ctx, "CalvingEvent", calvingId, RecordRevisionService.CORRECT, req.reason(), before, calvingSnapshot(calving));
        audit.log(ctx, "CALVING_CORRECT", "CalvingEvent", calvingId, Map.of("damId", calving.getDam().getId()));
        return new ReproductionDtos.CalvingResult(calvingId, calving.getStatus(), calving.getVersion(),
            calving.getEpisode() == null ? null : calving.getEpisode().getId(), calfIds(calvingId), registeredCattleIds(calvingId), List.of());
    }

    public ReproductionDtos.CalvingResult voidCalving(Long farmId, Long calvingId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALVING_VOID", key,
            Map.of("calvingId", calvingId, "request", req), ReproductionDtos.CalvingResult.class,
            () -> voidCalvingInCommand(farmId, calvingId, req));
    }

    @Transactional
    ReproductionDtos.CalvingResult voidCalvingInCommand(Long farmId, Long calvingId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalvingEvent calving = calving(farmId, calvingId);
        VersionGuard.requireExpected(calving.getVersion(), req == null ? null : req.expectedVersion()); requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(calving.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        List<CalfOutcome> outcomes = em.createQuery("select o from CalfOutcome o where o.calving.id=:id order by o.calfNo,o.id", CalfOutcome.class)
            .setParameter("id", calvingId).getResultList();
        if (outcomes.stream().anyMatch(o -> "REGISTERED".equalsIgnoreCase(o.getRegistrationState())))
            throw DomainException.conflict("MSG-FE12-12", "reason", "registered_calf_depends_on_calving");
        if (calving.getEpisode() != null && em.createQuery("select count(u) from PregnancyUpdate u where u.episode.id=:episode and u.status='VALID' and u.occurredTime>:birth",Long.class)
            .setParameter("episode",calving.getEpisode().getId()).setParameter("birth",calving.getBirthTime()).getSingleResult()>0)
            throw DomainException.conflict("MSG-FE12-12","reason","later_pregnancy_update_depends_on_calving");
        Map<String,Object> before = calvingSnapshot(calving);
        for (CalfOutcome calf : outcomes) {
            Map<String,Object> calfBefore=calfSnapshot(calf);
            calf.setStatus("VOIDED"); calf.setStatusReason(req.reason().trim()); entryReminders.cancelCalfReminder(calf);
            em.flush();
            revisions.record(ctx,"CalfOutcome",calf.getId(),RecordRevisionService.VOID,req.reason(),calfBefore,calfSnapshot(calf));
        }
        calving.setStatus("VOIDED"); calving.setStatusReason(req.reason().trim());
        if (calving.getEpisode() != null) {
            PregnancyUpdate loss = em.createQuery("select u from PregnancyUpdate u where u.episode.id=:episode and u.status='VALID' and u.type='LOSS' order by u.occurredTime desc,u.id desc",PregnancyUpdate.class)
                .setParameter("episode",calving.getEpisode().getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
            calving.getEpisode().setStatus(loss==null?"OPEN":"LOST");
            calving.getEpisode().setClosedDate(loss==null?null:clock.toFarmDate(loss.getOccurredTime()));
            calving.getEpisode().setCloseReason(loss==null?null:"PREGNANCY_LOSS");
            if(loss==null)reproductiveReminders.calvingVoided(calving.getDam(),calvingId,calving.getEpisode());
            else reproductiveReminders.pregnancyLost(calving.getEpisode());
        }
        em.flush();
        revisions.record(ctx, "CalvingEvent", calvingId, RecordRevisionService.VOID, req.reason(), before, calvingSnapshot(calving));
        audit.log(ctx, "CALVING_VOID", "CalvingEvent", calvingId, Map.of("damId", calving.getDam().getId(), "calfCount", outcomes.size()));
        return new ReproductionDtos.CalvingResult(calvingId, calving.getStatus(), calving.getVersion(), calving.getEpisode() == null ? null : calving.getEpisode().getId(),
            calfIds(calvingId), List.of(), List.of());
    }

    public ReproductionDtos.CalfOutcomeResult correctCalf(Long farmId, Long calfId, String key, ReproductionDtos.CorrectCalf req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALF_OUTCOME_CORRECT", key,
            Map.of("calfId", calfId, "request", req), ReproductionDtos.CalfOutcomeResult.class,
            () -> correctCalfInCommand(farmId, calfId, req));
    }

    @Transactional
    ReproductionDtos.CalfOutcomeResult correctCalfInCommand(Long farmId, Long calfId, ReproductionDtos.CorrectCalf req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalfOutcome calf = calf(farmId, calfId); VersionGuard.requireExpected(calf.getVersion(), req == null ? null : req.expectedVersion()); requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(calf.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        Map<String,Object> before = calfSnapshot(calf);
        if ("REGISTERED".equalsIgnoreCase(calf.getRegistrationState()) &&
            (req.outcome()!=null || req.sex()!=null || req.birthWeight()!=null || req.weightUnit()!=null || req.weightBasis()!=null ||
             req.tagCode()!=null || req.proposedPenId()!=null || req.breedId()!=null || req.purposeId()!=null || Boolean.TRUE.equals(req.registerNow())))
            throw DomainException.conflict("MSG-FE12-12", "reason", "registered_calf_data_is_linked_to_cattle");
        if ((req.weightUnit()!=null || req.weightBasis()!=null) && req.birthWeight()==null)
            throw DomainException.invalid("birthWeight");
        String outcome = req.outcome() == null ? calf.getOutcome() : normalize(req.outcome());
        String sex = req.sex() == null ? calf.getSex() : normalize(req.sex());
        if (!Set.of("LIVE","STILLBORN").contains(normalize(outcome))) throw DomainException.invalid("outcome");
        if ("LIVE".equalsIgnoreCase(outcome) && !Set.of("MALE","FEMALE").contains(normalize(sex))) throw DomainException.invalid("sex");
        if ("STILLBORN".equalsIgnoreCase(outcome) && sex != null && !Set.of("MALE","FEMALE","UNKNOWN").contains(normalize(sex))) throw DomainException.invalid("sex");
        if ("STILLBORN".equalsIgnoreCase(outcome) && Boolean.TRUE.equals(req.registerNow())) throw DomainException.unprocessable(MessageCodes.COM_05,"reason","stillborn_cannot_register");
        if (req.birthWeight() != null) {
            if (req.birthWeight().signum() <= 0 || req.weightUnit() == null || req.weightBasis() == null) throw DomainException.invalid("birthWeight");
            calf.setBirthWeight(req.birthWeight()); calf.setWeightUnit(bounded(req.weightUnit(), "weightUnit", 30));
            String basis = normalize(req.weightBasis()); if (!Set.of("MEASURED","ESTIMATED").contains(basis)) throw DomainException.invalid("weightBasis"); calf.setWeightBasis(basis);
        }
        if (req.outcome() != null) calf.setOutcome(outcome);
        if (req.sex() != null) calf.setSex(sex);
        if (req.tagCode() != null) {
            String tag=optional(req.tagCode(),"tagCode",50);
            if(tag!=null && (em.createQuery("select count(c) from Cattle c where c.farm.id=:farm and (lower(c.displayCode)=lower(:tag) or lower(c.earTagNumber)=lower(:tag))",Long.class)
                .setParameter("farm",farmId).setParameter("tag",tag).getSingleResult()>0 ||
                em.createQuery("select count(o) from CalfOutcome o where o.id<>:id and o.calving.dam.farm.id=:farm and lower(o.tagCode)=lower(:tag) and o.status='VALID'",Long.class)
                    .setParameter("id",calfId).setParameter("farm",farmId).setParameter("tag",tag).getSingleResult()>0))
                throw DomainException.conflict(MessageCodes.FE06_02,"cattle_code",tag);
            calf.setTagCode(tag);
        }
        if (req.proposedPenId() != null) calf.setProposedPen(em.createQuery("select p from Pen p where p.id=:id and p.farm.id=:farm", Pen.class)
            .setParameter("id", req.proposedPenId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "penId", req.proposedPenId())));
        if (req.breedId() != null) calf.setBreed(em.createQuery("select b from Breed b where b.id=:id and b.farm.id=:farm", Breed.class)
            .setParameter("id", req.breedId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "breedId", req.breedId())));
        if (req.purposeId() != null) calf.setProposedPurpose(em.createQuery("select p from ProductionPurpose p where p.id=:id and p.farm.id=:farm", ProductionPurpose.class)
            .setParameter("id", req.purposeId()).setParameter("farm", farmId).getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "purposeId", req.purposeId())));
        if ("STILLBORN".equalsIgnoreCase(calf.getOutcome())) {
            calf.setRegistrationState("NOT_REQUIRED"); entryReminders.cancelCalfReminder(calf);
        } else if (!"REGISTERED".equalsIgnoreCase(calf.getRegistrationState())) {
            calf.setRegistrationState("PENDING_CONFIRMATION");
            if (Boolean.TRUE.equals(req.registerNow())) {
                var registered = pendingCalves.registerCalfNow(farmId, calf.getId(), calf.getProposedPen() == null ? null : calf.getProposedPen().getId(),
                    calf.getProposedPurpose() == null ? null : calf.getProposedPurpose().getId());
                calf.setCorrected(true); em.flush();
                revisions.record(ctx, "CalfOutcome", calfId, RecordRevisionService.CORRECT, req.reason(), before, calfSnapshot(calf));
                audit.log(ctx, "CALF_OUTCOME_REGISTER", "CalfOutcome", calfId, Map.of("cattleId", registered.cattleId()));
                return calfResult(calf);
            }
            entryReminders.raiseCalfReminder(calf, calf.getCalving().getDam());
        }
        calf.setCorrected(true); em.flush();
        revisions.record(ctx, "CalfOutcome", calfId, RecordRevisionService.CORRECT, req.reason(), before, calfSnapshot(calf));
        audit.log(ctx, "CALF_OUTCOME_CORRECT", "CalfOutcome", calfId, Map.of("calvingId", calf.getCalving().getId()));
        return calfResult(calf);
    }

    public ReproductionDtos.CalfOutcomeResult voidCalf(Long farmId, Long calfId, String key, ReproductionDtos.VoidRecord req) {
        return idempotency.execute(farmId, FarmAction.MANAGE_REPRODUCTION, "CALF_OUTCOME_VOID", key,
            Map.of("calfId", calfId, "request", req), ReproductionDtos.CalfOutcomeResult.class,
            () -> voidCalfInCommand(farmId, calfId, req));
    }

    @Transactional
    ReproductionDtos.CalfOutcomeResult voidCalfInCommand(Long farmId, Long calfId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        CalfOutcome calf = calf(farmId, calfId); VersionGuard.requireExpected(calf.getVersion(), req == null ? null : req.expectedVersion()); requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(calf.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        if ("REGISTERED".equalsIgnoreCase(calf.getRegistrationState())) throw DomainException.conflict("MSG-FE12-12", "reason", "registered_calf_cannot_be_voided");
        Map<String,Object> before = calfSnapshot(calf); calf.setStatus("VOIDED"); calf.setStatusReason(req.reason().trim());
        entryReminders.cancelCalfReminder(calf); em.flush();
        revisions.record(ctx, "CalfOutcome", calfId, RecordRevisionService.VOID, req.reason(), before, calfSnapshot(calf));
        audit.log(ctx, "CALF_OUTCOME_VOID", "CalfOutcome", calfId, Map.of("calvingId", calf.getCalving().getId()));
        return calfResult(calf);
    }

    @Transactional
    ReproductionDtos.EventResult voidEventInCommand(Long farmId, Long eventId, ReproductionDtos.VoidRecord req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_REPRODUCTION);
        ReproductionEvent event = event(farmId, eventId);
        Cattle cattle = cattleGuard.lockCattle(farmId, event.getCattle().getId());
        VersionGuard.requireExpected(event.getVersion(), req == null ? null : req.expectedVersion()); requireReason(req == null ? null : req.reason());
        if (!"VALID".equalsIgnoreCase(event.getStatus())) throw DomainException.conflict(MessageCodes.COM_05);
        PregnancyEpisode confirmed = event.getPregnancyEpisode();
        if (hasBlockingReproductionDependents(event, confirmed)) throw DomainException.conflict("MSG-FE12-02", "cattle_code", cattle.getDisplayCode());
        Map<String,Object> before = eventSnapshot(event); event.setStatus("VOIDED"); event.setStatusReason(req.reason().trim()); event.setUpdatedAt(clock.now());
        if (confirmed != null) {
            confirmed.setStatus("VOIDED"); confirmed.setCloseReason("CONFIRMING_CHECK_VOIDED"); confirmed.setClosedDate(clock.today());
        }
        reproductiveReminders.eventVoided(cattle,event);
        em.flush();
        revisions.record(ctx, "ReproductionEvent", eventId, RecordRevisionService.VOID, req.reason(), before, eventSnapshot(event));
        audit.log(ctx, "REPRODUCTION_EVENT_VOID", "ReproductionEvent", eventId, Map.of("cattleId", cattle.getId()));
        return new ReproductionDtos.EventResult(event.getId(), event.getType(), event.getStatus(), event.getVersion(), event.getTentativeExpectedCalvingDate(), null, cattle.getVersion());
    }

    private void setSireFields(Long farmId, ReproductionEvent event, ReproductionDtos.EventCommand req) {
        String source = req.sireSource() == null ? (req.sireId() == null ? "UNKNOWN" : "INTERNAL") : normalize(req.sireSource());
        source = switch (source) { case "ON_FARM" -> "INTERNAL"; case "EXTERNAL" -> "EXTERNAL"; default -> source; };
        event.setSireSource(source);
        if ("INTERNAL".equals(source)) {
            if (req.sireId() == null) throw DomainException.required("sireId");
            Cattle sire = em.createQuery("select c from Cattle c where c.id=:id and c.farm.id=:farm", Cattle.class)
                .setParameter("id", req.sireId()).setParameter("farm", farmId).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "sireId", req.sireId()));
            if (sire.getSex() == null || !"MALE".equals(sire.getSex().name()) || sire.getHerdStatus()==null || !"ACTIVE".equals(sire.getHerdStatus().name())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "sire_must_be_active_male");
            event.setSire(sire);
        } else if ("EXTERNAL".equals(source)) {
            if (req.externalSireName() != null) event.setExternalSireName(optional(req.externalSireName(), "externalSireName", 255));
            if (req.sireBreedId() == null) throw DomainException.required("sireBreedId");
            event.setSireBreed(em.createQuery("select b from Breed b where b.id=:id and b.farm.id=:farm", Breed.class)
                .setParameter("id", req.sireBreedId()).setParameter("farm", farmId).getResultStream().findFirst()
                .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "sireBreedId", req.sireBreedId())));
            event.setSemenBatch(optional(req.semenBatch(), "semenBatch", 50)); event.setSupplier(optional(req.supplier(), "supplier", 100));
        } else if (!"UNKNOWN".equals(source)) throw DomainException.invalid("sireSource");
    }

    private ReproductionEvent linkedEvent(Long farmId, Cattle cattle, String type, Long id, Instant occurred) {
        String requiredType = "BREEDING".equals(type) ? "ESTRUS" : "PREGNANCY_CHECK".equals(type) ? "BREEDING" : null;
        if (id == null) return null;
        if (requiredType == null) throw DomainException.invalid("linkedEventId");
        ReproductionEvent linked = event(farmId, id);
        if (!linked.getCattle().getId().equals(cattle.getId()) || !requiredType.equals(linked.getType()) || !"VALID".equalsIgnoreCase(linked.getStatus()) || linked.getEventTime().isAfter(occurred))
            throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "invalid_linked_event");
        return linked;
    }

    private int gestationDays(Long farmId, LocalDate date) {
        return em.createQuery("select p.gestationLengthDays from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.versionNo desc", Integer.class)
            .setParameter("farm", farmId).setParameter("date", date).setMaxResults(1).getResultStream().findFirst().orElse(283);
    }
    private int nextParity(Cattle cattle) {
        Long count = em.createQuery("select count(c) from CalvingEvent c where c.dam.id=:dam and c.status='VALID'", Long.class).setParameter("dam", cattle.getId()).getSingleResult();
        return Math.max(cattle.getDeclaredParity() == null ? 0 : cattle.getDeclaredParity(), count.intValue()) + 1;
    }
    private PregnancyEpisode openPregnancy(Long cattleId) {
        return em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:id and upper(p.status)='OPEN' order by p.id desc", PregnancyEpisode.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }
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
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "pregnancyUpdateId", id));
    }
    private CalvingEvent calving(Long farmId, Long id) {
        return em.createQuery("select c from CalvingEvent c where c.id=:id and c.dam.farm.id=:farm", CalvingEvent.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calvingId", id));
    }
    private CalfOutcome calf(Long farmId, Long id) {
        return em.createQuery("select o from CalfOutcome o where o.id=:id and o.calving.dam.farm.id=:farm", CalfOutcome.class)
            .setParameter("id", id).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "calfOutcomeId", id));
    }
    private ReproductionDtos.CalfOutcomeResult calfResult(CalfOutcome calf) {
        return new ReproductionDtos.CalfOutcomeResult(calf.getId(), calf.getOutcome(), calf.getSex(), calf.getBirthWeight(),
            calf.getRegistrationState(), calf.getStatus(), calf.getVersion(),
            calf.getRegisteredCattle() == null ? null : calf.getRegisteredCattle().getId());
    }
    private List<Long> calfIds(Long calvingId) {
        return em.createQuery("select o.id from CalfOutcome o where o.calving.id=:id order by o.calfNo,o.id", Long.class)
            .setParameter("id", calvingId).getResultList();
    }
    private List<Long> registeredCattleIds(Long calvingId) {
        return em.createQuery("select o.registeredCattle.id from CalfOutcome o where o.calving.id=:id and o.registeredCattle is not null order by o.calfNo,o.id", Long.class)
            .setParameter("id", calvingId).getResultList();
    }
    private Map<String,Object> calvingSnapshot(CalvingEvent c) {
        Map<String,Object> m = new LinkedHashMap<>(); m.put("damId", c.getDam().getId()); m.put("episodeId", c.getEpisode() == null ? null : c.getEpisode().getId());
        m.put("birthTime", c.getBirthTime()); m.put("source", c.getSource()); m.put("course", c.getCourse()); m.put("damCondition", c.getDamCondition());
        m.put("retainedPlacenta", c.getRetainedPlacenta()); m.put("attendant", c.getAttendant()); m.put("status", c.getStatus()); return m;
    }
    private Map<String,Object> calfSnapshot(CalfOutcome c) {
        Map<String,Object> m = new LinkedHashMap<>(); m.put("calvingId", c.getCalving().getId()); m.put("calfNo", c.getCalfNo()); m.put("outcome", c.getOutcome());
        m.put("sex", c.getSex()); m.put("birthWeight", c.getBirthWeight()); m.put("weightUnit", c.getWeightUnit()); m.put("weightBasis", c.getWeightBasis());
        m.put("tagCode", c.getTagCode()); m.put("registrationState", c.getRegistrationState()); m.put("status", c.getStatus()); return m;
    }
    private void assertNoLaterPregnancyEvidence(PregnancyUpdate update) {
        Long laterUpdates = em.createQuery("select count(u) from PregnancyUpdate u where u.episode.id=:episode and u.id<>:id and u.status='VALID' and u.occurredTime>=:time", Long.class)
            .setParameter("episode", update.getEpisode().getId()).setParameter("id", update.getId()).setParameter("time", update.getOccurredTime()).getSingleResult();
        Long calvings = em.createQuery("select count(c) from CalvingEvent c where c.episode.id=:episode and c.status='VALID'", Long.class)
            .setParameter("episode", update.getEpisode().getId()).getSingleResult();
        if (laterUpdates > 0 || calvings > 0) throw DomainException.conflict("MSG-FE12-12", "cattle_code", update.getEpisode().getCattle().getDisplayCode());
    }
    private Map<String,Object> pregnancyUpdateSnapshot(PregnancyUpdate u) {
        Map<String,Object> m = new LinkedHashMap<>(); m.put("episodeId", u.getEpisode().getId()); m.put("occurredTime", u.getOccurredTime());
        m.put("source", u.getSource()); m.put("type", u.getType()); m.put("details", u.getDetails()); m.put("status", u.getStatus());
        m.put("healthCaseId", u.getHealthCase() == null ? null : u.getHealthCase().getId()); return m;
    }
    private boolean hasReproductionDependents(ReproductionEvent e) {
        return em.createQuery("select count(x) from ReproductionEvent x where x.linkedEvent.id=:id", Long.class).setParameter("id", e.getId()).getSingleResult() > 0
            || em.createQuery("select count(p) from PregnancyEpisode p where p.confirmingCheck.id=:id or p.linkedBreeding.id=:id", Long.class).setParameter("id", e.getId()).getSingleResult() > 0;
    }
    private boolean hasBlockingReproductionDependents(ReproductionEvent e, PregnancyEpisode confirmed) {
        Long linked = em.createQuery("select count(x) from ReproductionEvent x where x.linkedEvent.id=:id and x.status='VALID'", Long.class)
            .setParameter("id", e.getId()).getSingleResult();
        if (linked > 0) return true;
        if (confirmed == null) return false;
        Long updates = em.createQuery("select count(u) from PregnancyUpdate u where u.episode.id=:id and u.status='VALID'", Long.class)
            .setParameter("id", confirmed.getId()).getSingleResult();
        Long calvings = em.createQuery("select count(c) from CalvingEvent c where c.episode.id=:id and c.status='VALID'", Long.class)
            .setParameter("id", confirmed.getId()).getSingleResult();
        return updates > 0 || calvings > 0;
    }
    private void assertFemaleApplicable(Cattle cattle, boolean trackedAction) {
        if (cattle.getSex() == null || !"FEMALE".equals(cattle.getSex().name())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "reproduction_requires_female");
        if (cattle.getHerdStatus() == null || !"ACTIVE".equals(cattle.getHerdStatus().name())) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "cattle_not_active");
        if (!Set.of("YOUNG_STOCK", "ADULT").contains(cattle.getLifeStage() == null ? "" : cattle.getLifeStage().name()) && openPregnancy(cattle.getId()) == null)
            throw DomainException.unprocessable("MSG-FE11-11", "cattle_code", cattle.getDisplayCode());
    }
    private Instant requiredTime(Instant value, String field) { if (value == null) throw DomainException.required(field); return value; }
    private void assertAfter(Instant value, Instant boundary) { if (boundary != null && value.isBefore(boundary)) throw DomainException.unprocessable(MessageCodes.COM_05, "reason", "event_time_before_parent"); }
    private String normalize(String value) { return value == null ? "" : value.trim().toUpperCase(Locale.ROOT); }
    private String dataSource(String value) {
        String source = value == null || value.isBlank() ? "DIRECT_OBSERVATION" : normalize(value);
        if (!Set.of("DIRECT_OBSERVATION", "FARM_NOTEBOOK", "EXTERNAL_REPORT").contains(source)) throw DomainException.invalid("source");
        return source;
    }
    private String optional(String value, String field, int max) { if (value == null || value.isBlank()) return null; return bounded(value.trim(), field, max); }
    private String boundedRequired(String value, String field, int max) { if (value == null || value.isBlank()) throw DomainException.required(field); return bounded(value.trim(), field, max); }
    private String bounded(String value, String field, int max) { if (value.length() > max) throw DomainException.invalid(field); return value; }
    private void requireReason(String reason) { if (reason == null || reason.isBlank()) throw DomainException.required("reason"); if (reason.trim().length() > 500) throw DomainException.invalid("reason"); }
    private Set<EstrusSign> parseSigns(List<String> values) {
        if (values == null || values.isEmpty()) return null;
        Set<EstrusSign> signs = new LinkedHashSet<>();
        for (String value : values) try { signs.add(EstrusSign.valueOf(normalize(value))); } catch (Exception e) { throw DomainException.invalid("signs"); }
        return signs;
    }
    private Map<String,Object> eventSnapshot(ReproductionEvent e) {
        Map<String,Object> m = new LinkedHashMap<>(); m.put("type", e.getType()); m.put("eventTime", e.getEventTime()); m.put("method", e.getMethod());
        m.put("result", e.getResult()); m.put("source", e.getSource()); m.put("description", e.getDescription()); m.put("performedBy", e.getPerformedBy());
        m.put("examiner", e.getExaminer()); m.put("observer", e.getObserver()); m.put("status", e.getStatus()); return m;
    }
}
