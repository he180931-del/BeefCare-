package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
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

/** Upgrade the entire previous schema, not an artificial table or an empty database. */
class PlanPriceMigrationPostgresIT {
    /** Two complete Liquibase runs (previous schema, then upgrade) exceed the 15 s project default on a loaded machine/CI. */
    @Test
    @Timeout(value = 120, unit = TimeUnit.SECONDS)
    void preservesLegacyQuotesAndBackfillsOnlyRealPublicationAuditMetadata() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        var folder = Files.createTempDirectory("beefcare-uc7-upgrade-"); var before = folder.resolve("before.xml");
        String migration = "config/liquibase/changelog/20261110000300_plan_price_publication.xml";
        try (var stream = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(stream).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(migration);
            Files.writeString(before, master.replaceAll("(?m)^.*<include file=\"" + migration + "\"[^\\n]*\\n", ""));
        }
        String schema = "uc7_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var sql = c.createStatement()) { sql.execute("create schema " + schema); sql.execute("set search_path to " + schema); }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            database.setDefaultSchemaName(schema); database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var sql = c.createStatement()) {
                sql.execute("insert into app_user(id,email,full_name,account_status,version) values (70001,'legacy@uc7.test','Legacy PM','ACTIVE',0)");
                sql.execute("insert into farm(id,name,location,contact,service_status,version) values (70002,'Legacy farm','Dong Nai','0900000000','PENDING_PAYMENT',0)");
                sql.execute("insert into plan_version(id,price_1_y,price_2_y,price_3_y,terms,effective_at) values (70003,1200000,2160000,3060000,'Legacy terms','2026-01-01T00:00:00Z'),(70004,1300000,2300000,3300000,null,'2026-12-01T00:00:00Z')");
                sql.execute("insert into audit_log(id,actor_id,action,target_type,target_id,logged_at) values (70005,70001,'PLAN_PRICE_PUBLISH','PlanVersion',70003,'2025-12-25T07:30:00Z')");
                sql.execute("insert into subscription(id,farm_id,plan_version_id,entitlement_status) values (70006,70002,70003,'PENDING')");
                sql.execute("insert into payment(id,quote_ref,duration_years,amount_vnd,state,expires_at,subscription_id,requested_by_id,price_version_id,requested_at,version) values (70007,'UC7LEGACY',1,1200000,'PENDING','2026-11-10T03:00:00Z',70006,70001,70003,'2026-11-09T03:00:00Z',0)");
            }
            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var sql = c.createStatement(); var r = sql.executeQuery("select p.price_1_y,p.terms,p.published_by_id,p.published_at,p.revision,q.price_version_id,q.amount_vnd from plan_version p join payment q on q.price_version_id=p.id where q.id=70007")) {
                assertThat(r.next()).isTrue(); assertThat(r.getBigDecimal(1)).isEqualByComparingTo("1200000"); assertThat(r.getString(2)).isEqualTo("Legacy terms");
                assertThat(r.getLong(3)).isEqualTo(70001); assertThat(r.getTimestamp(4).toInstant()).isEqualTo(Instant.parse("2025-12-25T07:30:00Z"));
                assertThat(r.getLong(5)).isZero(); assertThat(r.getLong(6)).isEqualTo(70003); assertThat(r.getBigDecimal(7)).isEqualByComparingTo("1200000");
            }
            try (var sql = c.createStatement(); var r = sql.executeQuery("select published_by_id,published_at,withdrawn_at from plan_version where id=70004")) {
                assertThat(r.next()).isTrue(); assertThat(r.getObject(1)).isNull(); assertThat(r.getObject(2)).isNull(); assertThat(r.getObject(3)).isNull();
            }
            try (var statement = c.prepareStatement("update plan_version set terms=?,withdraw_reason=? where id=70004")) {
                statement.setString(1, "x".repeat(500)); statement.setString(2, "y".repeat(1000)); assertThat(statement.executeUpdate()).isEqualTo(1);
            }
            try (var sql = c.createStatement(); var r = sql.executeQuery("select length(terms),length(withdraw_reason),(select count(*) from plan_price_lock where id=1) from plan_version where id=70004")) {
                assertThat(r.next()).isTrue(); assertThat(r.getInt(1)).isEqualTo(500); assertThat(r.getInt(2)).isEqualTo(1000); assertThat(r.getInt(3)).isEqualTo(1);
            }
        } finally { Files.deleteIfExists(before); Files.deleteIfExists(folder); }
    }
}
