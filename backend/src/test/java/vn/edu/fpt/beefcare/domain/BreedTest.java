package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.BreedTestSamples.*;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class BreedTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Breed.class);
        Breed breed1 = getBreedSample1();
        Breed breed2 = new Breed();
        assertThat(breed1).isNotEqualTo(breed2);

        breed2.setId(breed1.getId());
        assertThat(breed1).isEqualTo(breed2);

        breed2 = getBreedSample2();
        assertThat(breed1).isNotEqualTo(breed2);
    }

    @Test
    void farmTest() {
        Breed breed = getBreedRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        breed.setFarm(farmBack);
        assertThat(breed.getFarm()).isEqualTo(farmBack);

        breed.farm(null);
        assertThat(breed.getFarm()).isNull();
    }
}
