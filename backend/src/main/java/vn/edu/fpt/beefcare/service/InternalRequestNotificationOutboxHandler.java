package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.repository.InternalRequestRepository;

/** Delivers the named-recipient JOB-07 notices for internal support requests. */
@Service
public class InternalRequestNotificationOutboxHandler implements OutboxEventHandler {
    public static final String EVENT_TYPE = "JOB07_INTERNAL_REQUEST_NOTICE";
    private static final String AGGREGATE_TYPE = "InternalRequest";

    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;
    private final InternalRequestRepository requests;
    private final NotificationTargetAccessService targetAccess;
    private final NotificationService notifications;

    public InternalRequestNotificationOutboxHandler(ObjectMapper objectMapper, EntityManager entityManager, InternalRequestRepository requests,
        NotificationTargetAccessService targetAccess, NotificationService notifications) {
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
        this.requests = requests;
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
        if (event == null || !supports(event.getEventType()) || !AGGREGATE_TYPE.equals(event.getAggregateType()) || event.getId() == null) {
            throw new IllegalStateException("Unsupported internal request notification event");
        }
        Long requestId = positiveLong(event.getAggregateId(), "aggregateId");
        JsonNode payload = objectMapper.readTree(event.getPayloadJson());
        Long recipientId = positiveLong(payload.path("recipientId").asText(null), "recipientId");
        String action = payload.path("action").asText(null);
        int requestVersion = payload.path("requestVersion").asInt(-1);
        if (requestVersion < 0 || !("CREATED".equals(action) || "REASSIGNED".equals(action) || "CANCELLED".equals(action))) {
            throw new IllegalStateException("Invalid internal request notification payload");
        }

        InternalRequest observed = requests.findById(requestId)
            .orElseThrow(() -> new IllegalStateException("Internal request notification target is missing"));
        if (observed.getTicket() == null || observed.getTicket().getId() == null) {
            throw new IllegalStateException("Internal request notification ticket is missing");
        }
        // Match command lock order: ticket first, then the mutable assignment row.
        SupportTicket ticket = entityManager.find(SupportTicket.class, observed.getTicket().getId(), LockModeType.PESSIMISTIC_WRITE);
        if (ticket == null) throw new IllegalStateException("Internal request notification ticket is missing");
        entityManager.lock(observed, LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(observed);
        InternalRequest request = observed;
        if (request.getVersion() == null || request.getVersion() != requestVersion) return;
        if (request.getRecipient() == null || !recipientId.equals(request.getRecipient().getId())) return;
        if (("CREATED".equals(action) || "REASSIGNED".equals(action)) && !"OPEN".equals(request.getState())) return;
        if ("CANCELLED".equals(action) && !"CANCELLED".equals(request.getState())) return;
        if (!targetAccess.canOpenInternalRequest(request.getRecipient(), requestId)) return;

        notifications.notify(
            request.getRecipient(),
            "SUPPORT",
            "INTERNAL_REQUEST",
            requestId,
            title(request, action),
            "Trạng thái: " + request.getState(),
            "JOB07:INTERNAL_REQUEST:" + event.getId()
        );
    }

    private static String title(InternalRequest request, String action) {
        return switch (action) {
            case "CANCELLED" -> "Yêu cầu nội bộ " + request.getCode() + " đã bị hủy";
            case "REASSIGNED" -> "Bạn được giao yêu cầu nội bộ " + request.getCode();
            default -> "Bạn có yêu cầu nội bộ mới " + request.getCode();
        };
    }

    private static Long positiveLong(String raw, String field) {
        try {
            long value = Long.parseLong(raw);
            if (value > 0) return value;
        } catch (NumberFormatException ignored) {}
        throw new IllegalStateException("Invalid internal request notification " + field);
    }
}
