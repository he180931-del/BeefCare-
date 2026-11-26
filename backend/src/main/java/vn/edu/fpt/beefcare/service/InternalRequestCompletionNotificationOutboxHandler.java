package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.InternalRequestRepository;

/** Delivers the JOB-07 CS notice after a named PM/SA completes an internal request. */
@Service
public class InternalRequestCompletionNotificationOutboxHandler implements OutboxEventHandler {
    public static final String EVENT_TYPE = "JOB07_INTERNAL_REQUEST_COMPLETED_NOTICE";

    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;
    private final InternalRequestRepository requests;
    private final SupportTicketNotificationRecipientResolver notificationRecipients;
    private final NotificationTargetAccessService targetAccess;
    private final NotificationService notifications;

    public InternalRequestCompletionNotificationOutboxHandler(ObjectMapper objectMapper, EntityManager entityManager,
        InternalRequestRepository requests, SupportTicketNotificationRecipientResolver notificationRecipients, NotificationTargetAccessService targetAccess,
        NotificationService notifications) {
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
        this.requests = requests;
        this.notificationRecipients = notificationRecipients;
        this.targetAccess = targetAccess;
        this.notifications = notifications;
    }

    @Override
    public boolean supports(String eventType) {
        return EVENT_TYPE.equals(eventType);
    }

    @Override
    @Transactional
    public void handle(OutboxEvent event) throws Exception {
        if (event == null || !supports(event.getEventType()) || !"InternalRequest".equals(event.getAggregateType()) || event.getId() == null) {
            throw new IllegalStateException("Unsupported internal request completion notification event");
        }
        Long requestId = positiveLong(event.getAggregateId(), "aggregateId");
        JsonNode payload = objectMapper.readTree(event.getPayloadJson());
        Long ticketId = positiveLong(payload.path("ticketId").asText(null), "ticketId");
        int requestVersion = payload.path("requestVersion").asInt(-1);
        if (!"COMPLETED".equals(payload.path("action").asText(null)) || requestVersion < 0) {
            throw new IllegalStateException("Invalid internal request completion payload");
        }

        InternalRequest observed = requests.findById(requestId)
            .orElseThrow(() -> new IllegalStateException("Internal request completion target is missing"));
        if (observed.getTicket() == null || observed.getTicket().getId() == null) {
            throw new IllegalStateException("Internal request completion ticket is missing");
        }
        // Match completion command lock order: ticket first, then the request row.
        SupportTicket lockedTicket = entityManager.find(SupportTicket.class, observed.getTicket().getId(), LockModeType.PESSIMISTIC_WRITE);
        if (lockedTicket == null) throw new IllegalStateException("Internal request completion ticket is missing");
        // find(..., lockMode) may return an already-managed ticket loaded with the request above;
        // refresh after acquiring the lock so recipient resolution sees a concurrent CS handover.
        entityManager.refresh(lockedTicket, LockModeType.PESSIMISTIC_WRITE);
        entityManager.lock(observed, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(observed);
        InternalRequest request = observed;
        if (!"DONE".equals(request.getState()) || !Integer.valueOf(requestVersion).equals(request.getVersion())) return;
        SupportTicket ticket = request.getTicket();
        if (ticket == null || ticket.getId() == null || !ticketId.equals(ticket.getId())) {
            throw new IllegalStateException("Internal request completion ticket does not match its event");
        }
        for (AppUser recipient : notificationRecipients.currentCsRecipients(ticket)) {
            if (!targetAccess.canOpenSupportTicket(recipient, ticketId)) continue;
            notifications.notify(
                recipient,
                "SUPPORT",
                "SUPPORT_TICKET",
                ticketId,
                "Yêu cầu nội bộ " + request.getCode() + " đã có kết quả",
                "Trạng thái yêu cầu: DONE",
                "JOB07:INTERNAL_REQUEST_COMPLETED:" + event.getId()
            );
        }
    }

    private static Long positiveLong(String raw, String field) {
        try {
            long value = Long.parseLong(raw);
            if (value > 0) return value;
        } catch (NumberFormatException ignored) {}
        throw new IllegalStateException("Invalid internal request completion " + field);
    }
}
