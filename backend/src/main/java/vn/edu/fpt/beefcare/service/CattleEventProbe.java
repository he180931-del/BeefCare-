package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The recorded events of a cattle other than its herd entry and its first pen placement (GBR-33): weights, health,
 * doses, reproduction, pen moves, QR replacement, profile changes, exit lines and offspring. Used to decide whether
 * an entry may be voided and to validate the date order of a correction.
 */
@Component
public class CattleEventProbe {

    /** type is a label such as WEIGHT or PEN_MOVE; date is null for events that have no single date. */
    public record Event(String type, LocalDate date) {}

    @PersistenceContext
    private EntityManager em;

    private final FarmClock clock;

    public CattleEventProbe(FarmClock clock) {
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Event> events(Long cattleId) {
        List<Event> events = new ArrayList<>();
        add(events, "WEIGHT", "select g.checkDate from Growth g where g.cattle.id = :id", cattleId);
        add(events, "HEALTH_CASE", "select h.openedDate from HealthCase h where h.cattle.id = :id", cattleId);
        add(events, "HEALTH_OBSERVATION", "select o.observedTime from HealthObservation o where o.healthCase.cattle.id = :id", cattleId);
        add(events, "TREATMENT", "select t.treatmentTime from Treatment t where t.healthCase.cattle.id = :id", cattleId);
        add(
            events,
            "VACCINATION",
            "select v.vaccinationDate from Vaccination v where v.cattle.id = :id and (v.source is null or v.source <> 'HISTORICAL')",
            cattleId
        );
        add(events, "SCHEDULED_DOSE", "select d.dueDate from ScheduledDose d where d.cattle.id = :id", cattleId);
        add(events, "REPRODUCTION", "select r.eventTime from ReproductionEvent r where r.cattle.id = :id", cattleId);
        add(events, "PREGNANCY", "select p.id from PregnancyEpisode p where p.cattle.id = :id", cattleId);
        add(events, "CALVING", "select c.birthTime from CalvingEvent c where c.dam.id = :id", cattleId);
        add(events, "OFFSPRING", "select c.id from Cattle c where c.dam.id = :id or c.sire.id = :id", cattleId);
        add(events, "PEN_MOVE", "select a.fromDate from PenAssignment a where a.cattle.id = :id and a.source <> vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource.HERD_ENTRY", cattleId);
        add(events, "QR_REPLACEMENT", "select t.id from CattleQrTag t where t.cattle.id = :id and t.status = vn.edu.fpt.beefcare.domain.enumeration.QrTagStatus.REPLACED", cattleId);
        add(events, "PROFILE_CHANGE", "select c.effectiveDate from CattleProfileChange c where c.cattle.id = :id", cattleId);
        add(events, "EXIT", "select h.voucher.exitDate from HerdExit h where h.cattle.id = :id", cattleId);
        Long placements = em.createQuery("select count(a) from PenAssignment a where a.cattle.id = :id", Long.class).setParameter("id", cattleId).getSingleResult();
        long moves = events.stream().filter(e -> e.type().equals("PEN_MOVE")).count();
        if (placements > 1 && moves == 0) {
            events.add(new Event("PEN_MOVE", null));
        }
        return events;
    }

    /** Distinct event labels, in a stable order, for display. */
    public List<String> labels(List<Event> events) {
        return events.stream().map(Event::type).distinct().sorted().toList();
    }

    /** The earliest dated event (an entry date must not be after it), or null when there is none. */
    public LocalDate earliestEventDate(Long cattleId) {
        return events(cattleId).stream().map(Event::date).filter(d -> d != null).min(Comparator.naturalOrder()).orElse(null);
    }

    private void add(List<Event> events, String type, String jpql, Long cattleId) {
        for (Object o : em.createQuery(jpql).setParameter("id", cattleId).getResultList()) {
            events.add(new Event(type, toDate(o)));
        }
    }

    private LocalDate toDate(Object o) {
        if (o instanceof LocalDate d) {
            return d;
        }
        if (o instanceof Instant i) {
            return clock.toFarmDate(i);
        }
        return null;
    }
}
