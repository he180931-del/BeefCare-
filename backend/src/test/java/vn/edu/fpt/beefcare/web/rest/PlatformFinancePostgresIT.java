package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/** Runs the same FE21 HTTP/database workflow against the real PostgreSQL 16.15 schema. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class PlatformFinancePostgresIT extends PlatformFinanceResourceTest {
    @Autowired DataSource dataSource;

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        DatabaseTestcontainer.databaseContainer.start();
        properties.add("spring.datasource.url", DatabaseTestcontainer.databaseContainer::getJdbcUrl);
        properties.add("spring.datasource.username", DatabaseTestcontainer.databaseContainer::getUsername);
        properties.add("spring.datasource.password", DatabaseTestcontainer.databaseContainer::getPassword);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @BeforeEach
    void assertPostgres16() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
