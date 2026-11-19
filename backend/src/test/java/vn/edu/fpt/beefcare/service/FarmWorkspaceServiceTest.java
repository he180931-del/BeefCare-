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
    @Test void unfinishedOwnerProfileCannotCreateFarm() {
        actAs(user());
        assertThatThrownBy(()->workspaces.register(request(Set.of()))).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getStatus().value()).isEqualTo(403));
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
