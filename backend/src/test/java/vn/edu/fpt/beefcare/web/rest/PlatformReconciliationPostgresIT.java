package vn.edu.fpt.beefcare.web.rest;

import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/** UC-FE19-06 on real PostgreSQL migrations: varchar(1000) reason, return_date, review rows and locking. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class PlatformReconciliationPostgresIT extends PlatformReconciliationResourceTest {
    @Autowired DataSource dataSource;
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry registry) { SubscriptionPaymentRequestPostgresIT.configurePostgres(registry); }
    @BeforeEach
    void realPostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
