package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.FarmParameterVersion;

/** Shared read-only derivation of care, withdrawal, and reproductive indicators (GBR-45/46/54/55). */
@Service
public class CattleStateService {

    @PersistenceContext
    private EntityManager em;

    private final FarmClock clock;
    private final ObjectMapper json;

    public CattleStateService(FarmClock clock, ObjectMapper json) {
        this.clock = clock;
        this.json = json;
    }

    /** API intended for cattle/profile/timeline and report projections; never persists derived status. */
    @Transactional(readOnly = true)
    public Map<String, Object> state(Cattle cattle) {
        Map<String, Object> result = new LinkedHashMap<>();
        Long cattleId = cattle.getId();
        Long farmId = cattle.getFarm().getId();
        Long validCases = em.createQuery("select count(h) from HealthCase h where h.cattle.id=:id and upper(h.status) in ('OPEN','CHRONIC')", Long.class)
            .setParameter("id", cattleId).getSingleResult();
        Long treatedCases = em.createQuery("select count(distinct h.id) from HealthCase h join Treatment t on t.healthCase.id=h.id where h.cattle.id=:id and upper(h.status)='OPEN' and (t.status is null or upper(t.status)='VALID')", Long.class)
            .setParameter("id", cattleId).getSingleResult();
        result.put("healthState", treatedCases > 0 ? "UNDER_TREATMENT" : validCases > 0 ? "MONITORING" : "HEALTHY");
        ZoneId farmZone = farmZone(cattle);
        LocalDate today = clock.now().atZone(farmZone).toLocalDate();
        LocalDate withdrawal = em.createQuery("select max(t.withdrawalEndDate) from Treatment t where t.healthCase.cattle.id=:id and (t.status is null or upper(t.status)='VALID')", LocalDate.class)
            .setParameter("id", cattleId).getSingleResult();
        LocalDate vaccinationWithdrawal = em.createQuery("select max(v.withdrawalEndDate) from Vaccination v where v.cattle.id=:id and (v.source is null or upper(v.source)<>'HISTORICAL') and upper(v.status)='VALID'", LocalDate.class)
            .setParameter("id", cattleId).getSingleResult();
        if (vaccinationWithdrawal != null && (withdrawal == null || vaccinationWithdrawal.isAfter(withdrawal))) withdrawal = vaccinationWithdrawal;
        result.put("withdrawalEndDate", withdrawal != null && withdrawal.isBefore(today) ? null : withdrawal);
        Long contagious = em.createQuery("select count(h) from HealthCase h where h.cattle.id=:id and upper(h.status) in ('OPEN','CHRONIC') and h.isSuspectedContagious=true", Long.class)
            .setParameter("id", cattleId).getSingleResult();
        result.put("suspectedContagious", contagious > 0);

        List<?> pregnancy = em.createQuery("select p from PregnancyEpisode p where p.cattle.id=:id and upper(p.status)='OPEN' order by p.id desc", vn.edu.fpt.beefcare.domain.PregnancyEpisode.class)
            .setParameter("id", cattleId).setMaxResults(1).getResultList();
        LocalDate expectedCalvingDate = pregnancy.isEmpty() ? null : ((vn.edu.fpt.beefcare.domain.PregnancyEpisode) pregnancy.get(0)).getExpectedCalvingDate();
        String expectedBasis = pregnancy.isEmpty() ? null : ((vn.edu.fpt.beefcare.domain.PregnancyEpisode) pregnancy.get(0)).getExpectedBasis();
        if (pregnancy.isEmpty()) {
            List<vn.edu.fpt.beefcare.domain.ReproductionEvent> latest = em.createQuery(
                "select e from ReproductionEvent e where e.cattle.id=:id and upper(e.status)='VALID' order by e.eventTime desc,e.id desc",
                vn.edu.fpt.beefcare.domain.ReproductionEvent.class
            ).setParameter("id", cattleId).setMaxResults(1).getResultList();
            Instant lastCalvingAt = em.createQuery("select max(c.birthTime) from CalvingEvent c where c.dam.id=:id and upper(c.status)='VALID'",Instant.class)
                .setParameter("id",cattleId).getSingleResult();
            Instant lastLossAt = em.createQuery("select max(u.occurredTime) from PregnancyUpdate u where u.episode.cattle.id=:id and upper(u.status)='VALID' and upper(u.type)='LOSS'",Instant.class)
                .setParameter("id",cattleId).getSingleResult();
            if (!latest.isEmpty()) {
                var event = latest.get(0);
                var expectedSource = "BREEDING".equalsIgnoreCase(event.getType()) ? event
                    : "PREGNANCY_CHECK".equalsIgnoreCase(event.getType()) && "INCONCLUSIVE".equalsIgnoreCase(event.getResult())
                        && event.getLinkedEvent() != null && "BREEDING".equalsIgnoreCase(event.getLinkedEvent().getType())
                        ? event.getLinkedEvent() : null;
                boolean superseded = (lastCalvingAt != null && !event.getEventTime().isAfter(lastCalvingAt))
                    || (lastLossAt != null && !event.getEventTime().isAfter(lastLossAt));
                if (expectedSource != null && !superseded) {
                    expectedCalvingDate = expectedSource.getTentativeExpectedCalvingDate();
                    expectedBasis = expectedCalvingDate == null ? null : "TENTATIVE";
                }
            }
        }
        String reproductiveStatus = reproductiveStatus(cattle, pregnancy.isEmpty() ? null : (vn.edu.fpt.beefcare.domain.PregnancyEpisode) pregnancy.get(0), today);
        result.put("reproductiveStatus", reproductiveStatus);
        result.put("expectedCalvingDate", expectedCalvingDate);
        result.put("expectedBasis", expectedBasis);

        List<String> failures = new ArrayList<>();
        boolean applicable = reproductiveStatus != null && !"NOT_APPLICABLE".equals(reproductiveStatus);
        if (applicable && List.of("AWAITING_BREEDING", "IN_ESTRUS", "POST_CALVING").contains(reproductiveStatus)) {
            Map<String, Object> params = effectiveParameters(farmId, today);
            Integer minAge = integer(params, "MIN_BREEDING_AGE_MONTHS", "minimumBreedingAgeMonths", "minimum_breeding_age_months", "breedingMinimumAgeMonths");
            BigDecimal minWeight = decimal(params, "MIN_BREEDING_WEIGHT_KG", "minimumBreedingWeightKg", "minimum_breeding_weight_kg", "breedingMinimumWeightKg");
            if (minAge != null) {
                if (cattle.getBirthDate() == null || cattle.getBirthDate().plusMonths(minAge).isAfter(today)) failures.add("MINIMUM_AGE");
            }
            BigDecimal weight = em.createQuery("select g.weightKg from Growth g where g.cattle.id=:id and upper(g.status)='VALID' and g.weightKg is not null order by g.checkDate desc, g.id desc", BigDecimal.class)
                .setParameter("id", cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);
            if (minWeight != null && (weight == null || weight.compareTo(minWeight) < 0)) failures.add("MINIMUM_WEIGHT");
            if (validCases > 0 && em.createQuery("select count(h) from HealthCase h where h.cattle.id=:id and upper(h.status)='OPEN'", Long.class).setParameter("id", cattleId).getSingleResult() > 0) failures.add("OPEN_HEALTH_CASE");
            result.put("breedingEligible", failures.isEmpty());
        } else {
            result.put("breedingEligible", null);
        }
        result.put("failedBreedingConditions", failures);
        return result;
    }

    private String reproductiveStatus(Cattle cattle, vn.edu.fpt.beefcare.domain.PregnancyEpisode open, LocalDate today) {
        if (open != null) return "PREGNANT";
        if (cattle.getSex() == null || !"FEMALE".equalsIgnoreCase(cattle.getSex().name())) return "NOT_APPLICABLE";
        if (cattle.getLifeStage() == null || !("YOUNG_STOCK".equals(cattle.getLifeStage().name()) || "ADULT".equals(cattle.getLifeStage().name()))) return "NOT_APPLICABLE";
        if (cattle.getPurpose() == null || cattle.getPurpose().getPurposeType() == null || !("BREEDING".equals(cattle.getPurpose().getPurposeType().name()) || "UNDECIDED".equals(cattle.getPurpose().getPurposeType().name()))) return "NOT_APPLICABLE";
        List<?> events = em.createQuery("select e from ReproductionEvent e where e.cattle.id=:id and upper(e.status)='VALID' order by e.eventTime desc, e.id desc", vn.edu.fpt.beefcare.domain.ReproductionEvent.class)
            .setParameter("id", cattle.getId()).setMaxResults(1).getResultList();
        var event = events.isEmpty() ? null : (vn.edu.fpt.beefcare.domain.ReproductionEvent) events.get(0);
        var calving = em.createQuery("select c from CalvingEvent c where c.dam.id=:id and upper(c.status)='VALID' order by c.birthTime desc,c.id desc",vn.edu.fpt.beefcare.domain.CalvingEvent.class)
            .setParameter("id",cattle.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
        Instant lastLossAt = em.createQuery("select max(u.occurredTime) from PregnancyUpdate u where u.episode.cattle.id=:id and upper(u.status)='VALID' and upper(u.type)='LOSS'",Instant.class)
            .setParameter("id",cattle.getId()).getSingleResult();
        Instant eventAt=event==null?null:event.getEventTime();
        Instant calvingAt=calving==null?null:calving.getBirthTime();
        Instant last=latest(eventAt,calvingAt,lastLossAt);
        if(last==null)return "AWAITING_BREEDING";
        if(lastLossAt!=null&&last.equals(lastLossAt))return "AWAITING_BREEDING";
        if(calvingAt!=null&&last.equals(calvingAt)){
            int days=effectiveInt(cattle.getFarm().getId(),today,45,"POST_CALVING_DAYS","postpartumIntervalDays","postpartum_interval_days");
            return !calvingAt.isBefore(today.minusDays(days).atStartOfDay(farmZone(cattle)).toInstant())?"POST_CALVING":"AWAITING_BREEDING";
        }
        if(event!=null&&last.equals(eventAt)){
            String type=event.getType()==null?"":event.getType().toUpperCase();
            if("ESTRUS".equals(type)&&!eventAt.isBefore(clock.now().minusSeconds(86400)))return "IN_ESTRUS";
            if("BREEDING".equals(type))return "BRED";
            if("PREGNANCY_CHECK".equals(type)&&"INCONCLUSIVE".equalsIgnoreCase(event.getResult()))return "BRED";
        }
        return "AWAITING_BREEDING";
    }

    private Instant latest(Instant... values) {
        Instant result=null;
        for(Instant value:values)if(value!=null&&(result==null||value.isAfter(result)))result=value;
        return result;
    }

    private Map<String, Object> effectiveParameters(Long farmId, LocalDate date) {
        List<FarmParameterVersion> versions = em.createQuery("select p from FarmParameterVersion p where p.farm.id=:farm and p.effectiveFrom<=:date order by p.effectiveFrom desc,p.versionNo desc", FarmParameterVersion.class)
            .setParameter("farm", farmId).setParameter("date", date).setMaxResults(1).getResultList();
        if (versions.isEmpty()) return Map.of();
        try { return json.readValue(versions.get(0).getParameterValues(), new TypeReference<>() {}); }
        catch (Exception ignored) { return Map.of(); }
    }

    private int effectiveInt(Long farmId, LocalDate date, int fallback, String... keys) {
        Integer value = integer(effectiveParameters(farmId, date), keys);
        return value == null ? fallback : value;
    }
    private Integer integer(Map<String, Object> values, String... keys) {
        for (String key : keys) { Object value=values.get(key); if (value instanceof Number n) return n.intValue(); }
        return null;
    }
    private BigDecimal decimal(Map<String, Object> values, String... keys) {
        for (String key : keys) { Object value=values.get(key); if (value instanceof Number n) return new BigDecimal(n.toString()); }
        return null;
    }
    private ZoneId farmZone(Cattle cattle) {
        try { return ZoneId.of(cattle.getFarm().getTimeZone()); }
        catch (Exception ignored) { return clock.zone(); }
    }
}
