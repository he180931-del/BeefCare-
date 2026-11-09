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

/** Run the same secured HTTP/readback contract on isolated PostgreSQL 16.15, including real migrations. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class SubscriptionOverviewPostgresIT extends SubscriptionOverviewResourceTest {
    @Autowired DataSource dataSource;

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        // Reuse the safe test clock/mail/job settings, replacing every database-specific setting with real PostgreSQL.
        DatabaseTestcontainer.databaseContainer.start();
        properties.add("spring.datasource.url", DatabaseTestcontainer.databaseContainer::getJdbcUrl);
        properties.add("spring.datasource.username", DatabaseTestcontainer.databaseContainer::getUsername);
        properties.add("spring.datasource.password", DatabaseTestcontainer.databaseContainer::getPassword);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @BeforeEach
    void requiresRealPostgres() throws java.sql.SQLException {
        try (var connection = dataSource.getConnection()) {
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
