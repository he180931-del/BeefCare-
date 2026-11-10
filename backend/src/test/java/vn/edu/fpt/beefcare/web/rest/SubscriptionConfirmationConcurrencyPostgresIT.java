package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;

/**
 * The farm-lock contract on real PostgreSQL row locks. The threads commit their data, so the class runs in its own
 * schema of the shared container and never changes what the other PostgreSQL tests count.
 */
@ActiveProfiles(value = "testh2", inheritProfiles = false)
class SubscriptionConfirmationConcurrencyPostgresIT extends SubscriptionConfirmationConcurrencyTest {
    private static final String SCHEMA = "uc6_concurrency";

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) {
        var container = DatabaseTestcontainer.databaseContainer;
        container.start();
        p.add("spring.datasource.url", () -> {
            try (var connection = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
                 var sql = connection.createStatement()) {
                sql.execute("create schema if not exists " + SCHEMA);
            } catch (java.sql.SQLException failure) {
                throw new IllegalStateException(failure);
            }
            String url = container.getJdbcUrl();
            return url + (url.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA;
        });
        p.add("spring.datasource.username", container::getUsername);
        p.add("spring.datasource.password", container::getPassword);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        p.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @BeforeEach
    void realPostgresInItsOwnSchema() throws Exception {
        try (var connection = dataSource.getConnection(); var sql = connection.createStatement(); var row = sql.executeQuery("select current_schema()")) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
            assertThat(row.next()).isTrue();
            assertThat(row.getString(1)).isEqualTo(SCHEMA);
        }
    }
}
