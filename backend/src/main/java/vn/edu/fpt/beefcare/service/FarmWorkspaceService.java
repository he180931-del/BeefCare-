package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.time.ZoneId;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.repository.FarmRepository;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.*;

/** Small, complete workspace slice used by every feature team. */
@Service
public class FarmWorkspaceService {
    private final EntityManager em;
    private final FarmAccessService access;
    private final FarmRepository farms;
    private final StarterCatalogueService starters;
    private final AuditService audit;
    private final OutboxService outbox;
    public FarmWorkspaceService(EntityManager em,FarmAccessService access,FarmRepository farms,
        StarterCatalogueService starters,AuditService audit,OutboxService outbox) {
        this.em=em;this.access=access;this.farms=farms;this.starters=starters;this.audit=audit;this.outbox=outbox;
    }
    @Transactional(readOnly=true)
    public List<Summary> list() {
        AppUser user=access.currentActiveUser();
        return em.createQuery("select m from FarmMembership m join fetch m.farm where m.user.id=:user and upper(m.status)='ACTIVE' order by m.farm.id",FarmMembership.class)
            .setParameter("user",user.getId()).getResultList().stream()
            .filter(m -> "OWNER".equalsIgnoreCase(m.getRole()) || "ACTIVE".equalsIgnoreCase(m.getFarm().getServiceStatus()))
            .map(m -> new Summary(m.getFarm().getId(),m.getFarm().getName(),m.getRole(),m.getFarm().getServiceStatus(),m.getFarm().getVersion())).toList();
    }
    @Transactional
    public Details register(Registration request) {
        AppUser owner=access.currentActiveUser();
        if (!owner.isOwnerRegistrationCompleted()) throw DomainException.forbidden("MSG-FE02-OWNER_PROFILE_REQUIRED");
        Farm farm=new Farm(); farm.setServiceStatus("PENDING_PAYMENT"); farm.setTimeZone("Asia/Ho_Chi_Minh");
        applyContact(farm,request.name(),request.province(),request.commune(),request.detailedAddress(),
            blankDefault(request.contactPerson(),owner.getFullName()),blankDefault(request.contactPhone(),owner.getPhone()),request.registrationCertificateInfo());
        farm.setExpectedHerdSize(request.expectedHerdSize()); em.persist(farm);
        FarmMembership membership=new FarmMembership();membership.setFarm(farm);membership.setUser(owner);
        membership.setRole("OWNER");membership.setStatus("ACTIVE");em.persist(membership);
        starters.create(farm,owner,request.mainBreedCodes());
        audit.log(farm,owner,"FARM_REGISTER","Farm",farm.getId(),Map.of("name",farm.getName()));
        outbox.enqueue(farm.getId(),"FARM_REGISTERED","Farm",farm.getId(),Map.of("farmId",farm.getId(),"ownerId",owner.getId()));
        em.flush();return details(farm);
    }
    @Transactional(readOnly=true)
    public Details get(Long farmId) { return details(access.require(farmId,FarmAction.VIEW_FARM_INFORMATION).farm()); }
    @Transactional(readOnly=true)
    public Summary context(Long farmId) {
        FarmContext ctx=access.require(farmId,FarmAction.VIEW_CATALOGUES);
        return new Summary(farmId,ctx.farm().getName(),ctx.role().name(),ctx.farm().getServiceStatus(),ctx.farm().getVersion());
    }
    @Transactional
    public Details update(Long farmId,Update request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FARM_INFORMATION);
        Farm f=farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(f.getVersion(),request.expectedVersion());
        applyContact(f,request.name(),request.province(),request.commune(),request.detailedAddress(),request.contactPerson(),request.contactPhone(),request.registrationCertificateInfo());
        String zone=blankDefault(request.timeZone(),"Asia/Ho_Chi_Minh");
        try { ZoneId.of(zone); } catch (java.time.DateTimeException error) { throw DomainException.invalid("timeZone"); }
        f.setTimeZone(zone); f.setMorningShiftStart(request.morningShiftStart());f.setOperatingNotes(request.operatingNotes());
        if(request.mainBreedIds()!=null) {
            Set<Breed> selected=new LinkedHashSet<>();
            for(Long id:request.mainBreedIds()) {
                Breed b=id==null?null:em.find(Breed.class,id);
                if(b==null || !farmId.equals(b.getFarm().getId()) || !Boolean.TRUE.equals(b.getAvailable())) throw DomainException.invalid("mainBreedIds");
                selected.add(b);
            }
            f.setMainBreeds(selected);
        }
        audit.log(ctx,"FARM_UPDATE","Farm",f.getId(),Map.of("name",f.getName()));
        outbox.enqueue(farmId,"FARM_UPDATED","Farm",farmId,Map.of("farmId",farmId));
        em.flush();return details(f);
    }
    @Transactional(readOnly=true)
    public Catalogues catalogues(Long farmId) {
        access.require(farmId,FarmAction.VIEW_CATALOGUES);
        List<Lookup> breeds=em.createQuery("select b from Breed b where b.farm.id=:farm order by b.code",Breed.class).setParameter("farm",farmId).getResultList()
            .stream().map(b->new Lookup(b.getId(),b.getCode(),b.getName(),Boolean.TRUE.equals(b.getAvailable()),null)).toList();
        List<Lookup> purposes=em.createQuery("select p from ProductionPurpose p where p.farm.id=:farm order by p.code",ProductionPurpose.class).setParameter("farm",farmId).getResultList()
            .stream().map(p->new Lookup(p.getId(),p.getCode(),p.getName(),Boolean.TRUE.equals(p.getAvailable()),p.getPurposeType().name())).toList();
        List<Lookup> vaccines=em.createQuery("select v from Vaccine v where v.farm.id=:farm order by v.code",Vaccine.class).setParameter("farm",farmId).getResultList()
            .stream().map(v->new Lookup(v.getId(),v.getCode(),v.getName(),Boolean.TRUE.equals(v.getAvailable()),v.getDiseasePrevented())).toList();
        List<Lookup> feeds=em.createQuery("select f from FeedItem f where f.farm.id=:farm order by f.code",FeedItem.class).setParameter("farm",farmId).getResultList()
            .stream().map(f->new Lookup(f.getId(),f.getCode(),f.getName(),Boolean.TRUE.equals(f.getAvailable()),f.getFeedGroup())).toList();
        return new Catalogues(breeds,purposes,vaccines,feeds);
    }
    private void applyContact(Farm f,String name,String province,String commune,String address,String person,String phone,String certificate) {
        f.setName(name.trim());f.setProvince(province.trim());f.setCommune(commune.trim());f.setDetailedAddress(address);
        f.setLocation(province.trim()+", "+commune.trim());f.setContact(phone==null?"":phone);
        f.setContactPerson(person);f.setContactPhone(phone);f.setRegistrationCertificateInfo(certificate);
    }
    private String blankDefault(String value,String fallback) { return value==null || value.isBlank()?fallback:value.trim(); }
    private Details details(Farm f) {
        return new Details(f.getId(),f.getName(),f.getProvince(),f.getCommune(),f.getDetailedAddress(),f.getContactPerson(),f.getContactPhone(),
            f.getRegistrationCertificateInfo(),f.getExpectedHerdSize(),f.getTimeZone(),f.getMorningShiftStart(),f.getOperatingNotes(),f.getServiceStatus(),
            f.getMainBreeds().stream().map(Breed::getId).collect(java.util.stream.Collectors.toSet()),f.getVersion());
    }
}

