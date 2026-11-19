package vn.edu.fpt.beefcare.service;

import vn.edu.fpt.beefcare.domain.OutboxEvent;

/** Provider adapters implement this interface. Handlers must treat event ID as a deduplication key. */
public interface OutboxEventHandler {
    boolean supports(String eventType);
    void handle(OutboxEvent event) throws Exception;
}
