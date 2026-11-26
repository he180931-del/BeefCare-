package vn.edu.fpt.beefcare.web.rest;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.junit.jupiter.api.BeforeEach;
import javax.sql.DataSource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/** Identical secured HTTP/readback cases on PostgreSQL 16.15 with real migrations. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class SubscriptionPaymentRequestPostgresIT extends SubscriptionPaymentRequestResourceTest {
    @Autowired DataSource dataSource;
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) { configurePostgres(p); }
    static void configurePostgres(DynamicPropertyRegistry p) {
        DatabaseTestcontainer.databaseContainer.start();
        p.add("spring.datasource.url", DatabaseTestcontainer.databaseContainer::getJdbcUrl);
        p.add("spring.datasource.username", DatabaseTestcontainer.databaseContainer::getUsername);
        p.add("spring.datasource.password", DatabaseTestcontainer.databaseContainer::getPassword);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }
    @BeforeEach
    void realPostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
