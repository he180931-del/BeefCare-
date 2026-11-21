package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;

/** Same lifecycle cases on PostgreSQL 16.15, plus real transaction commits and the cross-process lease. */
@ServiceIntegrationTest
@ActiveProfiles(value = "testh2", inheritProfiles = false)
class LocalRuntimeCattleLifecyclePostgresIT extends LocalRuntimeCattleLifecycleTest {
    private static final String SCHEMA = "runtime_cattle_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        var container = DatabaseTestcontainer.databaseContainer;
        container.start();
        String url = container.getJdbcUrl();
        try (var connection = DriverManager.getConnection(url, container.getUsername(), container.getPassword());
            var statement = connection.createStatement()) {
            statement.execute("create schema if not exists " + SCHEMA);
        } catch (SQLException failure) {
            throw new IllegalStateException("Could not create the runtime cattle test schema", failure);
        }
        properties.add("spring.datasource.url", () -> url + (url.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        properties.add("spring.datasource.username", container::getUsername);
        properties.add("spring.datasource.password", container::getPassword);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Test
    void aSecondBackendCannotReplaceTheRunningBackendsFixtures() throws Exception {
        start();
        var ids = cattle().stream().map(vn.edu.fpt.beefcare.domain.Cattle::getId).toList();
        var other = instance();
        assertThatThrownBy(() -> other.run(new DefaultApplicationArguments())).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Another backend owns");
        assertThat(cattle()).extracting(vn.edu.fpt.beefcare.domain.Cattle::getId).containsExactlyElementsOf(ids);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void actualStartupAndContextShutdownCommitAndReleaseTheLease() throws Exception {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String reservedFemaleQr = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            try (GenericApplicationContext context = new GenericApplicationContext()) {
                context.registerBean(LocalRuntimeCattleLifecycle.class, this::instance);
                context.refresh();
                context.getBean(LocalRuntimeCattleLifecycle.class).run(new DefaultApplicationArguments());
                assertThat(jdbc.queryForObject("select count(*) from cattle where farm_id=?", Long.class, farm.getId())).isEqualTo(2);
                assertThat(jdbc.queryForObject("select count(*) from cattle_qr_tag where tag_code=?", Long.class, LocalRuntimeCattleStore.MALE_QR)).isEqualTo(1);
                String currentFemaleQr = femaleQr();
                if (reservedFemaleQr == null) reservedFemaleQr = currentFemaleQr;
                assertThat(currentFemaleQr).isEqualTo(reservedFemaleQr);
                assertThat(jdbc.queryForObject("select count(*) from cattle_qr_tag where tag_code=?", Long.class, reservedFemaleQr)).isEqualTo(1);
            }
            assertThat(jdbc.queryForObject("select count(*) from cattle where farm_id=?", Long.class, farm.getId())).isZero();
            assertThat(jdbc.queryForObject("select count(*) from cattle_qr_tag where tag_code=?", Long.class, LocalRuntimeCattleStore.MALE_QR)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from cattle_qr_tag where tag_code=?", Long.class, reservedFemaleQr)).isZero();
            assertThat(femaleQr()).isEqualTo(reservedFemaleQr);
        }
    }
}
