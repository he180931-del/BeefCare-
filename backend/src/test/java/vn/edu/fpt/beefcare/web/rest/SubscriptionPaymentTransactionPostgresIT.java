package vn.edu.fpt.beefcare.web.rest;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class SubscriptionPaymentTransactionPostgresIT extends SubscriptionPaymentRequestTransactionTest {
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) { SubscriptionPaymentRequestPostgresIT.configurePostgres(p); }
}
