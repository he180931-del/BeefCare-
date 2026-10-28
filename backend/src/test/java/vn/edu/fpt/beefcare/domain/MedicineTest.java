package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.MedicineTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class MedicineTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Medicine.class);
        Medicine medicine1 = getMedicineSample1();
        Medicine medicine2 = new Medicine();
        assertThat(medicine1).isNotEqualTo(medicine2);

        medicine2.setId(medicine1.getId());
        assertThat(medicine1).isEqualTo(medicine2);

        medicine2 = getMedicineSample2();
        assertThat(medicine1).isNotEqualTo(medicine2);
    }

    @Test
    void farmTest() {
        Medicine medicine = getMedicineRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        medicine.setFarm(farmBack);
        assertThat(medicine.getFarm()).isEqualTo(farmBack);

        medicine.farm(null);
        assertThat(medicine.getFarm()).isNull();
    }
}
