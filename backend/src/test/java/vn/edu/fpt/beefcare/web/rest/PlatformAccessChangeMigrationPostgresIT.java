package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
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

/**
 * D33 / UC-FE03-09 (TC-03-97): upgrading from the UC8 schema copies the platform access changes kept only in the audit into
 * {@code platform_access_change} (NONE → null, missing reason → placeholder, missing actor kept null); account status
 * entries and unreadable details are skipped; the audit rows stay unchanged.
 */
class PlatformAccessChangeMigrationPostgresIT {
    @Test
    @Timeout(value = 120, unit = TimeUnit.SECONDS)
    void upgradeCopiesPlatformAccessChangesFromTheAudit() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        var folder = Files.createTempDirectory("beefcare-fe03-uc09-upgrade-"); var before = folder.resolve("before.xml");
        String migration = "config/liquibase/changelog/20261114000500_platform_access_change.xml";
        try (var source = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(migration);
            Files.writeString(before, master.lines().filter(line -> !line.contains(migration)).collect(Collectors.joining("\n")));
        }
        String schema = "fe03_uc09_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var s = c.createStatement()) { s.execute("create schema " + schema); s.execute("set search_path to " + schema); }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            database.setDefaultSchemaName(schema); database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var s = c.createStatement()) {
                s.execute("insert into app_user(id,email,full_name,account_status,version) values "
                    + "(74001,'staff@uc9.test','Nhân sự','ACTIVE',0),(74002,'sa@uc9.test','Quản trị','ACTIVE',0)");
                s.execute("insert into audit_log(id,action,target_type,target_id,logged_at,actor_id,details) values "
                    + "(74101,'PLATFORM_ACCESS_GRANT','AppUser',74001,'2026-11-01 08:00:00',74002,'{\"fromRole\":\"NONE\",\"fromStatus\":\"NONE\",\"toRole\":\"CS\",\"toStatus\":\"ACTIVE\",\"reason\":\" Bổ sung nhân sự \"}'),"
                    + "(74102,'PLATFORM_ACCESS_REVOKE','AppUser',74001,'2026-11-02 08:00:00',74002,'{\"toStatus\":\"REVOKED\",\"fromRole\":\"CS\",\"reason\":\"Nghỉ việc\",\"fromStatus\":\"ACTIVE\",\"toRole\":\"CS\"}'),"
                    + "(74103,'ACCOUNT_SUSPEND','AppUser',74001,'2026-11-03 08:00:00',74002,'{\"from\":\"ACTIVE\",\"to\":\"SUSPENDED\",\"reason\":\"Nghi ngờ\"}'),"
                    + "(74104,'PLATFORM_ACCESS_RESTORE','AppUser',74001,'2026-11-04 08:00:00',null,'{\"fromRole\":\"CS\",\"fromStatus\":\"REVOKED\",\"toRole\":\"CS\",\"toStatus\":\"ACTIVE\"}'),"
                    + "(74105,'PLATFORM_ACCESS_GRANT','AppUser',74001,'2026-11-05 08:00:00',74002,'không phải JSON')");
            }
            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());

            List<String> rows = new ArrayList<>();
            try (var s = c.createStatement(); var r = s.executeQuery(
                "select action, coalesce(role_before,'-'), coalesce(status_before,'-'), role_after, status_after, reason, coalesce(changed_by_id::text,'-'), changed_at "
                    + "from platform_access_change where app_user_id = 74001 order by changed_at")) {
                while (r.next()) rows.add(String.join("|", r.getString(1), r.getString(2), r.getString(3), r.getString(4), r.getString(5), r.getString(6), r.getString(7), r.getString(8)));
            }
            assertThat(rows).containsExactly(
                "GRANT|-|-|CS|ACTIVE|Bổ sung nhân sự|74002|2026-11-01 08:00:00",
                "REVOKE|CS|ACTIVE|CS|REVOKED|Nghỉ việc|74002|2026-11-02 08:00:00",
                "RESTORE|CS|REVOKED|CS|ACTIVE|(không ghi lý do)|-|2026-11-04 08:00:00"
            );
            try (var s = c.createStatement(); var r = s.executeQuery("select count(*) from audit_log where id between 74101 and 74105")) {
                assertThat(r.next()).isTrue(); assertThat(r.getInt(1)).isEqualTo(5);
            }
            try (var s = c.createStatement(); var r = s.executeQuery("select details from audit_log where id = 74102")) {
                assertThat(r.next()).isTrue(); assertThat(r.getString(1)).contains("Nghỉ việc");
            }
            // New rows inserted after the upgrade get ids from the shared sequence.
            try (var s = c.createStatement(); var r = s.executeQuery("select min(id) > 0 from platform_access_change")) {
                assertThat(r.next()).isTrue(); assertThat(r.getBoolean(1)).isTrue();
            }
        } finally { Files.deleteIfExists(before); Files.deleteIfExists(folder); }
    }
}
