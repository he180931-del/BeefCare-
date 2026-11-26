package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.AuditLog;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;

/**
 * Read-only service facts shared by the Owner side (SCR-09, SCR-11) and the Platform Manager side (SCR-12 and its
 * popup): ACTIVE cattle, latest confirmed end, the purchased period covering now, the last suspension (kept in the
 * append-only audit as the farm service history, decision 08/11/2026) and the Owner. No cattle or care record is read
 * beyond a count (GBR-11).
 */
@Service
@Transactional(readOnly = true)
public class FarmServiceFacts {

    /** Audit action of a PM suspension; its details hold {@code statusBefore}, {@code statusAfter} and {@code reason}. */
    public static final String SUSPEND_ACTION = "FARM_SERVICE_SUSPEND";
    public static final String RESTORE_ACTION = "FARM_SERVICE_RESTORE";

    public record Period(Instant start, Instant end) {}

    public record Suspension(Instant at, String byName, String reason) {}

    private final EntityManager em;
    private final FarmClock clock;

    public FarmServiceFacts(EntityManager em, FarmClock clock) {
        this.em = em;
        this.clock = clock;
    }

    public Instant now() {
        return clock.now();
    }

    public Map<Long, Long> activeCattle(Collection<Long> farmIds) {
        Map<Long, Long> counts = new HashMap<>();
        if (farmIds.isEmpty()) return counts;
        em
            .createQuery("select c.farm.id, count(c) from Cattle c where c.farm.id in :ids and c.herdStatus=:s group by c.farm.id", Object[].class)
            .setParameter("ids", farmIds)
            .setParameter("s", HerdStatus.ACTIVE)
            .getResultList()
            .forEach(row -> counts.put((Long) row[0], (Long) row[1]));
        return counts;
    }

    /** Number of farms per upper-case service status, over every farm of the platform (SCR-12 tiles). */
    public Map<String, Long> farmsByStatus() {
        Map<String, Long> counts = new HashMap<>();
        em
            .createQuery("select upper(f.serviceStatus), count(f) from Farm f group by upper(f.serviceStatus)", Object[].class)
            .getResultList()
            .forEach(row -> counts.put(row[0] == null ? "" : (String) row[0], (Long) row[1]));
        return counts;
    }

    /** Latest confirmed end per farm; absent when the farm has no accepted payment yet. */
    public Map<Long, Instant> latestEnd(Collection<Long> farmIds) {
        Map<Long, Instant> ends = new HashMap<>();
        if (farmIds.isEmpty()) return ends;
        em
            .createQuery("select s.farm.id, s.latestEnd from Subscription s where s.farm.id in :ids", Object[].class)
            .setParameter("ids", farmIds)
            .getResultList()
            .forEach(row -> {
                if (row[1] != null) ends.put((Long) row[0], (Instant) row[1]);
            });
        return ends;
    }

    /** The accepted purchased period covering now, if any. */
    public Optional<Period> currentPeriod(Long farmId) {
        Instant now = clock.now();
        return em
            .createQuery(
                "select p.purchasedStart, p.purchasedEnd from Payment p where p.subscription.farm.id=:f and upper(p.state)='PAID' " +
                "and p.purchasedStart<=:now and p.purchasedEnd>:now order by p.purchasedEnd desc",
                Object[].class
            )
            .setParameter("f", farmId)
            .setParameter("now", now)
            .setMaxResults(1)
            .getResultStream()
            .findFirst()
            .map(row -> new Period((Instant) row[0], (Instant) row[1]));
    }

    /** The most recent PM suspension per farm (date, PM and reason), read from the farm service history in the audit. */
    public Map<Long, Suspension> lastSuspension(Collection<Long> farmIds) {
        Map<Long, Suspension> latest = new HashMap<>();
        if (farmIds.isEmpty()) return latest;
        em
            .createQuery(
                "select a from AuditLog a left join fetch a.actor where a.farm.id in :ids and a.action=:action order by a.loggedAt desc, a.id desc",
                AuditLog.class
            )
            .setParameter("ids", farmIds)
            .setParameter("action", SUSPEND_ACTION)
            .getResultList()
            .forEach(entry -> latest.putIfAbsent(entry.getFarm().getId(), suspension(entry)));
        return latest;
    }

    public Map<Long, AppUser> owners(Collection<Long> farmIds) {
        Map<Long, AppUser> owners = new HashMap<>();
        if (farmIds.isEmpty()) return owners;
        em
            .createQuery(
                "select m from FarmMembership m join fetch m.user where m.farm.id in :ids and upper(m.role)='OWNER' and upper(m.status)='ACTIVE'",
                FarmMembership.class
            )
            .setParameter("ids", farmIds)
            .getResultList()
            .forEach(m -> owners.putIfAbsent(m.getFarm().getId(), m.getUser()));
        return owners;
    }

    /**
     * GBR-13 without the suspension flag, used after a restore (GBR-15): ACTIVE while the latest confirmed end is ahead,
     * EXPIRED once it has passed, PENDING_PAYMENT when no payment was ever accepted (UC-FE02-05 AF2).
     */
    public String statusFromSubscription(Instant latestEnd) {
        if (latestEnd == null) return "PENDING_PAYMENT";
        return latestEnd.isAfter(clock.now()) ? "ACTIVE" : "EXPIRED";
    }

    @SuppressWarnings("unchecked")
    private static Suspension suspension(AuditLog entry) {
        Map<String, Object> details = JsonSupport.fromJson(entry.getDetails(), Map.class);
        Object reason = details == null ? null : details.get("reason");
        return new Suspension(entry.getLoggedAt(), entry.getActor() == null ? null : entry.getActor().getFullName(), reason == null ? null : reason.toString());
    }
}
