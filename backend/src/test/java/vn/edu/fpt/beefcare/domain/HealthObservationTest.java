package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.HealthCaseTestSamples.*;
import static vn.edu.fpt.beefcare.domain.HealthObservationTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccinationTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class HealthObservationTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(HealthObservation.class);
        HealthObservation healthObservation1 = getHealthObservationSample1();
        HealthObservation healthObservation2 = new HealthObservation();
        assertThat(healthObservation1).isNotEqualTo(healthObservation2);

        healthObservation2.setId(healthObservation1.getId());
        assertThat(healthObservation1).isEqualTo(healthObservation2);

        healthObservation2 = getHealthObservationSample2();
        assertThat(healthObservation1).isNotEqualTo(healthObservation2);
    }

    @Test
    void healthCaseTest() {
        HealthObservation healthObservation = getHealthObservationRandomSampleGenerator();
        HealthCase healthCaseBack = getHealthCaseRandomSampleGenerator();

        healthObservation.setHealthCase(healthCaseBack);
        assertThat(healthObservation.getHealthCase()).isEqualTo(healthCaseBack);

        healthObservation.healthCase(null);
        assertThat(healthObservation.getHealthCase()).isNull();
    }

    @Test
    void vaccinationTest() {
        HealthObservation healthObservation = getHealthObservationRandomSampleGenerator();
        Vaccination vaccinationBack = getVaccinationRandomSampleGenerator();

        healthObservation.setVaccination(vaccinationBack);
        assertThat(healthObservation.getVaccination()).isEqualTo(vaccinationBack);

        healthObservation.vaccination(null);
        assertThat(healthObservation.getVaccination()).isNull();
    }
}
