package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.ProductionPurpose;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;

class CattleProfileServiceHerdGroupTest {

    private final CattleProfileService service = new CattleProfileService(null, null, null, null, null, null, null, null, null, null, null, null, null);

    @Test
    void tc0501FemaleAdultBreedingIsBreedingFemale() {
        assertThat(group(Sex.FEMALE, LifeStage.ADULT, PurposeType.BREEDING)).isEqualTo("BREEDING_FEMALES");
    }

    @Test
    void tc0502WeanedCalfTakesPrecedenceOverBreedingPurpose() {
        assertThat(group(Sex.FEMALE, LifeStage.WEANED_CALF, PurposeType.BREEDING)).isEqualTo("CALVES");
    }

    @Test
    void tc0503FatteningPurposeIsFatteningGroup() {
        assertThat(group(Sex.MALE, LifeStage.ADULT, PurposeType.FATTENING)).isEqualTo("FATTENING");
    }

    @Test
    void tc0504AdultMaleSireIsBreedingBull() {
        assertThat(group(Sex.MALE, LifeStage.ADULT, PurposeType.SIRE)).isEqualTo("BREEDING_BULLS");
    }

    @Test
    void tc0505YoungStockIsClassifiedBeforeGeneralOther() {
        assertThat(group(Sex.FEMALE, LifeStage.YOUNG_STOCK, PurposeType.BREEDING)).isEqualTo("YOUNG_STOCK");
    }

    @Test
    void tc0506AdultUndecidedIsOther() {
        assertThat(group(Sex.FEMALE, LifeStage.ADULT, PurposeType.UNDECIDED)).isEqualTo("OTHER");
    }

    private String group(Sex sex, LifeStage stage, PurposeType purposeType) {
        Cattle cattle = mock(Cattle.class);
        ProductionPurpose purpose = mock(ProductionPurpose.class);
        when(cattle.getSex()).thenReturn(sex);
        when(cattle.getLifeStage()).thenReturn(stage);
        when(cattle.getPurpose()).thenReturn(purpose);
        when(purpose.getPurposeType()).thenReturn(purposeType);
        return service.herdGroup(cattle);
    }
}
