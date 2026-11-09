package vn.edu.fpt.beefcare.web.rest;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import javax.sql.DataSource;
import vn.edu.fpt.beefcare.IntegrationTest;
import vn.edu.fpt.beefcare.support.TestClockConfiguration;

/** The same UC3 HTTP/query/readback contract on PostgreSQL 16.15, not an H2 substitute. */
@IntegrationTest
@AutoConfigureMockMvc
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Import(TestClockConfiguration.class)
class SubscriptionPaymentHistoryPostgresIT extends SubscriptionPaymentHistoryResourceTest {
    @Autowired DataSource dataSource;
    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) { SubscriptionPaymentRequestPostgresIT.configurePostgres(properties); }

    @BeforeEach
    void realPostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            org.assertj.core.api.Assertions.assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
        }
    }

    /** Changeset 20261109000200: the case-insensitive evidence lookup can use an index instead of a full scan. */
    @org.junit.jupiter.api.Test
    void upperQuoteRefIndexServesTheBatchedEvidenceLookup() throws Exception {
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try (var definition = statement.executeQuery(
                "select indexdef from pg_indexes where tablename = 'bank_transfer_evidence' and indexname = 'ix_evidence_quote_ref_upper'")) {
                org.assertj.core.api.Assertions.assertThat(definition.next()).isTrue();
                org.assertj.core.api.Assertions.assertThat(definition.getString(1)).contains("upper(", "quote_ref");
            }
            statement.execute("set enable_seqscan = off");
            try (var plan = statement.executeQuery(
                "explain select * from bank_transfer_evidence where upper(quote_ref) in ('BCAAAA', 'BCBBBB')")) {
                StringBuilder text = new StringBuilder();
                while (plan.next()) text.append(plan.getString(1)).append('\n');
                org.assertj.core.api.Assertions.assertThat(text.toString()).contains("ix_evidence_quote_ref_upper");
            } finally {
                statement.execute("reset enable_seqscan");
            }
        }
    }
}
