package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.*;

/** FE18: each catalogue is farm-owned; deactivation only affects later selection. */
@Service
@Transactional
public class HerdCatalogueCommandService {
    private final EntityManager em;
    private final FarmAccessService access;
    private final AuditService audit;
    private final FarmClock clock;
    public HerdCatalogueCommandService(EntityManager em,FarmAccessService access,AuditService audit,FarmClock clock) { this.em=em;this.access=access;this.audit=audit;this.clock=clock; }
    @Transactional(readOnly=true)
    public List<BreedView> breeds(Long farmId,String q,String status) {
        access.require(farmId,FarmAction.VIEW_CATALOGUES); validateStatus(status);
        return em.createQuery("select b from Breed b where b.farm.id=:f order by b.code",Breed.class).setParameter("f",farmId).getResultList()
            .stream().filter(b->matches(q,status,b.getCode(),b.getName(),b.getAvailable())).map(b->breedView(b,List.of())).toList();
    }
    @Transactional(readOnly=true)
    public List<PurposeView> purposes(Long farmId,String q,String status) {
        access.require(farmId,FarmAction.VIEW_CARE_CATALOGUES); validateStatus(status);
        return em.createQuery("select p from ProductionPurpose p where p.farm.id=:f order by p.code",ProductionPurpose.class).setParameter("f",farmId).getResultList()
            .stream().filter(p->matches(q,status,p.getCode(),p.getName(),p.getAvailable())).map(p->purposeView(p,List.of())).toList();
    }
    public BreedView saveBreed(Long farmId,Long id,BreedWrite r) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_CATALOGUES); em.lock(ctx.farm(),LockModeType.PESSIMISTIC_WRITE);
        Breed b=id==null?new Breed():em.find(Breed.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(b==null||id!=null&&!farmId.equals(b.getFarm().getId()))throw DomainException.notFound(MessageCodes.COM_08);
        if(id!=null)VersionGuard.requireExpected(b.getVersion(),r.expectedVersion());
        boolean referenced=id!=null&&breedReferenced(id);String code=code(r.code());
        if(referenced&&!code.equals(b.getCode()))throw DomainException.unprocessable("MSG-FE18-04","field","code");
        unique("Breed",farmId,id,code); b.setFarm(ctx.farm()); b.setCode(code); b.setName(required(r.name(),100,"name"));
        b.setBreedGroup(optional(r.group(),50,"group")); b.setDescription(optional(r.description(),500,"description")); b.setAvailable(r.available());
        if(id==null)em.persist(b); em.flush();
        audit.log(ctx,id==null?"BREED_CREATE":"BREED_UPDATE","Breed",b.getId(),Map.of("code",code,"available",b.getAvailable()));
        return breedView(b,referenced&&!r.available()?List.of("MSG-FE18-03"):List.of());
    }
    public PurposeView savePurpose(Long farmId,Long id,PurposeWrite r) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_CATALOGUES);em.lock(ctx.farm(),LockModeType.PESSIMISTIC_WRITE);
        ProductionPurpose p=id==null?new ProductionPurpose():em.find(ProductionPurpose.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(p==null||id!=null&&!farmId.equals(p.getFarm().getId()))throw DomainException.notFound(MessageCodes.COM_08);
        if(id!=null)VersionGuard.requireExpected(p.getVersion(),r.expectedVersion());
        boolean referenced=id!=null&&purposeReferenced(p);String code=code(r.code());
        if(referenced&&!code.equals(p.getCode()))throw DomainException.unprocessable("MSG-FE18-04","field","code");
        if(referenced&&r.purposeType()!=p.getPurposeType())throw DomainException.unprocessable("MSG-FE18-09");
        if(r.purposeType()==null)throw DomainException.required("purposeType");
        unique("ProductionPurpose",farmId,id,code);p.setFarm(ctx.farm());p.setCode(code);p.setName(required(r.name(),100,"name"));
        p.setPurposeType(r.purposeType());p.setDescription(optional(r.description(),500,"description"));p.setAvailable(r.available());
        if(id==null)em.persist(p);em.flush();
        audit.log(ctx,id==null?"PURPOSE_CREATE":"PURPOSE_UPDATE","ProductionPurpose",p.getId(),Map.of("code",code,"purposeType",p.getPurposeType(),"available",p.getAvailable()));
        return purposeView(p,referenced&&!r.available()?List.of("MSG-FE18-03"):List.of());
    }
    private BreedView breedView(Breed b,List<String> messages) {
        return new BreedView(b.getId(),b.getCode(),b.getName(),b.getBreedGroup(),b.getDescription(),b.getAvailable(),activeCattle("breed",b.getId()),breedReferenced(b.getId()),b.getVersion(),messages);
    }
    private PurposeView purposeView(ProductionPurpose p,List<String> messages) {
        List<ReceivingPen> pens=em.createQuery("select c from PenCriteriaVersion c join fetch c.pen where c.farm.id=:f and c.effectiveFrom<=:d order by c.effectiveFrom desc,c.versionNo desc",PenCriteriaVersion.class)
            .setParameter("f",p.getFarm().getId()).setParameter("d",java.time.LocalDate.ofInstant(clock.now(),java.time.ZoneId.of(p.getFarm().getTimeZone()))).getResultList().stream().collect(java.util.stream.Collectors.toMap(c->c.getPen().getId(),c->c,(a,b)->a))
            .values().stream().filter(c->c.getPurposeTypes()!=null&&c.getPurposeTypes().contains(p.getPurposeType())).map(c->new ReceivingPen(c.getPen().getId(),c.getPen().getCode(),c.getPen().getName()))
            .sorted(java.util.Comparator.comparing(ReceivingPen::code)).toList();
        return new PurposeView(p.getId(),p.getCode(),p.getName(),p.getPurposeType(),p.getDescription(),p.getAvailable(),activeCattle("purpose",p.getId()),purposeReferenced(p),pens,p.getVersion(),messages);
    }
    private long activeCattle(String field,Long id) { return em.createQuery("select count(c) from Cattle c where c."+field+".id=:id and c.herdStatus=:s",Long.class).setParameter("id",id).setParameter("s",HerdStatus.ACTIVE).getSingleResult(); }
    private boolean breedReferenced(Long id) {
        return count("select count(c) from Cattle c where c.breed.id=:id",id)>0||count("select count(c) from CalfOutcome c where c.breed.id=:id",id)>0||count("select count(r) from ReproductionEvent r where r.sireBreed.id=:id",id)>0||
            count("select count(f) from Farm f join f.mainBreeds b where b.id=:id",id)>0;
    }
    private boolean purposeReferenced(ProductionPurpose p) {
        return count("select count(c) from Cattle c where c.purpose.id=:id",p.getId())>0||count("select count(c) from CalfOutcome c where c.proposedPurpose.id=:id",p.getId())>0||
            em.createQuery("select c from PenCriteriaVersion c where c.farm.id=:f",PenCriteriaVersion.class)
                .setParameter("f",p.getFarm().getId()).getResultList().stream().anyMatch(c->c.getPurposeTypes()!=null&&c.getPurposeTypes().contains(p.getPurposeType()));
    }
    private long count(String jpql,Long id){return em.createQuery(jpql,Long.class).setParameter("id",id).getSingleResult();}
    private void unique(String entity,Long farmId,Long id,String code) {
        if(em.createQuery("select count(x) from "+entity+" x where x.farm.id=:f and upper(x.code)=:c and x.id<>:id",Long.class)
            .setParameter("f",farmId).setParameter("c",code).setParameter("id",id==null?-1L:id).getSingleResult()>0)throw DomainException.unprocessable("MSG-FE18-02","code",code);
    }
    private String code(String value){String code=required(value,20,"code");if(!code.matches("[A-Z0-9-]{2,20}"))throw DomainException.invalid("code");return code;}
    private String required(String value,int max,String field){return SupportTicketCommandService.text(value,max,field);}
    private String optional(String value,int max,String field){return SupportTicketCommandService.optionalText(value,max,field);}
    private void validateStatus(String status){if(status!=null&&!List.of("ALL","ACTIVE","INACTIVE").contains(status))throw DomainException.invalid("status");}
    private boolean matches(String q,String status,String code,String name,Boolean active){return (status==null||"ALL".equals(status)||active=="ACTIVE".equals(status))&&(q==null||(code+" "+name).toLowerCase(Locale.ROOT).contains(q.trim().toLowerCase(Locale.ROOT)));}
}
