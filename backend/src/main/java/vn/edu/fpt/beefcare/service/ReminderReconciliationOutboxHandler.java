package vn.edu.fpt.beefcare.service;

import java.util.Set;
import org.springframework.stereotype.Component;
import vn.edu.fpt.beefcare.domain.OutboxEvent;

/** Re-evaluates JOB-01 after committed source events from existing and reminder-specific outbox producers. */
@Component
public class ReminderReconciliationOutboxHandler implements OutboxEventHandler {

    static final Set<String> SOURCE_CHANGE_EVENTS = Set.of(
        "CATTLE_PROFILE_UPDATED",
        "GROWTH_RECORDED",
        "GROWTH_CORRECTED",
        "FARM_REMINDER_SOURCE_CHANGED",
        "PEN_CREATED",
        "PEN_UPDATED",
        "PEN_AVAILABILITY_CHANGED",
        "FEED_ITEM_CREATED",
        "FEED_ITEM_UPDATED",
        "FEED_RECEIPT_POSTED",
        "FEED_RECEIPT_VOIDED",
        "FEED_STOCK_ADJUSTED",
        "FEED_RATION_VERSION_SAVED",
        "FEED_RATION_VERSION_CANCELLED",
        "FEED_RATION_STOPPED",
        "FEEDING_RECORDED",
        "FEEDING_VOIDED",
        "FEEDING_CORRECTED"
    );

    private final ReminderReconciliationService reminders;

    public ReminderReconciliationOutboxHandler(ReminderReconciliationService reminders) {
        this.reminders = reminders;
    }

    @Override
    public boolean supports(String eventType) {
        return SOURCE_CHANGE_EVENTS.contains(eventType);
    }

    @Override
    public void handle(OutboxEvent event) {
        if (event == null || !supports(event.getEventType())) {
            throw new IllegalArgumentException("Unsupported reminder source event");
        }
        if (event.getFarmId() == null) {
            throw new IllegalArgumentException("Reminder source event must have a farm ID");
        }
        // Reconciliation is idempotent by rule key; a dispatcher retry only repeats the projection update.
        reminders.reconcileFarm(event.getFarmId());
    }
}
