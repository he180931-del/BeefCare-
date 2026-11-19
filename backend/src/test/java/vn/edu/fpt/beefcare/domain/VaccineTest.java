package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccineTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class VaccineTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Vaccine.class);
        Vaccine vaccine1 = getVaccineSample1();
        Vaccine vaccine2 = new Vaccine();
        assertThat(vaccine1).isNotEqualTo(vaccine2);

        vaccine2.setId(vaccine1.getId());
        assertThat(vaccine1).isEqualTo(vaccine2);

        vaccine2 = getVaccineSample2();
        assertThat(vaccine1).isNotEqualTo(vaccine2);
    }

    @Test
    void farmTest() {
        Vaccine vaccine = getVaccineRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        vaccine.setFarm(farmBack);
        assertThat(vaccine.getFarm()).isEqualTo(farmBack);

        vaccine.farm(null);
        assertThat(vaccine.getFarm()).isNull();
    }
}
