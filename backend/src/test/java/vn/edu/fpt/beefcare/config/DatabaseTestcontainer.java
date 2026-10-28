package vn.edu.fpt.beefcare.config;

import org.slf4j.LoggerFactory;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.output.Slf4jLogConsumer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.containers.PostgreSQLContainer;

public interface DatabaseTestcontainer {
    @Container
    PostgreSQLContainer<?> databaseContainer = createDatabaseContainer();

    private static PostgreSQLContainer<?> createDatabaseContainer() {
        PostgreSQLContainer<?> container = new PostgreSQLContainer<>("postgres:18.4");
        container.withDatabaseName("beefcare");
        container.withLogConsumer(new Slf4jLogConsumer(LoggerFactory.getLogger(DatabaseTestcontainer.class)));
        container.withReuse(true);
        return container;
    }

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", databaseContainer::getJdbcUrl);
        registry.add("spring.datasource.username", databaseContainer::getUsername);
        registry.add("spring.datasource.password", databaseContainer::getPassword);
    }
}
