package vn.edu.fpt.beefcare.service.email;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tech.jhipster.config.JHipsterProperties;

class ResendEmailDeliveryContextTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner()
        .withPropertyValues("beefcare.email.provider=resend", "beefcare.email.resend.api-key=re_test_token")
        .withBean(JHipsterProperties.class, JHipsterProperties::new)
        .withUserConfiguration(ResendEmailDelivery.class);

    @Test
    void startsWhenResendProviderIsSelected() {
        context.run(applicationContext -> {
            assertThat(applicationContext).hasNotFailed();
            assertThat(applicationContext).hasSingleBean(ResendEmailDelivery.class);
        });
    }
}
