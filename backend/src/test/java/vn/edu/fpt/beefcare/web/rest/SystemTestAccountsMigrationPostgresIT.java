package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.DriverManager;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import liquibase.resource.CompositeResourceAccessor;
import liquibase.resource.DirectoryResourceAccessor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;

class SystemTestAccountsMigrationPostgresIT {

    private static final String MIGRATION = "config/liquibase/changelog/20261121000200_system_test_accounts.xml";

    @Test
    @Timeout(value = 120, unit = TimeUnit.SECONDS)
    void upgradeCreatesPasswordAccountsForEverySystemTestRoleAndAnOwnerFarm() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer;
        container.start();
        var folder = Files.createTempDirectory("beefcare-system-test-accounts-");
        var before = folder.resolve("before.xml");
        try (var source = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(MIGRATION);
            Files.writeString(before, master.lines().filter(line -> !line.contains(MIGRATION)).collect(Collectors.joining("\n")));
        }

        String schema = "system_test_accounts_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var statement = connection.createStatement()) {
                statement.execute("create schema " + schema);
                statement.execute("set search_path to " + schema);
            }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            database.setDefaultSchemaName(schema);
            database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());

            try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                select u.login, u.activated, u.password_hash, a.password_login_enabled, a.account_status,
                       coalesce(p.role, 'OWNER') as role, coalesce(m.role, 'NONE') as farm_role, f.name
                from jhi_user u
                join app_user a on lower(a.email) = lower(u.email)
                left join platform_staff_access p on p.user_id = a.id
                left join farm_membership m on m.user_id = a.id
                left join farm f on f.id = m.farm_id
                where u.login in ('owner@beefcare.test', 'cs@beefcare.test', 'pm@beefcare.test', 'sa@beefcare.test')
                order by u.login
                """)) {
                java.util.Map<String, String> roles = new java.util.LinkedHashMap<>();
                while (rows.next()) {
                    assertThat(rows.getBoolean("activated")).isTrue();
                    assertThat(rows.getString("password_hash")).startsWith("$2");
                    assertThat(rows.getBoolean("password_login_enabled")).isTrue();
                    assertThat(rows.getString("account_status")).isEqualTo("ACTIVE");
                    if ("owner@beefcare.test".equals(rows.getString("login"))) {
                        assertThat(rows.getString("farm_role")).isEqualTo("OWNER");
                        assertThat(rows.getString("name")).isEqualTo("BeefCare Production Test Farm");
                    }
                    roles.put(rows.getString("login"), rows.getString("role"));
                }
                assertThat(roles).containsExactly(
                    java.util.Map.entry("cs@beefcare.test", "CS"),
                    java.util.Map.entry("owner@beefcare.test", "OWNER"),
                    java.util.Map.entry("pm@beefcare.test", "PM"),
                    java.util.Map.entry("sa@beefcare.test", "SA")
                );
            }
        } finally {
            Files.deleteIfExists(before);
            Files.deleteIfExists(folder);
        }
    }
}
