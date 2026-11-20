package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import vn.edu.fpt.beefcare.ServiceIntegrationTest;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Cattle;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.domain.PenAssignment;
import vn.edu.fpt.beefcare.domain.enumeration.AssignmentSource;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.LifeStage;
import vn.edu.fpt.beefcare.domain.enumeration.PurposeType;
import vn.edu.fpt.beefcare.domain.enumeration.Sex;
import vn.edu.fpt.beefcare.service.dto.PenCattleDTO;
import vn.edu.fpt.beefcare.service.dto.PenMoveCheckRequest;
import vn.edu.fpt.beefcare.service.dto.PenMoveRequest;
import vn.edu.fpt.beefcare.support.DomainTestSupport;

@ServiceIntegrationTest
@ActiveProfiles(value = "testh2", inheritProfiles = false)
@Timeout(35)
class PenMoveConcurrencyPostgresIT extends DomainTestSupport {

    private static final String SCHEMA = "fe04_move_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource
    static void postgres(DynamicPropertyRegistry properties) {
        var container = DatabaseTestcontainer.databaseContainer;
        container.start();
        String url = container.getJdbcUrl();
        try (var connection = DriverManager.getConnection(url, container.getUsername(), container.getPassword());
            var statement = connection.createStatement()) {
            statement.execute("create schema if not exists " + SCHEMA);
        } catch (SQLException failure) {
            throw new IllegalStateException("Could not create the pen concurrency test schema", failure);
        }
        properties.add("spring.datasource.url", () -> url + (url.contains("?") ? "&" : "?") + "currentSchema=" + SCHEMA);
        properties.add("spring.datasource.username", container::getUsername);
        properties.add("spring.datasource.password", container::getPassword);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
    }

    @Autowired PlatformTransactionManager transactions;
    @Autowired DataSource dataSource;
    @Autowired PenMoveService moves;
    @Autowired PenAssignmentService assignments;
    @Autowired PenOccupancyService occupancy;
    @Autowired PenService pens;

    private record Fixture(Long farmId, AppUser owner, AppUser manager, Pen a, Pen b, Pen c, Cattle x, Cattle y, Cattle z) {}

    private Fixture fixture(int capacityB) {
        return new TransactionTemplate(transactions).execute(status -> {
            Farm farm = farm();
            AppUser owner = memberWithRole(farm, FarmRole.OWNER);
            AppUser manager = memberWithRole(farm, FarmRole.MANAGER);
            Pen a = pen(farm, "A", 5);
            Pen b = pen(farm, "B", capacityB);
            Pen c = pen(farm, "C", 5);
            var breed = breed(farm);
            var purpose = purpose(farm, PurposeType.FATTENING);
            Cattle x = cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
            Cattle y = cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
            Cattle z = cattle(farm, breed, purpose, Sex.FEMALE, LifeStage.ADULT);
            for (Cattle cattle : List.of(x, y, z)) {
                assignments.openAssignment(cattle, a, TODAY.minusDays(1), AssignmentSource.HERD_ENTRY, "entry", null, null, owner);
            }
            return new Fixture(farm.getId(), owner, manager, a, b, c, x, y, z);
        });
    }

    private PenMoveRequest request(Fixture fixture, Pen destination, Cattle... cattle) {
        // Read the same data that populates the move dialog before either transaction writes.
        var versions = pens.get(fixture.farmId(), fixture.a().getId()).cattle().stream()
            .collect(Collectors.toMap(PenCattleDTO::id, PenCattleDTO::version));
        List<Long> ids = Arrays.stream(cattle).map(Cattle::getId).toList();
        Map<Long, Integer> selected = ids.stream().collect(Collectors.toMap(id -> id, versions::get));
        return new PenMoveRequest(ids, destination.getId(), TODAY, "Chuyển bò", Map.of(), selected, null);
    }

    @Test
    void twoDifferentCattleCompeteForTheLastPlace() throws Exception {
        Fixture f = fixture(1);
        actAs(f.owner());
        DomainException rejected = race(f, request(f, f.b(), f.x()), request(f, f.b(), f.y()));

        assertThat(rejected.getStatus()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(rejected.getCode()).isEqualTo(MessageCodes.FE04_05);
        assertThat(rejected.getParams()).containsEntry("free", 0);
        assertThat(occupancy.headcount(f.b().getId())).isEqualTo(1);
        assertAssignment(f.x(), f.b(), 2, 1);
        assertAssignment(f.y(), f.a(), 1, 0);
        assertAuditCount(f, 1);
    }

    @Test
    void twoOperatorsCannotMoveTheSameSnapshotToDifferentPens() throws Exception {
        Fixture f = fixture(5);
        actAs(f.owner());
        DomainException rejected = race(f, request(f, f.b(), f.x()), request(f, f.c(), f.x()));

        assertConflict(rejected, f.x(), f.b());
        assertAssignment(f.x(), f.b(), 2, 1);
        assertThat(occupancy.headcount(f.c().getId())).isZero();
        assertAuditCount(f, 1);
    }

    @Test
    void staleCattleRejectsTheEntireOverlappingBatch() throws Exception {
        Fixture f = fixture(5);
        actAs(f.owner());
        DomainException rejected = race(f, request(f, f.b(), f.y(), f.z()), request(f, f.c(), f.x(), f.y()));

        assertConflict(rejected, f.y(), f.b());
        assertAssignment(f.y(), f.b(), 2, 1);
        assertAssignment(f.z(), f.b(), 2, 1);
        assertAssignment(f.x(), f.a(), 1, 0);
        assertThat(occupancy.headcount(f.c().getId())).isZero();
        assertAuditCount(f, 2);
    }

    private DomainException race(Fixture f, PenMoveRequest first, PenMoveRequest second) throws Exception {
        assertReady(f, f.owner(), first);
        assertReady(f, f.manager(), second);
        actAs(f.owner());
        ExecutorService worker = Executors.newSingleThreadExecutor();
        AtomicReference<Future<DomainException>> pending = new AtomicReference<>();
        try {
            new TransactionTemplate(transactions).executeWithoutResult(status -> {
                int firstPid = ((Number) em.createNativeQuery("select pg_backend_pid()").getSingleResult()).intValue();
                var result = moves.move(f.farmId(), first);
                assertThat(result.moved()).hasSize(first.cattleIds().size());
                pending.set(worker.submit(() -> {
                    actAs(f.manager());
                    try {
                        moves.move(f.farmId(), second);
                        throw new AssertionError("The second move succeeded with a stale snapshot");
                    } catch (DomainException rejected) {
                        return rejected;
                    } finally {
                        SecurityContextHolder.clearContext();
                    }
                }));
                assertThat(awaitLockWait(pending.get(), firstPid)).as("the second transaction must wait on the first").isTrue();
            });
            return pending.get().get(10, TimeUnit.SECONDS);
        } finally {
            worker.shutdownNow();
        }
    }

    private void assertReady(Fixture f, AppUser member, PenMoveRequest request) {
        actAs(member);
        var check = moves.check(f.farmId(), new PenMoveCheckRequest(request.cattleIds(), request.toPenId(), TODAY));
        assertThat(check.blocked()).isFalse();
        assertThat(check.cattle()).allSatisfy(row -> assertThat(row.error()).isNull());
    }

    private boolean awaitLockWait(Future<?> second, int firstPid) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(7);
        String sql = "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))";
        try (var connection = dataSource.getConnection(); var statement = connection.prepareStatement(sql)) {
            assertThat(connection.getMetaData().getDatabaseProductVersion()).startsWith("16.15");
            statement.setInt(1, firstPid);
            while (!second.isDone() && System.nanoTime() < deadline) {
                try (var rows = statement.executeQuery()) {
                    if (rows.next() && rows.getBoolean(1)) return true;
                }
                Thread.sleep(20);
            }
            return false;
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(failure);
        } catch (SQLException failure) {
            throw new IllegalStateException(failure);
        }
    }

    private void assertConflict(DomainException rejected, Cattle stale, Pen current) {
        assertThat(rejected.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(rejected.getCode()).isEqualTo(MessageCodes.COM_05);
        assertThat(rejected.getParams()).containsEntry("cattle_code", stale.getDisplayCode()).containsEntry("pen_code", current.getCode());
    }

    private void assertAssignment(Cattle cattle, Pen destination, int historySize, int increments) {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            List<PenAssignment> history = assignments.history(cattle.getId());
            assertThat(history).hasSize(historySize);
            assertThat(history).filteredOn(row -> row.getToDate() == null).singleElement()
                .satisfies(row -> assertThat(row.getPen().getId()).isEqualTo(destination.getId()));
            assertThat(versionOf(Cattle.class, cattle.getId())).isEqualTo(cattle.getVersion() + increments);
        });
    }

    private void assertAuditCount(Fixture f, long count) {
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            Long moves = em.createQuery("select count(l) from AuditLog l where l.farm.id = :farmId and l.action = 'PEN_MOVE'", Long.class)
                .setParameter("farmId", f.farmId()).getSingleResult();
            assertThat(moves).isEqualTo(count);
        });
    }
}
