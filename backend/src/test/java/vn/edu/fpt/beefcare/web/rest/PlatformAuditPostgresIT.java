package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/**
 * UC-FE17-01 (D34) on PostgreSQL 16.15: the same HTTP cases – the migration of actor_role / correlation_id and its
 * indexes, farm-zone day bounds, LIKE escaping of the actor search and of the payment suffix, scalar tuple reads.
 */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class PlatformAuditPostgresIT extends PlatformAuditResourceTest {
    @Autowired DataSource dataSource;

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) { FarmInvitationPostgresIT.configure(properties, "fe17_audit_"); }

    @BeforeEach
    void requirePostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
