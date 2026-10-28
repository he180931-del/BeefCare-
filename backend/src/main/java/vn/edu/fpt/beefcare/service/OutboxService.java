package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.data.domain.PageRequest;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.repository.OutboxEventRepository;

/**
 * Persists events with the caller transaction, then retries registered handlers asynchronously.
 *
 * <p>Provider adapters must implement {@link OutboxEventHandler}, select only event types they own, and use the event
 * ID as their external deduplication key. Events with no registered handler intentionally stay pending for a later
 * deployment that provides one; they are never marked delivered just because no provider is configured.</p>
 */
@Service
public class OutboxService {

    private static final Logger LOG = LoggerFactory.getLogger(OutboxService.class);
    private final OutboxEventRepository repository;
    private final ObjectMapper objectMapper;
    private final List<OutboxEventHandler> handlers;
    private final TransactionTemplate transaction;

    public OutboxService(OutboxEventRepository repository, ObjectMapper objectMapper, List<OutboxEventHandler> handlers, PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.handlers = handlers;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public OutboxEvent enqueue(Long farmId, String eventType, String aggregateType, Object aggregateId, Object payload) {
        if (!org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Outbox events must be enqueued inside the command transaction");
        }
        try {
            String json = objectMapper.writeValueAsString(payload);
            if (json.length() > 262_144) {
                throw new IllegalArgumentException("Outbox event payload exceeds 256 KiB");
            }
            Instant now = Instant.now();
            OutboxEvent event = new OutboxEvent();
            event.setFarmId(farmId);
            event.setEventType(eventType);
            event.setAggregateType(aggregateType);
            event.setAggregateId(String.valueOf(aggregateId));
            event.setPayloadJson(json);
            event.setCreatedAt(now);
            event.setAvailableAt(now);
            return repository.save(event);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Cannot serialize outbox event " + eventType, e);
        }
    }

    @Scheduled(fixedDelayString = "${beefcare.outbox.poll-delay-ms:5000}")
    public void dispatchDueEvents() {
        if (handlers.isEmpty()) return;
        Instant now = Instant.now();
        for (OutboxEvent candidate : repository.findDue(now, PageRequest.of(0, 50))) {
            List<OutboxEventHandler> matching = handlers.stream().filter(h -> h.supports(candidate.getEventType())).toList();
            if (matching.isEmpty()) continue;
            if (matching.size() > 1) {
                // An event row represents one delivery contract. Multiple handlers need distinct per-handler
                // delivery records and are rejected rather than silently acknowledging only the first one.
                markFailed(candidate.getId(), new IllegalStateException("Multiple outbox handlers claim event type " + candidate.getEventType()));
                LOG.error("Outbox event {} has multiple handlers for {}; leaving it retryable", candidate.getId(), candidate.getEventType());
                continue;
            }
            if (claim(candidate.getId(), now) == 0) continue;
            try {
                matching.get(0).handle(candidate);
                markDelivered(candidate.getId());
            } catch (Exception e) {
                markFailed(candidate.getId(), e);
                LOG.warn("Outbox delivery failed for event {} ({})", candidate.getId(), candidate.getEventType(), e);
            }
        }
    }

    private int claim(Long id, Instant now) {
        return transaction.execute(status -> repository.claim(id, now, now.plus(Duration.ofMinutes(2))));
    }

    private void markDelivered(Long id) {
        transaction.executeWithoutResult(status -> repository.findById(id).ifPresent(event -> {
            event.setPublishedAt(Instant.now());
            event.setClaimedUntil(null);
            event.setLastError(null);
        }));
    }

    private void markFailed(Long id, Exception error) {
        transaction.executeWithoutResult(status -> repository.findById(id).ifPresent(event -> {
            long delay = Math.min(3600, 1L << Math.min(12, event.getAttempts()));
            event.setAvailableAt(Instant.now().plusSeconds(delay));
            event.setClaimedUntil(null);
            String message = error.getClass().getSimpleName();
            event.setLastError(message.substring(0, Math.min(message.length(), 1000)));
        }));
    }
}
