package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.HealthCaseTestSamples.*;
import static vn.edu.fpt.beefcare.domain.MedicineTestSamples.*;
import static vn.edu.fpt.beefcare.domain.TreatmentTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class TreatmentTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Treatment.class);
        Treatment treatment1 = getTreatmentSample1();
        Treatment treatment2 = new Treatment();
        assertThat(treatment1).isNotEqualTo(treatment2);

        treatment2.setId(treatment1.getId());
        assertThat(treatment1).isEqualTo(treatment2);

        treatment2 = getTreatmentSample2();
        assertThat(treatment1).isNotEqualTo(treatment2);
    }

    @Test
    void healthCaseTest() {
        Treatment treatment = getTreatmentRandomSampleGenerator();
        HealthCase healthCaseBack = getHealthCaseRandomSampleGenerator();

        treatment.setHealthCase(healthCaseBack);
        assertThat(treatment.getHealthCase()).isEqualTo(healthCaseBack);

        treatment.healthCase(null);
        assertThat(treatment.getHealthCase()).isNull();
    }

    @Test
    void medicineTest() {
        Treatment treatment = getTreatmentRandomSampleGenerator();
        Medicine medicineBack = getMedicineRandomSampleGenerator();

        treatment.setMedicine(medicineBack);
        assertThat(treatment.getMedicine()).isEqualTo(medicineBack);

        treatment.medicine(null);
        assertThat(treatment.getMedicine()).isNull();
    }
}
