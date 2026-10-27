package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;
import static vn.edu.fpt.beefcare.domain.HerdEntryTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PenTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class HerdEntryTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(HerdEntry.class);
        HerdEntry herdEntry1 = getHerdEntrySample1();
        HerdEntry herdEntry2 = new HerdEntry();
        assertThat(herdEntry1).isNotEqualTo(herdEntry2);

        herdEntry2.setId(herdEntry1.getId());
        assertThat(herdEntry1).isEqualTo(herdEntry2);

        herdEntry2 = getHerdEntrySample2();
        assertThat(herdEntry1).isNotEqualTo(herdEntry2);
    }

    @Test
    void cattleTest() {
        HerdEntry herdEntry = getHerdEntryRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        herdEntry.setCattle(cattleBack);
        assertThat(herdEntry.getCattle()).isEqualTo(cattleBack);

        herdEntry.cattle(null);
        assertThat(herdEntry.getCattle()).isNull();
    }

    @Test
    void initialPenTest() {
        HerdEntry herdEntry = getHerdEntryRandomSampleGenerator();
        Pen penBack = getPenRandomSampleGenerator();

        herdEntry.setInitialPen(penBack);
        assertThat(herdEntry.getInitialPen()).isEqualTo(penBack);

        herdEntry.initialPen(null);
        assertThat(herdEntry.getInitialPen()).isNull();
    }
}
