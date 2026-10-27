package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.FarmTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PlanVersionTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SubscriptionTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class SubscriptionTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Subscription.class);
        Subscription subscription1 = getSubscriptionSample1();
        Subscription subscription2 = new Subscription();
        assertThat(subscription1).isNotEqualTo(subscription2);

        subscription2.setId(subscription1.getId());
        assertThat(subscription1).isEqualTo(subscription2);

        subscription2 = getSubscriptionSample2();
        assertThat(subscription1).isNotEqualTo(subscription2);
    }

    @Test
    void farmTest() {
        Subscription subscription = getSubscriptionRandomSampleGenerator();
        Farm farmBack = getFarmRandomSampleGenerator();

        subscription.setFarm(farmBack);
        assertThat(subscription.getFarm()).isEqualTo(farmBack);

        subscription.farm(null);
        assertThat(subscription.getFarm()).isNull();
    }

    @Test
    void planVersionTest() {
        Subscription subscription = getSubscriptionRandomSampleGenerator();
        PlanVersion planVersionBack = getPlanVersionRandomSampleGenerator();

        subscription.setPlanVersion(planVersionBack);
        assertThat(subscription.getPlanVersion()).isEqualTo(planVersionBack);

        subscription.planVersion(null);
        assertThat(subscription.getPlanVersion()).isNull();
    }
}
