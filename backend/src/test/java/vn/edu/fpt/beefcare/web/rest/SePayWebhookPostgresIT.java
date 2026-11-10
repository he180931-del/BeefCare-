package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;

/** The same signed HTTP, worker, rollback, race and mail contract on PostgreSQL16.15, in a fresh owned schema. */
class SePayWebhookPostgresIT extends SePayWebhookResourceTest {
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry p) {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        String schema = "uc8_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword()); var statement = c.createStatement()) {
            statement.execute("create schema " + schema);
        } catch (java.sql.SQLException failure) { throw new IllegalStateException("Cannot create isolated UC8 test schema", failure); }
        String url = container.getJdbcUrl() + (container.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=" + schema;
        p.add("spring.datasource.url", () -> url); p.add("spring.datasource.username", container::getUsername); p.add("spring.datasource.password", container::getPassword);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver"); p.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        p.add("spring.liquibase.default-schema", () -> schema); p.add("spring.liquibase.liquibase-schema", () -> schema);
        p.add("spring.datasource.hikari.schema", () -> schema); p.add("spring.jpa.properties.hibernate.default_schema", () -> schema);
    }

    @BeforeEach
    void realPostgres() { assertThat(sql.queryForObject("select version()", String.class)).startsWith("PostgreSQL 16.15"); }
}
