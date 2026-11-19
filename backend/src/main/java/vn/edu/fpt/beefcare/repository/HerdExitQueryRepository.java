package vn.edu.fpt.beefcare.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Repository;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Growth;
import vn.edu.fpt.beefcare.domain.HealthCase;
import vn.edu.fpt.beefcare.domain.PregnancyEpisode;
import vn.edu.fpt.beefcare.domain.Reminder;
import vn.edu.fpt.beefcare.domain.ScheduledDose;
import vn.edu.fpt.beefcare.domain.enumeration.EntryLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.ExitLineStatus;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;

/**
 * Read queries over the care and reproduction records that herd exit looks at (pre-confirmation checks, effects of the
 * confirmation, latest recorded event, cattle selection). Kept apart from the entity repositories of other features.
 */
@Repository
public class HerdExitQueryRepository {

    public static final List<String> OPEN_CASE_STATUSES = List.of("OPEN", "CHRONIC");
    public static final List<String> OPEN_DOSE_STATUSES = List.of("PLANNED", "DEFERRED");
    public static final String PENDING_CALF = "PENDING_CONFIRMATION";

    @PersistenceContext
    private EntityManager em;

    public Optional<LocalDate> withdrawalEnd(Long cattleId) {
        LocalDate treatment = em
            .createQuery(
                "select max(t.withdrawalEndDate) from Treatment t where t.healthCase.cattle.id = :c and (t.status is null or t.status = 'VALID')",
                LocalDate.class
            )
            .setParameter("c", cattleId)
            .getSingleResult();
        LocalDate vaccination = em
            .createQuery(
                "select max(v.withdrawalEndDate) from Vaccination v where v.cattle.id = :c and (v.source is null or v.source <> 'HISTORICAL')",
                LocalDate.class
            )
            .setParameter("c", cattleId)
            .getSingleResult();
        if (treatment == null) {
            return Optional.ofNullable(vaccination);
        }
        return Optional.of(vaccination != null && vaccination.isAfter(treatment) ? vaccination : treatment);
    }

    public List<HealthCase> openCases(Long cattleId) {
        return em
            .createQuery("select h from HealthCase h where h.cattle.id = :c and h.status in :s order by h.id", HealthCase.class)
            .setParameter("c", cattleId)
            .setParameter("s", OPEN_CASE_STATUSES)
            .getResultList();
    }

    public List<ScheduledDose> futureDoses(Long cattleId, LocalDate exitDate) {
        return em
            .createQuery("select d from ScheduledDose d where d.cattle.id = :c and d.status in :s and d.dueDate > :d order by d.id", ScheduledDose.class)
            .setParameter("c", cattleId)
            .setParameter("s", OPEN_DOSE_STATUSES)
            .setParameter("d", exitDate)
            .getResultList();
    }

    /** ACTIVE reminders due after the exit date (from the start of the next farm day). */
    public List<Reminder> futureReminders(Long cattleId, LocalDate exitDate, ZoneId zone) {
        Instant cutoff = exitDate.plusDays(1).atStartOfDay(zone).toInstant();
        return em
            .createQuery("select r from Reminder r where r.cattle.id = :c and r.status = 'ACTIVE' and r.dueTime >= :t order by r.id", Reminder.class)
            .setParameter("c", cattleId)
            .setParameter("t", cutoff)
            .getResultList();
    }

    public Optional<PregnancyEpisode> openPregnancy(Long cattleId) {
        return em
            .createQuery("select p from PregnancyEpisode p where p.cattle.id = :c and p.status = 'OPEN' order by p.id desc", PregnancyEpisode.class)
            .setParameter("c", cattleId)
            .setMaxResults(1)
            .getResultList()
            .stream()
            .findFirst();
    }

    public List<CalfOutcome> draftCalves(Long damId) {
        return em
            .createQuery("select o from CalfOutcome o where o.calving.dam.id = :c and o.registrationState = :s order by o.id", CalfOutcome.class)
            .setParameter("c", damId)
            .setParameter("s", PENDING_CALF)
            .getResultList();
    }

    public Optional<Reminder> activeReminder(Long farmId, String ruleType, String sourceRecord) {
        return em
            .createQuery(
                "select r from Reminder r where r.farm.id = :f and r.ruleType = :t and r.sourceRecord = :s and r.status = 'ACTIVE' order by r.id desc",
                Reminder.class
            )
            .setParameter("f", farmId)
            .setParameter("t", ruleType)
            .setParameter("s", sourceRecord)
            .setMaxResults(1)
            .getResultList()
            .stream()
            .findFirst();
    }

    /** The latest recorded event date of a cattle (GBR-34): herd entry, placement, care and reproduction records. */
    public Optional<LocalDate> latestEventDate(Long cattleId, ZoneId zone) {
        LocalDate latest = null;
        latest = max(latest, scalarDate("select max(e.entryDate) from HerdEntry e where e.cattle.id = :c and e.status = :s", cattleId, "s", EntryLineStatus.VALID));
        latest = max(latest, scalarDate("select max(a.fromDate) from PenAssignment a where a.cattle.id = :c", cattleId, null, null));
        latest = max(latest, scalarDate("select max(a.toDate) from PenAssignment a where a.cattle.id = :c", cattleId, null, null));
        latest = max(latest, scalarDate("select max(g.checkDate) from Growth g where g.cattle.id = :c and g.status <> 'EXCLUDED'", cattleId, null, null));
        latest = max(latest, scalarDate("select max(v.vaccinationDate) from Vaccination v where v.cattle.id = :c", cattleId, null, null));
        latest = max(latest, scalarDate("select max(h.openedDate) from HealthCase h where h.cattle.id = :c", cattleId, null, null));
        latest = max(latest, scalarDate("select max(h.closedDate) from HealthCase h where h.cattle.id = :c", cattleId, null, null));
        latest = max(latest, scalarInstant("select max(t.treatmentTime) from Treatment t where t.healthCase.cattle.id = :c and (t.status is null or t.status = 'VALID')", cattleId, zone));
        latest = max(latest, scalarInstant("select max(o.observedTime) from HealthObservation o where o.healthCase.cattle.id = :c", cattleId, zone));
        latest = max(latest, scalarInstant("select max(r.eventTime) from ReproductionEvent r where r.cattle.id = :c", cattleId, zone));
        latest = max(latest, scalarInstant("select max(b.birthTime) from CalvingEvent b where b.dam.id = :c", cattleId, zone));
        return Optional.ofNullable(latest);
    }

    /** Latest non-excluded growth record of each cattle (weights, GBR-92: entry and exit weights are not growth records). */
    public Map<Long, Growth> latestGrowth(Collection<Long> cattleIds) {
        Map<Long, Growth> result = new HashMap<>();
        if (cattleIds.isEmpty()) {
            return result;
        }
        List<Growth> all = em
            .createQuery("select g from Growth g where g.cattle.id in :ids and g.status <> 'EXCLUDED' order by g.checkDate asc, g.entryTime asc, g.id asc", Growth.class)
            .setParameter("ids", cattleIds)
            .getResultList();
        for (Growth g : all) {
            result.put(g.getCattle().getId(), g);
        }
        return result;
    }

    /** ACTIVE cattle of the farm that are on no DRAFT / PENDING / CONFIRMED exit line, filtered by search text and pen. */
    public List<Cattle> selectableCattle(Long farmId, String likePattern, Long penId) {
        StringBuilder jpql = new StringBuilder(
            "select c from Cattle c where c.farm.id = :f and c.herdStatus = :hs " +
            "and not exists (select 1 from HerdExit l where l.cattle = c and l.status in :open) " +
            "and (lower(c.displayCode) like :q or lower(coalesce(c.earTagNumber, '')) like :q)"
        );
        if (penId != null) {
            jpql.append(" and exists (select 1 from PenAssignment a where a.cattle = c and a.toDate is null and a.pen.id = :p)");
        }
        jpql.append(" order by c.displayCode");
        var query = em
            .createQuery(jpql.toString(), Cattle.class)
            .setParameter("f", farmId)
            .setParameter("hs", HerdStatus.ACTIVE)
            .setParameter("open", List.of(ExitLineStatus.DRAFT, ExitLineStatus.PENDING, ExitLineStatus.CONFIRMED))
            .setParameter("q", likePattern);
        if (penId != null) {
            query.setParameter("p", penId);
        }
        return query.getResultList();
    }

    /** voucher id to pen codes: current pens of DRAFT / PENDING lines and last pens of confirmed lines. */
    public Map<Long, java.util.Set<String>> pensOfVouchers(Collection<Long> voucherIds) {
        Map<Long, java.util.Set<String>> result = new HashMap<>();
        if (voucherIds.isEmpty()) {
            return result;
        }
        List<Object[]> last = em
            .createQuery(
                "select l.voucher.id, l.lastPen.code from HerdExit l where l.voucher.id in :ids and l.lastPen is not null and l.status <> :removed",
                Object[].class
            )
            .setParameter("ids", voucherIds)
            .setParameter("removed", ExitLineStatus.REMOVED)
            .getResultList();
        List<Object[]> current = em
            .createQuery(
                "select l.voucher.id, a.pen.code from HerdExit l, PenAssignment a where a.cattle = l.cattle and a.toDate is null " +
                "and l.voucher.id in :ids and l.status in :open",
                Object[].class
            )
            .setParameter("ids", voucherIds)
            .setParameter("open", List.of(ExitLineStatus.DRAFT, ExitLineStatus.PENDING))
            .getResultList();
        for (List<Object[]> rows : List.of(last, current)) {
            for (Object[] row : rows) {
                result.computeIfAbsent((Long) row[0], k -> new java.util.TreeSet<>()).add((String) row[1]);
            }
        }
        return result;
    }

    private LocalDate scalarDate(String jpql, Long cattleId, String extraName, Object extraValue) {
        var q = em.createQuery(jpql, LocalDate.class).setParameter("c", cattleId);
        if (extraName != null) {
            q.setParameter(extraName, extraValue);
        }
        return q.getSingleResult();
    }

    private LocalDate scalarInstant(String jpql, Long cattleId, ZoneId zone) {
        Instant i = em.createQuery(jpql, Instant.class).setParameter("c", cattleId).getSingleResult();
        return i == null ? null : i.atZone(zone).toLocalDate();
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        if (a == null) {
            return b;
        }
        return b != null && b.isAfter(a) ? b : a;
    }
}
