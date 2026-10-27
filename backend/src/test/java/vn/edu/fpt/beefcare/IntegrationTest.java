package vn.edu.fpt.beefcare;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.context.ImportTestcontainers;
import vn.edu.fpt.beefcare.config.AsyncSyncConfiguration;
import vn.edu.fpt.beefcare.config.DatabaseTestcontainer;
import vn.edu.fpt.beefcare.config.JacksonConfiguration;

/**
 * Base composite annotation for integration tests.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(
    classes = {
        BeefcareApp.class,
        JacksonConfiguration.class,
        AsyncSyncConfiguration.class,
        vn.edu.fpt.beefcare.config.JacksonHibernateConfiguration.class,
    }
)
@ImportTestcontainers(DatabaseTestcontainer.class)
public @interface IntegrationTest {}
