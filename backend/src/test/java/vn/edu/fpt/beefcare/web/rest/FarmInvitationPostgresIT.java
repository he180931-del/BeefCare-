package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.util.UUID;
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

@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class FarmInvitationPostgresIT extends FarmInvitationTransactionTest {
    @Autowired DataSource dataSource;
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) { configure(p, "fe03_transactions_"); }

    static void configure(DynamicPropertyRegistry p, String prefix) {
        var database = DatabaseTestcontainer.databaseContainer; database.start();
        String schema = prefix + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword()); var statement = connection.createStatement()) {
            statement.execute("create schema " + schema);
        } catch (java.sql.SQLException failure) { throw new IllegalStateException("Cannot create isolated FE-03 test schema", failure); }
        String url = database.getJdbcUrl() + (database.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=" + schema;
        p.add("spring.datasource.url", () -> url); p.add("spring.datasource.username", database::getUsername); p.add("spring.datasource.password", database::getPassword);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver"); p.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        p.add("spring.liquibase.default-schema", () -> schema); p.add("spring.liquibase.liquibase-schema", () -> schema);
        p.add("spring.datasource.hikari.schema", () -> schema); p.add("spring.jpa.properties.hibernate.default_schema", () -> schema);
    }

    @BeforeEach
    void realPostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
