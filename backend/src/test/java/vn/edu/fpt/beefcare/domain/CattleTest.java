package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.BreedTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.HerdEntryTestSamples.*;
import static vn.edu.fpt.beefcare.domain.HerdExitTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ProductionPurposeTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class CattleTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Cattle.class);
        Cattle cattle1 = getCattleSample1();
        Cattle cattle2 = new Cattle();
        assertThat(cattle1).isNotEqualTo(cattle2);

        cattle2.setId(cattle1.getId());
        assertThat(cattle1).isEqualTo(cattle2);

        cattle2 = getCattleSample2();
        assertThat(cattle1).isNotEqualTo(cattle2);
    }

    @Test
    void farmTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        cattle.setFarm(farmBack);
        assertThat(cattle.getFarm()).isEqualTo(farmBack);

        cattle.farm(null);
        assertThat(cattle.getFarm()).isNull();
    }

    @Test
    void breedTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        Breed breedBack = getBreedRandomSampleGenerator();

        cattle.setBreed(breedBack);
        assertThat(cattle.getBreed()).isEqualTo(breedBack);

        cattle.breed(null);
        assertThat(cattle.getBreed()).isNull();
    }

    @Test
    void purposeTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        ProductionPurpose productionPurposeBack = getProductionPurposeRandomSampleGenerator();

        cattle.setPurpose(productionPurposeBack);
        assertThat(cattle.getPurpose()).isEqualTo(productionPurposeBack);

        cattle.purpose(null);
        assertThat(cattle.getPurpose()).isNull();
    }

    @Test
    void damTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        cattle.setDam(cattleBack);
        assertThat(cattle.getDam()).isEqualTo(cattleBack);

        cattle.dam(null);
        assertThat(cattle.getDam()).isNull();
    }

    @Test
    void sireTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        cattle.setSire(cattleBack);
        assertThat(cattle.getSire()).isEqualTo(cattleBack);

        cattle.sire(null);
        assertThat(cattle.getSire()).isNull();
    }

    @Test
    void herdEntryTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        HerdEntry herdEntryBack = getHerdEntryRandomSampleGenerator();

        cattle.setHerdEntry(herdEntryBack);
        assertThat(cattle.getHerdEntry()).isEqualTo(herdEntryBack);
        assertThat(herdEntryBack.getCattle()).isEqualTo(cattle);

        cattle.herdEntry(null);
        assertThat(cattle.getHerdEntry()).isNull();
        assertThat(herdEntryBack.getCattle()).isNull();
    }

    @Test
    void herdExitTest() {
        Cattle cattle = getCattleRandomSampleGenerator();
        HerdExit herdExitBack = getHerdExitRandomSampleGenerator();

        cattle.setHerdExit(herdExitBack);
        assertThat(cattle.getHerdExit()).isEqualTo(herdExitBack);
        assertThat(herdExitBack.getCattle()).isEqualTo(cattle);

        cattle.herdExit(null);
        assertThat(cattle.getHerdExit()).isNull();
        assertThat(herdExitBack.getCattle()).isNull();
    }
}
