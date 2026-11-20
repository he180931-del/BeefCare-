package vn.edu.fpt.beefcare.web.rest;

import java.sql.DriverManager;
import java.util.UUID;
import org.springframework.test.context.DynamicPropertyRegistry;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;

/** Each UC7 test context owns a fresh schema; committed race fixtures cannot leak into HTTP/clock cases. */
final class PlanPricePostgresSupport {
    private PlanPricePostgresSupport() {}
    static void configure(DynamicPropertyRegistry p, String prefix) {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        String schema = prefix + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword()); var s = c.createStatement()) {
            s.execute("create schema " + schema);
        } catch (java.sql.SQLException failure) { throw new IllegalStateException("Cannot create isolated UC7 test schema", failure); }
        String url = container.getJdbcUrl() + (container.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=" + schema;
        p.add("spring.datasource.url", () -> url); p.add("spring.datasource.username", container::getUsername); p.add("spring.datasource.password", container::getPassword);
        p.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver"); p.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        p.add("spring.liquibase.default-schema", () -> schema); p.add("spring.liquibase.liquibase-schema", () -> schema);
        p.add("spring.datasource.hikari.schema", () -> schema);
        p.add("spring.jpa.properties.hibernate.default_schema", () -> schema);
    }
}
