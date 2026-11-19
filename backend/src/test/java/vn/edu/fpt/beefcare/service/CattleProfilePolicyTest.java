package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.CattleDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest @Transactional
class CattleProfilePolicyTest extends DomainTestSupport {
    @Autowired CattleProfileService service;
    private Cattle animal(Farm f){return cattle(f,breed(f),purpose(f,PurposeType.FATTENING),Sex.MALE,LifeStage.ADULT);}
    @Test void profileIsTypedAndPurposeChangeIsOwnerOnlyWithoutChangingPermanentIdentity() {
        Farm f=farm();Cattle c=animal(f);AppUser manager=memberWithRole(f,FarmRole.MANAGER),owner=memberWithRole(f,FarmRole.OWNER);
        ProductionPurpose sire=purpose(f,PurposeType.SIRE);actAs(manager);
        CattleDtos.ProfileUpdate r=new CattleDtos.ProfileUpdate(null,"Bò A",null,"Ghi chú",sire.getId(),null,TODAY,"Đổi mục đích",c.getVersion(),false);
        assertThatThrownBy(()->service.update(f.getId(),c.getId(),r)).isInstanceOf(DomainException.class);
        actAs(owner);CattleDtos.Profile updated=service.update(f.getId(),c.getId(),r);
        assertThat(updated.id()).isEqualTo(c.getId());assertThat(updated.displayCode()).isEqualTo(c.getDisplayCode());
        assertThat(updated.purposeType()).isEqualTo(PurposeType.SIRE);assertThat(updated.herdGroup()).isEqualTo("BREEDING_BULLS");
        assertThat(service.list(f.getId(),null,null,null,null,null,null,null,null,null,0,20,null).items()).extracting(CattleDtos.Profile::id).containsExactly(c.getId());
    }
    @Test void replacementKeepsOldTagResolvableAndRejectsStaleCattleVersion() {
        Farm f=farm();Cattle c=animal(f);actAs(memberWithRole(f,FarmRole.MANAGER));
        CattleDtos.Tag first=service.issueTag(f.getId(),c.getId(),new CattleDtos.TagRequest(null,"TEST-TAG-A",null,c.getVersion()));Integer oldVersion=c.getVersion();
        CattleDtos.Tag second=service.issueTag(f.getId(),c.getId(),new CattleDtos.TagRequest(ReplacementReason.LOST,"TEST-TAG-B",null,c.getVersion()));
        assertThat(second.status()).isEqualTo("ACTIVE");assertThat(service.resolve(f.getId(),first.tagCode()).replacedTag()).isTrue();
        assertThat(service.resolve(f.getId(),first.tagCode()).cattleId()).isEqualTo(c.getId());
        assertThatThrownBy(()->service.issueTag(f.getId(),c.getId(),new CattleDtos.TagRequest(ReplacementReason.DAMAGED,"TEST-TAG-C",null,oldVersion))).isInstanceOf(DomainException.class);
        assertThat(service.tags(f.getId(),c.getId())).extracting(CattleDtos.Tag::status).containsExactlyInAnyOrder("ACTIVE","REPLACED");
    }
    @Test void foreignTagDoesNotRevealCattleAndAccessibleOtherFarmRequiresSwitch() {
        Farm f=farm(),other=farm();Cattle c=animal(other);AppUser actor=memberWithRole(f,FarmRole.OWNER),otherOwner=memberWithRole(other,FarmRole.OWNER);
        actAs(otherOwner);service.issueTag(other.getId(),c.getId(),new CattleDtos.TagRequest(null,"FOREIGN-TAG",null,c.getVersion()));
        actAs(actor);assertThatThrownBy(()->service.resolve(f.getId(),"FOREIGN-TAG")).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("MSG-FE05-09"));
        member(other,actor,"TECHNICIAN","ACTIVE");CattleDtos.Resolved resolved=service.resolve(f.getId(),"FOREIGN-TAG");
        assertThat(resolved.switchFarmRequired()).isTrue();assertThat(resolved.farmId()).isEqualTo(other.getId());assertThat(resolved.cattle()).isNull();assertThat(resolved.cattleId()).isNull();
    }
    @Test void exitedCattleRemainsReadableButCannotBeEditedOrGivenNewTag() {
        Farm f=farm();Cattle c=animal(f);c.setHerdStatus(HerdStatus.EXITED);em.flush();actAs(memberWithRole(f,FarmRole.OWNER));
        assertThat(service.get(f.getId(),c.getId()).herdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThatThrownBy(()->service.issueTag(f.getId(),c.getId(),new CattleDtos.TagRequest(null,"EXIT-TAG",null,c.getVersion()))).isInstanceOf(DomainException.class);
    }
}
