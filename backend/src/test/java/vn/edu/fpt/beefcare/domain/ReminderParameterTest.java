package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ReminderParameterTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ReminderParameterTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(ReminderParameter.class);
        ReminderParameter reminderParameter1 = getReminderParameterSample1();
        ReminderParameter reminderParameter2 = new ReminderParameter();
        assertThat(reminderParameter1).isNotEqualTo(reminderParameter2);

        reminderParameter2.setId(reminderParameter1.getId());
        assertThat(reminderParameter1).isEqualTo(reminderParameter2);

        reminderParameter2 = getReminderParameterSample2();
        assertThat(reminderParameter1).isNotEqualTo(reminderParameter2);
    }

    @Test
    void farmTest() {
        ReminderParameter reminderParameter = getReminderParameterRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        reminderParameter.setFarm(farmBack);
        assertThat(reminderParameter.getFarm()).isEqualTo(farmBack);

        reminderParameter.farm(null);
        assertThat(reminderParameter.getFarm()).isNull();
    }
}
