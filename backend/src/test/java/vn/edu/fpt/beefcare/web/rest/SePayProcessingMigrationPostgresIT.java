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

/** Upgrade from the full UC7 schema; historic bank evidence must not acquire invented deliveries, jobs or emails. */
class SePayProcessingMigrationPostgresIT {
    @Test
    @Timeout(value = 120, unit = TimeUnit.SECONDS)
    void upgradePreservesLegacyEvidenceAllocationsAndUnknownDeliveryMetadata() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer; container.start();
        var folder = Files.createTempDirectory("beefcare-uc8-upgrade-"); var before = folder.resolve("before.xml");
        String migration = "config/liquibase/changelog/20261110000400_sepay_durable_processing.xml";
        String widths = "config/liquibase/changelog/20261110000500_sepay_evidence_text_widths.xml";
        try (var source = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(migration, widths);
            Files.writeString(before, master.lines().filter(line -> !line.contains(migration) && !line.contains(widths)).collect(Collectors.joining("\n")));
        }
        String schema = "uc8_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             var resources = new CompositeResourceAccessor(new DirectoryResourceAccessor(folder), new ClassLoaderResourceAccessor())) {
            try (var s = c.createStatement()) { s.execute("create schema " + schema); s.execute("set search_path to " + schema); }
            var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(c));
            database.setDefaultSchemaName(schema); database.setLiquibaseSchemaName(schema);
            new Liquibase("before.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var s = c.createStatement()) {
                s.execute("insert into app_user(id,email,full_name,account_status,version) values (71001,'legacy@uc8.test','Legacy Owner','ACTIVE',0)");
                s.execute("insert into farm(id,name,location,contact,service_status,version) values (71002,'Legacy farm','Dong Nai','0900000000','ACTIVE',0)");
                s.execute("insert into plan_version(id,price_1_y,price_2_y,price_3_y,effective_at) values (71003,1200000,2160000,3060000,'2026-01-01T00:00:00Z')");
                s.execute("insert into subscription(id,farm_id,plan_version_id,entitlement_status,latest_end) values (71004,71002,71003,'ACTIVE','2027-01-02T03:00:00Z')");
                s.execute("insert into payment(id,quote_ref,duration_years,amount_vnd,state,expires_at,subscription_id,requested_by_id,price_version_id,requested_at,confirmed_at,purchased_start,purchased_end,receipt_code,version) values (71005,'BCUC8LEGACY001',1,1200000,'PAID','2026-01-03T03:00:00Z',71004,71001,71003,'2026-01-02T03:00:00Z','2026-01-02T03:00:00Z','2026-01-02T03:00:00Z','2027-01-02T03:00:00Z','RC-26-LEGACY',0)");
                s.execute("insert into bank_transfer_evidence(id,provider_txn_id,amount,bank_paid_at,quote_ref,payment_id,provider,environment,account_namespace,transfer_direction,transfer_content,gateway,reference_code,receiving_account,review_status,locked_for_return,version) values (71006,887100000006,1200000,'2026-01-02T03:00:00Z','BCUC8LEGACY001',71005,'SEPAY','MOCK','LEGACY','IN','Original content','BIDV','REF-71006','LEGACY-ACCOUNT','ACCEPTED',false,0),(71007,887100000007,100,'2026-01-02T03:00:00Z',null,null,'SEPAY','MOCK','LEGACY','IN','Unmatched legacy',null,null,null,'UNMATCHED',false,0)");
            }
            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());
            try (var s = c.createStatement(); var r = s.executeQuery("select e.payment_id,e.transfer_content,e.first_received_at,e.delivery_attempts,e.description,e.provider_code,e.conflicting_references,p.state,p.receipt_code from bank_transfer_evidence e join payment p on p.id=e.payment_id where e.id=71006")) {
                assertThat(r.next()).isTrue(); assertThat(r.getLong(1)).isEqualTo(71005); assertThat(r.getString(2)).isEqualTo("Original content");
                for (int field = 3; field <= 6; field++) assertThat(r.getObject(field)).isNull();
                assertThat(r.getBoolean(7)).isFalse(); assertThat(r.getString(8)).isEqualTo("PAID"); assertThat(r.getString(9)).isEqualTo("RC-26-LEGACY");
            }
            try (var s = c.createStatement(); var r = s.executeQuery("select (select count(*) from bank_evidence_job),(select count(*) from email_delivery_job where event_key is not null),(select count(*) from bank_transfer_evidence)")) {
                assertThat(r.next()).isTrue(); assertThat(r.getLong(1)).isZero(); assertThat(r.getLong(2)).isZero(); assertThat(r.getLong(3)).isEqualTo(2);
            }
            // Review UC8 #3: widening keeps the legacy provider text unchanged.
            try (var s = c.createStatement(); var r = s.executeQuery("select gateway,reference_code,receiving_account from bank_transfer_evidence where id=71006")) {
                assertThat(r.next()).isTrue(); assertThat(r.getString(1)).isEqualTo("BIDV"); assertThat(r.getString(2)).isEqualTo("REF-71006");
                assertThat(r.getString(3)).isEqualTo("LEGACY-ACCOUNT");
            }
            try (var s = c.prepareStatement("update bank_transfer_evidence set transfer_content=?,description=?,provider_code=?,gateway=?,reference_code=?,receiving_account=? where id=71007")) {
                s.setString(1, "N".repeat(1000)); s.setString(2, "D".repeat(1000)); s.setString(3, "C".repeat(1000));
                s.setString(4, "G".repeat(1000)); s.setString(5, "R".repeat(1000)); s.setString(6, "9".repeat(1000)); assertThat(s.executeUpdate()).isEqualTo(1);
            }
            try (var s = c.createStatement(); var r = s.executeQuery("select length(transfer_content),length(description),length(provider_code),length(gateway),length(reference_code),length(receiving_account) from bank_transfer_evidence where id=71007")) {
                assertThat(r.next()).isTrue();
                for (int field = 1; field <= 6; field++) assertThat(r.getInt(field)).isEqualTo(1000);
            }
        } finally { Files.deleteIfExists(before); Files.deleteIfExists(folder); }
    }
}
