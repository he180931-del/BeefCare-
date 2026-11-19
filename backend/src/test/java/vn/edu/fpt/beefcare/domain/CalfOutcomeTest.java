package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.CalfOutcomeTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CalvingEventTestSamples.*;
import static vn.edu.fpt.beefcare.domain.CattleTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class CalfOutcomeTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(CalfOutcome.class);
        CalfOutcome calfOutcome1 = getCalfOutcomeSample1();
        CalfOutcome calfOutcome2 = new CalfOutcome();
        assertThat(calfOutcome1).isNotEqualTo(calfOutcome2);

        calfOutcome2.setId(calfOutcome1.getId());
        assertThat(calfOutcome1).isEqualTo(calfOutcome2);

        calfOutcome2 = getCalfOutcomeSample2();
        assertThat(calfOutcome1).isNotEqualTo(calfOutcome2);
    }

    @Test
    void calvingTest() {
        CalfOutcome calfOutcome = getCalfOutcomeRandomSampleGenerator();
        CalvingEvent calvingEventBack = getCalvingEventRandomSampleGenerator();

        calfOutcome.setCalving(calvingEventBack);
        assertThat(calfOutcome.getCalving()).isEqualTo(calvingEventBack);

        calfOutcome.calving(null);
        assertThat(calfOutcome.getCalving()).isNull();
    }

    @Test
    void registeredCattleTest() {
        CalfOutcome calfOutcome = getCalfOutcomeRandomSampleGenerator();
        Cattle cattleBack = getCattleRandomSampleGenerator();

        calfOutcome.setRegisteredCattle(cattleBack);
        assertThat(calfOutcome.getRegisteredCattle()).isEqualTo(cattleBack);

        calfOutcome.registeredCattle(null);
        assertThat(calfOutcome.getRegisteredCattle()).isNull();
    }
}
