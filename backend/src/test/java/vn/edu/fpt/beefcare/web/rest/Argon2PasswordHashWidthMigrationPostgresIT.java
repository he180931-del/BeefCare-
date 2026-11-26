package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.DriverManager;
import java.sql.Timestamp;
import java.util.UUID;
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

/** FE-01 WBS4: the forward migration widens password_hash without rewriting legacy hashes. */
class Argon2PasswordHashWidthMigrationPostgresIT {

    private static final String MIGRATION = "config/liquibase/changelog/20261124000100_argon2_password_hash_width.xml";
    private static final String LEGACY_BCRYPT = "$2a$10$01234567890123456789012345678901234567890123456789012";
    private static final String LONG_ARGON2ID = "$argon2id$v=19$m=65536,t=3,p=1$" + "a".repeat(100);

    @Test
    @Timeout(120)
    void widensPasswordHashAndPreservesLegacyValueWhileAcceptingLongArgon2idValue() throws Exception {
        var container = DatabaseTestcontainer.databaseContainer;
        container.start();
        var folder = Files.createTempDirectory("beefcare-argon2-width-");
        var before = folder.resolve("before.xml");
        try (var source = getClass().getClassLoader().getResourceAsStream("config/liquibase/master.xml")) {
            String master = new String(java.util.Objects.requireNonNull(source).readAllBytes(), StandardCharsets.UTF_8);
            assertThat(master).contains(MIGRATION);
            Files.writeString(before, master.lines().filter(line -> !line.contains(MIGRATION)).collect(Collectors.joining("\n")));
        }

        String schema = "argon2_width_" + UUID.randomUUID().toString().replace("-", "");
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
            try (var statement = connection.prepareStatement(
                "insert into jhi_user(id, login, password_hash, activated, created_by, created_date) values (?,?,?,?,?,?)"
            )) {
                statement.setLong(1, 88001L);
                statement.setString(2, "legacy-argon2-width");
                statement.setString(3, LEGACY_BCRYPT);
                statement.setBoolean(4, true);
                statement.setString(5, "test");
                statement.setTimestamp(6, Timestamp.from(java.time.Instant.parse("2026-01-01T00:00:00Z")));
                assertThat(statement.executeUpdate()).isEqualTo(1);
            }

            new Liquibase("config/liquibase/master.xml", resources, database).update(new Contexts("test"), new LabelExpression());

            try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                "select character_maximum_length from information_schema.columns where table_schema=current_schema() and table_name='jhi_user' and column_name='password_hash'"
            )) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isEqualTo(255);
            }
            try (var statement = connection.prepareStatement("select password_hash from jhi_user where id=?")) {
                statement.setLong(1, 88001L);
                try (var rows = statement.executeQuery()) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getString(1)).isEqualTo(LEGACY_BCRYPT);
                }
            }
            try (var statement = connection.prepareStatement(
                "insert into jhi_user(id, login, password_hash, activated, created_by, created_date) values (?,?,?,?,?,?)"
            )) {
                statement.setLong(1, 88002L);
                statement.setString(2, "argon2-width");
                statement.setString(3, LONG_ARGON2ID);
                statement.setBoolean(4, true);
                statement.setString(5, "test");
                statement.setTimestamp(6, Timestamp.from(java.time.Instant.parse("2026-01-01T00:00:00Z")));
                assertThat(statement.executeUpdate()).isEqualTo(1);
            }
            try (var statement = connection.prepareStatement("select length(password_hash) from jhi_user where id=?")) {
                statement.setLong(1, 88002L);
                try (var rows = statement.executeQuery()) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getInt(1)).isEqualTo(LONG_ARGON2ID.length());
                }
            }
        } finally {
            Files.deleteIfExists(before);
            Files.deleteIfExists(folder);
        }
    }
}
