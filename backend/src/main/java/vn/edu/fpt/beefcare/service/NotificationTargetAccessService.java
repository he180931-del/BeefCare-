package vn.edu.fpt.beefcare.service;

import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.fpt.beefcare.domain.AppUser;
import vn.edu.fpt.beefcare.domain.Notification;
import vn.edu.fpt.beefcare.domain.enumeration.PlatformRole;
import vn.edu.fpt.beefcare.repository.*;

/** Rechecks target ownership/assignment at inbox read time; revoked targets disappear from the inbox response. */
@Service
public class NotificationTargetAccessService {
    private final FarmAccessService farmAccess;
    private final PlatformAccessService platformAccess;
    private final SupportTicketRepository tickets;
    private final InternalRequestRepository requests;
    private final FeedReceiptRepository feedReceipts;
    private final FeedItemRepository feeds;
    private final FeedingRecordRepository feedingRecords;
    private final PaymentRepository payments;
    public NotificationTargetAccessService(FarmAccessService farmAccess,PlatformAccessService platformAccess,SupportTicketRepository tickets,
        InternalRequestRepository requests,FeedReceiptRepository feedReceipts,FeedItemRepository feeds,FeedingRecordRepository feedingRecords,
        PaymentRepository payments){
        this.farmAccess=farmAccess;this.platformAccess=platformAccess;this.tickets=tickets;this.requests=requests;this.feedReceipts=feedReceipts;this.feeds=feeds;this.feedingRecords=feedingRecords;
        this.payments=payments;
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
                case "SUPPORT_TICKET" -> tickets.findById(id).map(t->{
                    if(t.getRequester()!=null&&t.getRequester().getId().equals(actor.getId()))return true;
                    // CS can open queue notifications even before assignment; PM and SA do not inherit ticket access.
                    platformAccess.requireRole(PlatformRole.CS);
                    return true;
                }).orElse(false);
                case "INTERNAL_REQUEST" -> requests.findById(id).map(r->{
                    if(r.getRecipient()==null||!r.getRecipient().getId().equals(actor.getId())||r.getTargetRole()==null)return false;
                    PlatformRole role;try{role=PlatformRole.valueOf(r.getTargetRole().trim().toUpperCase(Locale.ROOT));}catch(IllegalArgumentException invalidRole){return false;}
                    platformAccess.requireRole(role);
                    return true;
                }).orElse(false);
                case "BANK_TRANSFER_EVIDENCE","EVIDENCE_REVIEW","RECONCILIATION" -> {platformAccess.requireRole(PlatformRole.PM);yield true;}
                default -> false;
            };
        } catch (DomainException denied) { return false; }
    }
}
