package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.service.dto.GrowthDtos;

/** FE-08 / GBR-38..40. Measurements, corrections and derived indicators always share the source records. */
@Service
public class GrowthAssessmentService {
    private final EntityManager em;private final FarmAccessService access;private final CattleGuardService guard;
    private final FarmClock clock;private final AuditService audit;private final RecordRevisionService revisions;private final OutboxService outbox;
    public GrowthAssessmentService(EntityManager em,FarmAccessService access,CattleGuardService guard,FarmClock clock,
        AuditService audit,RecordRevisionService revisions,OutboxService outbox) {
        this.em=em;this.access=access;this.guard=guard;this.clock=clock;this.audit=audit;this.revisions=revisions;this.outbox=outbox;
    }
    @Transactional public GrowthDtos.Record record(Long farmId,Long cattleId,GrowthDtos.Measurement request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_GROWTH);Cattle c=guard.lockWritable(farmId,cattleId);
        Growth g=new Growth();g.setCattle(c);g.setEntryTime(clock.now());g.setStatus("VALID");
        apply(ctx,g,request);em.persist(g);em.flush();
        audit.log(ctx,"GROWTH_RECORD","Growth",g.getId(),Map.of("cattleId",cattleId));
        outbox.enqueue(farmId,"GROWTH_RECORDED","Growth",g.getId(),Map.of("cattleId",cattleId));return dto(g);
    }
    @Transactional public GrowthDtos.Record correct(Long farmId,Long cattleId,Long id,GrowthDtos.Correction request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_GROWTH);Cattle c=guard.lockCattle(farmId,cattleId);guard.assertActive(c);
        Growth g=em.find(Growth.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(g==null || !cattleId.equals(g.getCattle().getId()))throw DomainException.notFound(MessageCodes.COM_08);
        VersionGuard.requireExpected(g.getVersion(),request.expectedVersion());
        GrowthDtos.Record before=dto(g);
        if("EXCLUDE".equals(request.action()))g.setStatus("EXCLUDED");
        else if("CORRECT".equals(request.action())){if(request.values()==null)throw DomainException.required("values");apply(ctx,g,request.values());g.setStatus("VALID");g.setCorrected(true);}
        else throw DomainException.invalid("action");
        g.setCorrectionReason(request.reason());
        revisions.record(ctx,"GROWTH_ASSESSMENT",id,request.action(),request.reason(),before,dto(g));
        audit.log(ctx,"GROWTH_CORRECT","Growth",id,Map.of("action",request.action()));
        outbox.enqueue(farmId,"GROWTH_CORRECTED","Growth",id,Map.of("cattleId",cattleId));em.flush();return dto(g);
    }
    @Transactional(readOnly=true) public GrowthDtos.Summary history(Long farmId,Long cattleId,int window) {
        access.require(farmId,FarmAction.VIEW_CATTLE);Cattle c=em.find(Cattle.class,cattleId);
        if(c==null || !farmId.equals(c.getFarm().getId()))throw DomainException.notFound(MessageCodes.COM_08);
        return summary(c,window);
    }
    public GrowthDtos.Summary summary(Cattle c,int window) {
        if(!Set.of(30,60,90,180).contains(window))throw DomainException.invalid("windowDays");
        LocalDate today=LocalDate.now(clockInstantClock(c));
        List<Growth> all=em.createQuery("select g from Growth g where g.cattle.id=:c order by g.checkDate,g.entryTime,g.id",Growth.class)
            .setParameter("c",c.getId()).getResultList();
        List<Growth> valid=all.stream().filter(this::valid).toList();
        Growth projectionWeight=valid.stream().filter(g->g.getWeightKg()!=null).reduce((a,b)->b).orElse(null);
        Growth weight=valid.stream().filter(g->g.getWeightKg()!=null && "MEASURED".equals(g.getWeightType())).reduce((a,b)->b)
            .orElseGet(()->valid.stream().filter(g->g.getWeightKg()!=null).reduce((a,b)->b).orElse(null));
        BigDecimal bcs=valid.stream().filter(g->g.getBcsScore()!=null).reduce((a,b)->b).map(Growth::getBcsScore).orElse(null);
        List<Growth> weights=valid.stream().filter(g->g.getWeightKg()!=null && !g.getCheckDate().isBefore(today.minusDays(window)) && !g.getCheckDate().isAfter(today)).toList();
        BigDecimal adg=adg(weights);LocalDate latestDate=valid.stream().filter(g->g.getWeightKg()!=null).map(Growth::getCheckDate).max(Comparator.naturalOrder()).orElse(entryDate(c.getId()));
        int interval=parameterNumber(c.getFarm(),"WEIGHING_INTERVAL_DAYS",30);LocalDate next=latestDate==null?null:latestDate.plusDays(interval);
        Object rawTarget=parameters(c.getFarm(),today).get("TARGET_FINISHING_WEIGHT_KG");
        BigDecimal target=rawTarget==null?null:new BigDecimal(rawTarget.toString());LocalDate projected=null;String status="NOT_APPLICABLE";
        if(c.getPurpose().getPurposeType()==vn.edu.fpt.beefcare.domain.enumeration.PurposeType.FATTENING&&target!=null){
            BigDecimal adg60=adg(valid.stream().filter(g->g.getWeightKg()!=null && !g.getCheckDate().isBefore(today.minusDays(60))).toList());
            status="INSUFFICIENT_WEIGHTS";
            if(projectionWeight!=null && target.signum()>0){if(projectionWeight.getWeightKg().compareTo(target)>=0)status="TARGET_REACHED";
                else if(adg60!=null && adg60.signum()>0){long days=target.subtract(projectionWeight.getWeightKg()).divide(adg60,0,RoundingMode.CEILING).longValue();projected=projectionWeight.getCheckDate().plusDays(days);status="PROJECTED";}}
        }
        List<GrowthDtos.Record> records=new ArrayList<>(all.stream().map(this::dto).toList());Collections.reverse(records);
        return new GrowthDtos.Summary(weight==null?null:dto(weight),bcs,adg,window,next,projected,status,all.size(),records);
    }
    public int parameterNumber(Farm farm,String key,int fallback) {
        Object value=parameters(farm,LocalDate.now(clockInstantClock(farm))).get(key);
        try{return value==null?fallback:new BigDecimal(value.toString()).intValueExact();}catch(NumberFormatException|ArithmeticException ex){return fallback;}
    }
    private Map<String,Object> parameters(Farm farm,LocalDate date) {
        List<FarmParameterVersion> rows=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:f and p.effectiveFrom<=:d order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class)
            .setParameter("f",farm.getId()).setParameter("d",date).setMaxResults(1).getResultList();
        return rows.isEmpty()?StarterCatalogueService.defaultParameters():JsonSupport.fromJson(rows.get(0).getParameterValues(),Map.class);
    }
    public static BigDecimal adg(List<Growth> ordered) {
        if(ordered.size()<2)return null;Growth first=ordered.get(0),last=ordered.get(ordered.size()-1);
        long days=ChronoUnit.DAYS.between(first.getCheckDate(),last.getCheckDate());
        return days<14?null:last.getWeightKg().subtract(first.getWeightKg()).divide(BigDecimal.valueOf(days),3,RoundingMode.HALF_UP);
    }
    public static BigDecimal tapeWeight(BigDecimal girth,BigDecimal length) {
        return new BigDecimal("88.4").multiply(girth.movePointLeft(2).pow(2)).multiply(length.movePointLeft(2)).setScale(1,RoundingMode.HALF_UP);
    }
    private void apply(FarmContext ctx,Growth g,GrowthDtos.Measurement r) {
        if(r==null || r.measuredAt()==null)throw DomainException.required("measuredAt");clock.assertNotFuture(r.measuredAt());
        LocalDate date=r.measuredAt().atZone(ZoneId.of(ctx.farm().getTimeZone())).toLocalDate();LocalDate entry=entryDate(g.getCattle().getId());
        if(entry!=null && date.isBefore(entry))throw DomainException.unprocessable(MessageCodes.COM_15,"date",entry);
        BigDecimal weight=r.weightKg();if(weight!=null&&r.method()==null)throw DomainException.required("method");String method=r.method()==null?"OTHER":r.method();
        if(!Set.of("SCALE","TAPE","OTHER").contains(method))throw DomainException.invalid("method");
        if("TAPE".equals(method)){
            range(r.heartGirthCm(),50,300,"heartGirthCm");range(r.bodyLengthCm(),30,250,"bodyLengthCm");
            if(weight==null)weight=tapeWeight(r.heartGirthCm(),r.bodyLengthCm());
        }else if(r.heartGirthCm()!=null || r.bodyLengthCm()!=null)throw DomainException.invalid("tapeDimensions");
        if(weight==null && r.bcs()==null)throw DomainException.unprocessable("MSG-FE08-02");
        if(weight!=null){range(weight,1,1500,"weightKg");if(weight.stripTrailingZeros().scale()>1)throw DomainException.invalid("weightKg");}
        if(r.bcs()!=null){
            List<FarmParameterVersion> versions=em.createQuery("select p from FarmParameterVersion p where p.farm.id=:f and p.effectiveFrom<=:d order by p.effectiveFrom desc,p.versionNo desc",FarmParameterVersion.class).setParameter("f",ctx.farmId()).setParameter("d",date).setMaxResults(1).getResultList();
            String scale=versions.isEmpty()?"1-5:0.5":Objects.toString(JsonSupport.fromJson(versions.get(0).getParameterValues(),Map.class).get("BCS_SCALE"),"1-5:0.5");
            boolean nine=scale.startsWith("1-9");range(r.bcs(),1,nine?9:5,"bcs");
            if(r.bcs().multiply(BigDecimal.valueOf(nine?1:2)).stripTrailingZeros().scale()>0)throw DomainException.invalid("bcs");
        }
        if(weight!=null&&!r.acknowledgedLargeChange()){
            List<Growth> recent=em.createQuery("select g from Growth g where g.cattle.id=:c and g.id<>:id and g.status in ('VALID','CORRECTED') and g.weightKg is not null and g.checkDate between :start and :end order by g.checkDate desc,g.id desc",Growth.class)
                .setParameter("c",g.getCattle().getId()).setParameter("id",g.getId()==null?-1L:g.getId()).setParameter("start",date.minusDays(30)).setParameter("end",date).setMaxResults(1).getResultList();
            if(!recent.isEmpty()){Growth last=recent.get(0);if(weight.subtract(last.getWeightKg()).abs().compareTo(last.getWeightKg().multiply(new BigDecimal("0.2")))>0)
                throw DomainException.unprocessable("MSG-FE08-04","new",weight,"last",last.getWeightKg(),"date",last.getCheckDate());}
        }
        AppUser measured=ctx.user();if(r.measuredBy()!=null){
            List<FarmMembership> members=em.createQuery("select m from FarmMembership m where m.farm.id=:f and m.user.id=:u and m.status='ACTIVE'",FarmMembership.class)
                .setParameter("f",ctx.farmId()).setParameter("u",r.measuredBy()).getResultList();
            if(members.isEmpty())throw DomainException.invalid("measuredBy");measured=members.get(0).getUser();
        }
        g.setObservedAt(r.measuredAt());g.setCheckDate(date);g.setWeightKg(weight);g.setWeightType(weight==null?null:("SCALE".equals(method)?"MEASURED":"ESTIMATED"));
        g.setMethod(method);g.setHeartGirthCm(r.heartGirthCm());g.setBodyLengthCm(r.bodyLengthCm());g.setBcs(null);g.setBcsScore(r.bcs());g.setMeasuredBy(measured);g.setNote(r.note());
    }
    private void range(BigDecimal n,int min,int max,String field){if(n==null || n.compareTo(BigDecimal.valueOf(min))<0 || n.compareTo(BigDecimal.valueOf(max))>0)throw DomainException.invalid(field);}
    private LocalDate entryDate(Long cattleId){return em.createQuery("select h.entryDate from HerdEntry h where h.cattle.id=:c order by h.id",LocalDate.class).setParameter("c",cattleId).setMaxResults(1).getResultStream().findFirst().orElse(null);}
    private boolean valid(Growth g){return Set.of("VALID","CORRECTED").contains(g.getStatus());}
    private Clock clockInstantClock(Cattle c){return clockInstantClock(c.getFarm());}
    private Clock clockInstantClock(Farm f){return Clock.fixed(clock.now(),ZoneId.of(f.getTimeZone()));}
    private GrowthDtos.Record dto(Growth g){return new GrowthDtos.Record(g.getId(),g.getCattle().getId(),g.getObservedAt()==null?g.getCheckDate().atStartOfDay(ZoneId.of(g.getCattle().getFarm().getTimeZone())).toInstant():g.getObservedAt(),g.getEntryTime(),g.getMeasuredBy()==null?null:g.getMeasuredBy().getId(),g.getMeasuredBy()==null?null:g.getMeasuredBy().getFullName(),g.getMethod(),g.getWeightKg(),g.getWeightType(),g.getHeartGirthCm(),g.getBodyLengthCm(),g.getBcsScore(),g.getNote(),g.getStatus(),g.isCorrected(),g.getVersion());}
}
