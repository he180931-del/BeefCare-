package vn.edu.fpt.beefcare.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.edu.fpt.beefcare.domain.AppUserTestSamples.*;
import static vn.edu.fpt.beefcare.domain.PaymentTestSamples.*;
import static vn.edu.fpt.beefcare.domain.SubscriptionTestSamples.*;

import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.web.rest.TestUtil;

class PaymentTest {

    @Test
    void equalsVerifier() throws Exception {
        TestUtil.equalsVerifier(Payment.class);
        Payment payment1 = getPaymentSample1();
        Payment payment2 = new Payment();
        assertThat(payment1).isNotEqualTo(payment2);

        payment2.setId(payment1.getId());
        assertThat(payment1).isEqualTo(payment2);

        payment2 = getPaymentSample2();
        assertThat(payment1).isNotEqualTo(payment2);
    }

    @Test
    void subscriptionTest() {
        Payment payment = getPaymentRandomSampleGenerator();
        Subscription subscriptionBack = getSubscriptionRandomSampleGenerator();

        payment.setSubscription(subscriptionBack);
        assertThat(payment.getSubscription()).isEqualTo(subscriptionBack);

        payment.subscription(null);
        assertThat(payment.getSubscription()).isNull();
    }

    @Test
    void requestedByTest() {
        Payment payment = getPaymentRandomSampleGenerator();
        AppUser appUserBack = getAppUserRandomSampleGenerator();

        payment.setRequestedBy(appUserBack);
        assertThat(payment.getRequestedBy()).isEqualTo(appUserBack);

        payment.requestedBy(null);
        assertThat(payment.getRequestedBy()).isNull();
    }
}
