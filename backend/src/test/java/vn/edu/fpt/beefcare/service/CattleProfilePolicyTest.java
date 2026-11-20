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
        // TC-05-27: scanning the replaced tag names the current tag and when it was replaced (MSG-FE05-05).
        CattleDtos.Resolved replaced=service.resolve(f.getId(),first.tagCode());
        assertThat(replaced.messageCode()).isEqualTo("MSG-FE05-05");assertThat(replaced.currentTagCode()).isEqualTo("TEST-TAG-B");assertThat(replaced.replacedAt()).isNotNull();
        assertThat(service.resolve(f.getId(),"TEST-TAG-B").currentTagCode()).isNull();
        // A5: the tag history shows who issued each tag.
        assertThat(service.tags(f.getId(),c.getId())).allSatisfy(t->assertThat(t.issuedByName()).isNotBlank());
        assertThatThrownBy(()->service.issueTag(f.getId(),c.getId(),new CattleDtos.TagRequest(ReplacementReason.DAMAGED,"TEST-TAG-C",null,oldVersion))).isInstanceOf(DomainException.class);
        assertThat(service.tags(f.getId(),c.getId())).extracting(CattleDtos.Tag::status).containsExactlyInAnyOrder("ACTIVE","REPLACED");
    }
    @Test void latestWeightFilterAndDescendingSortApplyBeforePagination() {
        Farm farm = farm();
        Cattle light = animal(farm);
        Cattle heavy = animal(farm);
        Cattle unweighed = animal(farm);
        weight(light, TODAY.minusDays(1), "220");
        weight(heavy, TODAY.minusDays(1), "350");
        actAs(memberWithRole(farm, FarmRole.MANAGER));

        CattleDtos.Page first = service.list(farm.getId(), null, null, null, null, null, null, null, null, null, 0, 1, "-latestWeightKg", true);
        assertThat(first.total()).isEqualTo(2);
        assertThat(first.items()).extracting(CattleDtos.Profile::id).containsExactly(heavy.getId());
        CattleDtos.Page missing = service.list(farm.getId(), null, null, null, null, null, null, null, null, null, 0, 10, "-latestWeightKg", false);
        assertThat(missing.items()).extracting(CattleDtos.Profile::id).containsExactly(unweighed.getId());
        CattleDtos.Page all = service.list(farm.getId(), null, null, null, null, null, null, null, null, null, 0, 10, "-latestWeightKg");
        assertThat(all.items()).extracting(CattleDtos.Profile::id).containsExactly(heavy.getId(), light.getId(), unweighed.getId());
    }
    @Test void foreignTagDoesNotRevealCattleAndAccessibleOtherFarmRequiresSwitch() {
        Farm f=farm(),other=farm();Cattle c=animal(other);AppUser actor=memberWithRole(f,FarmRole.OWNER),otherOwner=memberWithRole(other,FarmRole.OWNER);
        actAs(otherOwner);service.issueTag(other.getId(),c.getId(),new CattleDtos.TagRequest(null,"FOREIGN-TAG",null,c.getVersion()));
        actAs(actor);assertThatThrownBy(()->service.resolve(f.getId(),"FOREIGN-TAG")).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("MSG-FE05-09"));
        member(other,actor,"TECHNICIAN","ACTIVE");CattleDtos.Resolved resolved=service.resolve(f.getId(),"FOREIGN-TAG");
        assertThat(resolved.switchFarmRequired()).isTrue();assertThat(resolved.farmId()).isEqualTo(other.getId());assertThat(resolved.cattle()).isNull();assertThat(resolved.cattleId()).isNull();
    }
    private CattleDtos.ProfileUpdate purposeChange(Cattle c,ProductionPurpose p){return new CattleDtos.ProfileUpdate(c.getEarTagNumber(),c.getName(),null,null,p.getId(),null,TODAY,"Đổi mục đích",c.getVersion(),true);}
    private Reminder reminder(Farm f,Cattle c,String sourceId){Reminder r=new Reminder();r.setFarm(f);r.setCattle(c);r.setRuleType("REM-08");r.setSourceRecord("CATTLE:"+sourceId);r.setSourceType("CATTLE");r.setSourceId(sourceId);r.setDueTime(java.time.Instant.parse("2026-01-01T00:00:00Z"));r.setStatus("ACTIVE");em.persist(r);em.flush();return r;}

    @Test void tc0512And0513PurposeTypeIsMatchedToSexOnlyForSireAndBreeding() {
        Farm f=farm();Breed b=breed(f);actAs(memberWithRole(f,FarmRole.OWNER));
        Cattle cow=cattle(f,b,purpose(f,PurposeType.BREEDING),Sex.FEMALE,LifeStage.ADULT);
        Cattle bull=cattle(f,b,purpose(f,PurposeType.FATTENING),Sex.MALE,LifeStage.ADULT);
        // TC-05-13: a female may become FATTENING (R-05-04 binds only SIRE and BREEDING to a sex).
        assertThat(service.update(f.getId(),cow.getId(),purposeChange(cow,purpose(f,PurposeType.FATTENING))).purposeType()).isEqualTo(PurposeType.FATTENING);
        // TC-05-12: a male may not become BREEDING; a female may not become SIRE.
        assertThatThrownBy(()->service.update(f.getId(),bull.getId(),purposeChange(bull,purpose(f,PurposeType.BREEDING))))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("MSG-FE05-12"));
        Cattle heifer=cattle(f,b,purpose(f,PurposeType.UNDECIDED),Sex.FEMALE,LifeStage.ADULT);
        assertThatThrownBy(()->service.update(f.getId(),heifer.getId(),purposeChange(heifer,purpose(f,PurposeType.SIRE))))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("MSG-FE05-12"));
    }

    @Test void tc0508And0509EarTagIsUniqueAmongActiveCattleOnly() {
        Farm f=farm();Breed b=breed(f);ProductionPurpose p=purpose(f,PurposeType.FATTENING);actAs(memberWithRole(f,FarmRole.MANAGER));
        Cattle a=cattle(f,b,p,Sex.MALE,LifeStage.ADULT);a.setEarTagNumber("T-01");Cattle x=cattle(f,b,p,Sex.MALE,LifeStage.ADULT);em.flush();
        CattleDtos.ProfileUpdate tag=new CattleDtos.ProfileUpdate("t-01",null,null,null,null,null,TODAY,"Gắn tai",x.getVersion(),false);
        assertThatThrownBy(()->service.update(f.getId(),x.getId(),tag)).isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("MSG-FE05-02"));
        a.setHerdStatus(HerdStatus.EXITED);em.flush();
        assertThat(service.update(f.getId(),x.getId(),tag).earTagNumber()).isEqualTo("t-01");
    }

    @Test void tc0533ManualEarTagLookupPrefersTheActiveCattleOverAnExitedOneWithTheSameTag() {
        Farm f=farm();Breed b=breed(f);ProductionPurpose p=purpose(f,PurposeType.FATTENING);actAs(memberWithRole(f,FarmRole.TECHNICIAN));
        Cattle old=cattle(f,b,p,Sex.MALE,LifeStage.ADULT);old.setEarTagNumber("T-09");old.setHerdStatus(HerdStatus.EXITED);
        Cattle current=cattle(f,b,p,Sex.MALE,LifeStage.ADULT);current.setEarTagNumber("T-09");em.flush();
        assertThat(service.resolve(f.getId(),"t-09").cattleId()).isEqualTo(current.getId());
        assertThat(service.resolve(f.getId(),old.getDisplayCode()).cattleId()).isEqualTo(old.getId());
    }

    @Test void tc0517SavingTheSuggestedLifeStageResolvesTheStageSuggestionOnly() {
        Farm f=farm();Cattle c=cattle(f,breed(f),purpose(f,PurposeType.BREEDING),Sex.FEMALE,LifeStage.WEANED_CALF);actAs(memberWithRole(f,FarmRole.MANAGER));
        Reminder stage=reminder(f,c,"STAGE:YOUNG_STOCK:"+c.getId()+":P1"),pen=reminder(f,c,"PEN_CRITERIA:1:1:"+c.getId());
        // TC-05-18: nothing changes by itself while the suggestion is pending.
        assertThat(service.get(f.getId(),c.getId()).lifeStage()).isEqualTo(LifeStage.WEANED_CALF);
        service.update(f.getId(),c.getId(),new CattleDtos.ProfileUpdate(null,null,null,null,null,LifeStage.YOUNG_STOCK,TODAY,"Đủ tuổi bò tơ",c.getVersion(),true));
        em.flush();em.refresh(stage);em.refresh(pen);
        assertThat(stage.getStatus()).isEqualTo("RESOLVED");
        assertThat(pen.getStatus()).isEqualTo("ACTIVE");
    }

    @Test void exitedCattleRemainsReadableButCannotBeEditedOrGivenNewTag() {
        Farm f=farm();Cattle c=animal(f);c.setHerdStatus(HerdStatus.EXITED);em.flush();actAs(memberWithRole(f,FarmRole.OWNER));
        assertThat(service.get(f.getId(),c.getId()).herdStatus()).isEqualTo(HerdStatus.EXITED);
        assertThatThrownBy(()->service.issueTag(f.getId(),c.getId(),new CattleDtos.TagRequest(null,"EXIT-TAG",null,c.getVersion()))).isInstanceOf(DomainException.class);
    }
}
