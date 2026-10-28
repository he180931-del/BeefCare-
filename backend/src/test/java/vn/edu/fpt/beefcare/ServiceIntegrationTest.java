package vn.edu.fpt.beefcare;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import vn.edu.fpt.beefcare.config.AsyncSyncConfiguration;
import vn.edu.fpt.beefcare.config.JacksonConfiguration;

/**
 * Integration test against an in-memory H2 database (PostgreSQL mode): runs offline, no Docker needed.
 * Postgres-only DDL (changesets with dbms="postgresql") is not exercised by these tests.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(
    classes = {
        BeefcareApp.class,
        JacksonConfiguration.class,
        AsyncSyncConfiguration.class,
        vn.edu.fpt.beefcare.support.TestClockConfiguration.class,
        vn.edu.fpt.beefcare.config.JacksonHibernateConfiguration.class,
    }
)
@ActiveProfiles("testh2")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
public @interface ServiceIntegrationTest {}
