package vn.edu.fpt.beefcare.config;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.aop.interceptor.SimpleAsyncUncaughtExceptionHandler;
import org.springframework.boot.autoconfigure.task.TaskExecutionProperties;
import org.springframework.boot.task.ThreadPoolTaskSchedulerCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import tech.jhipster.async.ExceptionHandlingAsyncTaskExecutor;
import vn.edu.fpt.beefcare.service.CorrelationId;

@Configuration
@EnableAsync
@EnableScheduling
@Profile("!testdev & !testprod")
public class AsyncConfiguration implements AsyncConfigurer {

    private static final Logger LOG = LoggerFactory.getLogger(AsyncConfiguration.class);

    private final TaskExecutionProperties taskExecutionProperties;

    public AsyncConfiguration(TaskExecutionProperties taskExecutionProperties) {
        this.taskExecutionProperties = taskExecutionProperties;
    }

    @Override
    @Bean(name = "taskExecutor")
    public Executor getAsyncExecutor() {
        LOG.debug("Creating Async Task Executor");
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(taskExecutionProperties.getPool().getCoreSize());
        executor.setMaxPoolSize(taskExecutionProperties.getPool().getMaxSize());
        executor.setQueueCapacity(taskExecutionProperties.getPool().getQueueCapacity());
        executor.setThreadNamePrefix(taskExecutionProperties.getThreadNamePrefix());
        return new ExceptionHandlingAsyncTaskExecutor(executor);
    }

    /** D34: every scheduled job run gets its own correlation ID for its log lines and audit entries. */
    @Bean
    public ThreadPoolTaskSchedulerCustomizer correlationIdPerScheduledRun() {
        return scheduler -> scheduler.setTaskDecorator(CorrelationId::withNewId);
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new SimpleAsyncUncaughtExceptionHandler();
    }
}
