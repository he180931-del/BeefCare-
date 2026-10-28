package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.*;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.domain.*;
import vn.edu.fpt.beefcare.domain.enumeration.*;
import vn.edu.fpt.beefcare.service.dto.HerdCatalogueDtos.*;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest @Transactional
class HerdCatalogueCommandServiceTest extends DomainTestSupport {
    @Autowired HerdCatalogueCommandService service;
    @Test void referencedBreedKeepsItsCodeButMayBeDeactivatedWithoutRewritingCattle() {
        Farm f=farm();AppUser owner=memberWithRole(f,FarmRole.OWNER);actAs(owner);
        Breed b=breed(f);Cattle c=cattle(f,b,purpose(f,PurposeType.FATTENING),Sex.MALE,LifeStage.ADULT);
        assertThatThrownBy(()->service.saveBreed(f.getId(),b.getId(),new BreedWrite("NEW",b.getName(),null,null,true,b.getVersion()))).isInstanceOf(DomainException.class);
        BreedView updated=service.saveBreed(f.getId(),b.getId(),new BreedWrite(b.getCode(),"Giống mới hiển thị","Local","Mô tả",false,b.getVersion()));
        assertThat(updated.available()).isFalse();assertThat(updated.messages()).contains("MSG-FE18-03");assertThat(c.getBreed().getId()).isEqualTo(b.getId());
        assertThat(updated.activeCattle()).isEqualTo(1);
    }
    @Test void purposeTypeIsFixedByCattleAndByHistoricalPenCriteria() {
        Farm f=farm();AppUser owner=memberWithRole(f,FarmRole.OWNER);actAs(owner);ProductionPurpose p=purpose(f,PurposeType.BREEDING);
        criteria(pen(f,"C1",10),1,Set.of(PurposeType.BREEDING),Set.of(LifeStage.ADULT),Sex.FEMALE,null,null,owner);
        assertThatThrownBy(()->service.savePurpose(f.getId(),p.getId(),new PurposeWrite(p.getCode(),p.getName(),PurposeType.FATTENING,null,true,p.getVersion())))
            .isInstanceOfSatisfying(DomainException.class,e->assertThat(e.getCode()).isEqualTo("MSG-FE18-09"));
        assertThat(service.purposes(f.getId(),null,null)).anySatisfy(v->assertThat(v.receivingPens()).hasSize(1));
    }
    @Test void duplicateCodeVersionAndOtherFarmAreRejectedAndTechnicianCannotWrite() {
        Farm f=farm(),other=farm();AppUser owner=memberWithRole(f,FarmRole.OWNER);actAs(owner);
        BreedView first=service.saveBreed(f.getId(),null,new BreedWrite("MY-B","Lai",null,null,true,null));
        assertThatThrownBy(()->service.saveBreed(f.getId(),null,new BreedWrite("MY-B","Trùng",null,null,true,null))).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->service.saveBreed(f.getId(),first.id(),new BreedWrite("MY-B","Lai",null,null,false,first.version()+1))).isInstanceOf(DomainException.class);
        Breed foreign=breed(other);
        assertThatThrownBy(()->service.saveBreed(f.getId(),foreign.getId(),new BreedWrite(foreign.getCode(),"Lai",null,null,true,foreign.getVersion()))).isInstanceOf(DomainException.class);
        actAs(memberWithRole(f,FarmRole.TECHNICIAN));assertThat(service.breeds(f.getId(),null,"ACTIVE")).hasSize(1);
        assertThatThrownBy(()->service.saveBreed(f.getId(),null,new BreedWrite("NO","Lai",null,null,true,null))).isInstanceOf(DomainException.class);
        assertThatThrownBy(()->service.purposes(f.getId(),null,null)).isInstanceOf(DomainException.class);
    }
}
