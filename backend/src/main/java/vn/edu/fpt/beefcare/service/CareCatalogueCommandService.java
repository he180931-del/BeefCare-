package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Medicine;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Farm-scoped vaccine and medicine reference data commands (GBR-67). */
@Service
public class CareCatalogueCommandService {
    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;

    public CareCatalogueCommandService(FarmAccessService access, IdempotencyCommandService idempotency, AuditService audit) {
        this.access = access; this.idempotency = idempotency; this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<CareDtos.CatalogueItem> vaccines(Long farmId) {
        access.require(farmId, FarmAction.VIEW_CARE_CATALOGUES);
        return em.createQuery("select v from Vaccine v where v.farm.id=:farm order by v.code", Vaccine.class)
            .setParameter("farm", farmId).getResultList().stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public List<CareDtos.CatalogueItem> medicines(Long farmId) {
        access.require(farmId, FarmAction.VIEW_CARE_CATALOGUES);
        return em.createQuery("select m from Medicine m where m.farm.id=:farm order by m.code", Medicine.class)
            .setParameter("farm", farmId).getResultList().stream().map(this::view).toList();
    }

    public CareDtos.CatalogueItem saveVaccine(Long farmId, Long id, String key, CareDtos.VaccineCommand req) {
        String action = id == null ? "VACCINE_CREATE" : "VACCINE_UPDATE";
        return idempotency.execute(farmId, FarmAction.MANAGE_CARE_CATALOGUES, action, key,
            Map.of("id", id == null ? 0L : id, "request", req), CareDtos.CatalogueItem.class, () -> saveVaccineInCommand(farmId, id, req));
    }

    @Transactional
    CareDtos.CatalogueItem saveVaccineInCommand(Long farmId, Long id, CareDtos.VaccineCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_CARE_CATALOGUES);
        if (req == null) throw DomainException.required("vaccine");
        Vaccine vaccine = id == null ? new Vaccine() : vaccineForFarm(farmId, id);
        if (id != null) VersionGuard.requireExpected(vaccine.getVersion(), req.expectedVersion());
        String code = normalizeCode(req.code()); String name = requireText(req.name(), "name", 255);
        String disease = requireText(req.diseasePrevented(), "diseasePrevented", 255);
        ensureCodeAvailable(farmId, code, id, true);
        if (req.withdrawalDays() == null || req.withdrawalDays() < 0 || req.withdrawalDays() > 365) throw DomainException.invalid("withdrawalDays");
        if (req.boosterInterval() != null && (req.boosterInterval() < 1 || req.boosterInterval() > 60)) throw DomainException.invalid("boosterInterval");
        vaccine.setFarm(ctx.farm()); vaccine.setCode(code); vaccine.setName(name); vaccine.setDiseasePrevented(disease);
        vaccine.setManufacturer(trimMax(req.manufacturer(), "manufacturer", 255)); vaccine.setDose(trimMax(req.dose(), "dose", 255));
        vaccine.setRoute(trimMax(req.route(), "route", 255)); vaccine.setWithdrawalInfo(Integer.toString(req.withdrawalDays()));
        vaccine.setBoosterInterval(req.boosterInterval()); vaccine.setAvailable(req.available() == null ? Boolean.TRUE : req.available());
        em.persist(vaccine); em.flush();
        audit.log(ctx, id == null ? "VACCINE_CREATE" : "VACCINE_UPDATE", "Vaccine", vaccine.getId(), Map.of("code", code, "available", vaccine.getAvailable()));
        return view(vaccine);
    }

    public CareDtos.CatalogueItem saveMedicine(Long farmId, Long id, String key, CareDtos.MedicineCommand req) {
        String action = id == null ? "MEDICINE_CREATE" : "MEDICINE_UPDATE";
        return idempotency.execute(farmId, FarmAction.MANAGE_CARE_CATALOGUES, action, key,
            Map.of("id", id == null ? 0L : id, "request", req), CareDtos.CatalogueItem.class, () -> saveMedicineInCommand(farmId, id, req));
    }

    @Transactional
    CareDtos.CatalogueItem saveMedicineInCommand(Long farmId, Long id, CareDtos.MedicineCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_CARE_CATALOGUES);
        if (req == null) throw DomainException.required("medicine");
        Medicine medicine = id == null ? new Medicine() : medicineForFarm(farmId, id);
        if (id != null) VersionGuard.requireExpected(medicine.getVersion(), req.expectedVersion());
        String code = normalizeCode(req.code()); String name = requireText(req.name(), "name", 255);
        ensureCodeAvailable(farmId, code, id, false);
        if (req.withdrawalDays() == null || req.withdrawalDays() < 0 || req.withdrawalDays() > 365) throw DomainException.invalid("withdrawalDays");
        medicine.setFarm(ctx.farm()); medicine.setCode(code); medicine.setName(name); medicine.setDescription(req.description());
        medicine.setDose(requireText(req.dose(), "dose", 255)); medicine.setRoute(requireText(req.route(), "route", 255));
        medicine.setWithdrawalDays(req.withdrawalDays()); medicine.setWithdrawalInfo(Integer.toString(req.withdrawalDays()));
        medicine.setAvailable(req.available() == null ? Boolean.TRUE : req.available());
        em.persist(medicine); em.flush();
        audit.log(ctx, id == null ? "MEDICINE_CREATE" : "MEDICINE_UPDATE", "Medicine", medicine.getId(), Map.of("code", code, "available", medicine.getAvailable()));
        return view(medicine);
    }

    public Boolean deleteUnusedVaccine(Long farmId, Long id, String key, Integer expectedVersion) {
        return idempotency.execute(farmId, FarmAction.MANAGE_CARE_CATALOGUES, "VACCINE_DELETE", key,
            Map.of("id", id, "expectedVersion", expectedVersion == null ? -1 : expectedVersion), Boolean.class,
            () -> deleteUnusedVaccineInCommand(farmId, id, expectedVersion));
    }

    @Transactional
    Boolean deleteUnusedVaccineInCommand(Long farmId, Long id, Integer expectedVersion) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_CARE_CATALOGUES);
        Vaccine vaccine = vaccineForFarm(farmId, id); VersionGuard.requireExpected(vaccine.getVersion(), expectedVersion);
        Long usedByRecord = em.createQuery("select count(v) from Vaccination v where v.vaccine.id=:id", Long.class).setParameter("id", id).getSingleResult();
        Long usedBySchedule = em.createQuery("select count(s) from VaccinationSchedule s where s.vaccine.id=:id", Long.class).setParameter("id", id).getSingleResult();
        if (usedByRecord > 0 || usedBySchedule > 0) throw DomainException.conflict(MessageCodes.COM_05, "reason", "catalogue_item_referenced");
        em.remove(vaccine); em.flush(); audit.log(ctx, "VACCINE_DELETE", "Vaccine", id, Map.of("code", vaccine.getCode())); return Boolean.TRUE;
    }

    private Vaccine vaccineForFarm(Long farmId, Long id) {
        return em.createQuery("select v from Vaccine v where v.id=:id and v.farm.id=:farm", Vaccine.class).setParameter("id", id).setParameter("farm", farmId)
            .getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "vaccineId", id));
    }
    private Medicine medicineForFarm(Long farmId, Long id) {
        return em.createQuery("select m from Medicine m where m.id=:id and m.farm.id=:farm", Medicine.class).setParameter("id", id).setParameter("farm", farmId)
            .getResultStream().findFirst().orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08, "medicineId", id));
    }
    private void ensureCodeAvailable(Long farmId, String code, Long excludedId, boolean vaccine) {
        String q = vaccine ? "select count(v) from Vaccine v where v.farm.id=:farm and lower(v.code)=lower(:code)" : "select count(m) from Medicine m where m.farm.id=:farm and lower(m.code)=lower(:code)";
        if (excludedId != null) q += vaccine ? " and v.id<>:excluded" : " and m.id<>:excluded";
        var query = em.createQuery(q, Long.class).setParameter("farm", farmId).setParameter("code", code);
        if (excludedId != null) query.setParameter("excluded", excludedId);
        if (query.getSingleResult() > 0) throw DomainException.conflict(MessageCodes.COM_05, "reason", "catalogue_code_exists");
    }
    private CareDtos.CatalogueItem view(Vaccine v) {
        int days = 0; try { days = Integer.parseInt(v.getWithdrawalInfo()); } catch (Exception ignored) {}
        return new CareDtos.CatalogueItem(v.getId(), v.getCode(), v.getName(), null, v.getDiseasePrevented(), v.getManufacturer(), v.getDose(), v.getRoute(), days, v.getBoosterInterval(), v.getAvailable(), v.getVersion());
    }
    private CareDtos.CatalogueItem view(Medicine m) {
        return new CareDtos.CatalogueItem(m.getId(), m.getCode(), m.getName(), m.getDescription(), null, null, m.getDose(), m.getRoute(), m.getWithdrawalDays(), null, m.getAvailable(), m.getVersion());
    }
    private String normalizeCode(String value) {
        String code = requireText(value, "code", 50).toUpperCase(java.util.Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]{0,49}")) throw DomainException.invalid("code");
        return code;
    }
    private String requireText(String value, String field, int max) {
        if (value == null || value.isBlank()) throw DomainException.required(field);
        if (value.trim().length() > max) throw DomainException.invalid(field); return value.trim();
    }
    private String trimMax(String value, String field, int max) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().length() > max) throw DomainException.invalid(field); return value.trim();
    }
}
