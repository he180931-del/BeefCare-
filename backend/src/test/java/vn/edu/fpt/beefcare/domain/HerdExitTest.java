package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.HerdExitTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class HerdExitTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(HerdExit.class);
        HerdExit herdExit1 = getHerdExitSample1();
        HerdExit herdExit2 = new HerdExit();
        assertThat(herdExit1).isNotEqualTo(herdExit2);

        herdExit2.setId(herdExit1.getId());
        assertThat(herdExit1).isEqualTo(herdExit2);

        herdExit2 = getHerdExitSample2();
        assertThat(herdExit1).isNotEqualTo(herdExit2);
    }

    @Test
    void cattleTest() {
        HerdExit herdExit = getHerdExitRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        herdExit.setCattle(cattleBack);
        assertThat(herdExit.getCattle()).isEqualTo(cattleBack);

        herdExit.cattle(null);
        assertThat(herdExit.getCattle()).isNull();
    }

    @Test
    void confirmedByTest() {
        HerdExit herdExit = getHerdExitRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        herdExit.setConfirmedBy(appUserBack);
        assertThat(herdExit.getConfirmedBy()).isEqualTo(appUserBack);

        herdExit.confirmedBy(null);
        assertThat(herdExit.getConfirmedBy()).isNull();
    }
}
