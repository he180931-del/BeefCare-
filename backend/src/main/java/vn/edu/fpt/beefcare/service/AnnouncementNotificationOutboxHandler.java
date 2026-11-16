package vn.edu.fpt.beefcare.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AnnouncementRecipient;
import vn.edu.fpt.beefcare.domain.AnnouncementVersion;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Farm;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.OutboxEvent;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.repository.AnnouncementRecipientRepository;
import vn.edu.fpt.beefcare.repository.AnnouncementVersionRepository;
import vn.edu.fpt.beefcare.repository.FarmMembershipRepository;

/** Delivers FE-07's immutable audience snapshot as one recipient-scoped in-app notice per event. */
@Service
public class AnnouncementNotificationOutboxHandler implements OutboxEventHandler {
    private static final String PUBLISHED = "ANNOUNCEMENT_PUBLISHED";
    private static final String CORRECTED = "ANNOUNCEMENT_CORRECTED";
    private static final String VERSION_AGGREGATE = "AnnouncementVersion";
    private static final String ACTIVE = "ACTIVE";
    private static final String NOTIFICATION_CATEGORY = "ANNOUNCEMENT";
    private static final String EVENT_KEY_PREFIX = "JOB07:ANNOUNCEMENT:";
    private static final String TARGET_TYPE = "ANNOUNCEMENT_VERSION";

    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;
    private final AnnouncementVersionRepository versions;
    private final AnnouncementRecipientRepository recipients;
    private final FarmMembershipRepository memberships;
    private final NotificationService notifications;

    public AnnouncementNotificationOutboxHandler(
        ObjectMapper objectMapper,
        EntityManager entityManager,
        AnnouncementVersionRepository versions,
        AnnouncementRecipientRepository recipients,
        FarmMembershipRepository memberships,
        NotificationService notifications
    ) {
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
        this.versions = versions;
        this.recipients = recipients;
        this.memberships = memberships;
        this.notifications = notifications;
    }

    @Override
    public boolean supports(String eventType) {
        return PUBLISHED.equals(eventType) || CORRECTED.equals(eventType);
    }

    /**
     * Runs in its own transaction. If any persistence/provider-independent step fails, the dispatcher can retry the
     * event. NotificationService uses recipient + this event ID as its idempotency key, so a retry after commit but
     * before outbox acknowledgement reuses each already-created row.
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void handle(OutboxEvent event) throws Exception {
        Long versionId = eventVersionId(event);
        AnnouncementVersion version = versions.findById(versionId)
            .orElseThrow(() -> new IllegalStateException("Announcement outbox version does not exist"));
        Farm farm = version.getAnnouncement().getFarm();
        Long announcementId = version.getAnnouncement().getId();
        if (event.getFarmId() == null || !event.getFarmId().equals(farm.getId())) {
            throw new IllegalStateException("Announcement outbox farm does not match its version");
        }

        List<AnnouncementRecipient> snapshot = recipients.findSnapshotByVersion_Id(versionId).stream()
            .sorted(Comparator.comparing((AnnouncementRecipient delivery) -> delivery.getMembership().getId()))
            .toList();
        validatePayload(event, versionId, announcementId, snapshot.size());

        // A suspended farm has revoked announcement access. Close the event without creating notices; inbox reads
        // also recheck the farm's current service status.
        if (!ACTIVE.equalsIgnoreCase(farm.getServiceStatus())) return;

        String summary = summary(farm, event.getEventType(), version.getVersionNo());
        String title = limitTitle(version.getTitle());
        String eventKey = EVENT_KEY_PREFIX + event.getId();
        for (AnnouncementRecipient delivery : snapshot) {
            Long membershipId = delivery.getMembership().getId();
            FarmMembership member = memberships.lockByIdAndFarmId(membershipId, farm.getId()).orElse(null);
            if (member == null) continue;
            // Re-read while holding the membership lock, which is also used by role and status changes. This keeps
            // revocation from racing between the access check and notification insert.
            entityManager.refresh(member, LockModeType.PESSIMISTIC_WRITE);
            if (!currentlyEligible(member)) continue;

            AppUser recipient = member.getUser();
            notifications.notify(
                recipient,
                NOTIFICATION_CATEGORY,
                TARGET_TYPE,
                versionId,
                title,
                summary,
                eventKey
            );
        }
    }

    private Long eventVersionId(OutboxEvent event) {
        if (!supports(event.getEventType()) || !VERSION_AGGREGATE.equals(event.getAggregateType()) || event.getId() == null) {
            throw new IllegalStateException("Unsupported announcement outbox contract");
        }
        try {
            return Long.valueOf(event.getAggregateId());
        } catch (RuntimeException invalidId) {
            throw new IllegalStateException("Announcement outbox aggregate ID is invalid", invalidId);
        }
    }

    private void validatePayload(OutboxEvent event, Long versionId, Long announcementId, int snapshotCount) throws Exception {
        JsonNode payload = objectMapper.readTree(event.getPayloadJson());
        if (
            !payload.path("versionId").canConvertToLong() || payload.path("versionId").longValue() != versionId ||
            !payload.path("announcementId").canConvertToLong() || payload.path("announcementId").longValue() != announcementId ||
            !payload.path("recipientCount").canConvertToInt() || payload.path("recipientCount").intValue() != snapshotCount
        ) {
            throw new IllegalStateException("Announcement outbox payload does not match its persisted recipient snapshot");
        }
    }

    private boolean currentlyEligible(FarmMembership member) {
        if (!ACTIVE.equalsIgnoreCase(member.getStatus())) return false;
        FarmRole role = FarmAccessService.parseRole(member.getRole());
        if (role != FarmRole.MANAGER && role != FarmRole.TECHNICIAN) return false;

        AppUser recipient = member.getUser();
        if (recipient == null || !ACTIVE.equalsIgnoreCase(recipient.getAccountStatus())) return false;
        PlatformStaffAccess platformAccess = recipient.getPlatformStaffAccess();
        return platformAccess == null || !ACTIVE.equalsIgnoreCase(platformAccess.getStatus());
    }

    private String summary(Farm farm, String eventType, Integer versionNo) {
        String action = CORRECTED.equals(eventType) ? "Đính chính" : "Thông báo mới";
        return "Trại " + farm.getName() + " · " + action + " · phiên bản " + versionNo;
    }

    private String limitTitle(String title) {
        String value = title == null || title.isBlank() ? "Thông báo trại" : title.trim();
        return value.length() <= 200 ? value : value.substring(0, 200);
    }
}
