package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.ReproductionDtos.*;

/** FE-11 A1 (SCR-38 worklist) and A2 / FE-12 A1 (SCR-39 tab Sinh sản). Derived values are computed, never stored (GBR-54, GBR-106). */
@Service
public class ReproductionReadService {
    static final Set<String> ELIGIBILITY_STATUSES = Set.of("AWAITING_BREEDING", "IN_ESTRUS", "POST_CALVING");

    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final FarmClock clock;
    private final CattleStateService cattleState;

    public ReproductionReadService(FarmAccessService access, FarmClock clock, CattleStateService cattleState) {
        this.access = access; this.clock = clock; this.cattleState = cattleState;
    }

    // ------------------------------------------------------------------ A1

    @Transactional(readOnly = true)
    public Worklist worklist(Long farmId, String tab, String q, Long penId, Long breedId, String eligibility) {
        FarmContext ctx = access.require(farmId, FarmAction.VIEW_REPRODUCTION);
        ZoneId zone = zone(ctx.farm());
        LocalDate today = clock.now().atZone(zone).toLocalDate();
        Map<String, Object> params = cattleState.parameters(farmId, today);
        int leadDays = intParam(params, "CALVING_LEAD_DAYS", 30);
        Integer windowStart = intParam(params, "BREEDING_WINDOW_START_HOURS"), windowEnd = intParam(params, "BREEDING_WINDOW_END_HOURS");
        Map<Long, PenAssignment> pens = currentPens(farmId, today);
        Map<Long, List<Reminder>> reminders = activeReminders(farmId);
        List<Cattle> females = em.createQuery("select c from Cattle c where c.farm.id=:farm and c.herdStatus=:status and c.sex=:sex order by c.displayCode", Cattle.class)
            .setParameter("farm", farmId).setParameter("status", HerdStatus.ACTIVE).setParameter("sex", Sex.FEMALE).getResultList();

        List<WorklistItem> all = new ArrayList<>();
        int inEstrus = 0, inWindow = 0, checkDue = 0, calving30 = 0, postReady = 0, notEligible = 0;
        Instant now = clock.now();
        for (Cattle c : females) {
            Map<String, Object> state = cattleState.state(c);
            String status = String.valueOf(state.get("reproductiveStatus"));
            if ("NOT_APPLICABLE".equals(status)) continue;
            LocalDate expected = (LocalDate) state.get("expectedCalvingDate");
            Boolean eligible = (Boolean) state.get("breedingEligible");
            @SuppressWarnings("unchecked") List<String> failed = (List<String>) state.getOrDefault("failedBreedingConditions", List.of());
            List<Reminder> rem = reminders.getOrDefault(c.getId(), List.of());
            ReproductionEvent lastEstrus = "IN_ESTRUS".equals(status) ? latestEvent(c.getId(), "ESTRUS") : null;
            Instant wFrom = lastEstrus == null || windowStart == null || windowEnd == null ? null : lastEstrus.getEventTime().plus(Duration.ofHours(windowStart));
            Instant wTo = lastEstrus == null || windowStart == null || windowEnd == null ? null : lastEstrus.getEventTime().plus(Duration.ofHours(windowEnd));

            if ("IN_ESTRUS".equals(status)) inEstrus++;
            if (wFrom != null && !now.isBefore(wFrom) && !now.isAfter(wTo)) inWindow++;
            if (rem.stream().anyMatch(r -> Set.of("REM-03", "REM-04").contains(r.getRuleType()) && !r.getDueTime().atZone(zone).toLocalDate().isAfter(today))) checkDue++;
            if (expected != null && !expected.isBefore(today) && !expected.isAfter(today.plusDays(30))) calving30++;
            if (rem.stream().anyMatch(r -> "REM-07".equals(r.getRuleType()) && !r.getDueTime().isAfter(now))) postReady++;
            if (ELIGIBILITY_STATUSES.contains(status) && Boolean.FALSE.equals(eligible)) notEligible++;

            String nextAction; Due due;
            switch (status) {
                case "IN_ESTRUS" -> { nextAction = "CONSIDER_BREEDING"; due = new Due(null, wFrom, wTo); }
                case "BRED" -> { nextAction = "PREGNANCY_CHECK"; due = new Due(dueOf(rem, zone, "REM-03", "REM-04"), null, null); }
                case "PREGNANT" -> { nextAction = "PREPARE_CALVING_PEN"; due = new Due(expected, null, null); }
                case "POST_CALVING" -> { nextAction = "CONSIDER_BREEDING"; due = new Due(dueOf(rem, zone, "REM-07"), null, null); }
                default -> { nextAction = failed.contains("MINIMUM_WEIGHT") ? "MONITOR_WEIGHT" : "CONSIDER_BREEDING"; due = null; }
            }
            PenAssignment pa = pens.get(c.getId());
            LatestEvent latest = latestOfAll(c.getId(), zone, today);
            Eligibility eligibilityRow = ELIGIBILITY_STATUSES.contains(status) ? new Eligibility(eligible, failed,
                cattleState.breedingCriteria(c, today).stream().map(x -> new Criterion(x.name(), x.required(), x.value(), x.met())).toList()) : null;
            all.add(new WorklistItem(c.getId(), c.getDisplayCode(), c.getName(), c.getEarTagNumber(), ageMonths(c, today), latestWeight(c.getId()),
                ref(c.getBreed()), pa == null ? null : ref(pa.getPen()), status,
                statusSince(c, status, latest), eligibilityRow, latest, nextAction, due,
                expected, (String) state.get("expectedBasis"), c.getVersion()));
        }
        Tiles tiles = new Tiles(inEstrus, inWindow, checkDue, calving30, postReady, notEligible);

        String query = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        String elig = eligibility == null ? "ALL" : eligibility.trim().toUpperCase(Locale.ROOT);
        List<WorklistItem> filtered = all.stream().filter(i -> query.isEmpty() || i.code().toLowerCase(Locale.ROOT).contains(query)
                || (i.earTag() != null && i.earTag().toLowerCase(Locale.ROOT).contains(query)))
            .filter(i -> penId == null || (i.pen() != null && penId.equals(i.pen().id())))
            .filter(i -> breedId == null || (i.breed() != null && breedId.equals(i.breed().id())))
            .filter(i -> switch (elig) {
                case "MET" -> i.eligibility() != null && Boolean.TRUE.equals(i.eligibility().met());
                case "NOT_MET" -> i.eligibility() != null && Boolean.FALSE.equals(i.eligibility().met());
                default -> true;
            }).toList();
        java.util.function.Predicate<WorklistItem> dueSoon = i -> "PREGNANT".equals(i.status()) && i.expectedCalvingDate() != null && !i.expectedCalvingDate().isAfter(today.plusDays(leadDays));
        Counts counts = new Counts(count(filtered, "AWAITING_BREEDING"), count(filtered, "IN_ESTRUS"), count(filtered, "BRED"), count(filtered, "PREGNANT"),
            (int) filtered.stream().filter(dueSoon).count(), count(filtered, "POST_CALVING"), filtered.size());
        String t = tab == null || tab.isBlank() ? "ALL" : tab.trim().toUpperCase(Locale.ROOT);
        List<WorklistItem> items = filtered.stream().filter(i -> "ALL".equals(t) || ("DUE_SOON".equals(t) ? dueSoon.test(i) : t.equals(i.status()))).toList();
        return new Worklist(tiles, counts, items);
    }

    // ------------------------------------------------------------------ A2

    @Transactional(readOnly = true)
    public Profile profile(Long farmId, Long cattleId, String type, LocalDate from, LocalDate to) {
        FarmContext ctx = access.require(farmId, FarmAction.VIEW_REPRODUCTION);
        Cattle c = em.createQuery("select c from Cattle c where c.id=:id and c.farm.id=:farm", Cattle.class)
            .setParameter("id", cattleId).setParameter("farm", farmId).getResultStream().findFirst()
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "cattleId", cattleId));
        ZoneId zone = zone(ctx.farm());
        LocalDate today = clock.now().atZone(zone).toLocalDate();
        Map<String, Object> params = cattleState.parameters(farmId, today);
        Map<String, Object> state = cattleState.state(c);
        String status = String.valueOf(state.get("reproductiveStatus"));
        boolean applicable = !"NOT_APPLICABLE".equals(status) && c.getHerdStatus() == HerdStatus.ACTIVE;
        boolean female = c.getSex() == Sex.FEMALE;
        boolean stage = c.getLifeStage() != null && Set.of("YOUNG_STOCK", "ADULT").contains(c.getLifeStage().name());
        boolean active = c.getHerdStatus() == HerdStatus.ACTIVE;
        PenAssignment pa = currentPens(farmId, today).get(c.getId());

        List<ReproductionEvent> events = em.createQuery("select e from ReproductionEvent e where e.cattle.id=:id order by e.eventTime, e.id", ReproductionEvent.class)
            .setParameter("id", cattleId).getResultList();
        List<ReproductionEvent> valid = events.stream().filter(e -> "VALID".equalsIgnoreCase(e.getStatus())).toList();
        List<PregnancyEpisode> episodes = em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:id order by p.id", PregnancyEpisode.class)
            .setParameter("id", cattleId).getResultList();
        List<PregnancyUpdate> updates = em.createQuery("select u from PregnancyUpdate u where u.episode.cattle.id=:id order by u.occurredTime, u.id", PregnancyUpdate.class)
            .setParameter("id", cattleId).getResultList();
        List<CalvingEvent> calvings = em.createQuery("select c from CalvingEvent c where c.dam.id=:id order by c.birthTime, c.id", CalvingEvent.class)
            .setParameter("id", cattleId).getResultList();
        List<CalvingEvent> validCalvings = calvings.stream().filter(x -> "VALID".equalsIgnoreCase(x.getStatus())).toList();
        PregnancyEpisode open = episodes.stream().filter(p -> "OPEN".equalsIgnoreCase(p.getStatus())).reduce((a, b) -> b).orElse(null);

        // Cycle: since the latest calving, pregnancy loss or NOT_PREGNANT check.
        Instant cycleStart = latest(
            validCalvings.isEmpty() ? null : validCalvings.get(validCalvings.size() - 1).getBirthTime(),
            updates.stream().filter(u -> "VALID".equalsIgnoreCase(u.getStatus()) && "LOSS".equalsIgnoreCase(u.getType())).map(PregnancyUpdate::getOccurredTime).max(Comparator.naturalOrder()).orElse(null),
            valid.stream().filter(e -> "PREGNANCY_CHECK".equals(e.getType()) && "NOT_PREGNANT".equals(e.getResult())).map(ReproductionEvent::getEventTime).max(Comparator.naturalOrder()).orElse(null));
        int servicesInCycle = (int) valid.stream().filter(e -> "BREEDING".equals(e.getType()) && (cycleStart == null || e.getEventTime().isAfter(cycleStart))).count();
        int parity = (c.getDeclaredParity() == null ? 0 : c.getDeclaredParity()) + validCalvings.size();
        CalvingEvent lastCalving = validCalvings.isEmpty() ? null : validCalvings.get(validCalvings.size() - 1);
        Growth weight = em.createQuery("select g from Growth g where g.cattle.id=:id and upper(g.status)='VALID' and g.weightKg is not null order by g.checkDate desc, g.id desc", Growth.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);

        Indicators indicators = indicators(c, validCalvings, valid, episodes, open, params, zone, today);
        boolean canManage = FarmAction.MANAGE_REPRODUCTION.allows(ctx.role());
        List<String> allowed = !applicable ? List.of() : switch (status) {
            case "BRED" -> List.of("ESTRUS", "PREGNANCY_CHECK", "CALVING");
            case "PREGNANT" -> List.of("PREGNANCY_CHECK", "PREGNANCY_UPDATE", "CALVING");
            default -> List.of("ESTRUS", "BREEDING");
        };
        List<String> other = female && active && stage ? List.of("PREGNANCY_CHECK", "CALVING") : List.of();

        EligibilityDetail eligibility = null;
        if (applicable && ELIGIBILITY_STATUSES.contains(status)) {
            List<Criterion> criteria = cattleState.breedingCriteria(c, today).stream().map(x -> new Criterion(x.name(), x.required(), x.value(), x.met())).toList();
            eligibility = new EligibilityDetail(criteria.stream().allMatch(Criterion::met), criteria);
        }
        EstrusWindow window = null;
        if ("IN_ESTRUS".equals(status)) {
            ReproductionEvent estrus = valid.stream().filter(e -> "ESTRUS".equals(e.getType())).reduce((a, b) -> b).orElse(null);
            Integer start = intParam(params, "BREEDING_WINDOW_START_HOURS"), end = intParam(params, "BREEDING_WINDOW_END_HOURS");
            if (estrus != null) window = start == null || end == null ? new EstrusWindow(estrus.getEventTime(), null, null, false)
                : new EstrusWindow(estrus.getEventTime(), estrus.getEventTime().plus(Duration.ofHours(start)), estrus.getEventTime().plus(Duration.ofHours(end)), true);
        }
        LatestBreeding latestBreeding = null;
        if ("BRED".equals(status)) {
            ReproductionEvent b = valid.stream().filter(e -> "BREEDING".equals(e.getType())).reduce((x, y) -> y).orElse(null);
            if (b != null) {
                int checks = (int) valid.stream().filter(e -> "PREGNANCY_CHECK".equals(e.getType()) && e.getEventTime().isAfter(b.getEventTime())).count();
                Integer checkDays = intParam(params, "PREGNANCY_CHECK_DAYS");
                latestBreeding = new LatestBreeding(b.getId(), b.getEventTime(), b.getMethod(), b.getSireSource(), cattleRef(b.getSire()), ref(b.getSireBreed()),
                    b.getExternalSireName(), b.getSemenBatch(), b.getSupplier(), person(b.getPerformerUser(), b.getPerformedBy()), b.getTentativeExpectedCalvingDate(), checks,
                    checkDays == null ? null : b.getEventTime().atZone(zone).toLocalDate().plusDays(checkDays));
            }
        }
        CurrentPregnancy pregnancy = null;
        if (open != null) {
            LocalDate conception = conception(open, zone);
            pregnancy = new CurrentPregnancy(open.getId(), open.getVersion(), open.getParity(),
                open.getLinkedBreeding() == null ? null : open.getLinkedBreeding().getId(), open.getLinkedBreeding() == null ? null : open.getLinkedBreeding().getEventTime(),
                open.getConfirmingCheck() == null ? null : open.getConfirmingCheck().getId(), open.getConfirmingCheck() == null ? null : open.getConfirmingCheck().getEventTime(),
                open.getExpectedCalvingDate(), open.getExpectedBasis(), conception == null ? null : ChronoUnit.DAYS.between(conception, today),
                open.getExpectedCalvingDate() != null && !open.getExpectedCalvingDate().isAfter(today.plusDays(intParam(params, "CALVING_LEAD_DAYS", 30))));
        }

        List<TimelineRow> timeline = new ArrayList<>();
        for (ReproductionEvent e : events) timeline.add(row(e));
        for (PregnancyUpdate u : updates) timeline.add(row(u));
        for (CalvingEvent x : calvings) timeline.add(row(x));
        String kind = type == null || type.isBlank() ? null : type.trim().toUpperCase(Locale.ROOT);
        timeline = timeline.stream()
            .filter(r -> kind == null || kind.equals(r.kind()))
            .filter(r -> from == null || !r.at().atZone(zone).toLocalDate().isBefore(from))
            .filter(r -> to == null || !r.at().atZone(zone).toLocalDate().isAfter(to))
            .sorted(Comparator.comparing(TimelineRow::at).thenComparing(TimelineRow::id).reversed()).toList();
        List<CalvingRow> calvingRows = calvings.stream().sorted(Comparator.comparing(CalvingEvent::getBirthTime).reversed()).map(this::calvingRow).toList();

        return new Profile(c.getId(), c.getDisplayCode(), c.getName(), c.getEarTagNumber(), ageMonths(c, today), c.getSex() == null ? null : c.getSex().name(),
            c.getLifeStage() == null ? null : c.getLifeStage().name(),
            c.getPurpose() == null || c.getPurpose().getPurposeType() == null ? null : c.getPurpose().getPurposeType().name(),
            c.getHerdStatus() == null ? null : c.getHerdStatus().name(), ref(c.getBreed()), pa == null ? null : ref(pa.getPen()), c.getVersion(),
            applicable, applicable ? null : (active ? ReproductionCommandService.notTrackedReason(c) : "NOT_ACTIVE"),
            "NOT_APPLICABLE".equals(status) ? null : status, statusSince(c, status, latestOfAll(cattleId, zone, today)), servicesInCycle, parity,
            lastCalving == null ? null : new LastCalving(lastCalving.getId(), lastCalving.getBirthTime()),
            weight == null ? null : new LatestWeight(weight.getWeightKg(), weight.getCheckDate()),
            null, // declared pregnancy at entry: not stored by herd entry yet (FE-05), see FE-11-12-progress.md
            indicators, canManage, allowed, other, eligibility, window, latestBreeding, pregnancy, timeline, calvingRows);
    }

    /** GBR-106 per-cow indicators on VALID events only. */
    private Indicators indicators(Cattle c, List<CalvingEvent> calvings, List<ReproductionEvent> valid, List<PregnancyEpisode> episodes, PregnancyEpisode open,
                                  Map<String, Object> params, ZoneId zone, LocalDate today) {
        Integer ageAtFirst = null; Long lastInterval = null, sinceCalving = null, daysOpen = null; boolean overdue = false;
        if (!calvings.isEmpty()) {
            LocalDate first = calvings.get(0).getBirthTime().atZone(zone).toLocalDate();
            LocalDate last = calvings.get(calvings.size() - 1).getBirthTime().atZone(zone).toLocalDate();
            if (c.getBirthDate() != null) ageAtFirst = (int) ChronoUnit.MONTHS.between(c.getBirthDate(), first);
            if (calvings.size() > 1) lastInterval = ChronoUnit.DAYS.between(calvings.get(calvings.size() - 2).getBirthTime().atZone(zone).toLocalDate(), last);
            sinceCalving = ChronoUnit.DAYS.between(last, today);
            Instant lastAt = calvings.get(calvings.size() - 1).getBirthTime();
            PregnancyEpisode after = episodes.stream().filter(p -> !"VOIDED".equalsIgnoreCase(p.getStatus()) && p.getConfirmingCheck() != null
                && p.getConfirmingCheck().getEventTime().isAfter(lastAt)).findFirst().orElse(null);
            LocalDate conception = after == null ? null : conception(after, zone);
            daysOpen = ChronoUnit.DAYS.between(last, conception == null ? today : conception);
            int limit = intParam(params, "POST_CALVING_DAYS", 45) + 3 * intParam(params, "ESTRUS_CYCLE_DAYS", 21);
            overdue = open == null && after == null && sinceCalving > limit;
        }
        int conceptions = (int) episodes.stream().filter(p -> !"VOIDED".equalsIgnoreCase(p.getStatus())).count();
        int services = (int) valid.stream().filter(e -> "BREEDING".equals(e.getType())).count();
        return new Indicators(ageAtFirst, lastInterval, sinceCalving, daysOpen, conceptions, services, overdue);
    }

    private LocalDate conception(PregnancyEpisode p, ZoneId zone) {
        if (p.getLinkedBreeding() != null) return p.getLinkedBreeding().getEventTime().atZone(zone).toLocalDate();
        if (p.getConfirmingCheck() != null && p.getConfirmingCheck().getEstMonthsPregnant() != null)
            return p.getConfirmingCheck().getEventTime().atZone(zone).toLocalDate().minusDays(p.getConfirmingCheck().getEstMonthsPregnant() * 30L);
        return null;
    }

    // ------------------------------------------------------------------ rows

    private TimelineRow row(ReproductionEvent e) {
        return new TimelineRow(e.getType(), e.getId(), e.getEventTime(), e.getRecordedAt(), name(e.getRecordedBy()), e.getSource(), e.getStatus(),
            Boolean.TRUE.equals(e.getCorrected()), e.getVersion(), "VOIDED".equalsIgnoreCase(e.getStatus()) ? e.getStatusReason() : null,
            e.getSigns() == null ? null : e.getSigns().stream().map(Enum::name).toList(), e.getDescription(),
            "ESTRUS".equals(e.getType()) ? person(e.getObserverUser(), e.getObserver()) : null,
            e.getMethod(), e.getSireSource(), cattleRef(e.getSire()), ref(e.getSireBreed()), e.getExternalSireName(), e.getSemenBatch(), e.getSupplier(),
            person(e.getPerformerUser(), e.getPerformedBy()), e.getLinkedEvent() == null ? null : e.getLinkedEvent().getId(), e.getTentativeExpectedCalvingDate(),
            "PREGNANCY_CHECK".equals(e.getType()) ? e.getResult() : null, e.getEstMonthsPregnant(), person(e.getExaminerUser(), e.getExaminer()),
            e.getPregnancyEpisode() == null ? null : e.getPregnancyEpisode().getId(), null, null, null, null);
    }
    private TimelineRow row(PregnancyUpdate u) {
        return new TimelineRow("PREGNANCY_UPDATE", u.getId(), u.getOccurredTime(), u.getRecordedAt(), name(u.getRecordedBy()), u.getSource(), u.getStatus(),
            Boolean.TRUE.equals(u.getCorrected()), u.getVersion(), "VOIDED".equalsIgnoreCase(u.getStatus()) ? u.getStatusReason() : null,
            null, u.getDetails(), null, null, null, null, null, null, null, null, null, null, null, null, null, null,
            u.getEpisode().getId(), u.getType(), u.getHealthCase() == null ? null : u.getHealthCase().getId(),
            u.getHealthCase() == null ? null : u.getHealthCase().getCaseCode(), null);
    }
    private TimelineRow row(CalvingEvent x) {
        return new TimelineRow("CALVING", x.getId(), x.getBirthTime(), x.getRecordedAt(), name(x.getRecordedBy()), x.getSource(), x.getStatus(),
            Boolean.TRUE.equals(x.getCorrected()), x.getVersion(), "VOIDED".equalsIgnoreCase(x.getStatus()) ? x.getStatusReason() : null,
            null, null, null, x.getCourse(), null, null, null, null, null, null, person(x.getAttendantUser(), x.getAttendant()), null, null, null, null, null,
            x.getEpisode() == null ? null : x.getEpisode().getId(), null, null, null, x.getId());
    }
    private CalvingRow calvingRow(CalvingEvent x) {
        List<CalfRow> calves = em.createQuery("select o from CalfOutcome o where o.calving.id=:id order by o.calfNo, o.id", CalfOutcome.class)
            .setParameter("id", x.getId()).getResultList().stream().map(o -> new CalfRow(o.getId(), o.getCalfNo(), o.getOutcome(), o.getSex(), o.getBirthWeight(),
                o.getWeightBasis(), o.getTagCode(), ref(o.getProposedPen()), ref(o.getBreed()), ref(o.getProposedPurpose()), o.getRegistrationState(),
                o.getRegisteredCattle() == null ? null : o.getRegisteredCattle().getId(), o.getRegisteredCattle() == null ? null : o.getRegisteredCattle().getDisplayCode(),
                o.getStatus(), o.getVersion(), Boolean.TRUE.equals(o.getCorrected()))).toList();
        return new CalvingRow(x.getId(), x.getBirthTime(), x.getStatus(), Boolean.TRUE.equals(x.getCorrected()), x.getVersion(), x.getSource(),
            person(x.getAttendantUser(), x.getAttendant()), x.getCourse(), x.getDamCondition(), x.getRetainedPlacenta(),
            x.getEpisode() == null ? null : x.getEpisode().getId(), calves);
    }

    // ------------------------------------------------------------------ helpers

    private Instant statusSince(Cattle c, String status, LatestEvent latest) {
        if ("PREGNANT".equals(status)) {
            return em.createQuery("select p.confirmingCheck.eventTime from PregnancyEpisode p where p.cattle.id=:id and upper(p.status)='OPEN' order by p.id desc", Instant.class)
                .setParameter("id", c.getId()).setMaxResults(1).getResultStream().findFirst().orElse(latest == null ? null : latest.at());
        }
        if ("POST_CALVING".equals(status)) {
            return em.createQuery("select max(x.birthTime) from CalvingEvent x where x.dam.id=:id and upper(x.status)='VALID'", Instant.class).setParameter("id", c.getId()).getSingleResult();
        }
        return latest == null ? null : latest.at();
    }
    private LatestEvent latestOfAll(Long cattleId, ZoneId zone, LocalDate today) {
        ReproductionEvent e = em.createQuery("select e from ReproductionEvent e where e.cattle.id=:id and upper(e.status)='VALID' order by e.eventTime desc, e.id desc", ReproductionEvent.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
        Instant calving = em.createQuery("select max(x.birthTime) from CalvingEvent x where x.dam.id=:id and upper(x.status)='VALID'", Instant.class).setParameter("id", cattleId).getSingleResult();
        PregnancyUpdate u = em.createQuery("select u from PregnancyUpdate u where u.episode.cattle.id=:id and upper(u.status)='VALID' order by u.occurredTime desc, u.id desc", PregnancyUpdate.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
        String type = null; Instant at = null;
        if (e != null) { type = e.getType(); at = e.getEventTime(); }
        if (calving != null && (at == null || calving.isAfter(at))) { type = "CALVING"; at = calving; }
        if (u != null && (at == null || u.getOccurredTime().isAfter(at))) { type = "PREGNANCY_UPDATE"; at = u.getOccurredTime(); }
        if (at == null) return null;
        LocalDate date = at.atZone(zone).toLocalDate();
        return new LatestEvent(type, at, date, ChronoUnit.DAYS.between(date, today));
    }
    private ReproductionEvent latestEvent(Long cattleId, String type) {
        return em.createQuery("select e from ReproductionEvent e where e.cattle.id=:id and e.type=:type and upper(e.status)='VALID' order by e.eventTime desc, e.id desc", ReproductionEvent.class)
            .setParameter("id", cattleId).setParameter("type", type).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }
    private Map<Long, List<Reminder>> activeReminders(Long farmId) {
        Map<Long, List<Reminder>> out = new HashMap<>();
        em.createQuery("select r from Reminder r where r.farm.id=:farm and r.cattle is not null and upper(r.status) in ('OPEN','ACTIVE') and r.ruleType in ('REM-03','REM-04','REM-07')", Reminder.class)
            .setParameter("farm", farmId).getResultList().forEach(r -> out.computeIfAbsent(r.getCattle().getId(), k -> new ArrayList<>()).add(r));
        return out;
    }
    private static LocalDate dueOf(List<Reminder> reminders, ZoneId zone, String... rules) {
        return reminders.stream().filter(r -> Set.of(rules).contains(r.getRuleType()) && r.getDueTime() != null).map(r -> r.getDueTime().atZone(zone).toLocalDate())
            .min(Comparator.naturalOrder()).orElse(null);
    }
    private Map<Long, PenAssignment> currentPens(Long farmId, LocalDate date) {
        Map<Long, PenAssignment> result = new HashMap<>();
        em.createQuery("select p from PenAssignment p join fetch p.pen where p.farm.id=:farm and p.fromDate<=:date and (p.toDate is null or p.toDate>=:date) order by p.fromDate desc", PenAssignment.class)
            .setParameter("farm", farmId).setParameter("date", date).getResultList().forEach(p -> result.putIfAbsent(p.getCattle().getId(), p));
        return result;
    }
    private static Integer ageMonths(Cattle c, LocalDate today) {
        return c.getBirthDate() == null ? null : (int) ChronoUnit.MONTHS.between(c.getBirthDate(), today);
    }
    private java.math.BigDecimal latestWeight(Long cattleId) {
        return em.createQuery("select g.weightKg from Growth g where g.cattle.id=:id and upper(g.status)='VALID' and g.weightKg is not null order by g.checkDate desc, g.id desc", java.math.BigDecimal.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
    }
    private static int count(List<WorklistItem> items, String status) { return (int) items.stream().filter(i -> status.equals(i.status())).count(); }
    private static Instant latest(Instant... values) {
        Instant out = null;
        for (Instant v : values) if (v != null && (out == null || v.isAfter(out))) out = v;
        return out;
    }
    private static Integer intParam(Map<String, Object> params, String key) { return params.get(key) instanceof Number n ? n.intValue() : null; }
    private static int intParam(Map<String, Object> params, String key, int fallback) { Integer v = intParam(params, key); return v == null ? fallback : v; }
    private ZoneId zone(Farm farm) { try { return ZoneId.of(farm.getTimeZone()); } catch (Exception ignored) { return clock.zone(); } }
    private static String name(AppUser user) { return user == null ? null : user.getFullName(); }
    private static Person person(AppUser user, String text) { return user != null ? new Person(user.getId(), user.getFullName()) : text == null ? null : new Person(null, text); }
    private static Ref ref(Breed b) { return b == null ? null : new Ref(b.getId(), b.getCode(), b.getName()); }
    private static Ref ref(Pen p) { return p == null ? null : new Ref(p.getId(), p.getCode(), p.getName()); }
    private static Ref ref(ProductionPurpose p) { return p == null ? null : new Ref(p.getId(), p.getCode(), p.getName()); }
    private static Ref cattleRef(Cattle c) { return c == null ? null : new Ref(c.getId(), c.getDisplayCode(), c.getEarTagNumber()); }
}
