package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.HerdStatus;
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
    private final FarmClock clock;
    public FarmWorkspaceService(EntityManager em,FarmAccessService access,FarmRepository farms,
        StarterCatalogueService starters,AuditService audit,OutboxService outbox,FarmClock clock) {
        this.em=em;this.access=access;this.farms=farms;this.starters=starters;this.audit=audit;this.outbox=outbox;this.clock=clock;
    }
    /**
     * UC-FE02-02 step 2: every farm where the caller has an ACTIVE membership, whatever its service status. A Manager or
     * Technician gets a farm that is not ACTIVE as a locked card (AF3); entering it is refused by {@link #context}.
     */
    @Transactional(readOnly=true)
    public List<Summary> list() {
        AppUser user=access.currentActiveUser();
        List<FarmMembership> memberships=em.createQuery("select m from FarmMembership m join fetch m.farm where m.user.id=:user and upper(m.status)='ACTIVE' order by m.farm.id",FarmMembership.class)
            .setParameter("user",user.getId()).getResultList();
        if (memberships.isEmpty()) return List.of();
        List<Long> ids=memberships.stream().map(m -> m.getFarm().getId()).toList();
        Map<Long,Long> cattle=activeCattle(ids);Map<Long,Instant> until=serviceUntil(ids);
        return memberships.stream().map(m -> summary(m.getFarm(),m.getRole(),cattle,until)).toList();
    }
    private static Summary summary(Farm farm,String role,Map<Long,Long> cattle,Map<Long,Instant> until) {
        return new Summary(farm.getId(),farm.getName(),role,farm.getServiceStatus(),farm.getVersion(),farm.getProvince(),farm.getCommune(),
            cattle.getOrDefault(farm.getId(),0L),until.get(farm.getId()));
    }
    private Map<Long,Long> activeCattle(List<Long> farmIds) {
        Map<Long,Long> counts=new HashMap<>();
        em.createQuery("select c.farm.id, count(c) from Cattle c where c.farm.id in :ids and c.herdStatus=:s group by c.farm.id",Object[].class)
            .setParameter("ids",farmIds).setParameter("s",HerdStatus.ACTIVE).getResultList()
            .forEach(row -> counts.put((Long) row[0],(Long) row[1]));
        return counts;
    }
    /** Latest confirmed service end per farm (SCR-09 "Until dd/mm/yyyy"); absent when the farm has no subscription yet. */
    private Map<Long,Instant> serviceUntil(List<Long> farmIds) {
        Map<Long,Instant> ends=new HashMap<>();
        em.createQuery("select s.farm.id, s.latestEnd from Subscription s where s.farm.id in :ids",Object[].class)
            .setParameter("ids",farmIds).getResultList()
            .forEach(row -> { if (row[1]!=null) ends.put((Long) row[0],(Instant) row[1]); });
        return ends;
    }
    /** UC-FE02-01: one farm in PENDING_PAYMENT with its OWNER membership, parameters, starter catalogue and audit (R-02-03). */
    @Transactional
    public Details register(Registration request) {
        AppUser owner=access.currentActiveUser();
        if (!owner.isOwnerRegistrationCompleted()) throw DomainException.forbidden(MessageCodes.FE02_02);
        String province=VietnamProvinces.require(request.province(),"province");
        Farm farm=new Farm(); farm.setServiceStatus("PENDING_PAYMENT"); farm.setTimeZone("Asia/Ho_Chi_Minh");
        applyContact(farm,request.name(),province,request.commune(),request.detailedAddress(),
            blankDefault(request.contactPerson(),owner.getFullName()),blankDefault(request.contactPhone(),owner.getPhone()),request.registrationCertificateInfo());
        farm.setExpectedHerdSize(blankDefault(request.expectedHerdSize(),null)); em.persist(farm);
        FarmMembership membership=new FarmMembership();membership.setFarm(farm);membership.setUser(owner);
        membership.setRole("OWNER");membership.setStatus("ACTIVE");em.persist(membership);
        starters.create(farm,owner,request.mainBreedCodes());
        audit.log(farm,owner,"FARM_REGISTER","Farm",farm.getId(),Map.of("name",farm.getName()));
        outbox.enqueue(farm.getId(),"FARM_REGISTERED","Farm",farm.getId(),Map.of("farmId",farm.getId(),"ownerId",owner.getId()));
        em.flush();return details(farm);
    }
    @Transactional(readOnly=true)
    public Details get(Long farmId) { return details(access.require(farmId,FarmAction.VIEW_FARM_INFORMATION).farm()); }
    /** UC-FE02-02 step 4: rechecks membership, role and service status before the farm becomes the current farm (GBR-09, GBR-14). */
    @Transactional(readOnly=true)
    public Summary context(Long farmId) {
        FarmContext ctx=access.require(farmId,FarmAction.SELECT_FARM);
        List<Long> ids=List.of(farmId);
        return summary(ctx.farm(),ctx.role().name(),activeCattle(ids),serviceUntil(ids));
    }
    /**
     * UC-FE02-03 (SCR-11, flow confirmed as Q1): the Owner saves registration, contact and operating information in any
     * service status. Province as SCR-10 (Q3), time zone one of the offered UTC+7 zones (Q2), a blank optional field is
     * "not provided"; main breeds change only when the request sends them (SCR-11 has no such field).
     */
    @Transactional
    public Details update(Long farmId,Update request) {
        FarmContext ctx=access.require(farmId,FarmAction.MANAGE_FARM_INFORMATION);
        Farm f=farms.lockById(farmId).orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        VersionGuard.requireExpected(f.getVersion(),request.expectedVersion());
        String province=VietnamProvinces.require(request.province(),"province");
        String zone=FarmTimeZones.require(request.timeZone(),"timeZone");
        applyContact(f,request.name(),province,request.commune(),blankDefault(request.detailedAddress(),null),blankDefault(request.contactPerson(),null),
            blankDefault(request.contactPhone(),null),blankDefault(request.registrationCertificateInfo(),null));
        f.setTimeZone(zone); f.setMorningShiftStart(request.morningShiftStart());f.setOperatingNotes(blankDefault(request.operatingNotes(),null));
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
        Instant now=clock.now();
        Instant currentEnd=em.createQuery("select max(p.purchasedEnd) from Payment p where p.subscription.farm.id=:f and upper(p.state)='PAID' "
                +"and p.purchasedStart<=:now and p.purchasedEnd>:now",Instant.class)
            .setParameter("f",f.getId()).setParameter("now",now).getSingleResult();
        Instant latestEnd=serviceUntil(List.of(f.getId())).get(f.getId());
        Instant suspendedAt="SUSPENDED".equalsIgnoreCase(f.getServiceStatus())
            ? em.createQuery("select max(a.loggedAt) from AuditLog a where a.farm.id=:f and a.action='FARM_SERVICE_SUSPEND'",Instant.class)
                .setParameter("f",f.getId()).getSingleResult()
            : null;
        // Whole days left, as SCR-57 counts them; the period keeps running while SUSPENDED (Q4).
        Long daysRemaining=currentEnd==null?null:Math.max(0,Duration.between(now,currentEnd).toDays());
        AppUser owner=em.createQuery("select m.user from FarmMembership m where m.farm.id=:f and upper(m.role)='OWNER' and upper(m.status)='ACTIVE'",AppUser.class)
            .setParameter("f",f.getId()).setMaxResults(1).getResultStream().findFirst().orElse(null);
        return new Details(f.getId(),f.getName(),f.getProvince(),f.getCommune(),f.getDetailedAddress(),f.getContactPerson(),f.getContactPhone(),
            f.getRegistrationCertificateInfo(),f.getExpectedHerdSize(),f.getTimeZone(),f.getMorningShiftStart(),f.getOperatingNotes(),f.getServiceStatus(),
            f.getMainBreeds().stream().map(Breed::getId).collect(java.util.stream.Collectors.toSet()),f.getVersion(),
            currentEnd,latestEnd==null?null:latestEnd.minus(SubscriptionPaymentService.RENEWAL_WINDOW),suspendedAt,daysRemaining,
            owner==null?null:owner.getFullName(),owner==null?null:owner.getEmail());
    }
}

