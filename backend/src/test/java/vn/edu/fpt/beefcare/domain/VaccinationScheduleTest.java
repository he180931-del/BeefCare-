package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccinationScheduleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccineTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class VaccinationScheduleTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(VaccinationSchedule.class);
        VaccinationSchedule vaccinationSchedule1 = getVaccinationScheduleSample1();
        VaccinationSchedule vaccinationSchedule2 = new VaccinationSchedule();
        assertThat(vaccinationSchedule1).isNotEqualTo(vaccinationSchedule2);

        vaccinationSchedule2.setId(vaccinationSchedule1.getId());
        assertThat(vaccinationSchedule1).isEqualTo(vaccinationSchedule2);

        vaccinationSchedule2 = getVaccinationScheduleSample2();
        assertThat(vaccinationSchedule1).isNotEqualTo(vaccinationSchedule2);
    }

    @Test
    void farmTest() {
        VaccinationSchedule vaccinationSchedule = getVaccinationScheduleRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        vaccinationSchedule.setFarm(farmBack);
        assertThat(vaccinationSchedule.getFarm()).isEqualTo(farmBack);

        vaccinationSchedule.farm(null);
        assertThat(vaccinationSchedule.getFarm()).isNull();
    }

    @Test
    void vaccineTest() {
        VaccinationSchedule vaccinationSchedule = getVaccinationScheduleRandomSampleGenerator();
        Vaccine vaccineBack = getVaccineRandomSampleGenerator();

        vaccinationSchedule.setVaccine(vaccineBack);
        assertThat(vaccinationSchedule.getVaccine()).isEqualTo(vaccineBack);

        vaccinationSchedule.vaccine(null);
        assertThat(vaccinationSchedule.getVaccine()).isNull();
    }
}
