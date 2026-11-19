package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ScheduledDoseTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccinationTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccineTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class VaccinationTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Vaccination.class);
        Vaccination vaccination1 = getVaccinationSample1();
        Vaccination vaccination2 = new Vaccination();
        assertThat(vaccination1).isNotEqualTo(vaccination2);

        vaccination2.setId(vaccination1.getId());
        assertThat(vaccination1).isEqualTo(vaccination2);

        vaccination2 = getVaccinationSample2();
        assertThat(vaccination1).isNotEqualTo(vaccination2);
    }

    @Test
    void cattleTest() {
        Vaccination vaccination = getVaccinationRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        vaccination.setCattle(cattleBack);
        assertThat(vaccination.getCattle()).isEqualTo(cattleBack);

        vaccination.cattle(null);
        assertThat(vaccination.getCattle()).isNull();
    }

    @Test
    void vaccineTest() {
        Vaccination vaccination = getVaccinationRandomSampleGenerator();
        Vaccine vaccineBack = getVaccineRandomSampleGenerator();

        vaccination.setVaccine(vaccineBack);
        assertThat(vaccination.getVaccine()).isEqualTo(vaccineBack);

        vaccination.vaccine(null);
        assertThat(vaccination.getVaccine()).isNull();
    }

    @Test
    void scheduledDoseTest() {
        Vaccination vaccination = getVaccinationRandomSampleGenerator();
        ScheduledDose scheduledDoseBack = getScheduledDoseRandomSampleGenerator();

        vaccination.setScheduledDose(scheduledDoseBack);
        assertThat(vaccination.getScheduledDose()).isEqualTo(scheduledDoseBack);
        assertThat(scheduledDoseBack.getVaccination()).isEqualTo(vaccination);

        vaccination.scheduledDose(null);
        assertThat(vaccination.getScheduledDose()).isNull();
        assertThat(scheduledDoseBack.getVaccination()).isNull();
    }
}
