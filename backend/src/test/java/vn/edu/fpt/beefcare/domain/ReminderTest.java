package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ReminderTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ReminderTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Reminder.class);
        Reminder reminder1 = getReminderSample1();
        Reminder reminder2 = new Reminder();
        assertThat(reminder1).isNotEqualTo(reminder2);

        reminder2.setId(reminder1.getId());
        assertThat(reminder1).isEqualTo(reminder2);

        reminder2 = getReminderSample2();
        assertThat(reminder1).isNotEqualTo(reminder2);
    }

    @Test
    void farmTest() {
        Reminder reminder = getReminderRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        reminder.setFarm(farmBack);
        assertThat(reminder.getFarm()).isEqualTo(farmBack);

        reminder.farm(null);
        assertThat(reminder.getFarm()).isNull();
    }

    @Test
    void cattleTest() {
        Reminder reminder = getReminderRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        reminder.setCattle(cattleBack);
        assertThat(reminder.getCattle()).isEqualTo(cattleBack);

        reminder.cattle(null);
        assertThat(reminder.getCattle()).isNull();
    }
}
