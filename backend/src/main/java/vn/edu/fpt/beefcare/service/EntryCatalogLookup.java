package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import vn.edu.fpt.beefcare.domain.Breed;
import vn.edu.fpt.beefcare.domain.CalfOutcome;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;

/** Farm-scoped lookups of catalogue rows and calf outcomes: a row of another farm is treated as not found. */
@Component
public class EntryCatalogLookup {

    @PersistenceContext
    private EntityManager em;

    public Optional<Breed> breed(Long farmId, Long id) {
        Breed b = id == null ? null : em.find(Breed.class, id);
        return b != null && b.getFarm() != null && farmId.equals(b.getFarm().getId()) ? Optional.of(b) : Optional.empty();
    }

    public Optional<ProductionPurpose> purpose(Long farmId, Long id) {
        ProductionPurpose p = id == null ? null : em.find(ProductionPurpose.class, id);
        return p != null && p.getFarm() != null && farmId.equals(p.getFarm().getId()) ? Optional.of(p) : Optional.empty();
    }

    public Optional<Vaccine> vaccine(Long farmId, Long id) {
        Vaccine v = id == null ? null : em.find(Vaccine.class, id);
        return v != null && v.getFarm() != null && farmId.equals(v.getFarm().getId()) ? Optional.of(v) : Optional.empty();
    }

    public Optional<Pen> pen(Long farmId, Long id) {
        Pen p = id == null ? null : em.find(Pen.class, id);
        return p != null && p.getFarm() != null && farmId.equals(p.getFarm().getId()) ? Optional.of(p) : Optional.empty();
    }

    /** The first ACTIVE purpose of type UNDECIDED (default purpose of farm-born calves, GBR-93). */
    public Optional<ProductionPurpose> defaultUndecidedPurpose(Long farmId) {
        List<ProductionPurpose> found = em
            .createQuery(
                "select p from ProductionPurpose p where p.farm.id = :farm and p.purposeType = :type and p.available = true order by p.id",
                ProductionPurpose.class
            )
            .setParameter("farm", farmId)
            .setParameter("type", PurposeType.UNDECIDED)
            .setMaxResults(1)
            .getResultList();
        return found.stream().findFirst();
    }

    public Optional<CalfOutcome> calf(Long farmId, Long id) {
        return find(farmId, id, null);
    }

    /** Locks the calf outcome row for the registration / died-before-registration commands. */
    public Optional<CalfOutcome> lockCalf(Long farmId, Long id) {
        return find(farmId, id, LockModeType.PESSIMISTIC_WRITE);
    }

    private Optional<CalfOutcome> find(Long farmId, Long id, LockModeType lock) {
        if (id == null) {
            return Optional.empty();
        }
        CalfOutcome o = lock == null ? em.find(CalfOutcome.class, id) : em.find(CalfOutcome.class, id, lock);
        if (o == null || o.getCalving() == null || o.getCalving().getDam() == null || o.getCalving().getDam().getFarm() == null) {
            return Optional.empty();
        }
        return farmId.equals(o.getCalving().getDam().getFarm().getId()) ? Optional.of(o) : Optional.empty();
    }
}
