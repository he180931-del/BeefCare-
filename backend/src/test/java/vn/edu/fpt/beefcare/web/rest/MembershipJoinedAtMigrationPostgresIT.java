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
 * D29 / UC-FE03-05: upgrading from the UC4 schema gives every existing membership a joined time from the best source
 * (acceptance audit, farm registration audit for the Owner, accepted invitation, last effective date) and then makes it
 * mandatory. Role, status, effective date and version stay unchanged.
 */
class MembershipJoinedAtMigrationPostgresIT {
    @Test
    @Timeout(value = 120, unit = TimeUnit.SECONDS)
    void upgradeFillsTheJoinedTimeOfExistingMembershipsFromTheBestSource() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        var folder = Files.createTempDirectory("beefcare-fe03-uc05-upgrade-"); var before = folder.resolve("before.xml");
        String migration = "config/liquibase/changelog/20261114000100_membership_joined_at.xml";
        try (var source = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(migration);
            Files.writeString(before, master.lines().filter(line -> !line.contains(migration)).collect(Collectors.joining("\n")));
        }
        String schema = "fe03_uc05_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var s = c.createStatement()) { s.execute("create schema " + schema); s.execute("set search_path to " + schema); }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            database.setDefaultSchemaName(schema); database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var s = c.createStatement()) {
                s.execute("insert into app_user(id,email,full_name,account_status,version) values "
                    + "(72001,'owner@uc5.test','Owner A','ACTIVE',0),(72002,'manager@uc5.test','Manager','ACTIVE',0),"
                    + "(72003,'Tech@UC5.test','Tech accepted','ACTIVE',0),(72004,'old@uc5.test','Old member','ACTIVE',0),(72005,'ownerb@uc5.test','Owner B','ACTIVE',0)");
                s.execute("insert into farm(id,name,location,contact,service_status,version) values "
                    + "(72010,'Farm A','Dong Nai','0900000000','ACTIVE',0),(72011,'Farm B','Dong Nai','0900000000','EXPIRED',0)");
                s.execute("insert into farm_membership(id,role,status,farm_id,user_id,effective_date,change_reason,version) values "
                    + "(72020,'OWNER','ACTIVE',72010,72001,'2026-11-01',null,0),"
                    + "(72021,'MANAGER','ACTIVE',72010,72002,'2026-11-02','Promoted',3),"
                    + "(72022,'TECHNICIAN','ACTIVE',72010,72003,'2026-11-03',null,0),"
                    + "(72023,'TECHNICIAN','INACTIVE',72010,72004,'2025-06-15','Left',2),"
                    + "(72024,'OWNER','ACTIVE',72011,72005,'2025-01-20',null,0)");
                // Two registration entries: the earliest is the registration; the acceptance audit wins over the effective date.
                s.execute("insert into audit_log(id,action,target_type,target_id,logged_at,actor_id,farm_id) values "
                    + "(72030,'FARM_REGISTER','Farm',72010,'2024-03-05 02:00:00',72001,72010),"
                    + "(72031,'FARM_REGISTER','Farm',72010,'2024-04-01 02:00:00',72001,72010),"
                    + "(72032,'MEMBER_ACCEPT','FarmMembership',72021,'2024-05-07 03:30:00',72002,72010),"
                    + "(72033,'MEMBER_CHANGE_ROLE','FarmMembership',72021,'2026-11-02 03:30:00',72001,72010)");
                // The email of the invitation differs only in letter case from the account.
                s.execute("insert into farm_invitation(id,invited_email,proposed_role,status,expires_at,farm_id,accepted_at) values "
                    + "(72040,'tech@uc5.test','TECHNICIAN','ACCEPTED','2025-09-08 00:00:00',72010,'2025-09-02 01:15:00'),"
                    + "(72041,'tech@uc5.test','TECHNICIAN','CANCELLED','2025-08-08 00:00:00',72010,null)");
            }
            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());

            Map<Long, LocalDateTime> joined = new LinkedHashMap<>();
            try (var s = c.createStatement(); var r = s.executeQuery("select id,joined_at,role,status,effective_date,version from farm_membership where id between 72020 and 72024 order by id")) {
                while (r.next()) joined.put(r.getLong(1), r.getObject(2, LocalDateTime.class));
            }
            assertThat(joined).containsExactly(
                Map.entry(72020L, LocalDateTime.parse("2024-03-05T02:00:00")),
                Map.entry(72021L, LocalDateTime.parse("2024-05-07T03:30:00")),
                Map.entry(72022L, LocalDateTime.parse("2025-09-02T01:15:00")),
                Map.entry(72023L, LocalDateTime.parse("2025-06-15T00:00:00")),
                Map.entry(72024L, LocalDateTime.parse("2025-01-20T00:00:00"))
            );
            try (var s = c.createStatement(); var r = s.executeQuery("select role,status,effective_date,change_reason,version from farm_membership where id=72021")) {
                assertThat(r.next()).isTrue();
                assertThat(r.getString(1)).isEqualTo("MANAGER"); assertThat(r.getString(2)).isEqualTo("ACTIVE");
                assertThat(r.getString(3)).isEqualTo("2026-11-02"); assertThat(r.getString(4)).isEqualTo("Promoted"); assertThat(r.getInt(5)).isEqualTo(3);
            }
            try (var s = c.createStatement(); var r = s.executeQuery("select is_nullable from information_schema.columns where table_schema='" + schema + "' and table_name='farm_membership' and column_name='joined_at'")) {
                assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("NO");
            }
        } finally { Files.deleteIfExists(before); Files.deleteIfExists(folder); }
    }
}
