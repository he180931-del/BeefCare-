package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Vaccine;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.CareDtos;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

/** TC-18-34: real independent transactions, in both commit orders, on PostgreSQL 16.15. */
@ServiceIntegrationTest
@Timeout(45)
class CatalogueConcurrencyPostgresIT extends DomainTestSupport {
    private static final String SCHEMA = "fe18_catalogue_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        var container = DatabaseTestcontainer.databaseContainer;
        container.start();
        String url = container.getJdbcUrl();
        try (var connection = DriverManager.getConnection(url, container.getUsername(), container.getPassword()); var statement = connection.createStatement()) {
            statement.execute("create schema if not exists " + SCHEMA);
        } catch (SQLException failure) {
            throw new IllegalStateException("Could not create the FE18 test schema", failure);
        }
        properties.add("spring.datasource.url", () -> url + (url.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        properties.add("spring.datasource.username", container::getUsername);
        properties.add("spring.datasource.password", container::getPassword);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Autowired PlatformTransactionManager transactions;
    @Autowired DataSource dataSource;
    @Autowired CareCatalogueCommandService catalogue;
    @Autowired VaccinationCommandService vaccination;

    private record Fixture(Long farmId, AppUser owner, Long cattleId, Long vaccineId, Integer version) {}

    private Fixture fixture() {
        return new TransactionTemplate(transactions).execute(status -> {
            var farm = farm(); var owner = memberWithRole(farm, FarmRole.OWNER); actAs(owner);
            var cow = cattle(farm, breed(farm), purpose(farm, PurposeType.FATTENING), Sex.MALE, LifeStage.ADULT);
            var vaccine = catalogue.saveVaccine(farm.getId(), null, key(), new CareDtos.VaccineCommand(null, "VX-TEST", "LMLM", "LMLM", null, "2 ml", "SC", 0, null, true));
            return new Fixture(farm.getId(), owner, cow.getId(), vaccine.id(), vaccine.version());
        });
    }

    private static String key() { return UUID.randomUUID().toString(); }

    @Test void scheduleCommittedFirstPreventsDeletion() throws Exception { race(true, false); }
    @Test void deletionCommittedFirstPreventsScheduling() throws Exception { race(false, false); }
    @Test void vaccinationCommittedFirstPreventsDeletion() throws Exception { race(true, true); }
    @Test void deletionCommittedFirstPreventsRecording() throws Exception { race(false, true); }

    private void createReference(Fixture fixture, boolean record) {
        if (record) {
            vaccination.record(fixture.farmId(), key(), new CareDtos.RecordVaccinations(fixture.vaccineId(), "HISTORICAL", TODAY.minusDays(1), null, null, "2 ml", "SC", null, "Trại cũ",
                List.of(new CareDtos.VaccinationAnimal(fixture.cattleId(), null, null, "VACCINATE", null, null))));
        } else {
            vaccination.createSchedule(fixture.farmId(), key(), new CareDtos.CreateVaccinationSchedule("Lịch thử", fixture.vaccineId(), TODAY, 1, 21, null, List.of(fixture.cattleId())));
        }
    }

    private void delete(Fixture fixture) {
        catalogue.deleteUnusedVaccine(fixture.farmId(), fixture.vaccineId(), key(), fixture.version());
    }

    private void race(boolean referenceFirst, boolean record) throws Exception {
        Fixture fixture = fixture(); actAs(fixture.owner());
        var worker = Executors.newSingleThreadExecutor();
        AtomicReference<Future<DomainException>> pending = new AtomicReference<>();
        try {
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                int firstPid = ((Number) em.createNativeQuery("select pg_backend_pid()").getSingleResult()).intValue();
                if (referenceFirst) createReference(fixture, record); else delete(fixture);
                pending.set(worker.submit(() -> {
                    actAs(fixture.owner());
                    try {
                        if (referenceFirst) delete(fixture); else createReference(fixture, record);
                        throw new AssertionError("Both conflicting commands succeeded");
                    } catch (DomainException rejected) {
                        return rejected;
                    } finally {
                        SecurityContextHolder.clearContext();
                    }
                }));
                assertThat(awaitBlocked(pending.get(), firstPid)).as("second transaction waited for the catalogue row").isTrue();
            });
            assertThat(pending.get().get(10, TimeUnit.SECONDS).getCode()).isEqualTo(referenceFirst ? MessageCodes.FE18_04 : MessageCodes.COM_08);
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                assertThat(em.find(Vaccine.class, fixture.vaccineId()) != null).isEqualTo(referenceFirst);
                String entity = record ? "Vaccination" : "VaccinationSchedule";
                long count = em.createQuery("select count(r) from " + entity + " r where r.vaccine.id=:id", Long.class).setParameter("id", fixture.vaccineId()).getSingleResult();
                assertThat(count).isEqualTo(referenceFirst ? 1 : 0);
                long deletes = em.createQuery("select count(a) from AuditLog a where a.farm.id=:farm and a.action='VACCINE_DELETE'", Long.class).setParameter("farm", fixture.farmId()).getSingleResult();
                assertThat(deletes).isEqualTo(referenceFirst ? 0 : 1);
            });
        } finally {
            worker.shutdownNow();
        }
    }

    private boolean awaitBlocked(Future<?> second, int firstPid) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(7);
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement("select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))")) {
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
            statement.setInt(1, firstPid);
            while (!second.isDone() && System.nanoTime() < deadline) {
                try (var rows = statement.executeQuery()) { if (rows.next() && rows.getBoolean(1)) return true; }
                Thread.sleep(20);
            }
            return false;
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt(); throw new IllegalStateException(failure);
        } catch (SQLException failure) {
            throw new IllegalStateException(failure);
        }
    }
}
