package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.ManualFinanceRecordTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class ManualFinanceRecordTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(ManualFinanceRecord.class);
        ManualFinanceRecord manualFinanceRecord1 = getManualFinanceRecordSample1();
        ManualFinanceRecord manualFinanceRecord2 = new ManualFinanceRecord();
        assertThat(manualFinanceRecord1).isNotEqualTo(manualFinanceRecord2);

        manualFinanceRecord2.setId(manualFinanceRecord1.getId());
        assertThat(manualFinanceRecord1).isEqualTo(manualFinanceRecord2);

        manualFinanceRecord2 = getManualFinanceRecordSample2();
        assertThat(manualFinanceRecord1).isNotEqualTo(manualFinanceRecord2);
    }

    @Test
    void farmTest() {
        ManualFinanceRecord manualFinanceRecord = getManualFinanceRecordRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        manualFinanceRecord.setFarm(farmBack);
        assertThat(manualFinanceRecord.getFarm()).isEqualTo(farmBack);

        manualFinanceRecord.farm(null);
        assertThat(manualFinanceRecord.getFarm()).isNull();
    }
}
