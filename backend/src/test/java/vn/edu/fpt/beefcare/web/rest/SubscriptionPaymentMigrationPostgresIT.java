package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.DriverManager;
import java.util.UUID;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import liquibase.resource.CompositeResourceAccessor;
import liquibase.resource.DirectoryResourceAccessor;
import org.junit.jupiter.api.Test;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;

/** Upgrade the complete previous schema with legacy rows; never touches a shared development database. */
class SubscriptionPaymentMigrationPostgresIT {
    @Test
    void addsUnknownProgressTimesWithoutChangingExistingPaymentOrEvidence() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        var folder = Files.createTempDirectory("beefcare-uc02-upgrade-");
        var beforeFile = folder.resolve("before.xml");
        String migration = "config/liquibase/changelog/20261109000100_subscription_payment_progress.xml";
        try (var stream = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(stream).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(migration);
            Files.writeString(beforeFile, master.replaceAll("(?m)^.*<include file=\"" + migration + "\"[^\\n]*\\n", ""));
        }
        String schema = "uc02_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var sql = connection.createStatement()) { sql.execute("create schema " + schema); sql.execute("set search_path to " + schema); }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
            database.setDefaultSchemaName(schema); database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var sql = connection.createStatement()) {
                sql.execute("insert into app_user(id,email,full_name,account_status,version) values (70001,'legacy@uc02.test','Legacy fixture','ACTIVE',0)");
                sql.execute("insert into farm(id,name,location,contact,service_status,version) values (70002,'Legacy farm','Dong Nai','0900000000','PENDING_PAYMENT',0)");
                sql.execute("insert into plan_version(id,price_1_y,price_2_y,price_3_y,effective_at) values (70003,1200000,2160000,3060000,'2026-01-01T00:00:00Z')");
                sql.execute("insert into subscription(id,farm_id,plan_version_id,entitlement_status) values (70004,70002,70003,'PENDING')");
                sql.execute("insert into payment(id,quote_ref,duration_years,amount_vnd,state,expires_at,subscription_id,requested_by_id,price_version_id,requested_at,version) " +
                    "values (70005,'UC02LEGACY',1,1200000,'PENDING','2026-11-10T03:00:00Z',70004,70001,70003,'2026-11-09T03:00:00Z',0)");
                sql.execute("insert into bank_transfer_evidence(id,provider_txn_id,amount,bank_paid_at,provider,environment,account_namespace,review_status,locked_for_return,version) " +
                    "values (70006,70006,1100000,'2026-11-09T03:10:00Z','SEPAY','TEST','UC02','UNMATCHED',false,0)");
            }
            new Liquibase(migration, resources, database).update(new Contexts("test"), new LabelExpression());
            try (var sql = connection.createStatement(); var row = sql.executeQuery("select quote_ref,amount_vnd,state,confirmed_at,confirmation_source from payment where id=70005")) {
                assertThat(row.next()).isTrue(); assertThat(row.getString(1)).isEqualTo("UC02LEGACY");
                assertThat(row.getLong(2)).isEqualTo(1_200_000); assertThat(row.getString(3)).isEqualTo("PENDING");
                assertThat(row.getObject(4)).isNull(); assertThat(row.getObject(5)).isNull();
            }
            try (var sql = connection.createStatement(); var row = sql.executeQuery("select amount,review_status,first_received_at from bank_transfer_evidence where id=70006")) {
                assertThat(row.next()).isTrue(); assertThat(row.getLong(1)).isEqualTo(1_100_000);
                assertThat(row.getString(2)).isEqualTo("UNMATCHED"); assertThat(row.getObject(3)).isNull();
            }
        } finally { Files.deleteIfExists(beforeFile); Files.deleteIfExists(folder); }
    }
}
