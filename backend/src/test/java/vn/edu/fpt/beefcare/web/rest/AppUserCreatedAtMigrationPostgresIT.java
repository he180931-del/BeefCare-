package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.DriverManager;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
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
 * D31 / UC-FE03-07 (TC-03-81): upgrading from the UC6 schema gives every existing account a created time from the best
 * source (sign-in identity of the same email, earliest linked sign-in method, terms acceptance, migration time), then
 * makes it mandatory with a default for rows inserted outside JPA. Other account columns stay unchanged.
 */
class AppUserCreatedAtMigrationPostgresIT {
    @Test
    @Timeout(value = 120, unit = TimeUnit.SECONDS)
    void upgradeFillsTheCreatedTimeOfExistingAccountsFromTheBestSource() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        var folder = Files.createTempDirectory("beefcare-fe03-uc07-upgrade-"); var before = folder.resolve("before.xml");
        String migration = "config/liquibase/changelog/20261114000300_app_user_created_at.xml";
        try (var source = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(migration);
            Files.writeString(before, master.lines().filter(line -> !line.contains(migration)).collect(Collectors.joining("\n")));
        }
        String schema = "fe03_uc07_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var s = c.createStatement()) { s.execute("create schema " + schema); s.execute("set search_path to " + schema); }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            database.setDefaultSchemaName(schema); database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var s = c.createStatement()) {
                s.execute("insert into app_user(id,email,full_name,account_status,version,password_linked_at,google_linked_at,terms_accepted,terms_accepted_at) values "
                    // the identity created with the account wins over a later linked method (email differs in letter case)
                    + "(73001,'Match@UC7.test','Có identity','ACTIVE',4,'2026-01-01 00:00:00',null,false,null),"
                    + "(73002,'google@uc7.test','Chỉ Google','SUSPENDED',1,null,'2025-03-01 01:00:00',false,null),"
                    + "(73003,'both@uc7.test','Hai cách','ACTIVE',0,'2025-04-02 00:00:00','2025-04-01 08:00:00',false,null),"
                    + "(73004,'terms@uc7.test','Chỉ điều khoản','ACTIVE',0,null,null,true,'2025-05-05 05:05:00'),"
                    + "(73005,'none@uc7.test','Không nguồn','ACTIVE',0,null,null,false,null),"
                    + "(73006,'nodate@uc7.test','Identity không ngày','ACTIVE',0,'2025-06-06 06:00:00',null,false,null)");
                s.execute("insert into jhi_user(id,login,password_hash,email,activated,created_by,created_date) values "
                    + "(73101,'match-uc7','" + "x".repeat(60) + "','match@uc7.test',true,'system','2025-02-03 04:05:06'),"
                    + "(73102,'nodate-uc7','" + "x".repeat(60) + "','nodate@uc7.test',true,'system',null)");
            }
            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());

            Map<Long, LocalDateTime> created = new LinkedHashMap<>();
            try (var s = c.createStatement(); var r = s.executeQuery("select id,created_at from app_user where id between 73001 and 73004 or id = 73006 order by id")) {
                while (r.next()) created.put(r.getLong(1), r.getObject(2, LocalDateTime.class));
            }
            assertThat(created).containsExactly(
                Map.entry(73001L, LocalDateTime.parse("2025-02-03T04:05:06")),
                Map.entry(73002L, LocalDateTime.parse("2025-03-01T01:00:00")),
                Map.entry(73003L, LocalDateTime.parse("2025-04-01T08:00:00")),
                Map.entry(73004L, LocalDateTime.parse("2025-05-05T05:05:00")),
                Map.entry(73006L, LocalDateTime.parse("2025-06-06T06:00:00"))
            );
            // No source at all: the time of the upgrade.
            try (var s = c.createStatement(); var r = s.executeQuery("select created_at >= now() - interval '10 minutes' and created_at <= now() from app_user where id = 73005")) {
                assertThat(r.next()).isTrue(); assertThat(r.getBoolean(1)).isTrue();
            }
            try (var s = c.createStatement(); var r = s.executeQuery("select full_name,account_status,version from app_user where id = 73002")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getString(1)).isEqualTo("Chỉ Google"); assertThat(r.getString(2)).isEqualTo("SUSPENDED"); assertThat(r.getInt(3)).isEqualTo(1);
            }
            try (var s = c.createStatement(); var r = s.executeQuery("select is_nullable, column_default from information_schema.columns where table_schema='" + schema + "' and table_name='app_user' and column_name='created_at'")) {
                assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("NO"); assertThat(r.getString(2)).isNotBlank();
            }
            // A row inserted outside JPA still gets a created time.
            try (var s = c.createStatement()) {
                s.execute("insert into app_user(id,email,full_name,account_status,version) values (73007,'later@uc7.test','Sau nâng cấp','ACTIVE',0)");
                try (var r = s.executeQuery("select created_at from app_user where id = 73007")) {
                    assertThat(r.next()).isTrue(); assertThat(r.getObject(1, LocalDateTime.class)).isNotNull();
                }
            }
        } finally { Files.deleteIfExists(before); Files.deleteIfExists(folder); }
    }
}
