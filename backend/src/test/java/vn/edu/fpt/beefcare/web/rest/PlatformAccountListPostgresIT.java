package vn.edu.fpt.beefcare.web.rest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/** UC-FE03-07 (D31) on PostgreSQL 16.15: the same HTTP cases, including the vi-x-icu name order and the fetch join. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class PlatformAccountListPostgresIT extends PlatformAccountListResourceTest {
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) { FarmInvitationPostgresIT.configure(properties, "fe03_accounts_"); }

    @BeforeEach
    void requirePostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }
}
