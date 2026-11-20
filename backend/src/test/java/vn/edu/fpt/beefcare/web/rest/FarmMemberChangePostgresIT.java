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

/** UC-FE03-06 (D30) on PostgreSQL 16.15: commit/rollback of membership, history and audit, and the row-lock race. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class FarmMemberChangePostgresIT extends FarmMemberChangeTransactionTest {
    @Autowired DataSource dataSource;

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) { FarmInvitationPostgresIT.configure(properties, "fe03_member_change_"); }

    @BeforeEach
    void requirePostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
