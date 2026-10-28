package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SubscriptionTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class FarmTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Farm.class);
        Farm farm1 = getFarmSample1();
        Farm farm2 = new Farm();
        assertThat(farm1).isNotEqualTo(farm2);

        farm2.setId(farm1.getId());
        assertThat(farm1).isEqualTo(farm2);

        farm2 = getFarmSample2();
        assertThat(farm1).isNotEqualTo(farm2);
    }

    @Test
    void subscriptionTest() {
        Farm farm = getFarmRandomSampleGenerator();
        Subscription subscriptionBack = getSubscriptionRandomSampleGenerator();

        farm.setSubscription(subscriptionBack);
        assertThat(farm.getSubscription()).isEqualTo(subscriptionBack);
        assertThat(subscriptionBack.getFarm()).isEqualTo(farm);

        farm.subscription(null);
        assertThat(farm.getSubscription()).isNull();
        assertThat(subscriptionBack.getFarm()).isNull();
    }
}
