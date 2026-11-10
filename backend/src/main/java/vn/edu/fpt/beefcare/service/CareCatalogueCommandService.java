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
        String code = catalogueCode(req.code(), id == null ? null : vaccine.getCode()); String name = requireText(req.name(), "name", 150);
        if (id != null && !code.equals(vaccine.getCode()) && vaccineReferenced(id)) throw DomainException.invalid("code");
        String disease = requireText(req.diseasePrevented(), "diseasePrevented", 150);
        ensureCodeAvailable(farmId, code, id, true);
        // §3.2: withdrawal 0–365 (default 0), booster interval 0–730 days.
        int withdrawal = req.withdrawalDays() == null ? 0 : req.withdrawalDays();
        if (withdrawal < 0 || withdrawal > 365) throw DomainException.invalid("withdrawalDays");
        if (req.boosterInterval() != null && (req.boosterInterval() < 0 || req.boosterInterval() > 730)) throw DomainException.invalid("boosterInterval");
        vaccine.setFarm(ctx.farm()); vaccine.setCode(code); vaccine.setName(name); vaccine.setDiseasePrevented(disease);
        vaccine.setManufacturer(trimMax(req.manufacturer(), "manufacturer", 100)); vaccine.setDose(trimMax(req.dose(), "dose", 50));
        vaccine.setRoute(trimMax(req.route(), "route", 50)); vaccine.setWithdrawalInfo(Integer.toString(withdrawal));
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
        String code = catalogueCode(req.code(), id == null ? null : medicine.getCode()); String name = requireText(req.name(), "name", 150);
        if (id != null && !code.equals(medicine.getCode()) && treatments(id) > 0) throw DomainException.invalid("code");
        ensureCodeAvailable(farmId, code, id, false);
        // §3.3: withdrawal required 0–365; reference dose (≤ 100), route and notes (≤ 500) optional.
        if (req.withdrawalDays() == null) throw DomainException.required("withdrawalDays");
        if (req.withdrawalDays() < 0 || req.withdrawalDays() > 365) throw DomainException.invalid("withdrawalDays");
        medicine.setFarm(ctx.farm()); medicine.setCode(code); medicine.setName(name); medicine.setDescription(trimMax(req.description(), "description", 500));
        medicine.setDose(trimMax(req.dose(), "dose", 100)); medicine.setRoute(trimMax(req.route(), "route", 50));
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
        if (vaccineReferenced(id)) throw DomainException.unprocessable(MessageCodes.FE18_04, "item", vaccine.getName());
        em.remove(vaccine); em.flush(); audit.log(ctx, "VACCINE_DELETE", "Vaccine", id, Map.of("code", vaccine.getCode())); return Boolean.TRUE;
    }

    public Boolean deleteUnusedMedicine(Long farmId, Long id, String key, Integer expectedVersion) {
        return idempotency.execute(farmId, FarmAction.MANAGE_CARE_CATALOGUES, "MEDICINE_DELETE", key,
            Map.of("id", id, "expectedVersion", expectedVersion == null ? -1 : expectedVersion), Boolean.class,
            () -> deleteUnusedMedicineInCommand(farmId, id, expectedVersion));
    }

    /** Q4 (decided 09/11): a medicine never used by a treatment may be deleted; otherwise it is only stopped. */
    @Transactional
    Boolean deleteUnusedMedicineInCommand(Long farmId, Long id, Integer expectedVersion) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_CARE_CATALOGUES);
        Medicine medicine = medicineForFarm(farmId, id); VersionGuard.requireExpected(medicine.getVersion(), expectedVersion);
        if (treatments(id) > 0) throw DomainException.unprocessable(MessageCodes.FE18_04, "item", medicine.getName());
        em.remove(medicine); em.flush(); audit.log(ctx, "MEDICINE_DELETE", "Medicine", id, Map.of("code", medicine.getCode())); return Boolean.TRUE;
    }

    private long count(String jpql, Long id) { return em.createQuery(jpql, Long.class).setParameter("id", id).getSingleResult(); }
    private long vaccinationSchedules(Long vaccineId) {
        return count("select count(s) from VaccinationSchedule s where s.vaccine.id=:id", vaccineId);
    }
    private long vaccinationRecords(Long vaccineId) {
        return count("select count(v) from Vaccination v where v.vaccine.id=:id", vaccineId);
    }
    private boolean vaccineReferenced(Long vaccineId) {
        return vaccinationSchedules(vaccineId) > 0 || vaccinationRecords(vaccineId) > 0;
    }
    private long treatments(Long medicineId) { return count("select count(t) from Treatment t where t.medicine.id=:id", medicineId); }

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
        if (query.getSingleResult() > 0) throw DomainException.unprocessable(MessageCodes.FE18_02, "code", code);
    }
    private CareDtos.CatalogueItem view(Vaccine v) {
        int days = 0; try { days = Integer.parseInt(v.getWithdrawalInfo()); } catch (Exception ignored) {}
        long schedules = vaccinationSchedules(v.getId());
        long records = vaccinationRecords(v.getId());
        boolean incomplete = v.getDose() == null || v.getDose().isBlank() || v.getRoute() == null || v.getRoute().isBlank();
        return new CareDtos.CatalogueItem(v.getId(), v.getCode(), v.getName(), null, v.getDiseasePrevented(), v.getManufacturer(), v.getDose(), v.getRoute(), days, v.getBoosterInterval(), v.getAvailable(), v.getVersion(),
            schedules, records, schedules + records, incomplete);
    }
    private CareDtos.CatalogueItem view(Medicine m) {
        long records = treatments(m.getId());
        return new CareDtos.CatalogueItem(m.getId(), m.getCode(), m.getName(), m.getDescription(), null, null, m.getDose(), m.getRoute(), m.getWithdrawalDays(), null, m.getAvailable(), m.getVersion(),
            0L, records, records, false);
    }
    /**
     * R-18-01 ("như giống"): 2–20 characters, upper-case letters, digits and "-" (TC-18-02/03). An unchanged code of an
     * older item is kept as it is so that editing other fields never fails on legacy data.
     */
    private String catalogueCode(String value, String current) {
        String code = requireText(value, "code", 20);
        if (code.equals(current)) return code;
        if (!code.matches("[A-Z0-9-]{2,20}")) throw DomainException.invalid("code");
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
