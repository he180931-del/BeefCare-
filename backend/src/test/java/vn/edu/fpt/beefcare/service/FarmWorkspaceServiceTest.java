package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.service.dto.FarmWorkspaceDtos.*;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@Transactional
class FarmWorkspaceServiceTest extends DomainTestSupport {
    @Autowired FarmWorkspaceService workspaces;
    @Autowired IdempotencyCommandService commands;

    private Registration request(Set<String> breeds) {
        return new Registration("New cattle farm","Hà Nội","Xã demo",null,null,null,null,"150_300",breeds);
    }
    private AppUser owner() {
        AppUser owner=user();owner.setOwnerRegistrationCompleted(true);owner.setOwnerRegistrationCompletedAt(clock.instant());
        owner.setPhone("0900000000");em.flush();actAs(owner);return owner;
    }
    @Test void farmRegistrationCreatesCompleteIndependentStarterCatalogueAndOwner() {
        AppUser owner=owner();
        Details farm=workspaces.register(request(Set.of("LAISIND","ZEBU-D")));
        assertThat(farm.serviceStatus()).isEqualTo("PENDING_PAYMENT");
        assertThat(farm.mainBreedIds()).hasSize(2);
        assertThat(farm.contactPerson()).isEqualTo(owner.getFullName());
        assertThat(count("Breed",farm.id())).isEqualTo(9);
        assertThat(count("ProductionPurpose",farm.id())).isEqualTo(4);
        assertThat(count("Vaccine",farm.id())).isEqualTo(4);
        assertThat(count("FeedItem",farm.id())).isEqualTo(9);
        assertThat(count("Medicine",farm.id())).isZero();
        assertThat(count("FarmParameterVersion",farm.id())).isEqualTo(1);
        assertThat(em.createQuery("select count(b) from Breed b where b.farm.id=:f and b.available=true",Long.class).setParameter("f",farm.id()).getSingleResult()).isEqualTo(2);
        assertThat(em.createQuery("select count(m) from FarmMembership m where m.farm.id=:f and m.user.id=:u and m.role='OWNER'",Long.class)
            .setParameter("f",farm.id()).setParameter("u",owner.getId()).getSingleResult()).isEqualTo(1);
        assertThat(em.createQuery("select c.lastValue from CodeSequence c where c.farmId=:f and c.codeType=vn.edu.fpt.beefcare.domain.enumeration.CodeType.FEED_ITEM",Long.class)
            .setParameter("f",farm.id()).getSingleResult()).isEqualTo(9);
        assertThat(workspaces.list()).extracting(Summary::id).contains(farm.id());
    }
    /** TC-02-07 (R-02-03, R-02-04, GBR-109, Table III-6): the post-conditions not covered by the test above. */
    @Test void tc0207RegistrationWritesOneAuditEntryAndNoSubscriptionOrPayment() {
        owner();
        Details farm=workspaces.register(request(Set.of("ZEBU-D")));
        assertThat(farm.timeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(em.createQuery("select a.action from AuditLog a where a.farm.id=:f",String.class).setParameter("f",farm.id()).getResultList()).containsExactly("FARM_REGISTER");
        assertThat(em.createQuery("select count(s) from Subscription s where s.farm.id=:f",Long.class).setParameter("f",farm.id()).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(p) from Payment p where p.subscription.farm.id=:f",Long.class).setParameter("f",farm.id()).getSingleResult()).isZero();
        assertThat(em.createQuery("select count(p) from ProductionPurpose p where p.farm.id=:f and p.available=true",Long.class).setParameter("f",farm.id()).getSingleResult()).isEqualTo(4);
        assertThat(em.createQuery("select count(v) from Vaccine v where v.farm.id=:f and (v.dose is not null or v.route is not null or v.boosterInterval is not null)",Long.class).setParameter("f",farm.id()).getSingleResult()).isZero();
        assertThat(em.createQuery("select v.code from Vaccine v where v.farm.id=:f and v.available=false",String.class).setParameter("f",farm.id()).getResultList()).containsExactly("VX-NT");
        assertThat(em.createQuery("select count(i) from FeedItem i where i.farm.id=:f and (i.onHandKg<>0 or i.minimumStockKg is not null)",Long.class).setParameter("f",farm.id()).getSingleResult()).isZero();
    }
    /** TC-02-05: farm names need not be unique, not even for the same Owner. */
    @Test void tc0205SameOwnerCanRegisterTwoFarmsWithTheSameName() {
        owner();
        Details first=workspaces.register(minimal("Trại A","Hà Nội",null,null));
        Details second=workspaces.register(minimal("Trại A","Hà Nội",null,null));
        assertThat(second.id()).isNotEqualTo(first.id());
        assertThat(workspaces.list()).extracting(Summary::id).contains(first.id(),second.id());
    }
    /** TC-02-06 (R-02-01, UC-FE02-01 E1): MSG-FE02-02 and no farm. */
    @Test void unfinishedOwnerProfileCannotCreateFarm() {
        AppUser notOwnerYet=user();actAs(notOwnerYet);
        assertThatThrownBy(()->workspaces.register(request(Set.of()))).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getStatus().value()).isEqualTo(403);assertThat(e.getCode()).isEqualTo("MSG-FE02-02");
        });
        assertThat(em.createQuery("select count(m) from FarmMembership m where m.user.id=:u",Long.class).setParameter("u",notOwnerYet.getId()).getSingleResult()).isZero();
    }
    /** SCR-10 Province, decision FE-02 Q3: one of the 34 provinces and centrally-run cities, stored by name. */
    @Test void provinceMustBeOneOfTheThirtyFourProvinces() {
        owner();
        assertThatThrownBy(()->workspaces.register(minimal("Trại B","Hà Tây",null,null))).isInstanceOfSatisfying(DomainException.class,e->{
            assertThat(e.getCode()).isEqualTo("MSG-COM-10");assertThat(e.getParams()).containsEntry("field","province");
        });
        assertThat(workspaces.register(minimal("Trại B"," TP. Hồ Chí Minh ",null,null)).province()).isEqualTo("TP. Hồ Chí Minh");
        assertThat(VietnamProvinces.NAMES).hasSize(34).doesNotHaveDuplicates();
    }
    /** SCR-10: a blank optional field is "not provided"; the contact phone then defaults to the Owner's phone. */
    @Test void blankOptionalFieldsAreNotProvided() {
        AppUser owner=owner();
        Details farm=workspaces.register(minimal("Trại C","Phú Thọ","",""));
        assertThat(farm.contactPhone()).isEqualTo(owner.getPhone());
        assertThat(farm.expectedHerdSize()).isNull();
    }
    private Registration minimal(String name,String province,String phone,String herdSize) {
        return new Registration(name,province,"Xã demo",null,null,phone,null,herdSize,Set.of());
    }
    @Test void idempotentFarmRegistrationDoesNotCreateDuplicateFarmOrCatalogue() {
        owner();Registration request=request(Set.of("ZEBU-D"));
        Details first=commands.execute(null,null,"FARM_REGISTER","farm-key",request,Details.class,()->workspaces.register(request));
        Details again=commands.execute(null,null,"FARM_REGISTER","farm-key",request,Details.class,()->{throw new AssertionError("Repeated command executed");});
        assertThat(again.id()).isEqualTo(first.id());assertThat(count("FeedItem",first.id())).isEqualTo(9);
        assertThatThrownBy(()->commands.execute(null,null,"FARM_REGISTER","farm-key",request(Set.of()),Details.class,()->workspaces.register(request)))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getStatus().value()).isEqualTo(409));
    }
    @Test void farmListHidesInactiveFarmFromManagerButKeepsOwnerException() {
        Farm farm=farm("EXPIRED");AppUser owner=memberWithRole(farm,FarmRole.OWNER);AppUser manager=memberWithRole(farm,FarmRole.MANAGER);
        actAs(manager);assertThat(workspaces.list()).isEmpty();
        actAs(owner);assertThat(workspaces.list()).extracting(Summary::id).contains(farm.getId());
        assertThat(workspaces.get(farm.getId()).id()).isEqualTo(farm.getId());
        assertThatThrownBy(()->workspaces.catalogues(farm.getId())).isInstanceOf(DomainException.class);
    }
    @Test void userCannotReadOtherFarmInformationOrCatalogue() {
        Farm farm=farm();Farm other=farm();actAs(memberWithRole(farm,FarmRole.OWNER));
        assertThatThrownBy(()->workspaces.get(other.getId())).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->workspaces.catalogues(other.getId())).isInstanceOf(DomainException.class);
    }
    private long count(String entity,Long farmId) {
        return em.createQuery("select count(x) from "+entity+" x where x.farm.id=:farm",Long.class).setParameter("farm",farmId).getSingleResult();
    }
}
