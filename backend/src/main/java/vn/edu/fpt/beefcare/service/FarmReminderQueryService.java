package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.FeedItem;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HerdEntry;
import vn.edu.fpt.beefcare.domain.HerdExitVoucher;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.ReproductionEvent;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.enumeration.BirthDateAccuracy;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.ReminderRepository;
import vn.edu.fpt.beefcare.service.dto.FeedManagementDtos.FeedReminderView;

/** Tenant-scoped read projection for SCR-44; reading never changes reminder lifecycle (GBR-63). */
@Service
public class FarmReminderQueryService {

    static final int UPCOMING_DAYS = 7;
    private static final DateTimeFormatter DATE_LABEL = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_LABEL = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Map<String, String> PARAMETER_LABELS = Map.ofEntries(
        Map.entry("WEIGHING_INTERVAL_DAYS", "chu kỳ cân (tham số trại)"),
        Map.entry("WEANING_AGE_MONTHS", "tuổi cai sữa (tham số trại)"),
        Map.entry("YOUNG_STOCK_AGE_MONTHS", "tuổi chuyển bò tơ (tham số trại)"),
        Map.entry("ADULT_AGE_MONTHS", "tuổi trưởng thành (tham số trại)"),
        Map.entry("BREEDING_WINDOW_START_HOURS", "giờ bắt đầu cửa sổ phối (tham số trại)"),
        Map.entry("BREEDING_WINDOW_END_HOURS", "giờ kết thúc cửa sổ phối (tham số trại)"),
        Map.entry("PREGNANCY_CHECK_DAYS", "số ngày đến hạn khám thai (tham số trại)"),
        Map.entry("PREGNANCY_RECHECK_DAYS", "số ngày đến hạn khám lại (tham số trại)"),
        Map.entry("CALVING_LEAD_DAYS", "thời gian chuẩn bị đẻ (tham số trại)"),
        Map.entry("VACCINATION_LEAD_DAYS", "thời gian nhắc tiêm (tham số trại)"),
        Map.entry("POST_CALVING_DAYS", "khoảng nghỉ sau đẻ (tham số trại)"),
        Map.entry("TARGET_FINISHING_WEIGHT_KG", "cân xuất chuồng mục tiêu (tham số trại)")
    );

    private final FarmAccessService access;
    private final ReminderRepository reminders;
    private final FeedManagementService feedManagement;
    private final FarmClock clock;
    private final EntityManager em;
    private final ObjectMapper json;

    public FarmReminderQueryService(
        FarmAccessService access,
        ReminderRepository reminders,
        FeedManagementService feedManagement,
        FarmClock clock,
        EntityManager em,
        ObjectMapper json
    ) {
        this.access = access;
        this.reminders = reminders;
        this.feedManagement = feedManagement;
        this.clock = clock;
        this.em = em;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<ReminderView> mine(Long farmId) {
        FarmContext context = access.require(farmId, FarmAction.VIEW_CATTLE);
        FarmRole role = context.role();
        Instant now = clock.now();
        ZoneId zone = clock.zone();
        LocalDate today = now.atZone(zone).toLocalDate();
        List<ReminderView> result = new ArrayList<>();

        for (Reminder reminder : reminders.findAllByFarm_IdOrderByDueTimeAscIdAsc(farmId)) {
            if (!isActive(reminder.getStatus()) || !allowed(reminder.getRuleType(), role)) {
                continue;
            }
            if (reminder.getCattle() != null && (reminder.getCattle().getFarm() == null || !farmId.equals(reminder.getCattle().getFarm().getId()))) {
                continue;
            }
            Snapshot basis = snapshot(reminder.getParameterSnapshot());
            String urgency = urgency(reminder.getRuleType(), reminder.getDueTime(), basis, zone, today);
            if (urgency == null) {
                continue;
            }
            boolean highlighted = Set.of("REM-09", "REM-12").contains(reminder.getRuleType())
                && reminder.getDueTime().plus(3, ChronoUnit.DAYS).isBefore(now);
            String label = "REM-05".equals(reminder.getRuleType())
                ? ("PREGNANCY_EPISODE".equals(reminder.getSourceType()) ? "CONFIRMED" : "TENTATIVE")
                : null;
            result.add(
                view(
                    farmId,
                    role,
                    reminder.getId(),
                    reminder.getRuleType(),
                    reminder.getSourceRecord(),
                    reminder.getSourceType(),
                    reminder.getSourceId(),
                    reminder.getCattle(),
                    reminder.getDueTime(),
                    reminder.getStatus(),
                    urgency,
                    highlighted,
                    label,
                    basis,
                    zone,
                    today,
                    null
                )
            );
        }

        // Feed reminders are derived from current stock and ration state, so their read projection cannot go stale.
        feedManagement.feedReminders(farmId).forEach(feed -> {
            if (!allowed(feed.ruleType(), role)) {
                return;
            }
            boolean alreadyStored = result.stream().anyMatch(saved -> isSameFeedSource(saved, feed));
            String urgency = urgency(feed.ruleType(), feed.dueTime(), Snapshot.NONE, zone, today);
            if (!alreadyStored && urgency != null) {
                result.add(
                    view(
                        farmId,
                        role,
                        null,
                        feed.ruleType(),
                        "FEED:" + feed.sourceId(),
                        "REM-10".equals(feed.ruleType()) ? "FEED_ITEM" : "FEED_RATION",
                        "REM-10".equals(feed.ruleType()) ? "FEED_ITEM:" + feed.sourceId() : "RATION:" + feed.sourceId(),
                        null,
                        feed.dueTime(),
                        feed.status(),
                        urgency,
                        false,
                        null,
                        Snapshot.NONE,
                        zone,
                        today,
                        feed
                    )
                );
            }
        });

        Snapshot currentParameters = parameters(farmId, today);
        addWeighingDue(farmId, zone, today, currentParameters, role, result);
        addFinishingWeight(farmId, zone, today, currentParameters, role, result);
        return result.stream().sorted(Comparator.comparing(ReminderView::dueTime).thenComparing(ReminderView::ruleType)).toList();
    }

    private boolean isSameFeedSource(ReminderView saved, FeedReminderView feed) {
        if (!saved.ruleType().equals(feed.ruleType())) {
            return false;
        }
        if ("REM-10".equals(feed.ruleType())) {
            return ("FEED_ITEM:" + feed.sourceId()).equals(saved.sourceId());
        }
        return saved.sourceId() != null
            && saved.sourceId().startsWith("PEN:" + feed.penId() + ":RATION:" + feed.sourceId() + ":DAY:");
    }

    private ReminderView view(
        Long farmId,
        FarmRole role,
        Long id,
        String rule,
        String sourceRecord,
        String sourceType,
        String sourceId,
        Cattle sourceCattle,
        Instant due,
        String status,
        String urgency,
        boolean highlighted,
        String basisLabel,
        Snapshot basis,
        ZoneId zone,
        LocalDate today,
        FeedReminderView feedFallback
    ) {
        boolean cattleIsInFarm = sourceCattle != null
            && sourceCattle.getFarm() != null
            && farmId.equals(sourceCattle.getFarm().getId());
        Cattle cattle = cattleIsInFarm ? sourceCattle : null;
        CattleDetail cattleDetail = cattle == null ? null : cattleDetail(cattle, farmId, today);
        Long cattleId = cattleDetail == null ? null : cattle.getId();
        ReminderTarget cattleTarget = cattleDetail == null
            ? null
            : new ReminderTarget("CATTLE_PROFILE", cattleId, cattleId, null, null, null, cattleDetail.code());

        SourceProjection source = sourceProjection(
            farmId,
            rule,
            sourceType,
            sourceId,
            cattle,
            due,
            zone,
            feedFallback
        );
        ReminderTarget sourceTarget = sourceAllowed(rule, role) ? source.target() : null;
        Map<String, Object> basisValues = basisValues(rule, sourceType, sourceId, basis);
        String basisMissing = basisMissing(rule, sourceType, sourceId, basisValues);
        return new ReminderView(
            id,
            rule,
            sourceRecord,
            cattleId,
            due,
            windowEnd(rule, due, basis, zone),
            status,
            urgency,
            highlighted,
            basisLabel,
            basis.versionNo(),
            sourceType,
            sourceId,
            source.summary(),
            cattleDetail,
            basisValues,
            basisMissing,
            cattleTarget,
            sourceTarget
        );
    }

    private SourceProjection sourceProjection(
        Long farmId,
        String rule,
        String sourceType,
        String sourceId,
        Cattle cattle,
        Instant due,
        ZoneId zone,
        FeedReminderView feedFallback
    ) {
        if (feedFallback != null) {
            return feedFallbackProjection(farmId, feedFallback, due, zone);
        }
        if ("REM-01".equals(rule)) {
            Long weightId = idAfter(sourceId, "WEIGHT");
            if (weightId != null) {
                List<Growth> rows = em.createQuery(
                    "select g from Growth g where g.id=:id and g.cattle.farm.id=:farm",
                    Growth.class
                ).setParameter("id", weightId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    Growth weight = rows.get(0);
                    return new SourceProjection(
                        "Cân " + decimal(weight.getWeightKg()) + " kg · " + dateLabel(weight.getCheckDate()),
                        new ReminderTarget("GROWTH_RECORD", weightId, cattle == null ? null : cattle.getId(), null, null, null, null)
                    );
                }
            }
            Long entryId = idAfter(sourceId, "ENTRY");
            if (entryId != null) {
                List<HerdEntry> rows = em.createQuery(
                    "select e from HerdEntry e where e.id=:id and e.cattle.farm.id=:farm",
                    HerdEntry.class
                ).setParameter("id", entryId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    return new SourceProjection(
                        "Nhập đàn " + dateLabel(rows.get(0).getEntryDate()),
                        new ReminderTarget("HERD_ENTRY", entryId, cattle == null ? null : cattle.getId(), null, null, null, null)
                    );
                }
            }
        }
        if (Set.of("REM-02", "REM-03", "REM-04", "REM-05").contains(rule) && "REPRODUCTION_EVENT".equals(sourceType)) {
            Long eventId = idAfter(sourceId, "REPRODUCTION_EVENT");
            if (eventId != null) {
                List<ReproductionEvent> rows = em.createQuery(
                    "select e from ReproductionEvent e where e.id=:id and e.cattle.farm.id=:farm",
                    ReproductionEvent.class
                ).setParameter("id", eventId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    ReproductionEvent event = rows.get(0);
                    String summary = eventLabel(event.getType()) + " " + dateTimeLabel(event.getEventTime(), zone);
                    if (event.getResult() != null && !event.getResult().isBlank()) {
                        summary += " · " + event.getResult();
                    }
                    return new SourceProjection(
                        summary,
                        new ReminderTarget("REPRODUCTION_EVENT", eventId, event.getCattle().getId(), null, null, null, null)
                    );
                }
            }
        }
        if ("REM-03".equals(rule) && "HERD_ENTRY".equalsIgnoreCase(sourceType)) {
            Long entryId = lastId(sourceId);
            if (entryId != null) {
                List<HerdEntry> rows = em.createQuery(
                    "select e from HerdEntry e where e.id=:id and e.cattle.farm.id=:farm",
                    HerdEntry.class
                ).setParameter("id", entryId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    HerdEntry entry = rows.get(0);
                    return new SourceProjection(
                        "Thai khai báo khi nhập đàn " + dateLabel(entry.getEntryDate()),
                        new ReminderTarget("HERD_ENTRY", entryId, entry.getCattle().getId(), null, null, null, null)
                    );
                }
            }
        }
        if ("REM-05".equals(rule) && "PREGNANCY_EPISODE".equals(sourceType)) {
            Long episodeId = lastId(sourceId);
            if (episodeId != null) {
                List<PregnancyEpisode> rows = em.createQuery(
                    "select p from PregnancyEpisode p where p.id=:id and p.cattle.farm.id=:farm",
                    PregnancyEpisode.class
                ).setParameter("id", episodeId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    PregnancyEpisode episode = rows.get(0);
                    return new SourceProjection(
                        "Dự sinh " + dateLabel(episode.getExpectedCalvingDate()),
                        new ReminderTarget("PREGNANCY_EPISODE", episodeId, episode.getCattle().getId(), null, null, null, null)
                    );
                }
            }
        }
        if ("REM-06".equals(rule)) {
            Long doseId = lastId(sourceId);
            if (doseId != null) {
                List<ScheduledDose> rows = em.createQuery(
                    "select d from ScheduledDose d where d.id=:id and d.cattle.farm.id=:farm and d.schedule.farm.id=:farm and d.schedule.vaccine.farm.id=:farm",
                    ScheduledDose.class
                ).setParameter("id", doseId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    ScheduledDose dose = rows.get(0);
                    String vaccine = dose.getSchedule().getVaccine() == null ? "vắc-xin" : dose.getSchedule().getVaccine().getName();
                    String summary = dose.getSchedule().getScheduleName() + " · mũi " + dose.getDoseNo() + " · " + vaccine
                        + " · hạn " + dateLabel(dose.getNewExpectedDate() == null ? dose.getDueDate() : dose.getNewExpectedDate());
                    return new SourceProjection(
                        summary,
                        new ReminderTarget("VACCINATION_DOSE", doseId, dose.getCattle().getId(), null, null, null, null)
                    );
                }
            }
        }
        if ("REM-07".equals(rule)) {
            Long calvingId = lastId(sourceId);
            if (calvingId != null) {
                List<vn.edu.fpt.beefcare.domain.CalvingEvent> rows = em.createQuery(
                    "select c from CalvingEvent c where c.id=:id and c.dam.farm.id=:farm",
                    vn.edu.fpt.beefcare.domain.CalvingEvent.class
                ).setParameter("id", calvingId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    var calving = rows.get(0);
                    return new SourceProjection(
                        "Đẻ " + dateTimeLabel(calving.getBirthTime(), zone),
                        new ReminderTarget("CALVING_EVENT", calvingId, calving.getDam().getId(), null, null, null, null)
                    );
                }
            }
        }
        if ("REM-08".equals(rule)) {
            String[] parts = sourceId == null ? new String[0] : sourceId.split(":");
            if (parts.length >= 4 && "PEN_CRITERIA".equals(parts[0])) {
                Long penId = parseLong(parts[1]);
                Long assignmentId = parseLong(parts[2]);
                if (penId != null && assignmentId != null) {
                    List<PenAssignment> rows = em.createQuery(
                        "select a from PenAssignment a where a.id=:assignment and a.pen.id=:pen and a.farm.id=:farm and a.cattle.farm.id=:farm",
                        PenAssignment.class
                    ).setParameter("assignment", assignmentId).setParameter("pen", penId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                    if (!rows.isEmpty()) {
                        PenAssignment assignment = rows.get(0);
                        return new SourceProjection(
                            "Không còn đạt tiêu chí tiếp nhận chuồng " + assignment.getPen().getCode(),
                            new ReminderTarget("PEN_MOVE", assignmentId, assignment.getCattle().getId(), penId, null, null, assignment.getPen().getCode())
                        );
                    }
                }
            }
            String targetType = sourceId != null && sourceId.startsWith("STAGE:") ? "CATTLE_LIFE_STAGE" : "CATTLE_PROFILE";
            return new SourceProjection("Gợi ý xem lại giai đoạn hoặc chuồng hiện tại", cattle == null
                ? null
                : new ReminderTarget(targetType, cattle.getId(), cattle.getId(), null, null, null, cattle.getDisplayCode()));
        }
        if ("REM-09".equals(rule)) {
            Long outcomeId = lastId(sourceId);
            if (outcomeId != null) {
                List<CalfOutcome> rows = em.createQuery(
                    "select o from CalfOutcome o where o.id=:id and o.calving.dam.farm.id=:farm",
                    CalfOutcome.class
                ).setParameter("id", outcomeId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    CalfOutcome outcome = rows.get(0);
                    return new SourceProjection(
                        "Bê số " + outcome.getCalfNo() + " · sinh " + dateTimeLabel(outcome.getCalving().getBirthTime(), zone) + " · chờ xác nhận",
                        new ReminderTarget("CALF_REGISTRATION", outcomeId, outcome.getCalving().getDam().getId(), null, null, null, null)
                    );
                }
            }
        }
        if ("REM-10".equals(rule)) {
            Long feedId = idAfter(sourceId, "FEED_ITEM");
            if (feedId != null) {
                List<FeedItem> rows = em.createQuery(
                    "select f from FeedItem f where f.id=:id and f.farm.id=:farm",
                    FeedItem.class
                ).setParameter("id", feedId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    FeedItem item = rows.get(0);
                    return new SourceProjection(
                        item.getName() + " · tồn " + decimal(item.getOnHandKg()) + " kg / tối thiểu " + decimal(item.getMinimumStockKg()) + " kg",
                        new ReminderTarget("FEED_ITEM", feedId, null, null, null, null, item.getCode())
                    );
                }
            }
        }
        if ("REM-11".equals(rule)) {
            String[] parts = sourceId == null ? new String[0] : sourceId.split(":");
            if (parts.length == 8 && "PEN".equals(parts[0]) && "RATION".equals(parts[2]) && "DAY".equals(parts[4]) && "SESSION".equals(parts[6])) {
                Long penId = parseLong(parts[1]);
                Long rationId = parseLong(parts[3]);
                LocalDate sessionDate = parseDate(parts[5]);
                Integer sessionNo = parseInteger(parts[7]);
                if (penId != null && rationId != null && sessionDate != null && sessionNo != null) {
                    List<Pen> rows = em.createQuery(
                        "select p from Pen p where p.id=:pen and p.farm.id=:farm",
                        Pen.class
                    ).setParameter("pen", penId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                    if (!rows.isEmpty()) {
                        Pen pen = rows.get(0);
                        return new SourceProjection(
                            "Chuồng " + pen.getCode() + " · bữa " + sessionNo + " · " + dateLabel(sessionDate) + " · hạn ghi " + dateTimeLabel(due, zone),
                            new ReminderTarget("FEEDING_LOG", null, null, penId, sessionDate, sessionNo, pen.getCode())
                        );
                    }
                }
            }
        }
        if ("REM-12".equals(rule)) {
            Long voucherId = lastId(sourceId);
            if (voucherId != null) {
                List<HerdExitVoucher> rows = em.createQuery(
                    "select v from HerdExitVoucher v where v.id=:id and v.farm.id=:farm",
                    HerdExitVoucher.class
                ).setParameter("id", voucherId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    HerdExitVoucher voucher = rows.get(0);
                    return new SourceProjection(
                        "Phiếu " + voucher.getCode() + " · chờ xác nhận của Owner",
                        new ReminderTarget("DEATH_VOUCHER", voucherId, cattle == null ? null : cattle.getId(), null, null, null, voucher.getCode())
                    );
                }
            }
        }
        if ("REM-13".equals(rule)) {
            Long weightId = idAfter(sourceId, "GROWTH");
            if (weightId != null) {
                List<Growth> rows = em.createQuery(
                    "select g from Growth g where g.id=:id and g.cattle.farm.id=:farm",
                    Growth.class
                ).setParameter("id", weightId).setParameter("farm", farmId).setMaxResults(1).getResultList();
                if (!rows.isEmpty()) {
                    Growth weight = rows.get(0);
                    return new SourceProjection(
                        "Cân " + decimal(weight.getWeightKg()) + " kg · " + dateLabel(weight.getCheckDate()),
                        new ReminderTarget("GROWTH_RECORD", weightId, cattle == null ? null : cattle.getId(), null, null, null, null)
                    );
                }
            }
        }
        return new SourceProjection(null, null);
    }

    private SourceProjection feedFallbackProjection(
        Long farmId,
        FeedReminderView feed,
        Instant due,
        ZoneId zone
    ) {
        if ("REM-10".equals(feed.ruleType()) && feed.feedItemId() != null) {
            List<FeedItem> rows = em.createQuery(
                "select f from FeedItem f where f.id=:id and f.farm.id=:farm",
                FeedItem.class
            ).setParameter("id", feed.feedItemId()).setParameter("farm", farmId).setMaxResults(1).getResultList();
            if (!rows.isEmpty()) {
                FeedItem item = rows.get(0);
                return new SourceProjection(
                    item.getName() + " · tồn " + decimal(item.getOnHandKg()) + " kg / tối thiểu " + decimal(item.getMinimumStockKg()) + " kg",
                    new ReminderTarget("FEED_ITEM", item.getId(), null, null, null, null, item.getCode())
                );
            }
        }
        if ("REM-11".equals(feed.ruleType()) && feed.penId() != null) {
            List<Pen> rows = em.createQuery(
                "select p from Pen p where p.id=:id and p.farm.id=:farm",
                Pen.class
            ).setParameter("id", feed.penId()).setParameter("farm", farmId).setMaxResults(1).getResultList();
            if (!rows.isEmpty()) {
                Pen pen = rows.get(0);
                LocalDate date = due.atZone(zone).toLocalDate();
                return new SourceProjection(
                    "Chuồng " + pen.getCode() + " · bữa chưa ghi · hạn ghi " + dateTimeLabel(due, zone),
                    new ReminderTarget("FEEDING_LOG", feed.sourceId(), null, pen.getId(), date, null, pen.getCode())
                );
            }
        }
        return new SourceProjection(feed.title(), null);
    }

    private CattleDetail cattleDetail(Cattle cattle, Long farmId, LocalDate today) {
        String breed = null;
        if (cattle.getBreed() != null && cattle.getBreed().getFarm() != null && farmId.equals(cattle.getBreed().getFarm().getId())) {
            breed = cattle.getBreed().getName();
        }
        Integer ageMonths = null;
        if (cattle.getBirthDate() != null && !BirthDateAccuracy.UNKNOWN.equals(cattle.getBirthDateAccuracy()) && !cattle.getBirthDate().isAfter(today)) {
            ageMonths = Math.toIntExact(ChronoUnit.MONTHS.between(cattle.getBirthDate(), today));
        }
        List<String> currentPens = em.createQuery(
            "select a.pen.code from PenAssignment a where a.farm.id=:farm and a.cattle.farm.id=:farm and a.pen.farm.id=:farm and a.cattle.id=:cattle and a.toDate is null order by a.id desc",
            String.class
        ).setParameter("farm", farmId).setParameter("cattle", cattle.getId()).setMaxResults(1).getResultList();
        return new CattleDetail(cattle.getDisplayCode(), breed, cattle.getSex() == null ? null : cattle.getSex().name(), ageMonths,
            currentPens.isEmpty() ? null : currentPens.get(0));
    }

    /** OVERDUE / TODAY / UPCOMING, or null when the reminder is not yet shown on SCR-44. */
    static String urgency(String rule, Instant due, Snapshot basis, ZoneId zone, LocalDate today) {
        LocalDate date = due.atZone(zone).toLocalDate();
        if (date.isBefore(today)) return "OVERDUE";
        if (date.isEqual(today)) return "TODAY";
        Integer lead = "REM-05".equals(rule) ? basis.value("CALVING_LEAD_DAYS")
            : "REM-06".equals(rule) ? basis.value("VACCINATION_LEAD_DAYS") : null;
        int days = Math.max(UPCOMING_DAYS, lead == null ? 0 : lead);
        return date.isAfter(today.plusDays(days)) ? null : "UPCOMING";
    }

    /** REM-02 is a window: estrus + start hours to estrus + end hours; the reminder stores the start. */
    private Instant windowEnd(String rule, Instant due, Snapshot basis, ZoneId zone) {
        if (!"REM-02".equals(rule)) return null;
        Integer start = basis.value("BREEDING_WINDOW_START_HOURS");
        Integer end = basis.value("BREEDING_WINDOW_END_HOURS");
        return start == null || end == null ? null : due.plus(end - start, ChronoUnit.HOURS);
    }

    private boolean isActive(String status) {
        return "OPEN".equalsIgnoreCase(status) || "ACTIVE".equalsIgnoreCase(status);
    }

    private boolean allowed(String type, FarmRole role) {
        if (Set.of("REM-09", "REM-12", "REM-13", "REM-10").contains(type)) return role == FarmRole.OWNER || role == FarmRole.MANAGER;
        // REM-11 (feeding session not recorded) goes to every farm role: the Owner records feeding too (GBR-104, D41).
        return true;
    }

    private boolean sourceAllowed(String rule, FarmRole role) {
        return !"REM-08".equals(rule) || role == FarmRole.OWNER || role == FarmRole.MANAGER;
    }

    private void addWeighingDue(Long farmId, ZoneId zone, LocalDate today, Snapshot basis, FarmRole role, List<ReminderView> result) {
        Integer interval = basis.value("WEIGHING_INTERVAL_DAYS");
        if (interval == null) return;
        List<Cattle> cattle = em.createQuery(
            "select c from Cattle c where c.farm.id=:farm and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE order by c.id",
            Cattle.class
        ).setParameter("farm", farmId).getResultList();
        for (Cattle animal : cattle) {
            if (hasStored(farmId, "REM-01", animal.getId())) continue;
            LocalDate latest = em.createQuery(
                "select max(g.checkDate) from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null",
                LocalDate.class
            ).setParameter("id", animal.getId()).getSingleResult();
            String sourceType = "CATTLE";
            String sourceId;
            if (latest == null) {
                List<Object[]> entry = em.createQuery(
                    "select e.id,e.entryDate from HerdEntry e where e.cattle.id=:id and e.status=:valid",
                    Object[].class
                ).setParameter("id", animal.getId()).setParameter("valid", vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus.VALID).setMaxResults(1).getResultList();
                if (entry.isEmpty()) continue;
                latest = (LocalDate) entry.get(0)[1];
                sourceId = "CATTLE:" + animal.getId() + ":ENTRY:" + entry.get(0)[0];
            } else {
                List<Long> weights = em.createQuery(
                    "select g.id from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null and g.checkDate=:date order by g.id desc",
                    Long.class
                ).setParameter("id", animal.getId()).setParameter("date", latest).setMaxResults(1).getResultList();
                sourceId = weights.isEmpty() ? "CATTLE:" + animal.getId() : "CATTLE:" + animal.getId() + ":WEIGHT:" + weights.get(0);
            }
            Instant due = latest.plusDays(interval).atStartOfDay(zone).toInstant();
            String urgency = urgency("REM-01", due, basis, zone, today);
            if (urgency != null) {
                result.add(view(farmId, role, null, "REM-01", sourceId, sourceType, sourceId, animal, due,
                    "ACTIVE", urgency, false, null, basis, zone, today, null));
            }
        }
    }

    private void addFinishingWeight(Long farmId, ZoneId zone, LocalDate today, Snapshot basis, FarmRole role, List<ReminderView> result) {
        if (role != FarmRole.OWNER && role != FarmRole.MANAGER) return;
        Object targetValue = basis.values().get("TARGET_FINISHING_WEIGHT_KG");
        if (!(targetValue instanceof Number n)) return;
        BigDecimal target = new BigDecimal(n.toString());
        List<Cattle> cattle = em.createQuery(
            "select c from Cattle c where c.farm.id=:farm and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE and c.purpose.purposeType=vn.edu.fpt.beefcare.domain.enumeration.PurposeType.FATTENING",
            Cattle.class
        ).setParameter("farm", farmId).getResultList();
        for (Cattle animal : cattle) {
            if (hasStored(farmId, "REM-13", animal.getId())) continue;
            List<Object[]> latest = em.createQuery(
                "select g.id,g.checkDate,g.weightKg from Growth g where g.cattle.id=:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null order by g.checkDate desc,g.id desc",
                Object[].class
            ).setParameter("id", animal.getId()).setMaxResults(1).getResultList();
            if (latest.isEmpty()) continue;
            Long weightId = (Long) latest.get(0)[0];
            LocalDate date = (LocalDate) latest.get(0)[1];
            BigDecimal weight = (BigDecimal) latest.get(0)[2];
            if (weight.compareTo(target) >= 0) {
                Instant due = date.atStartOfDay(zone).toInstant();
                String sourceId = "GROWTH:" + weightId + ":PARAM:" + basis.versionNo();
                result.add(view(farmId, role, null, "REM-13", sourceId, "CATTLE", sourceId, animal, due,
                    "ACTIVE", urgency("REM-13", due, basis, zone, today), false, null, basis, zone, today, null));
            }
        }
    }

    /** An active stored row means JOB-01 evaluated the cattle; the live fallback must not duplicate it. */
    private boolean hasStored(Long farmId, String rule, Long cattleId) {
        return em.createQuery(
            "select count(r) from Reminder r where r.farm.id=:farm and r.ruleType=:rule and r.cattle.id=:c and r.status in ('ACTIVE','OPEN')",
            Long.class
        ).setParameter("farm", farmId).setParameter("rule", rule).setParameter("c", cattleId).getSingleResult() > 0;
    }

    private Snapshot parameters(Long farmId, LocalDate date) {
        List<FarmParameterVersion> rows = em.createQuery(
            "select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc",
            FarmParameterVersion.class
        ).setParameter("farm", farmId).setParameter("date", date).setMaxResults(1).getResultList();
        if (rows.isEmpty()) return Snapshot.NONE;
        FarmParameterVersion version = rows.get(0);
        try {
            Map<String, Object> values = json.readValue(version.getParameterValues(), new TypeReference<>() {});
            Map<String, Object> wrapped = new LinkedHashMap<>();
            wrapped.put("versionNo", version.getVersionNo());
            wrapped.put("values", values);
            return snapshot(json.writeValueAsString(wrapped));
        } catch (Exception ignored) {
            return Snapshot.NONE;
        }
    }

    /** The version and values JOB-01 used; only fields relevant to this reminder are returned. */
    private Snapshot snapshot(String raw) {
        if (raw == null || raw.isBlank()) return Snapshot.NONE;
        try {
            Map<String, Object> data = json.readValue(raw, new TypeReference<>() {});
            Object values = data.get("values");
            Object version = data.get("versionNo");
            return new Snapshot(version instanceof Number n ? n.intValue() : null,
                values instanceof Map<?, ?> map ? map : Map.of());
        } catch (Exception ignored) {
            return Snapshot.NONE;
        }
    }

    private Map<String, Object> basisValues(String rule, String sourceType, String sourceId, Snapshot basis) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (String key : parameterKeys(rule, sourceType, sourceId)) {
            Object value = basis.values().get(key);
            if (value != null) values.put(key, value);
        }
        return Map.copyOf(values);
    }

    private String basisMissing(String rule, String sourceType, String sourceId, Map<String, Object> values) {
        List<String> missing = parameterKeys(rule, sourceType, sourceId).stream().filter(key -> !values.containsKey(key)).map(PARAMETER_LABELS::get).toList();
        return missing.isEmpty() ? null : String.join(", ", missing);
    }

    private List<String> parameterKeys(String rule, String sourceType, String sourceId) {
        return switch (rule) {
            case "REM-01" -> List.of("WEIGHING_INTERVAL_DAYS");
            case "REM-02" -> List.of("BREEDING_WINDOW_START_HOURS", "BREEDING_WINDOW_END_HOURS");
            case "REM-03" -> "HERD_ENTRY".equalsIgnoreCase(sourceType) ? List.of() : List.of("PREGNANCY_CHECK_DAYS");
            case "REM-04" -> List.of("PREGNANCY_RECHECK_DAYS");
            case "REM-05" -> List.of("CALVING_LEAD_DAYS");
            case "REM-06" -> List.of("VACCINATION_LEAD_DAYS");
            case "REM-07" -> List.of("POST_CALVING_DAYS");
            case "REM-08" -> stageParameter(sourceId);
            case "REM-13" -> List.of("TARGET_FINISHING_WEIGHT_KG");
            default -> List.of();
        };
    }

    private List<String> stageParameter(String sourceId) {
        if (sourceId == null || !sourceId.startsWith("STAGE:")) return List.of();
        String[] parts = sourceId.split(":");
        if (parts.length < 2) return List.of();
        return switch (parts[1]) {
            case "WEANED_CALF" -> List.of("WEANING_AGE_MONTHS");
            case "YOUNG_STOCK" -> List.of("YOUNG_STOCK_AGE_MONTHS");
            case "ADULT" -> List.of("ADULT_AGE_MONTHS");
            default -> List.of();
        };
    }

    private Long idAfter(String source, String marker) {
        if (source == null) return null;
        String[] parts = source.split(":");
        for (int i = 0; i + 1 < parts.length; i++) {
            if (marker.equalsIgnoreCase(parts[i])) return parseLong(parts[i + 1]);
        }
        return null;
    }

    private Long lastId(String source) {
        if (source == null) return null;
        String[] parts = source.split(":");
        for (int i = parts.length - 1; i >= 0; i--) {
            Long id = parseLong(parts[i]);
            if (id != null) return id;
        }
        return null;
    }

    private Long parseLong(String value) {
        try { return value == null ? null : Long.valueOf(value); } catch (NumberFormatException ignored) { return null; }
    }

    private Integer parseInteger(String value) {
        try { return value == null ? null : Integer.valueOf(value); } catch (NumberFormatException ignored) { return null; }
    }

    private LocalDate parseDate(String value) {
        try { return value == null ? null : LocalDate.parse(value); } catch (RuntimeException ignored) { return null; }
    }

    private String dateLabel(LocalDate value) {
        return value == null ? "chưa có ngày" : DATE_LABEL.format(value);
    }

    private String dateTimeLabel(Instant value, ZoneId zone) {
        return value == null ? "chưa có thời điểm" : DATE_TIME_LABEL.format(value.atZone(zone));
    }

    private String decimal(BigDecimal value) {
        return value == null ? "chưa có dữ liệu" : value.stripTrailingZeros().toPlainString();
    }

    private String eventLabel(String value) {
        return switch (value == null ? "" : value.toUpperCase()) {
            case "ESTRUS" -> "Động dục";
            case "BREEDING" -> "Phối giống";
            case "PREGNANCY_CHECK" -> "Khám thai";
            default -> "Sự kiện sinh sản";
        };
    }


    /** Stable typed target data; the destination resource still performs its own current permission checks. */
    public record ReminderTarget(String type, Long id, Long cattleId, Long penId, LocalDate date, Integer sessionNo, String code) {}

    public record CattleDetail(String code, String breed, String sex, Integer ageMonths, String pen) {}

    public record ReminderView(
        Long id,
        String ruleType,
        String sourceRecord,
        Long cattleId,
        Instant dueTime,
        Instant windowEnd,
        String lifecycleStatus,
        String urgency,
        boolean highlighted,
        String basisLabel,
        Integer parameterVersion,
        String sourceType,
        String sourceId,
        String sourceSummary,
        CattleDetail cattle,
        Map<String, Object> basisValues,
        String basisMissing,
        ReminderTarget cattleProfileTarget,
        ReminderTarget sourceTarget
    ) {}

    record Snapshot(Integer versionNo, Map<?, ?> values) {
        static final Snapshot NONE = new Snapshot(null, Map.of());

        Integer value(String key) {
            return values.get(key) instanceof Number n ? n.intValue() : null;
        }
    }

    private record SourceProjection(String summary, ReminderTarget target) {}
}
