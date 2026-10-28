package vn.edu.fpt.beefcare.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.enumeration.ActiveStatus;
import vn.edu.fpt.beefcare.repository.PenAssignmentRepository;
import vn.edu.fpt.beefcare.repository.PenRepository;

/**
 * Pen headcount and capacity (GBR-19, GBR-20, BR-D09). Headcount is derived: the number of OPEN pen assignments.
 */
@Service
public class PenOccupancyService {

    /** Occupancy of one pen before and after a planned change. */
    public record Occupancy(Long penId, String penCode, int capacity, int before, int after) {
        public boolean willBeFull() {
            return after >= capacity;
        }
    }

    private final PenRepository penRepository;
    private final PenAssignmentRepository assignmentRepository;

    public PenOccupancyService(PenRepository penRepository, PenAssignmentRepository assignmentRepository) {
        this.penRepository = penRepository;
        this.assignmentRepository = assignmentRepository;
    }

    @Transactional(readOnly = true)
    public int headcount(Long penId) {
        return (int) assignmentRepository.countByPenIdAndToDateIsNull(penId);
    }

    @Transactional(readOnly = true)
    public Map<Long, Integer> headcounts(Collection<Long> penIds) {
        Map<Long, Integer> result = new HashMap<>();
        if (penIds.isEmpty()) {
            return result;
        }
        penIds.forEach(id -> result.put(id, 0));
        for (Object[] row : assignmentRepository.countOpenGroupedByPen(penIds)) {
            result.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public int freePlaces(Pen pen) {
        return pen.getCapacity() - headcount(pen.getId());
    }

    /** Locks the pens of the farm (PESSIMISTIC_WRITE) in ascending id order; unknown pens give MSG-COM-08. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Map<Long, Pen> lockPens(Long farmId, Collection<Long> penIds) {
        Map<Long, Pen> pens = new TreeMap<>();
        if (penIds.isEmpty()) {
            return pens;
        }
        for (Pen pen : penRepository.lockAllByFarmIdAndIdIn(farmId, new ArrayList<>(new java.util.TreeSet<>(penIds)))) {
            pens.put(pen.getId(), pen);
        }
        for (Long id : penIds) {
            if (!pens.containsKey(id)) {
                throw DomainException.unprocessable(MessageCodes.COM_08, "pen_id", id);
            }
        }
        return pens;
    }

    /**
     * Validates that every destination pen is ACTIVE and has room for the cattle arriving in it. {@code incomingByPen}
     * is already grouped per pen (several voucher lines into one pen are one entry), so aggregate capacity is checked.
     * Pens are locked first in ascending id order. Failure: MSG-FE04-05 with {pen_code, count, free}.
     *
     * @return the occupancy before / after for each pen (for "pen will be full" warnings, MSG-FE06-17)
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<Occupancy> assertCanReceive(Long farmId, Map<Long, Integer> incomingByPen) {
        Map<Long, Pen> pens = lockPens(farmId, incomingByPen.keySet());
        Map<Long, Integer> current = headcounts(pens.keySet());
        List<Occupancy> result = new ArrayList<>();
        for (Pen pen : pens.values()) {
            int incoming = incomingByPen.get(pen.getId());
            int used = current.get(pen.getId());
            int free = Math.max(0, pen.getCapacity() - used);
            if (pen.getStatus() != ActiveStatus.ACTIVE) {
                throw DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", pen.getCode(), "count", incoming, "free", 0);
            }
            if (incoming > free) {
                throw DomainException.unprocessable(MessageCodes.FE04_05, "pen_code", pen.getCode(), "count", incoming, "free", free);
            }
            result.add(new Occupancy(pen.getId(), pen.getCode(), pen.getCapacity(), used, used + incoming));
        }
        return result;
    }

    /** Non-locking preview of the same figures (no validation), for forms and the pre-save checks panel. */
    @Transactional(readOnly = true)
    public List<Occupancy> preview(Long farmId, Map<Long, Integer> deltaByPen) {
        List<Occupancy> result = new ArrayList<>();
        Map<Long, Integer> current = headcounts(deltaByPen.keySet());
        for (Map.Entry<Long, Integer> e : new TreeMap<>(deltaByPen).entrySet()) {
            penRepository
                .findByIdAndFarmId(e.getKey(), farmId)
                .ifPresent(pen ->
                    result.add(new Occupancy(pen.getId(), pen.getCode(), pen.getCapacity(), current.get(pen.getId()), current.get(pen.getId()) + e.getValue()))
                );
        }
        return result;
    }
}
