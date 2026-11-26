package vn.edu.fpt.beefcare.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.FarmMembership;
import vn.edu.fpt.beefcare.domain.InternalRequest;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.domain.PlatformStaffAccess;
import vn.edu.fpt.beefcare.domain.SupportTicket;
import vn.edu.fpt.beefcare.domain.enumeration.FarmRole;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.*;

/** Rechecks target ownership/assignment at inbox read time; revoked targets disappear from the inbox response. */
@Service
public class NotificationTargetAccessService {
    private final EntityManager entityManager;
    private final FarmAccessService farmAccess;
    private final PlatformAccessService platformAccess;
    private final SupportTicketRepository tickets;
    private final InternalRequestRepository requests;
    private final FeedReceiptRepository feedReceipts;
    private final FeedItemRepository feeds;
    private final FeedingRecordRepository feedingRecords;
    private final PaymentRepository payments;
    private final AnnouncementVersionRepository announcementVersions;
    private final AnnouncementRecipientRepository announcementRecipients;
    private final FarmMembershipRepository memberships;
    private final PlatformStaffAccessRepository platformStaffAccesses;
    public NotificationTargetAccessService(EntityManager entityManager,FarmAccessService farmAccess,PlatformAccessService platformAccess,SupportTicketRepository tickets,
        InternalRequestRepository requests,FeedReceiptRepository feedReceipts,FeedItemRepository feeds,FeedingRecordRepository feedingRecords,
        PaymentRepository payments,AnnouncementVersionRepository announcementVersions,AnnouncementRecipientRepository announcementRecipients,
        FarmMembershipRepository memberships,PlatformStaffAccessRepository platformStaffAccesses){
        this.entityManager=entityManager;this.farmAccess=farmAccess;this.platformAccess=platformAccess;this.tickets=tickets;this.requests=requests;this.feedReceipts=feedReceipts;this.feeds=feeds;this.feedingRecords=feedingRecords;
        this.payments=payments;this.announcementVersions=announcementVersions;this.announcementRecipients=announcementRecipients;this.memberships=memberships;this.platformStaffAccesses=platformStaffAccesses;
    }
    @Transactional(readOnly=true)
    public boolean canOpen(AppUser actor,Notification notification){
        String type=notification.getTargetType().toUpperCase(Locale.ROOT);Long id=notification.getTargetId();
        try {
            return switch(type){
                case "FARM","SUBSCRIPTION","FARM_SERVICE" -> farmAccess.require(id,FarmAction.VIEW_FARM_INFORMATION).user().getId().equals(actor.getId());
                case "FEED_ITEM" -> feeds.findById(id).map(f->farmAccess.require(f.getFarm().getId(),FarmAction.VIEW_FEED).user().getId().equals(actor.getId())).orElse(false);
                case "FEED_RECEIPT" -> feedReceipts.findById(id).map(r->farmAccess.require(r.getFarm().getId(),FarmAction.MANAGE_FEED).user().getId().equals(actor.getId())).orElse(false);
                case "FEEDING_RECORD" -> feedingRecords.findById(id).map(r->farmAccess.require(r.getFarm().getId(),FarmAction.VIEW_FEED).user().getId().equals(actor.getId())).orElse(false);
                case "PAYMENT" -> payments.findById(id).map(p -> p.getRequestedBy().getId().equals(actor.getId()) &&
                    farmAccess.require(p.getSubscription().getFarm().getId(),FarmAction.VIEW_FARM_INFORMATION).user().getId().equals(actor.getId())).orElse(false);
                case "SUPPORT_TICKET" -> canOpenSupportTicket(actor,id);
                case "INTERNAL_REQUEST" -> canOpenInternalRequest(actor,id);
                case "ANNOUNCEMENT_VERSION" -> announcementVersions.findById(id).map(version -> {
                    Long farmId = version.getAnnouncement().getFarm().getId();
                    if (!farmAccess.require(farmId, FarmAction.VIEW_ANNOUNCEMENTS).user().getId().equals(actor.getId())) return false;
                    FarmMembership membership = memberships
                        .findFirstByFarmIdAndUserIdAndStatusIgnoreCase(farmId, actor.getId(), "ACTIVE")
                        .orElse(null);
                    if (membership == null || hasActivePlatformRole(actor)) return false;
                    FarmRole role = FarmAccessService.parseRole(membership.getRole());
                    if (role != FarmRole.MANAGER && role != FarmRole.TECHNICIAN) return false;
                    return announcementRecipients.existsByVersion_IdAndMembership_Id(version.getId(), membership.getId());
                }).orElse(false);
                case "BANK_TRANSFER_EVIDENCE","EVIDENCE_REVIEW","RECONCILIATION" -> {platformAccess.requireRole(PlatformRole.PM);yield true;}
                default -> false;
            };
        } catch (DomainException denied) { return false; }
    }

    /** Background JOB-07 delivery and inbox reads share the current named-recipient/role check. */
    @Transactional(readOnly=true)
    public boolean canOpenInternalRequest(AppUser actor,Long requestId){
        if(actor==null||actor.getId()==null||requestId==null)return false;
        return requests.findById(requestId).map(request -> canOpenInternalRequest(actor,request)).orElse(false);
    }

    /**
     * Locks current internal-request assignments using the same ticket → request order as
     * InternalSupportRequestService.manage. For read-all, every ticket is locked in ascending
     * ID order before any request, then requests are locked by ticket ID and request ID.
     */
    @Transactional
    public Map<Long, InternalRequest> lockInternalRequestsForRead(Collection<Long> requestIds) {
        if (requestIds == null || requestIds.isEmpty()) return Map.of();

        Map<Long, ObservedInternalRequest> observed = new LinkedHashMap<>();
        for (Long requestId : new TreeSet<>(requestIds.stream().filter(id -> id != null).toList())) {
            InternalRequest request = entityManager.find(InternalRequest.class, requestId);
            if (request == null || request.getTicket() == null || request.getTicket().getId() == null) continue;
            observed.put(requestId, new ObservedInternalRequest(request, request.getTicket().getId()));
        }

        TreeSet<Long> ticketIds = new TreeSet<>();
        observed.values().forEach(item -> ticketIds.add(item.ticketId()));
        TreeSet<Long> lockedTicketIds = new TreeSet<>();
        for (Long ticketId : ticketIds) {
            SupportTicket ticket = entityManager.find(SupportTicket.class, ticketId);
            if (ticket == null) continue;
            entityManager.refresh(ticket, LockModeType.PESSIMISTIC_WRITE);
            lockedTicketIds.add(ticketId);
        }

        Map<Long, InternalRequest> locked = new LinkedHashMap<>();
        observed.entrySet().stream()
            .sorted(Comparator.<Map.Entry<Long, ObservedInternalRequest>, Long>comparing(entry -> entry.getValue().ticketId())
                .thenComparing(Map.Entry::getKey))
            .filter(entry -> lockedTicketIds.contains(entry.getValue().ticketId()))
            .forEach(entry -> {
                InternalRequest request = entry.getValue().request();
                entityManager.refresh(request, LockModeType.PESSIMISTIC_WRITE);
                // The request's ticket is immutable in the command workflow. If that invariant
                // ever changes concurrently, fail closed rather than authorizing under a wrong lock.
                if (!entry.getValue().ticketId().equals(request.getTicket().getId())) {
                    throw new IllegalStateException("Internal request ticket changed while locking its assignment");
                }
                locked.put(entry.getKey(), request);
            });
        return Map.copyOf(locked);
    }

    /** Rechecks the actor against the request after the caller has acquired its ticket/request locks. */
    @Transactional(readOnly=true)
    public boolean canOpenInternalRequest(AppUser actor, InternalRequest request) {
        if (actor == null || actor.getId() == null || request == null || request.getId() == null ||
            request.getRecipient() == null || !request.getRecipient().getId().equals(actor.getId()) || request.getTargetRole() == null) return false;
        PlatformRole role;
        try { role = PlatformRole.valueOf(request.getTargetRole().trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException invalidRole) { return false; }
        if (role != PlatformRole.PM && role != PlatformRole.SA) return false;
        return hasActivePlatformRole(actor, role);
    }

    /** A former recipient may learn only that an assignment changed while they still hold an active PM/SA role. */
    @Transactional(readOnly=true)
    public boolean hasActiveInternalRequestRole(AppUser actor) {
        if (actor == null || actor.getId() == null || !"ACTIVE".equalsIgnoreCase(actor.getAccountStatus())) return false;
        PlatformStaffAccess access = platformStaffAccesses.findOneByUserIdAndStatusIgnoreCase(actor.getId(), "ACTIVE").orElse(null);
        if (access == null || access.getRole() == null || access.getUser() == null ||
            !"ACTIVE".equalsIgnoreCase(access.getUser().getAccountStatus())) return false;
        try {
            PlatformRole role = PlatformRole.valueOf(access.getRole().trim().toUpperCase(Locale.ROOT));
            return role == PlatformRole.PM || role == PlatformRole.SA;
        } catch (IllegalArgumentException invalidRole) {
            return false;
        }
    }

    /** CS can open the support queue before assignment; PM and SA never inherit ticket access. */
    @Transactional(readOnly=true)
    public boolean canOpenSupportTicket(AppUser actor,Long ticketId){
        if(actor==null||actor.getId()==null||ticketId==null)return false;
        return tickets.findById(ticketId).map(ticket->{
            if(ticket.getRequester()!=null&&ticket.getRequester().getId().equals(actor.getId()))return true;
            return hasActivePlatformRole(actor,PlatformRole.CS);
        }).orElse(false);
    }

    private boolean hasActivePlatformRole(AppUser actor) {
        var staffAccess = actor.getPlatformStaffAccess();
        return staffAccess != null && "ACTIVE".equalsIgnoreCase(staffAccess.getStatus());
    }

    private boolean hasActivePlatformRole(AppUser actor,PlatformRole role){
        PlatformStaffAccess access=platformStaffAccesses.findOneByUserIdAndStatusIgnoreCase(actor.getId(),"ACTIVE").orElse(null);
        return access!=null&&access.getRole()!=null&&role.name().equalsIgnoreCase(access.getRole().trim())&&
            access.getUser()!=null&&"ACTIVE".equalsIgnoreCase(access.getUser().getAccountStatus());
    }

    private record ObservedInternalRequest(InternalRequest request, Long ticketId) {}
}
