package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CashReportSnapshotTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class CashReportSnapshotTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(CashReportSnapshot.class);
        CashReportSnapshot cashReportSnapshot1 = getCashReportSnapshotSample1();
        CashReportSnapshot cashReportSnapshot2 = new CashReportSnapshot();
        assertThat(cashReportSnapshot1).isNotEqualTo(cashReportSnapshot2);

        cashReportSnapshot2.setId(cashReportSnapshot1.getId());
        assertThat(cashReportSnapshot1).isEqualTo(cashReportSnapshot2);

        cashReportSnapshot2 = getCashReportSnapshotSample2();
        assertThat(cashReportSnapshot1).isNotEqualTo(cashReportSnapshot2);
    }

    @Test
    void pmUserTest() {
        CashReportSnapshot cashReportSnapshot = getCashReportSnapshotRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        cashReportSnapshot.setPmUser(appUserBack);
        assertThat(cashReportSnapshot.getPmUser()).isEqualTo(appUserBack);

        cashReportSnapshot.pmUser(null);
        assertThat(cashReportSnapshot.getPmUser()).isNull();
    }

    @Test
    void farmTest() {
        CashReportSnapshot cashReportSnapshot = getCashReportSnapshotRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        cashReportSnapshot.setFarm(farmBack);
        assertThat(cashReportSnapshot.getFarm()).isEqualTo(farmBack);

        cashReportSnapshot.farm(null);
        assertThat(cashReportSnapshot.getFarm()).isNull();
    }
}
