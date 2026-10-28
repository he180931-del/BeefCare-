package vn.edu.fpt.beefcare.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import liquibase.Contexts;
import liquibase.Liquibase;
import liquibase.exception.LiquibaseException;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class LiquibaseDropSafetyGuardTest {

    private static final String CHANGELOG = "config/liquibase/changelog/20261028000001_guard_herd_logic_drop.xml";

    @Test
    void refusesToProceedWhenAnUnmigratedDraftTableContainsRows() throws Exception {
        try (Connection connection = connection("guard_populated")) {
            createDraftTables(connection);
            try (Statement statement = connection.createStatement()) {
                statement.executeUpdate("INSERT INTO herd_entry (id) VALUES (1)");
            }

            assertThrows(LiquibaseException.class, () -> runGuard(connection));
        }
    }

    @Test
    void allowsAnEmptyFreshSchemaToProceed() throws Exception {
        try (Connection connection = connection("guard_empty")) {
            createDraftTables(connection);

            assertDoesNotThrow(() -> runGuard(connection));
        }
    }

    @Test
    void allowsAnAlreadyAppliedLegacyDropWithoutRequiringTheDroppedTables() throws Exception {
        try (Connection connection = connection("guard_already_migrated")) {
            try (Statement statement = connection.createStatement()) {
                statement.execute(
                    "CREATE TABLE databasechangelog (" +
                    "id varchar(255) NOT NULL, author varchar(255) NOT NULL, filename varchar(255) NOT NULL, " +
                    "dateexecuted timestamp NOT NULL, orderexecuted integer NOT NULL, exectype varchar(10) NOT NULL, " +
                    "md5sum varchar(35), description varchar(255), comments varchar(255), tag varchar(255), " +
                    "liquibase varchar(20), contexts varchar(255), labels varchar(255), deployment_id varchar(10), " +
                    "PRIMARY KEY (id, author, filename))"
                );
                statement.executeUpdate(
                    "INSERT INTO databasechangelog (id, author, filename, dateexecuted, orderexecuted, exectype) " +
                    "VALUES ('20261028000001-drop-draft-tables', 'beefcare', 'config/liquibase/changelog/20261028000002_herd_logic_schema.xml', CURRENT_TIMESTAMP, 1, 'EXECUTED')"
                );
            }

            assertDoesNotThrow(() -> runGuard(connection));
        }
    }

    private static Connection connection(String databaseName) throws Exception {
        return DriverManager.getConnection(
            "jdbc:h2:mem:" + databaseName + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
            "sa",
            ""
        );
    }

    private static void createDraftTables(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute("CREATE TABLE pen_reception_criteria (id bigint)");
            statement.execute("CREATE TABLE pen_assignment (id bigint)");
            statement.execute("CREATE TABLE cattle_qr_tag (id bigint)");
            statement.execute("CREATE TABLE herd_entry (id bigint)");
            statement.execute("CREATE TABLE herd_exit (id bigint)");
            statement.execute("CREATE TABLE cattle_profile_change (id bigint)");
            statement.execute("CREATE TABLE record_revision (id bigint)");
        }
    }

    private static void runGuard(Connection connection) throws LiquibaseException {
        var database = DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection));
        var liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), database);
        liquibase.update(new Contexts());
    }

}
