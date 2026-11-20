package vn.edu.fpt.beefcare.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.repository.NotificationRepository;

/** Persisted, recipient-scoped notifications. The event key prevents duplicate notices on retried domain events. */
@Service
public class NotificationService {
    private final NotificationRepository repository;
    private final FarmAccessService access;
    private final FarmClock clock;
    private final NotificationTargetAccessService targetAccess;
    public NotificationService(NotificationRepository repository,FarmAccessService access,FarmClock clock,NotificationTargetAccessService targetAccess){this.repository=repository;this.access=access;this.clock=clock;this.targetAccess=targetAccess;}

    @Transactional
    public Notification notify(AppUser recipient,String category,String targetType,Long targetId,String title,String summary,String eventKey) {
        if(recipient==null||recipient.getId()==null||blank(category)||blank(targetType)||targetId==null||blank(title)||blank(eventKey))throw new IllegalArgumentException("Recipient, category, target, title and event key are required");
        if(category.length()>40||targetType.length()>50||title.length()>200||(summary!=null&&summary.length()>500)||eventKey.length()>120)throw new IllegalArgumentException("Notification fields exceed storage limits");
        return repository.findByEventKeyAndRecipient_Id(eventKey,recipient.getId()).orElseGet(()->{
            Notification n=new Notification();n.setRecipient(recipient);n.setCategory(category);n.setTargetType(targetType);n.setTargetId(targetId);n.setTitle(title);n.setSummary(summary);n.setEventKey(eventKey);n.setCreatedTime(clock.now());
            // A concurrent duplicate hits the unique constraint; the outbox retry then reads this row and no-ops.
            return repository.saveAndFlush(n);
        });
    }

    @Transactional(readOnly=true)
    public List<NotificationView> mine(){AppUser user=access.currentActiveUser();return repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(user.getId()).stream().filter(n->targetAccess.canOpen(user,n)).map(NotificationView::from).toList();}

    @Transactional
    public int markAllAsRead() {
        AppUser user = access.currentActiveUser();
        List<Notification> unread = repository.findAllByRecipient_IdOrderByCreatedTimeDescIdDesc(user.getId()).stream()
            .filter(notification -> notification.getReadTime() == null)
            .toList();

        Map<Long, InternalRequest> lockedRequests = targetAccess.lockInternalRequestsForRead(
            unread.stream().filter(NotificationService::targetsInternalRequest).map(Notification::getTargetId).filter(id -> id != null).toList()
        );
        List<Notification> accessible = unread.stream().filter(notification -> canOpenCurrentTarget(user, notification, lockedRequests)).toList();
        if (accessible.isEmpty()) return 0;

        Instant now = clock.now();
        accessible.forEach(notification -> notification.setReadTime(now));
        repository.saveAll(accessible);
        return accessible.size();
    }

    @Transactional
    public NotificationView markRead(Long id) {
        AppUser user = access.currentActiveUser();
        Notification notification = repository.findByIdAndRecipient_Id(id, user.getId())
            .orElseThrow(() -> DomainException.notFound(MessageCodes.COM_08));
        Map<Long, InternalRequest> lockedRequests = targetAccess.lockInternalRequestsForRead(
            targetsInternalRequest(notification) && notification.getTargetId() != null ? List.of(notification.getTargetId()) : List.of()
        );
        requireCurrentTargetAccess(user, notification, lockedRequests);
        if (notification.getReadTime() == null) notification.setReadTime(clock.now());
        return NotificationView.from(repository.save(notification));
    }

    private boolean canOpenCurrentTarget(AppUser user, Notification notification, Map<Long, InternalRequest> lockedRequests) {
        if (!targetsInternalRequest(notification)) return targetAccess.canOpen(user, notification);
        InternalRequest request = lockedRequests.get(notification.getTargetId());
        return targetAccess.canOpenInternalRequest(user, request);
    }

    private void requireCurrentTargetAccess(AppUser user, Notification notification, Map<Long, InternalRequest> lockedRequests) {
        if (!targetsInternalRequest(notification)) {
            if (!targetAccess.canOpen(user, notification)) throw DomainException.notFound(MessageCodes.COM_08);
            return;
        }

        InternalRequest request = lockedRequests.get(notification.getTargetId());
        if (request == null) throw DomainException.notFound(MessageCodes.COM_08);
        Long currentRecipientId = request.getRecipient() == null ? null : request.getRecipient().getId();
        if (currentRecipientId == null || !currentRecipientId.equals(user.getId())) {
            if (isInternalRequestRole(request.getTargetRole()) && targetAccess.hasActiveInternalRequestRole(user)) {
                throw DomainException.notFound(MessageCodes.FE20_19);
            }
            throw DomainException.notFound(MessageCodes.COM_08);
        }
        if (!targetAccess.canOpenInternalRequest(user, request)) throw DomainException.notFound(MessageCodes.COM_08);
    }

    private static boolean targetsInternalRequest(Notification notification) {
        return notification.getTargetType() != null && "INTERNAL_REQUEST".equalsIgnoreCase(notification.getTargetType());
    }

    private static boolean isInternalRequestRole(String role) {
        return role != null && ("PM".equalsIgnoreCase(role.trim()) || "SA".equalsIgnoreCase(role.trim()));
    }

    public record NotificationView(Long id,String category,String title,String summary,String targetType,Long targetId,Instant createdTime,Instant readTime){
        static NotificationView from(Notification n){return new NotificationView(n.getId(),n.getCategory(),n.getTitle(),n.getSummary(),n.getTargetType(),n.getTargetId(),n.getCreatedTime(),n.getReadTime());}
    }
    private static boolean blank(String s){return s==null||s.isBlank();}
}
