package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ScheduledDoseTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccinationScheduleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.VaccinationTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ScheduledDoseTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(ScheduledDose.class);
        ScheduledDose scheduledDose1 = getScheduledDoseSample1();
        ScheduledDose scheduledDose2 = new ScheduledDose();
        assertThat(scheduledDose1).isNotEqualTo(scheduledDose2);

        scheduledDose2.setId(scheduledDose1.getId());
        assertThat(scheduledDose1).isEqualTo(scheduledDose2);

        scheduledDose2 = getScheduledDoseSample2();
        assertThat(scheduledDose1).isNotEqualTo(scheduledDose2);
    }

    @Test
    void vaccinationTest() {
        ScheduledDose scheduledDose = getScheduledDoseRandomSampleGenerator();
        Vaccination vaccinationBack = getVaccinationRandomSampleGenerator();

        scheduledDose.setVaccination(vaccinationBack);
        assertThat(scheduledDose.getVaccination()).isEqualTo(vaccinationBack);

        scheduledDose.vaccination(null);
        assertThat(scheduledDose.getVaccination()).isNull();
    }

    @Test
    void scheduleTest() {
        ScheduledDose scheduledDose = getScheduledDoseRandomSampleGenerator();
        VaccinationSchedule vaccinationScheduleBack = getVaccinationScheduleRandomSampleGenerator();

        scheduledDose.setSchedule(vaccinationScheduleBack);
        assertThat(scheduledDose.getSchedule()).isEqualTo(vaccinationScheduleBack);

        scheduledDose.schedule(null);
        assertThat(scheduledDose.getSchedule()).isNull();
    }

    @Test
    void cattleTest() {
        ScheduledDose scheduledDose = getScheduledDoseRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        scheduledDose.setCattle(cattleBack);
        assertThat(scheduledDose.getCattle()).isEqualTo(cattleBack);

        scheduledDose.cattle(null);
        assertThat(scheduledDose.getCattle()).isNull();
    }
}
