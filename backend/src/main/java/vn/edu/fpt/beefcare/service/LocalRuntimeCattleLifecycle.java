package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** The local QR fixtures live between application startup and normal Spring context shutdown. */
@Component
@Profile("local & !prod")
@ConditionalOnProperty(name = {"beefcare.local-seed.enabled", "beefcare.local-runtime-cattle.enabled"}, havingValue = "true")
@DependsOn("localDevelopmentSeeder")
@Order(100)
public class LocalRuntimeCattleLifecycle implements ApplicationRunner, DisposableBean {
    private static final Logger LOG = LoggerFactory.getLogger(LocalRuntimeCattleLifecycle.class);
    private static final long LOCK_KEY = 0x4245454643415245L;
    private final LocalRuntimeCattleStore store;
    private final TransactionTemplate transactions;
    private final DataSource dataSource;
    private LocalRuntimeCattleStore.Session session;
    private Connection lease;

    public LocalRuntimeCattleLifecycle(EntityManager em, DataSource dataSource, PlatformTransactionManager manager,
        FarmClock clock, CodeSequenceService codes) {
        this.store = new LocalRuntimeCattleStore(em, dataSource, clock, codes);
        this.dataSource = dataSource;
        this.transactions = new TransactionTemplate(manager);
    }

    @Override
    public synchronized void run(ApplicationArguments arguments) throws SQLException {
        if (session != null) return;
        acquireLease();
        try {
            session = transactions.execute(status -> store.create());
            LOG.info("Local runtime cattle ready: farm={}, male={}, QR={}, female={}, femaleQR={}",
                session.farmId(), session.maleId(), LocalRuntimeCattleStore.MALE_QR, session.femaleId(), session.femaleQr());
        } catch (RuntimeException failure) {
            releaseLease();
            throw failure;
        }
    }

    @Override
    public synchronized void destroy() throws SQLException {
        try {
            if (session != null) {
                transactions.executeWithoutResult(status -> store.delete(session));
                LOG.info("Removed local runtime cattle {}", session.cattleIds());
                session = null;
            }
        } finally {
            releaseLease();
        }
    }

    private void acquireLease() throws SQLException {
        Connection connection = dataSource.getConnection();
        if (!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())) {
            connection.close();
            return;
        }
        try {
            try (var query = connection.prepareStatement("select pg_try_advisory_lock(?)")) {
                query.setLong(1, LOCK_KEY);
                try (var result = query.executeQuery()) {
                    if (!result.next() || !result.getBoolean(1)) {
                        throw new IllegalStateException("Another backend owns the local runtime cattle. Stop it before starting this local instance.");
                    }
                }
            }
            if (!connection.getAutoCommit()) connection.commit();
            lease = connection;
        } catch (SQLException | RuntimeException failure) {
            connection.close();
            throw failure;
        }
    }

    private void releaseLease() throws SQLException {
        if (lease == null) return;
        try (Connection connection = lease) {
            try (var query = connection.prepareStatement("select pg_advisory_unlock(?)")) {
                query.setLong(1, LOCK_KEY);
                query.execute();
            }
            if (!connection.getAutoCommit()) connection.commit();
        } finally {
            lease = null;
        }
    }
}
