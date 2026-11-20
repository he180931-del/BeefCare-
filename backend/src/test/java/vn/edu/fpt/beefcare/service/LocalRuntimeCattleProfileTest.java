package vn.edu.fpt.beefcare.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import jakarta.persistence.EntityManager;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.transaction.PlatformTransactionManager;

class LocalRuntimeCattleProfileTest {
    private ApplicationContextRunner context(String... profiles) {
        return new ApplicationContextRunner()
            .withInitializer(context -> context.getEnvironment().setActiveProfiles(profiles))
            .withPropertyValues("beefcare.local-seed.enabled=true", "beefcare.local-runtime-cattle.enabled=true")
            .withBean("localDevelopmentSeeder", ApplicationRunner.class, () -> arguments -> {})
            .withBean(EntityManager.class, () -> mock(EntityManager.class))
            .withBean(DataSource.class, () -> mock(DataSource.class))
            .withBean(PlatformTransactionManager.class, () -> mock(PlatformTransactionManager.class))
            .withBean(FarmClock.class, () -> mock(FarmClock.class))
            .withBean(CodeSequenceService.class, () -> mock(CodeSequenceService.class))
            .withUserConfiguration(LocalRuntimeCattleLifecycle.class);
    }

    @Test void runsInTheExplicitLocalProfile() {
        context("local").run(context -> assertThat(context).hasSingleBean(LocalRuntimeCattleLifecycle.class));
    }

    @Test void staysOffInNormalDevelopment() {
        context("dev").run(context -> assertThat(context).doesNotHaveBean(LocalRuntimeCattleLifecycle.class));
    }

    @Test void staysOffWhenProdAndLocalAreBothSelected() {
        context("local", "prod").run(context -> assertThat(context).doesNotHaveBean(LocalRuntimeCattleLifecycle.class));
    }

    @Test void canBeDisabledWithoutRemovingOrdinaryLocalAccounts() {
        context("local").withPropertyValues("beefcare.local-runtime-cattle.enabled=false")
            .run(context -> assertThat(context).doesNotHaveBean(LocalRuntimeCattleLifecycle.class).hasBean("localDevelopmentSeeder"));
    }
}
