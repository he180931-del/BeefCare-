package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.repository.CattleQrTagRepository;
import vn.edu.fpt.beefcare.service.dto.CattleDtos;

/** FE-05 identity is permanent; only explicit supported profile changes and QR lifecycle commands are exposed. */
@Service
public class CattleProfileService {
    private final EntityManager em;private final FarmAccessService access;private final CattleGuardService guard;private final FarmClock clock;
    private final PenAssignmentService assignments;private final GrowthAssessmentService growth;private final CattleStateService state;
    private final AuditService audit;private final CodeSequenceService codes;private final CattleQrTagRepository tags;private final OutboxService outbox;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper;
    public CattleProfileService(EntityManager em,FarmAccessService access,CattleGuardService guard,FarmClock clock,PenAssignmentService assignments,
        GrowthAssessmentService growth,CattleStateService state,AuditService audit,CodeSequenceService codes,CattleQrTagRepository tags,OutboxService outbox,com.fasterxml.jackson.databind.ObjectMapper mapper){
        this.em=em;this.access=access;this.guard=guard;this.clock=clock;this.assignments=assignments;this.growth=growth;this.state=state;this.audit=audit;this.codes=codes;this.tags=tags;this.outbox=outbox;this.mapper=mapper;
    }
    @Transactional(readOnly=true) public CattleDtos.Page list(Long farmId,String q,String herdStatus,Long breedId,Sex sex,Long penId,Long purposeId,LifeStage lifeStage,String health,String herdGroup,int page,int size,String sort) {
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_CATTLE);
        if(page<0 || page>100000 || size<1 || size>200)throw DomainException.invalid("page");
        if(herdStatus!=null&&!Set.of("ACTIVE","EXITED","VOIDED","EXIT_PENDING","ALL").contains(herdStatus))throw DomainException.invalid("herdStatus");
        List<Cattle> cattle=em.createQuery("select c from Cattle c join fetch c.breed join fetch c.purpose where c.farm.id=:farm order by c.displayCode",Cattle.class).setParameter("farm",farmId).getResultList();
        Map<String,Long> counts=new LinkedHashMap<>();counts.put("ACTIVE",0L);counts.put("EXITED",0L);counts.put("VOIDED",0L);
        for(String group:List.of("CALVES","FATTENING","BREEDING_BULLS","BREEDING_FEMALES","YOUNG_STOCK","OTHER"))counts.put(group,0L);
        List<Map<String,Object>> rows=new ArrayList<>();
        for(Cattle c:cattle){counts.merge(c.getHerdStatus().name(),1L,Long::sum);if(c.getHerdStatus()==HerdStatus.ACTIVE)counts.merge(herdGroup(c),1L,Long::sum);
            if(q!=null && !q.isBlank() && !(c.getDisplayCode()+" "+Objects.toString(c.getEarTagNumber(),"")+" "+Objects.toString(c.getName(),"")).toLowerCase(Locale.ROOT).contains(q.toLowerCase(Locale.ROOT)))continue;
            if(breedId!=null&&!breedId.equals(c.getBreed().getId()) || sex!=null&&sex!=c.getSex() || purposeId!=null&&!purposeId.equals(c.getPurpose().getId()) || lifeStage!=null&&lifeStage!=c.getLifeStage())continue;
            Map<String,Object> row=projection(c,ctx,false);
            String wanted=herdStatus==null?"ACTIVE":herdStatus;
            if("EXIT_PENDING".equals(wanted)){if(!Boolean.TRUE.equals(row.get("exitPending")))continue;}
            else if(!"ALL".equals(wanted)&&!wanted.equals(c.getHerdStatus().name()))continue;
            if(penId!=null&&!penId.equals(row.get("penId")))continue;
            if(herdGroup!=null&&!herdGroup.equals(row.get("herdGroup")))continue;
            if(health!=null&&!health.isBlank()){
                if("MEAT_WITHDRAWAL".equals(health)){if(!Boolean.TRUE.equals(row.get("withdrawalActive")))continue;}
                else if(!health.equals(row.get("healthState")))continue;
            }
            rows.add(row);
        }
        Set<String> sortable=Set.of("displayCode","name","latestWeightKg","birthDate");String key=sort==null?"displayCode":sort.replaceFirst("^-","");
        if(!sortable.contains(key))throw DomainException.invalid("sort");
        Comparator<Map<String,Object>> comparator=(a,b)->compare(a.get(key),b.get(key));if(sort!=null&&sort.startsWith("-"))comparator=comparator.reversed();rows.sort(comparator);
        int from=Math.min(rows.size(),Math.multiplyExact(page,size)),to=Math.min(rows.size(),from+size);
        return new CattleDtos.Page(rows.subList(from,to).stream().map(this::dto).toList(),rows.size(),page,size,counts);
    }
    @SuppressWarnings({"unchecked","rawtypes"}) private int compare(Object a,Object b){if(a==null)return b==null?0:1;if(b==null)return -1;return ((Comparable)a).compareTo(b);}
    @Transactional(readOnly=true) public CattleDtos.Profile get(Long farmId,Long cattleId){FarmContext ctx=access.require(farmId,FarmAction.VIEW_CATTLE);return dto(projection(find(farmId,cattleId),ctx,true));}
    @Transactional public CattleDtos.Profile update(Long farmId,Long cattleId,CattleDtos.ProfileUpdate request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_CATTLE);Cattle c=guard.lockWritable(farmId,cattleId);VersionGuard.requireExpected(c.getVersion(),request.expectedVersion());
        clock.assertNotFuture(request.effectiveDate());LocalDate entry=entry(cattleId).map(HerdEntry::getEntryDate).orElse(null);
        if(entry!=null&&request.effectiveDate().isBefore(entry))throw DomainException.unprocessable(MessageCodes.COM_15,"date",entry);
        ProductionPurpose purpose=c.getPurpose();if(request.productionPurposeId()!=null&&!request.productionPurposeId().equals(purpose.getId())){
            if(!ctx.isOwner())throw DomainException.forbidden("MSG-FE05-03");purpose=em.find(ProductionPurpose.class,request.productionPurposeId());
            if(purpose==null||!farmId.equals(purpose.getFarm().getId())||!Boolean.TRUE.equals(purpose.getAvailable()))throw DomainException.invalid("productionPurposeId");
            if(purpose.getPurposeType()==PurposeType.SIRE&&c.getSex()!=Sex.MALE || purpose.getPurposeType()==PurposeType.BREEDING&&c.getSex()!=Sex.FEMALE)throw DomainException.unprocessable("MSG-FE05-12","purpose",purpose.getName(),"purpose_type",purpose.getPurposeType(),"sex",c.getSex());
        }
        LifeStage stage=request.lifeStage()==null?c.getLifeStage():request.lifeStage();
        boolean wasApplicable=c.getSex()==Sex.FEMALE&&(c.getLifeStage()==LifeStage.YOUNG_STOCK||c.getLifeStage()==LifeStage.ADULT)&&Set.of(PurposeType.BREEDING,PurposeType.UNDECIDED).contains(c.getPurpose().getPurposeType());
        boolean ends=wasApplicable&&(stage==LifeStage.UNWEANED_CALF||stage==LifeStage.WEANED_CALF||!Set.of(PurposeType.BREEDING,PurposeType.UNDECIDED).contains(purpose.getPurposeType()));
        long pregnancies=em.createQuery("select count(p) from PregnancyEpisode p where p.cattle.id=:c and p.status='OPEN'",Long.class).setParameter("c",cattleId).getSingleResult();
        if(ends&&pregnancies==0&&!request.acknowledgedReproductionChange()&&(stage!=c.getLifeStage()||purpose!=c.getPurpose()))throw DomainException.unprocessable("MSG-FE05-11","cattle_code",c.getDisplayCode());
        String tag=clean(request.earTagNumber());if(tag!=null&&!tag.equalsIgnoreCase(Objects.toString(c.getEarTagNumber(),""))){
            long count=em.createQuery("select count(c) from Cattle c where c.farm.id=:f and lower(c.earTagNumber)=:tag and c.herdStatus=vn.edu.fpt.beefcare.domain.enumeration.HerdStatus.ACTIVE and c.id<>:id",Long.class).setParameter("f",farmId).setParameter("tag",tag.toLowerCase(Locale.ROOT)).setParameter("id",cattleId).getSingleResult();
            if(count>0)throw DomainException.unprocessable("MSG-FE05-02","ear_tag",tag);
        }
        if(purpose!=c.getPurpose()){history(ctx,c,ProfileFieldGroup.PURPOSE,c.getPurpose().getId().toString(),purpose.getId().toString(),request);c.setPurpose(purpose);}
        if(stage!=c.getLifeStage()){history(ctx,c,ProfileFieldGroup.LIFE_STAGE,c.getLifeStage().name(),stage.name(),request);c.setLifeStage(stage);}
        if(!Objects.equals(tag,c.getEarTagNumber()))history(ctx,c,ProfileFieldGroup.EAR_TAG,c.getEarTagNumber(),Objects.toString(tag,""),request);
        Map<String,Object> before=description(c);c.setEarTagNumber(tag);c.setName(clean(request.name()));c.setColourMarkings(clean(request.colourMarkings()));c.setNotes(clean(request.notes()));
        if(!before.equals(description(c)))history(ctx,c,ProfileFieldGroup.DESCRIPTIVE,JsonSupport.toJson(before),JsonSupport.toJson(description(c)),request);
        touch(c);audit.log(ctx,"CATTLE_PROFILE_UPDATE","Cattle",cattleId,Map.of("fields","profile"));
        outbox.enqueue(farmId,"CATTLE_PROFILE_UPDATED","Cattle",cattleId,Map.of("cattleId",cattleId));em.flush();return dto(projection(c,ctx,true));
    }
    @Transactional(readOnly=true) public List<CattleDtos.Tag> tags(Long farmId,Long cattleId){access.require(farmId,FarmAction.VIEW_CATTLE);find(farmId,cattleId);return em.createQuery("select t from CattleQrTag t where t.cattle.id=:c order by t.issuedAt desc,t.id desc",CattleQrTag.class).setParameter("c",cattleId).getResultList().stream().map(this::tagDto).toList();}
    @Transactional public CattleDtos.Tag issueTag(Long farmId,Long cattleId,CattleDtos.TagRequest request){
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_CATTLE);Cattle c=guard.lockWritable(farmId,cattleId);VersionGuard.requireExpected(c.getVersion(),request.cattleVersion());
        CattleQrTag old=tags.findFirstByCattleIdAndStatus(cattleId,QrTagStatus.ACTIVE).orElse(null);if(old!=null&&request.reason()==null)throw DomainException.required("reason");
        String code=clean(request.tagCode());if(code==null)code=codes.nextQrTagCode(farmId);if(tags.existsByTagCode(code))throw DomainException.unprocessable("MSG-FE12-08");
        CattleQrTag tag=new CattleQrTag();tag.setFarm(ctx.farm());tag.setCattle(c);tag.setTagCode(code);tag.setStatus(QrTagStatus.ACTIVE);tag.setIssuedAt(clock.now());tag.setIssuedBy(ctx.user());tag.setNote(request.note());
        if(old!=null){old.setStatus(QrTagStatus.REPLACED);old.setClosedAt(clock.now());old.setReplacementReason(request.reason());em.flush();}
        em.persist(tag);if(old!=null)old.setReplacedByTag(tag);touch(c);
        audit.log(ctx,"CATTLE_QR_ISSUE","Cattle",cattleId,Map.of("tagCode",code));outbox.enqueue(farmId,"CATTLE_QR_ISSUED","Cattle",cattleId,Map.of("cattleId",cattleId));em.flush();return tagDto(tag);
    }
    @Transactional(readOnly=true) public CattleDtos.Resolved resolve(Long farmId,String input){
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_CATTLE);if(input==null||input.isBlank()||input.length()>500)throw DomainException.invalid("code");String code=input.trim();
        if(code.contains("/tags/"))code=code.substring(code.lastIndexOf("/tags/")+6);if(code.contains("?")||code.contains("#"))throw DomainException.notFound("MSG-FE05-09");
        CattleQrTag tag=tags.findByTagCode(code).orElse(null);
        if(tag!=null){Long targetFarm=tag.getFarm().getId();if(!farmId.equals(targetFarm)){
            try{access.require(targetFarm,FarmAction.VIEW_CATTLE);}catch(DomainException error){throw DomainException.notFound("MSG-FE05-09");}
            return new CattleDtos.Resolved(targetFarm,null,true,tag.getStatus()==QrTagStatus.REPLACED,null,"MSG-FE05-06");
        }return new CattleDtos.Resolved(farmId,tag.getCattle().getId(),false,tag.getStatus()==QrTagStatus.REPLACED,dto(projection(tag.getCattle(),ctx,false)),tag.getStatus()==QrTagStatus.REPLACED?"MSG-FE05-05":null);}
        List<Cattle> rows=em.createQuery("select c from Cattle c where c.farm.id=:f and (lower(c.displayCode)=:code or lower(c.earTagNumber)=:code)",Cattle.class).setParameter("f",farmId).setParameter("code",code.toLowerCase(Locale.ROOT)).getResultList();
        if(!rows.isEmpty()){Cattle c=rows.get(0);return new CattleDtos.Resolved(farmId,c.getId(),false,false,dto(projection(c,ctx,false)),null);}
        Long draft=em.createQuery("select count(o) from CalfOutcome o where o.calving.dam.farm.id=:f and o.tagCode=:code and o.registrationState='PENDING_CONFIRMATION'",Long.class).setParameter("f",farmId).setParameter("code",code).getSingleResult();
        throw DomainException.notFound(draft>0?"MSG-FE05-10":"MSG-FE05-09");
    }
    public String herdGroup(Cattle c){if(c.getLifeStage()==LifeStage.UNWEANED_CALF||c.getLifeStage()==LifeStage.WEANED_CALF)return "CALVES";if(c.getPurpose().getPurposeType()==PurposeType.FATTENING)return "FATTENING";if(c.getSex()==Sex.MALE&&c.getPurpose().getPurposeType()==PurposeType.SIRE)return "BREEDING_BULLS";if(c.getSex()==Sex.FEMALE&&c.getLifeStage()==LifeStage.ADULT&&c.getPurpose().getPurposeType()==PurposeType.BREEDING)return "BREEDING_FEMALES";if(c.getLifeStage()==LifeStage.YOUNG_STOCK)return "YOUNG_STOCK";return "OTHER";}
    private Cattle find(Long farmId,Long id){Cattle c=em.find(Cattle.class,id);if(c==null||!farmId.equals(c.getFarm().getId()))throw DomainException.notFound(MessageCodes.COM_08);return c;}
    private CattleDtos.Profile dto(Map<String,Object> projection){return mapper.convertValue(projection,CattleDtos.Profile.class);}
    private void touch(Cattle c){Instant now=clock.now();c.setUpdatedAt(c.getUpdatedAt()!=null&&!now.isAfter(c.getUpdatedAt())?c.getUpdatedAt().plusNanos(1000):now);}
    private Map<String,Object> projection(Cattle c,FarmContext ctx,boolean detail){
        Map<String,Object> p=new LinkedHashMap<>();p.put("id",c.getId());p.put("displayCode",c.getDisplayCode());p.put("earTagNumber",c.getEarTagNumber());p.put("name",c.getName());p.put("sex",c.getSex());p.put("birthDate",c.getBirthDate());p.put("birthDateAccuracy",c.getBirthDateAccuracy());p.put("breedId",c.getBreed().getId());p.put("breedName",c.getBreed().getName());p.put("purposeId",c.getPurpose().getId());p.put("purposeName",c.getPurpose().getName());p.put("purposeType",c.getPurpose().getPurposeType());p.put("lifeStage",c.getLifeStage());p.put("herdStatus",c.getHerdStatus());p.put("exitType",c.getExitType());p.put("exitDate",c.getExitDate());p.put("herdGroup",herdGroup(c));p.put("version",c.getVersion());p.put("photoUrl",c.getPhotoAttachment()==null?c.getPhotoUrl():"/api/farms/"+ctx.farmId()+"/attachments/"+c.getPhotoAttachment().getId());
        assignments.findOpen(c.getId()).ifPresent(a->{p.put("penId",a.getPen().getId());p.put("penCode",a.getPen().getCode());p.put("penName",a.getPen().getName());p.put("penSince",a.getFromDate());});
        boolean pending=guard.isExitPending(c.getId());p.put("exitPending",ctx.role()!=FarmRole.TECHNICIAN&&pending);
        GrowthDtosProjection(p,growth.summary(c,90));if(c.getHerdStatus()==HerdStatus.ACTIVE)p.putAll(state.state(c));
        Object withdrawal=p.get("withdrawalEndDate");p.put("withdrawalActive",withdrawal instanceof LocalDate date&&!date.isBefore(LocalDate.ofInstant(clock.now(),ZoneId.of(c.getFarm().getTimeZone()))));
        if(detail){p.put("colourMarkings",c.getColourMarkings());p.put("notes",c.getNotes());p.put("damId",c.getDam()==null?null:c.getDam().getId());p.put("sireId",c.getSire()==null?null:c.getSire().getId());p.put("externalSireCode",c.getExternalSireCode());p.put("canUpdate",c.getHerdStatus()==HerdStatus.ACTIVE&&!pending&&ctx.role()!=FarmRole.TECHNICIAN);p.put("canChangePurpose",ctx.isOwner());
            entry(c.getId()).ifPresent(e->{Map<String,Object> entry=new LinkedHashMap<>();entry.put("source",e.getSource());entry.put("entryDate",e.getEntryDate());entry.put("weightKg",e.getEntryWeightKg());entry.put("weightBasis",e.getWeightBasis());
                if(ctx.role()!=FarmRole.TECHNICIAN){entry.put("id",e.getId());entry.put("voucherId",e.getVoucher().getId());entry.put("voucherCode",e.getVoucher().getCode());entry.put("seller",e.getVoucher().getSeller()==null?null:e.getVoucher().getSeller().getName());}
                p.put("entry",entry);p.put("quarantineUntil",e.getQuarantineUntil());});}
        return p;
    }
    private void GrowthDtosProjection(Map<String,Object> p,vn.edu.fpt.beefcare.service.dto.GrowthDtos.Summary growth){p.put("latestWeightKg",growth.currentWeight()==null?null:growth.currentWeight().weightKg());p.put("weightBasis",growth.currentWeight()==null?null:growth.currentWeight().basis());p.put("latestBcs",growth.latestBcs());p.put("adg90",growth.adg());}
    private Optional<HerdEntry> entry(Long id){return em.createQuery("select h from HerdEntry h where h.cattle.id=:c order by h.id",HerdEntry.class).setParameter("c",id).setMaxResults(1).getResultStream().findFirst();}
    private Map<String,Object> description(Cattle c){Map<String,Object> m=new LinkedHashMap<>();m.put("name",c.getName());m.put("colourMarkings",c.getColourMarkings());m.put("notes",c.getNotes());return m;}
    private void history(FarmContext ctx,Cattle c,ProfileFieldGroup group,String old,String value,CattleDtos.ProfileUpdate r){CattleProfileChange h=new CattleProfileChange();h.setFarm(ctx.farm());h.setCattle(c);h.setFieldGroup(group);h.setOldValue(old);h.setNewValue(value);h.setEffectiveDate(r.effectiveDate());h.setReason(r.reason());h.setChangedBy(ctx.user());h.setChangedAt(clock.now());em.persist(h);}
    private CattleDtos.Tag tagDto(CattleQrTag t){return new CattleDtos.Tag(t.getId(),t.getTagCode(),t.getStatus().name(),t.getCattle().getDisplayCode(),"/tags/"+t.getTagCode(),t.getIssuedAt(),t.getClosedAt(),t.getReplacementReason()==null?null:t.getReplacementReason().name(),t.getVersion());}
    private String clean(String text){return text==null||text.isBlank()?null:text.trim();}
}
