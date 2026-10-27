package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ProductionPurposeTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ProductionPurposeTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(ProductionPurpose.class);
        ProductionPurpose productionPurpose1 = getProductionPurposeSample1();
        ProductionPurpose productionPurpose2 = new ProductionPurpose();
        assertThat(productionPurpose1).isNotEqualTo(productionPurpose2);

        productionPurpose2.setId(productionPurpose1.getId());
        assertThat(productionPurpose1).isEqualTo(productionPurpose2);

        productionPurpose2 = getProductionPurposeSample2();
        assertThat(productionPurpose1).isNotEqualTo(productionPurpose2);
    }

    @Test
    void farmTest() {
        ProductionPurpose productionPurpose = getProductionPurposeRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        productionPurpose.setFarm(farmBack);
        assertThat(productionPurpose.getFarm()).isEqualTo(farmBack);

        productionPurpose.farm(null);
        assertThat(productionPurpose.getFarm()).isNull();
    }
}
