package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;
import vn.edu.fpt.beefcare.domain.ReminderParameter;
import vn.edu.fpt.beefcare.service.dto.CareDtos;

/** Immutable farm parameter snapshots (UC-FE18-17, GBR-68) with a compatibility projection for legacy reminders. */
@Service
public class FarmParameterCommandService {
    private static final Map<String, int[]> RANGES = Map.ofEntries(
        Map.entry("WEANING_AGE_MONTHS", new int[] {3, 12}), Map.entry("YOUNG_STOCK_AGE_MONTHS", new int[] {6, 24}),
        Map.entry("ADULT_AGE_MONTHS", new int[] {15, 48}), Map.entry("MIN_BREEDING_AGE_MONTHS", new int[] {6, 36}),
        Map.entry("MIN_BREEDING_WEIGHT_KG", new int[] {100, 600}), Map.entry("GESTATION_LENGTH_DAYS", new int[] {270, 300}),
        Map.entry("PREGNANCY_CHECK_DAYS", new int[] {25, 90}), Map.entry("PREGNANCY_RECHECK_DAYS", new int[] {7, 60}),
        Map.entry("CALVING_LEAD_DAYS", new int[] {1, 60}), Map.entry("POST_CALVING_DAYS", new int[] {20, 120}),
        Map.entry("BREEDING_WINDOW_START_HOURS", new int[] {0, 24}), Map.entry("BREEDING_WINDOW_END_HOURS", new int[] {1, 36}),
        Map.entry("ESTRUS_CYCLE_DAYS", new int[] {17, 25}), Map.entry("WEIGHING_INTERVAL_DAYS", new int[] {7, 180}),
        Map.entry("VACCINATION_LEAD_DAYS", new int[] {1, 30}), Map.entry("TARGET_FINISHING_WEIGHT_KG", new int[] {150, 900})
    );
    @PersistenceContext private EntityManager em;
    private final FarmAccessService access;
    private final IdempotencyCommandService idempotency;
    private final AuditService audit;
    private final FarmClock clock;
    private final ObjectMapper json;

    public FarmParameterCommandService(FarmAccessService access, IdempotencyCommandService idempotency, AuditService audit, FarmClock clock, ObjectMapper json) {
        this.access = access; this.idempotency = idempotency; this.audit = audit; this.clock = clock; this.json = json;
    }

    public CareDtos.ParameterVersionResult create(Long farmId, String key, CareDtos.ParameterVersionCommand request) {
        return idempotency.execute(farmId, FarmAction.MANAGE_CARE_CATALOGUES, "FARM_PARAMETER_VERSION_CREATE", key, request,
            CareDtos.ParameterVersionResult.class, () -> createInCommand(farmId, request));
    }

    @Transactional
    CareDtos.ParameterVersionResult createInCommand(Long farmId, CareDtos.ParameterVersionCommand req) {
        FarmContext ctx = access.require(farmId, FarmAction.MANAGE_CARE_CATALOGUES);
        if (req == null) throw DomainException.required("parameters");
        requireText(req.sourceNote(), "sourceNote", 255);
        Farm farm = em.find(Farm.class, farmId, LockModeType.PESSIMISTIC_WRITE);
        if (farm == null) throw DomainException.notFound(MessageCodes.COM_08, "farmId", farmId);
        var versions = em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm order by p.versionNo desc", FarmParameterVersion.class)
            .setParameter("farm", farmId).setMaxResults(1).getResultList();
        int versionNo = versions.isEmpty() ? 1 : versions.get(0).getVersionNo() + 1;
        Map<String, Object> values = new LinkedHashMap<>();
        if (!versions.isEmpty()) {
            try { values.putAll(json.readValue(versions.get(0).getParameterValues(), new TypeReference<>() {})); }
            catch (Exception e) { throw new IllegalStateException("Stored farm parameter JSON is invalid", e); }
        }
        if (req.parameters() != null) {
            for (var entry : req.parameters().entrySet()) {
                String name = entry.getKey();
                if (!RANGES.containsKey(name) && !"BCS_SCALE".equals(name)) throw DomainException.invalid("parameters." + name);
                if ("TARGET_FINISHING_WEIGHT_KG".equals(name) && entry.getValue() == null) { values.remove(name); continue; }
                if ("BCS_SCALE".equals(name)) {
                    if (!(entry.getValue() instanceof String s) || s.isBlank() || s.length() > 30) throw DomainException.invalid("parameters.BCS_SCALE");
                } else validateRange(name, entry.getValue());
                values.put(name, entry.getValue());
            }
        }
        validateRelationships(values);
        int gestation = req.gestationLengthDays() == null ? intValue(values.getOrDefault("GESTATION_LENGTH_DAYS", 283)) : req.gestationLengthDays();
        validateRange("GESTATION_LENGTH_DAYS", gestation);
        values.put("GESTATION_LENGTH_DAYS", gestation);
        LocalDate effectiveFrom = req.effectiveFrom() == null ? clock.today() : req.effectiveFrom();
        if (effectiveFrom.isBefore(clock.today())) throw DomainException.invalid("effectiveFrom");
        FarmParameterVersion snapshot = new FarmParameterVersion(); snapshot.setFarm(farm); snapshot.setVersionNo(versionNo);
        snapshot.setGestationLengthDays(gestation); snapshot.setParameterValues(JsonSupport.toJson(values)); snapshot.setEffectiveFrom(effectiveFrom);
        snapshot.setSourceNote(req.sourceNote().trim()); snapshot.setChangedBy(ctx.user()); snapshot.setCreatedAt(clock.now()); em.persist(snapshot);
        if (!effectiveFrom.isAfter(clock.today())) {
            for (var entry : values.entrySet()) {
                ReminderParameter legacy = new ReminderParameter(); legacy.setFarm(farm); legacy.setParameterType(entry.getKey());
                legacy.setParamValue(String.valueOf(entry.getValue())); legacy.setVersionNo(versionNo); legacy.setEffectiveFrom(effectiveFrom); em.persist(legacy);
            }
        }
        em.flush();
        audit.log(ctx, "FARM_PARAMETER_VERSION", "FarmParameterVersion", snapshot.getId(), Map.of("versionNo", versionNo, "effectiveFrom", effectiveFrom, "sourceNote", req.sourceNote().trim()));
        return new CareDtos.ParameterVersionResult(snapshot.getId(), versionNo, gestation, effectiveFrom, Map.copyOf(values));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> effective(Long farmId, LocalDate date) {
        access.require(farmId, FarmAction.VIEW_CARE_CATALOGUES);
        var versions = em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc", FarmParameterVersion.class)
            .setParameter("farm", farmId).setParameter("date", date == null ? clock.today() : date).setMaxResults(1).getResultList();
        if (versions.isEmpty()) return Map.of();
        try { return Map.copyOf(json.readValue(versions.get(0).getParameterValues(), new TypeReference<>() {})); }
        catch (Exception e) { throw new IllegalStateException("Stored farm parameter JSON is invalid", e); }
    }

    @Transactional(readOnly = true)
    public java.util.List<CareDtos.ParameterVersionResult> list(Long farmId) {
        access.require(farmId, FarmAction.VIEW_CARE_CATALOGUES);
        return em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm order by p.effectiveFrom desc,p.versionNo desc", FarmParameterVersion.class)
            .setParameter("farm", farmId).getResultList().stream().map(p -> {
                try {
                    Map<String, Object> values = json.readValue(p.getParameterValues(), new TypeReference<>() {});
                    return new CareDtos.ParameterVersionResult(p.getId(), p.getVersionNo(), p.getGestationLengthDays(), p.getEffectiveFrom(), Map.copyOf(values));
                } catch (Exception e) { throw new IllegalStateException("Stored farm parameter JSON is invalid", e); }
            }).toList();
    }

    private void validateRange(String name, Object raw) {
        int[] range = RANGES.get(name);
        if (range == null) throw DomainException.invalid("parameters." + name);
        if ("MIN_BREEDING_WEIGHT_KG".equals(name)) {
            java.math.BigDecimal value=decimalValue(raw);
            if(value.compareTo(java.math.BigDecimal.valueOf(range[0]))<0||value.compareTo(java.math.BigDecimal.valueOf(range[1]))>0)
                throw DomainException.invalid("parameters."+name);
            return;
        }
        int value = intValue(raw);
        if (value < range[0] || value > range[1]) throw DomainException.invalid("parameters." + name);
    }
    private java.math.BigDecimal decimalValue(Object value){
        try{return new java.math.BigDecimal(String.valueOf(value));}catch(Exception e){throw DomainException.invalid("parameters");}
    }
    private void validateRelationships(Map<String,Object> values){
        if(values.get("BCS_SCALE")!=null&&!java.util.Set.of("1-5:0.5","1-9:1").contains(String.valueOf(values.get("BCS_SCALE"))))
            throw DomainException.invalid("parameters.BCS_SCALE");
        Integer wean=optionalInt(values.get("WEANING_AGE_MONTHS")),young=optionalInt(values.get("YOUNG_STOCK_AGE_MONTHS")),adult=optionalInt(values.get("ADULT_AGE_MONTHS"));
        if(wean!=null&&young!=null&&wean>=young)throw DomainException.invalid("parameters.YOUNG_STOCK_AGE_MONTHS");
        if(young!=null&&adult!=null&&young>=adult)throw DomainException.invalid("parameters.ADULT_AGE_MONTHS");
        Integer start=optionalInt(values.get("BREEDING_WINDOW_START_HOURS")),end=optionalInt(values.get("BREEDING_WINDOW_END_HOURS"));
        if(start!=null&&end!=null&&end<=start)throw DomainException.invalid("parameters.BREEDING_WINDOW_END_HOURS");
    }
    private Integer optionalInt(Object value){return value==null?null:intValue(value);}
    private int intValue(Object value) {
        if (value instanceof Number n) {
            try { return new java.math.BigDecimal(n.toString()).intValueExact(); }
            catch (ArithmeticException e) { throw DomainException.invalid("parameters"); }
        }
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception e) { throw DomainException.invalid("parameters"); }
    }
    private void requireText(String value, String field, int max) {
        if (value == null || value.isBlank()) throw DomainException.required(field);
        if (value.trim().length() > max) throw DomainException.invalid(field);
    }
}
